import { Router, Request, Response } from "express";
import { verifyIdentity } from "../services/auth.js";
import { checkRateLimit } from "../services/rateLimiter.js";

const router = Router();

router.post("/webhook", async (req: Request, res: Response) => {
  // Verify Vapi shared secret to reject unauthenticated callers
  const secret = process.env.VAPI_SERVER_SECRET;
  if (secret && req.headers["x-vapi-secret"] !== secret) {
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

  if (!checkRateLimit(callerNumber)) {
    console.log({
      timestamp: new Date().toISOString(),
      callerNumber,
      input,
      result: "rate_limited",
    });
    res.json({
      results: [{ toolCallId: toolCall.id, result: "Access denied." }],
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

export default router;
