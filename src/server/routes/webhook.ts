import { Router, Request, Response } from "express";
import { verifyIdentity, isInjectionAttempt } from "../services/auth.js";
import { logAttempt } from "../services/logger.js";

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
  logAttempt({ caller_id: callerNumber, word_spoken: input, word_expected: wordExpected, match_distance: matchDistance, granted: outcome === "granted", granted_by: grantedBy ?? null, is_injection: injection });

  res.json({
    results: [
      {
        toolCallId: toolCall.id,
        result: outcome === "granted" ? "Access granted." : "Access denied.",
      },
    ],
  });
});


export default router;
