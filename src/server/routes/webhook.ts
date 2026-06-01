import { Router, Request, Response } from "express";
import { verifyIdentity } from "../services/auth.js";
import { checkRateLimit } from "../services/rateLimiter.js";
import { clearCache, getChannelId, getChannelToken, getTodaysWord } from "../services/sheets.js";

const router = Router();

router.post("/webhook", async (req: Request, res: Response) => {
  // Verify Vapi shared secret to reject unauthenticated callers
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret || req.headers["x-vapi-secret"] !== secret) {
    res.sendStatus(401);
    return;
  }

  const message = req.body?.message;

  if (message?.type !== "tool-calls") {
    res.sendStatus(200);
    return;
  }

  const toolCall = message.toolCallList?.[0];
  if (!toolCall || toolCall.function?.name !== "verify_identity") {
    res.sendStatus(200);
    return;
  }

  const callerNumber: string = message.call?.customer?.number ?? "unknown";
  const raw = toolCall.function.arguments;

  let args: Record<string, unknown> = {};
  try {
    args = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
  } catch {
    res.sendStatus(400);
    return;
  }

  const input: string = typeof args.input === "string" ? args.input : "";

  const rateLimit = checkRateLimit(callerNumber);
  if (!rateLimit.allowed) {
    const mins = Math.floor(rateLimit.msRemaining / 60000);
    const secs = Math.ceil((rateLimit.msRemaining % 60000) / 1000);
    const timeLeft = mins > 0 ? `${mins} minute${mins !== 1 ? "s" : ""} and ${secs} second${secs !== 1 ? "s" : ""}` : `${secs} second${secs !== 1 ? "s" : ""}`;
    console.log({
      timestamp: new Date().toISOString(),
      callerNumber,
      input,
      result: "rate_limited",
      msRemaining: rateLimit.msRemaining,
    });
    res.json({
      results: [{ toolCallId: toolCall.id, result: `Access denied. Too many failed attempts. Try again in ${timeLeft}.` }],
    });
    return;
  }

  let result: "granted" | "denied";
  try {
    result = await verifyIdentity(input);
  } catch (err) {
    console.error("verifyIdentity failed:", err);
    res.json({
      results: [{ toolCallId: toolCall.id, result: "Access denied." }],
    });
    return;
  }

  console.log({
    timestamp: new Date().toISOString(),
    callerNumber,
    input,
    result,
  });

  res.json({
    results: [
      {
        toolCallId: toolCall.id,
        result: result === "granted" ? "Access granted." : "Access denied.",
      },
    ],
  });
});

router.post("/sheets-webhook", (req: Request, res: Response) => {
  const incomingToken = req.headers["x-goog-channel-token"];
  const incomingChannelId = req.headers["x-goog-channel-id"];
  const state = req.headers["x-goog-resource-state"];
  const token = getChannelToken();
  const channelId = getChannelId();

  console.log("sheets-webhook received:", { incomingChannelId, incomingToken, state, expectedChannelId: channelId, tokenMatch: incomingToken === token });

  if (!token || incomingToken !== token || incomingChannelId !== channelId) {
    console.warn("sheets-webhook rejected: token or channel ID mismatch");
    res.sendStatus(401);
    return;
  }

  // "sync" is Google's initial handshake when the watch is registered — ignore it
  if (state === "update" || state === "change") {
    clearCache();
    console.log("Sheets cache cleared via push notification");
    // Delay re-fetch to allow Sheets API to propagate the change
    setTimeout(() => getTodaysWord().catch(() => {}), 4000);
  }

  res.sendStatus(200);
});

export default router;
