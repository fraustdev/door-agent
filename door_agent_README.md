# door-agent

A voice-controlled door access agent for the 2389.ai office. Built with [Vapi](https://vapi.ai) and Twilio. When someone calls the office number, an AI agent answers and asks for the word of the day. If they say the right word, the door unlocks via DTMF tone.

## How it works

1. Caller dials the office number (Twilio → Vapi)
2. The Vapi AI agent asks: *"What is the word of the day?"*
3. The caller responds with a word
4. Vapi calls the `/webhook` endpoint with the caller's input
5. The server looks up today's word from a Google Sheet and fuzzy-matches it against the input
6. If it matches, the server responds with "Access granted" and Vapi sends DTMF digit `1` to unlock the door
7. After 6 failed attempts within 5 minutes, the caller is locked out for 5 minutes

## Project structure

```
src/server/
  index.ts               Express server entry point
  routes/webhook.ts      Vapi webhook handler
  services/auth.ts       Fuzzy identity verification (Levenshtein)
  services/sheets.ts     Google Sheets word-of-day lookup (cached, event-driven)
  services/rateLimiter.ts  6 attempts per 5-minute window per caller
scripts/
  create-assistant.ts    Creates or updates the Vapi assistant
```

---

## Deployment

The server is hosted on [Render](https://render.com) and deploys automatically when changes are pushed to the `main` branch on GitHub.

- **Live URL:** https://door-agent.onrender.com
- **Render dashboard:** https://dashboard.render.com (log in to view logs, env vars, and deployment history)

### Environment variables on Render

These are set in the Render dashboard under the service's **Environment** tab. Never commit these to GitHub.

| Variable | Description |
|---|---|
| `VAPI_API_KEY` | Vapi API key |
| `VAPI_SERVER_SECRET` | Shared secret between Vapi and this server — must match what's set in the Vapi assistant config |
| `WEBHOOK_URL` | `https://door-agent.onrender.com` |
| `SERVER_URL` | `https://door-agent.onrender.com` |
| `SPREADSHEET_ID` | Google Sheet ID (from the sheet URL) |
| `ASSISTANT_ID` | Vapi assistant ID |
| `GOOGLE_CREDENTIALS` | Full contents of the Google service account JSON key file (paste the whole JSON as one line) |

### Keeping the server alive (cron-job)

Render's free tier puts the server to sleep after 15 minutes of inactivity. If the server is asleep when a call comes in, the first call will fail.

A cron job on [cron-job.org](https://cron-job.org) pings the server every 10 minutes to keep it awake:

- **URL:** `https://door-agent.onrender.com/ping`
- **Method:** GET
- **Interval:** every 10 minutes

If the server starts failing calls again, check cron-job.org first to make sure the ping job is still active and returning `200`.

---

## Day-to-day operations

### Changing the word of the day

Edit the **word_of_day** tab in the Google Sheet — column A is the weekday name, column B is the word.

The server receives a push notification from Google Drive when the sheet changes and updates within ~3 minutes. Watch for this log line in Render to confirm the update went through:

```
Sheets cache updated — current word: "newword"
```

**Word length recommendation:** Use words of 5 or more letters. Words of 4 letters or fewer require an exact match from the caller (no tolerance for slight mispronunciation). Longer words allow a 1-character difference, which helps with accent variation and background noise at the callbox.

### Viewing live logs

Go to the Render dashboard → select the `door-agent` service → **Logs** tab. Key log lines to know:

| Log line | Meaning |
|---|---|
| `GRANTED \| +1XXXXXXXXXX \| "word"` | Caller was let in |
| `DENIED \| +1XXXXXXXXXX \| "word"` | Caller said the wrong word |
| `RATE_LIMITED \| +1XXXXXXXXXX \| "word"` | Caller hit the 6-attempt lockout |
| `Sheets cache updated — current word: "X"` | Word of the day updated successfully |
| `Sheets watch registered — expires in 6 days` | Google Drive push notifications active |

### Google Drive watch renewal

The server registers a watch with Google Drive so it gets notified when the sheet changes. Google limits these watches to 7 days — the server automatically renews every 6 days. This happens in the background; you don't need to do anything. If the watch fails to renew, the server falls back to a 1-hour cache (the word will still update, just slower).

---

## Prerequisites

- Node.js 18+
- A [Vapi](https://vapi.ai) account with a phone number
- A Google Cloud service account with Sheets API and Drive API access
- A Google Sheet with a `word_of_day` tab in this format:

| Day | Word |
|-----|------|
| Monday | example |
| Tuesday | another |
| ... | ... |

---

## Local development setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `VAPI_API_KEY` | Your Vapi API key |
| `VAPI_SERVER_SECRET` | A random secret shared with Vapi to authenticate webhook calls |
| `SPREADSHEET_ID` | The ID from your Google Sheet URL |
| `WEBHOOK_URL` | Public URL where this server is deployed (e.g. your ngrok or Render URL) |
| `SERVER_URL` | Same as `WEBHOOK_URL` |
| `ASSISTANT_ID` | Filled in automatically after first run of `create-assistant` |

Generate a secure random secret for `VAPI_SERVER_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Add Google credentials

Place your Google Cloud service account key file at the project root as `credentials.json`. The service account needs read access to the spreadsheet and the Drive API enabled.

### 4. Create the Vapi assistant

```bash
npm run create-assistant
```

Copy the printed `ASSISTANT_ID` into your `.env`. Re-run this command any time you change the assistant's system prompt or tool config.

### 5. Assign the assistant to your phone number

In the Vapi dashboard, go to your phone number settings and assign the assistant you just created.

### 6. Run the server

```bash
npm start
```

The server runs on port `3000` by default. For local testing, expose it with [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Use the ngrok URL as `WEBHOOK_URL` and `SERVER_URL` in `.env`, then re-run `npm run create-assistant` to update Vapi.

---

## Security notes

- `credentials.json` and `.env` are gitignored — never commit them
- The webhook validates the `x-vapi-secret` header on every request and rejects anything that doesn't match
- Callers are rate-limited to 6 attempts per 5-minute window, then locked out for 5 minutes
- Words of 4 letters or fewer require an exact spoken match; words of 5+ letters allow 1 character of difference (for accent and noise tolerance)
- Input is capped at 100 characters before any processing
