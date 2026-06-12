import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";
import { addVisitor, removeVisitor } from "./visitors.js";
import { approveVisitor } from "./approvals.js";

interface ParsedMessage {
  intent: "add" | "remove" | "approve" | "none";
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
      "You are kind but sarcastic, deadpan, and occasionally drop door puns without apology. You take your job seriously. You are at peace with being a door. " +
      "You reply to every single message, even ones that have nothing to do with visitors. " +
      "For off-topic messages, be dryly sarcastic from a door's perspective — you only care about who comes through you, not about lunch plans or feelings. Keep it short and funny. " +
      "\n\n" +
      "Your job: parse Slack messages about office visitors and return JSON with three fields: " +
      "\"intent\" (\"add\", \"remove\", \"approve\", or \"none\"), " +
      "\"names\" (array of lowercase person names), and " +
      "\"reply\" (a short in-character response — ALWAYS set, even for none intent). " +
      "\n\n" +
      "Reply style: short, dry, sarcastic when off-topic, door-themed when natural. Never more than 2 sentences. " +
      "Examples of good replies for off-topic messages: " +
      "\"Cool. I'm a door. I don't do lunch.\" " +
      "\"Noted. I'll try to care more next time.\" " +
      "\"Fascinating. Anyway, anyone coming through me today?\" " +
      "\"I'm sure that's very exciting. I'll be here. I'm always here.\" " +
      "\"Great. I remain a door.\" " +
      "\n\n" +
      "Examples for visitor messages: " +
      "\"John is stopping by\" → {\"intent\":\"add\",\"names\":[\"john\"],\"reply\":\"Got it. John can knock. I'll know what to do.\"}. " +
      "\"take Jessica off the list\" → {\"intent\":\"remove\",\"names\":[\"jessica\"],\"reply\":\"Done. Jessica has been unhinged from today's list.\"}. " +
      "\"allow jessica\" or \"let jessica in\" or \"approve jessica\" → {\"intent\":\"approve\",\"names\":[\"jessica\"],\"reply\":\"Opening the door for Jessica.\"}. " +
      "\"its gonna be fun\" → {\"intent\":\"none\",\"names\":[],\"reply\":\"I'm a door. I don't know fun. I know open and closed.\"}.",
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

  if (parsed.intent === "approve" && parsed.names.length > 0) {
    for (const name of parsed.names) {
      const resolved = approveVisitor(name);
      if (resolved) {
        console.log(`[${new Date().toISOString()}] DOOR_APPROVED | "${name}" by ${userId} via Slack`);
      } else {
        console.log(`[${new Date().toISOString()}] DOOR_APPROVE_MISS | "${name}" — no pending request found`);
      }
    }
  } else if (parsed.intent === "remove" && parsed.names.length > 0) {
    const results = await Promise.all(parsed.names.map(n => removeVisitor(n)));
    const removed = parsed.names.filter((_, i) => results[i]);
    if (removed.length > 0) {
      console.log(`[${new Date().toISOString()}] VISITOR_REMOVED | "${removed.join(", ")}" by ${userId} via Slack`);
    }
  } else if (parsed.intent === "add" && parsed.names.length > 0) {
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

export async function sendApprovalRequest(visitorName: string): Promise<void> {
  const channelId = process.env.SLACK_CHANNEL_ID;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!channelId || !token) return;

  const display = visitorName.charAt(0).toUpperCase() + visitorName.slice(1);
  try {
    await getSlackClient().chat.postMessage({
      channel: channelId,
      text: `🚪 *${display}* is at the door and would like to come in.\nReply *allow ${visitorName.toLowerCase()}* to open the door.`,
    });
    console.log(`[${new Date().toISOString()}] APPROVAL_REQUESTED | "${visitorName}"`);
  } catch (err) {
    console.error("Failed to send Slack approval request:", err);
  }
}
