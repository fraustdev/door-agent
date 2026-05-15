import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook.js";

const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(webhookRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
