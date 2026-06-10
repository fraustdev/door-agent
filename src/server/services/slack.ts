import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";
import { addVisitor, removeVisitor } from "./visitors.js";

interface ParsedMessage {
  intent: "add" | "remove" | "none";
  names: string[];
}

async function parseMessage(text: string): Promise<ParsedMessage> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "You parse Slack messages sent in an office door access channel. " +
      "Determine whether the message intends to ADD visitors to the access list, REMOVE someone from it, or is unrelated. " +
      "Extract only person names (first name or full name). " +
      "Return JSON only: {\"intent\": \"add\"|\"remove\"|\"none\", \"names\": [\"name1\"]}. " +
      "Examples: " +
      "\"John is stopping by\" → {\"intent\":\"add\",\"names\":[\"john\"]}. " +
      "\"take Jessica off the list\" → {\"intent\":\"remove\",\"names\":[\"jessica\"]}. " +
      "\"delete What\" → {\"intent\":\"remove\",\"names\":[\"what\"]}. " +
      "\"see you guys later\" → {\"intent\":\"none\",\"names\":[]}.",
    messages: [{ role: "user", content: text }],
  });

  const content = response.content[0];
  if (content.type !== "text") return { intent: "none", names: [] };
  try {
    const raw = content.text.match(/\{[\s\S]*\}/)?.[0] ?? content.text;
    return JSON.parse(raw) as ParsedMessage;
  } catch {
    return { intent: "none", names: [] };
  }
}

export function verifySlackRequest(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;

  const timestamp = headers["x-slack-request-timestamp"];
  const signature = headers["x-slack-signature"];
  if (!timestamp || !signature || Array.isArray(timestamp) || Array.isArray(signature)) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const base = `v0:${timestamp}:${rawBody.toString()}`;
  const computed = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

function getSlackClient(): WebClient {
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

export async function postMorningMessage(): Promise<void> {
  const channelId = process.env.SLACK_CHANNEL_ID;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!channelId || !token) {
    console.error(`[SLACK] Missing env vars — SLACK_BOT_TOKEN: ${!!token}, SLACK_CHANNEL_ID: ${!!channelId}`);
    return;
  }

  try {
    await getSlackClient().chat.postMessage({
      channel: channelId,
      text: "Any visitors today?",
    });
    console.log(`[${new Date().toISOString()}] SLACK | Morning message posted`);
  } catch (err) {
    console.error("Failed to post Slack morning message:", err);
  }
}

export async function handleSlackEvent(event: Record<string, unknown>): Promise<void> {
  if (event.type !== "message") return;
  if (event.bot_id) return;
  if (event.subtype) return;

  const text = typeof event.text === "string" ? event.text : "";
  if (!text.trim()) return;

  const channel = typeof event.channel === "string" ? event.channel : process.env.SLACK_CHANNEL_ID ?? "";
  const threadTs = typeof event.thread_ts === "string" ? event.thread_ts
    : typeof event.ts === "string" ? event.ts : undefined;
  const userId = typeof event.user === "string" ? event.user : "unknown";

  let parsed: ParsedMessage;
  try {
    parsed = await parseMessage(text);
  } catch (err) {
    console.error("Failed to parse Slack message intent:", err);
    return;
  }

  if (parsed.intent === "none" || parsed.names.length === 0) return;

  const display = parsed.names.map(n => n.charAt(0).toUpperCase() + n.slice(1));
  const nameList = display.length === 1
    ? display[0]
    : display.slice(0, -1).join(", ") + " and " + display[display.length - 1];

  let reply: string;

  if (parsed.intent === "remove") {
    const results = await Promise.all(parsed.names.map(n => removeVisitor(n)));
    const removed = parsed.names.filter((_, i) => results[i]);
    const notFound = parsed.names.filter((_, i) => !results[i]);

    if (removed.length > 0) {
      const removedDisplay = removed.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ");
      console.log(`[${new Date().toISOString()}] VISITOR_REMOVED | "${removedDisplay}" by ${userId} via Slack`);
    }

    if (notFound.length === 0) {
      reply = `Done — ${nameList} ${display.length === 1 ? "has" : "have"} been removed from today's visitor list.`;
    } else if (removed.length === 0) {
      reply = `I couldn't find ${nameList} on today's list.`;
    } else {
      const notFoundDisplay = notFound.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(", ");
      reply = `Removed what I could, but I couldn't find ${notFoundDisplay} on today's list.`;
    }
  } else {
    for (const name of parsed.names) {
      await addVisitor(name, userId);
      console.log(`[${new Date().toISOString()}] VISITOR_ADDED | "${name}" by ${userId} via Slack`);
    }
    reply = `Got it — ${nameList} ${display.length === 1 ? "has" : "have"} been added to today's visitor list.`;
  }

  try {
    await getSlackClient().chat.postMessage({ channel, thread_ts: threadTs, text: reply });
  } catch (err) {
    console.error("Failed to send Slack reply:", err);
  }
}
