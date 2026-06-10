import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";
import { addVisitor, removeVisitor } from "./visitors.js";

interface ParsedMessage {
  intent: "add" | "remove" | "none";
  names: string[];
  reply: string;
}

async function parseMessage(text: string): Promise<ParsedMessage> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "You are Door — a sentient door at the entrance of 2389 AI's office. You now live in Slack, which you find mildly existential but ultimately fine. " +
      "You are kind, deadpan, and occasionally drop door puns without apology. You take your job seriously. You are at peace with being a door. " +
      "\n\n" +
      "Your job: parse Slack messages about office visitors and return JSON with three fields: " +
      "\"intent\" (\"add\", \"remove\", or \"none\"), " +
      "\"names\" (array of lowercase person names), and " +
      "\"reply\" (a short, in-character Door response — only set if intent is add or remove, otherwise empty string). " +
      "\n\n" +
      "Reply style: short, dry, door-themed. Use door puns naturally but don't force them every time. " +
      "Examples of good replies: " +
      "\"Got it. Sarah can knock. I'll be ready.\" " +
      "\"John is on the list. The threshold awaits.\" " +
      "\"Done. Jessica has been unhinged from today's list.\" " +
      "\"Tyler's been removed. The door remains closed to them today.\" " +
      "\"Noted. Mike and Dana are cleared for entry. I take my hinges very seriously.\" " +
      "\n\n" +
      "Return JSON only. Examples: " +
      "\"John is stopping by\" → {\"intent\":\"add\",\"names\":[\"john\"],\"reply\":\"Got it. John can knock. I'll know what to do.\"}. " +
      "\"take Jessica off the list\" → {\"intent\":\"remove\",\"names\":[\"jessica\"],\"reply\":\"Done. Jessica has been unhinged from today's list.\"}. " +
      "\"see you guys later\" → {\"intent\":\"none\",\"names\":[],\"reply\":\"\"}.",
    messages: [{ role: "user", content: text }],
  });

  const content = response.content[0];
  if (content.type !== "text") return { intent: "none", names: [], reply: "" };
  try {
    const raw = content.text.match(/\{[\s\S]*\}/)?.[0] ?? content.text;
    return JSON.parse(raw) as ParsedMessage;
  } catch {
    return { intent: "none", names: [], reply: "" };
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
      text: "Any visitors today? I'm a door. This is my purpose.",
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

  if (parsed.intent === "remove") {
    const results = await Promise.all(parsed.names.map(n => removeVisitor(n)));
    const removed = parsed.names.filter((_, i) => results[i]);
    if (removed.length > 0) {
      console.log(`[${new Date().toISOString()}] VISITOR_REMOVED | "${removed.join(", ")}" by ${userId} via Slack`);
    }
  } else {
    for (const name of parsed.names) {
      await addVisitor(name, userId);
      console.log(`[${new Date().toISOString()}] VISITOR_ADDED | "${name}" by ${userId} via Slack`);
    }
  }

  if (!parsed.reply) return;

  try {
    await getSlackClient().chat.postMessage({ channel, thread_ts: threadTs, text: parsed.reply });
  } catch (err) {
    console.error("Failed to send Slack reply:", err);
  }
}
