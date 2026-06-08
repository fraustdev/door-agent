import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook.js";
import { registerWatch, getTodaysWord, setTodaysWord } from "./services/sheets.js";
import { getActiveLockouts } from "./services/rateLimiter.js";
import { logAttempt } from "./services/logger.js";

const app = express();
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

// TwiML Twilio fetches when the outbound door-open call connects
app.get("/door-twiml", (_req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Play digits="1"/><Pause length="1"/><Hangup/></Response>`);
});

app.post("/door/open", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = process.env.CALLBOX_NUMBER;
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!accountSid || !authToken || !from || !to || !webhookUrl) {
    res.status(503).json({ error: "Door trigger not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, CALLBOX_NUMBER" });
    return;
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Url: `${webhookUrl}/door-twiml` }).toString(),
    }
  );

  if (!twilioRes.ok) {
    const text = await twilioRes.text();
    console.error("Twilio call failed:", text);
    res.status(502).json({ error: "Twilio call failed" });
    return;
  }

  console.log(`[${new Date().toISOString()}] DOOR_OPENED | manual trigger via dashboard`);
  logAttempt({ caller_id: "dashboard", word_spoken: "[manual open]", word_expected: null, match_distance: null, granted: true, locked_out: false });
  res.json({ ok: true });
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
