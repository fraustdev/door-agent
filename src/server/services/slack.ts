import { WebClient } from "@slack/web-api";
import crypto from "crypto";
import { addVisitor, removeVisitor } from "./visitors.js";

const STOP_WORDS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
  "good", "morning", "afternoon", "evening", "night",
  "hey", "hi", "hello", "yes", "yeah", "nope", "sure", "ok", "okay", "great", "thanks",
  "everyone", "team", "all", "folks", "guys",
  "i", "a", "the", "an", "is", "are", "will", "be", "have", "has", "was",
  "in", "on", "at", "by", "to", "for", "with", "and", "or", "but", "so", "just",
  "coming", "visiting", "stopping", "dropping", "bringing", "swinging", "meeting",
  "office", "door", "building", "today", "tomorrow", "later", "soon", "there", "here",
  "around", "probably", "maybe", "no", "not", "also",
  "what", "about", "please", "her", "him", "them", "forget", "delete", "remove",
  "list", "that", "was", "add", "from", "don't", "doesn't", "isn't", "wasn't",
]);

export function extractNames(text: string): string[] {
  const found = new Set<string>();
  const tokens = text.trim().split(/\s+/);

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i].replace(/[^a-zA-Z'-]/g, "");
    if (
      tok.length < 2 ||
      !/^[A-Z]/.test(tok) ||
      tok === tok.toUpperCase() ||
      STOP_WORDS.has(tok.toLowerCase())
    ) {
      i++;
      continue;
    }

    const firstName = tok.toLowerCase();

    // Check if the next token could be a last name
    const next = tokens[i + 1]?.replace(/[^a-zA-Z'-]/g, "");
    if (
      next &&
      next.length >= 2 &&
      /^[A-Z]/.test(next) &&
      next !== next.toUpperCase() &&
      !STOP_WORDS.has(next.toLowerCase())
    ) {
      found.add(`${firstName} ${next.toLowerCase()}`);
      i += 2;
    } else {
      found.add(firstName);
      i++;
    }
  }

  return [...found];
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

function getClient(): WebClient {
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
    await getClient().chat.postMessage({
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

  // Check for delete/remove intent before trying to add names
  const deleteMatch = text.match(/(?:delete|remove)\s+([A-Za-z][a-zA-Z'-]*(?:\s+[A-Za-z][a-zA-Z'-]*)?)/i);
  if (deleteMatch) {
    const name = deleteMatch[1].trim().toLowerCase();
    const removed = await removeVisitor(name);
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    const reply = removed
      ? `Done — ${display} has been removed from today's visitor list.`
      : `I couldn't find ${display} on today's list.`;
    try {
      await getClient().chat.postMessage({ channel, thread_ts: threadTs, text: reply });
    } catch (err) {
      console.error("Failed to send Slack delete confirmation:", err);
    }
    return;
  }

  const names = extractNames(text);

  if (names.length === 0) return;

  for (const name of names) {
    await addVisitor(name, userId);
    console.log(`[${new Date().toISOString()}] VISITOR_ADDED | "${name}" by ${userId} via Slack`);
  }

  const display = names.map(n => n.charAt(0).toUpperCase() + n.slice(1));
  const nameList = display.length === 1
    ? display[0]
    : display.slice(0, -1).join(", ") + " and " + display[display.length - 1];
  const reply = `Got it — ${nameList} ${display.length === 1 ? "has" : "have"} been added to today's visitor list.`;

  try {
    await getClient().chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: reply,
    });
  } catch (err) {
    console.error("Failed to send Slack acknowledgement:", err);
  }
}
