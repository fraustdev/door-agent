import "dotenv/config";
import express from "express";
import cron from "node-cron";
import webhookRouter from "./routes/webhook.js";
import { registerWatch, getTodaysWord, setTodaysWord } from "./services/sheets.js";
import { getActiveLockouts } from "./services/rateLimiter.js";
import { getVisitorRows } from "./services/visitors.js";
import { postMorningMessage, verifySlackRequest, handleSlackEvent } from "./services/slack.js";

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
  res.json({ currentWord, lockouts: getActiveLockouts() });
});

app.put("/word", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  const word: string = typeof req.body?.word === "string" ? req.body.word.trim() : "";
  if (!word) { res.status(400).json({ error: "word is required" }); return; }
  try {
    await setTodaysWord(word);
    console.log(`[${new Date().toISOString()}] WORD_UPDATED | "${word}" via dashboard`);
    res.json({ ok: true, word });
  } catch (err) {
    console.error("setTodaysWord failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/visitors", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  const rows = await getVisitorRows().catch(() => []);
  res.json(rows);
});

app.use(webhookRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  registerWatch().catch((err) => console.error("Sheets watch registration failed:", err));
});

// Renew 1 day before the 7-day Google expiry
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
setInterval(() => {
  registerWatch().catch((err) => console.error("Sheets watch renewal failed:", err));
}, SIX_DAYS_MS);

// Post morning visitor check message at 8am Chicago time
cron.schedule("0 8 * * *", () => {
  postMorningMessage().catch(console.error);
}, { timezone: "America/Chicago" });
