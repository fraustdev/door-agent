import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook.js";
import { registerWatch } from "./services/sheets.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/ping", (_req, res) => res.sendStatus(200));
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
