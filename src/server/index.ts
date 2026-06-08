import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook.js";
import { registerWatch, getTodaysWord, setTodaysWord } from "./services/sheets.js";
import { getActiveLockouts } from "./services/rateLimiter.js";
import { refreshCalendarData, getAllVisitors } from "./services/calendar.js";

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

app.post("/calendar/refresh", async (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  await refreshCalendarData().catch((err) => console.error("Manual calendar refresh failed:", err));
  res.json({ ok: true, visitors: getAllVisitors().length });
});

app.get("/visitors", (req, res) => {
  const key = process.env.DASHBOARD_API_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) { res.sendStatus(401); return; }
  res.json(getAllVisitors().map(v => ({
    firstName: v.firstName,
    displayName: v.displayName,
    meetingTitle: v.meetingTitle,
    meetingStart: v.meetingStart.toISOString(),
    meetingEnd: v.meetingEnd.toISOString(),
    windowStart: v.windowStart.toISOString(),
    windowEnd: v.windowEnd.toISOString(),
    calendarOwner: v.calendarOwner,
    active: v.windowStart.getTime() <= Date.now() && v.windowEnd.getTime() >= Date.now(),
  })));
});

app.use(webhookRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  registerWatch().catch((err) => console.error("Sheets watch registration failed:", err));
  refreshCalendarData().catch((err) => console.error("Initial calendar refresh failed:", err));
});

// Renew 1 day before the 7-day Google expiry
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
setInterval(() => {
  registerWatch().catch((err) => console.error("Sheets watch renewal failed:", err));
}, SIX_DAYS_MS);

// Refresh calendar visitor windows every 5 minutes
setInterval(() => {
  refreshCalendarData().catch((err) => console.error("Calendar refresh failed:", err));
}, 5 * 60 * 1000);
