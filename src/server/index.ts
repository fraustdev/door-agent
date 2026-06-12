import "dotenv/config";
import express from "express";
import cron from "node-cron";
import webhookRouter from "./routes/webhook.js";
import { getTodaysWord } from "./services/words.js";
import { getVisitorRows } from "./services/visitors.js";
import { postMorningMessage, verifySlackRequest, handleSlackEvent, sendApprovalRequest } from "./services/slack.js";
import { waitForApproval } from "./services/approvals.js";

const app = express();

// Must be registered before express.json() to preserve raw body for signature verification
app.post("/slack/events", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody: Buffer = req.body;

  if (!verifySlackRequest(rawBody, req.headers as Record<string, string | string[] | undefined>)) {
    res.sendStatus(401);
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    res.sendStatus(400);
    return;
  }

  // Slack URL verification challenge (one-time setup)
  if (payload.type === "url_verification") {
    res.json({ challenge: payload.challenge });
    return;
  }

  res.sendStatus(200);

  if (payload.type === "event_callback") {
    const event = payload.event as Record<string, unknown>;
    handleSlackEvent(event).catch(console.error);
  }
});

app.use(express.json({ limit: "1mb" }));
app.get("/ping", (_req, res) => res.sendStatus(200));

app.get("/status", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) {
    res.sendStatus(401);
    return;
  }
  const currentWord = await getTodaysWord().catch(() => null);
  res.json({ currentWord });
});


app.post("/slack/post-morning-message", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  await postMorningMessage().catch(console.error);
  res.json({ ok: true });
});

app.get("/visitors", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  const rows = await getVisitorRows().catch(() => []);
  res.json(rows);
});

app.post("/request-approval", async (req, res) => {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret || req.headers["x-vapi-secret"] !== secret) {
    res.sendStatus(401);
    return;
  }

  const toolCall = req.body?.message?.toolCallList?.[0];
  const raw = toolCall?.function?.arguments;
  let args: Record<string, unknown> = {};
  try {
    args = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
  } catch {
    res.sendStatus(400);
    return;
  }

  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (!name) {
    res.json({ results: [{ toolCallId: toolCall?.id, result: "timed_out" }] });
    return;
  }

  await sendApprovalRequest(name);
  const approved = await waitForApproval(name, 90_000);
  console.log(`[${new Date().toISOString()}] APPROVAL_RESULT | "${name}" | ${approved ? "approved" : "timed_out"}`);

  res.json({
    results: [{ toolCallId: toolCall?.id, result: approved ? "approved" : "timed_out" }],
  });
});

app.use(webhookRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Post morning visitor check message at 8am Chicago time
cron.schedule("0 8 * * *", () => {
  postMorningMessage().catch(console.error);
}, { timezone: "America/Chicago" });
