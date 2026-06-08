import { Router, Request, Response } from "express";
import { verifyIdentity, isInjectionAttempt } from "../services/auth.js";
import { logAttempt } from "../services/logger.js";
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

  if (input.length > 100) {
    res.json({
      results: [{ toolCallId: toolCall.id, result: "Access denied." }],
    });
    return;
  }

  const injection = isInjectionAttempt(input);

  const rateLimit = checkRateLimit(callerNumber);
  if (!rateLimit.allowed) {
    const mins = Math.floor(rateLimit.msRemaining / 60000);
    const secs = Math.ceil((rateLimit.msRemaining % 60000) / 1000);
    const timeLeft = mins > 0 ? `${mins} minute${mins !== 1 ? "s" : ""} and ${secs} second${secs !== 1 ? "s" : ""}` : `${secs} second${secs !== 1 ? "s" : ""}`;
    console.log(`[${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}] RATE_LIMITED | ${callerNumber} | "${input}" | retry in ${timeLeft}`);
    logAttempt({ caller_id: callerNumber, word_spoken: input, word_expected: null, match_distance: null, granted: false, locked_out: true, is_injection: injection });
    res.json({
      results: [{ toolCallId: toolCall.id, result: `Access denied. Too many failed attempts. Try again in ${timeLeft}.` }],
    });
    return;
  }

  let authResult: Awaited<ReturnType<typeof verifyIdentity>>;
  try {
    authResult = await verifyIdentity(input);
  } catch (err) {
    console.error("verifyIdentity failed:", err);
    res.json({
      results: [{ toolCallId: toolCall.id, result: "Access denied." }],
    });
    return;
  }

  const { outcome, wordExpected, matchDistance, grantedBy } = authResult;
  const logLabel = injection ? "INJECTION" : outcome.toUpperCase();
  console.log(`[${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}] ${logLabel} | ${callerNumber} | "${input}"`);
  logAttempt({ caller_id: callerNumber, word_spoken: input, word_expected: wordExpected, match_distance: matchDistance, granted: outcome === "granted", locked_out: false, granted_by: grantedBy ?? null, is_injection: injection });

  res.json({
    results: [
      {
        toolCallId: toolCall.id,
        result: outcome === "granted" ? "Access granted." : "Access denied.",
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

  if (!token || incomingToken !== token || incomingChannelId !== channelId) {
    res.sendStatus(401);
    return;
  }

  // "sync" is Google's initial handshake when the watch is registered — ignore it
  if (state === "update" || state === "change") {
    clearCache();
    console.log("Sheets cache cleared via push notification");
    // Force re-fetch after delay to allow Sheets API to propagate the change
    setTimeout(() => getTodaysWord(true).then(word => console.log(`Sheets cache updated — current word: "${word}"`)).catch(() => {}), 4000);
  }

  res.sendStatus(200);
});

export default router;
