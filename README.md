# door-agent

A voice-controlled door access agent for the 2389.ai office. Built with [Vapi](https://vapi.ai) and Twilio. When someone calls the office number, an AI agent answers and asks for the word of the day. If they say the right word, the door unlocks via DTMF tone.

## How it works

1. Caller dials the office number (Twilio → Vapi)
2. The Vapi AI agent asks: *"What is the word of the day?"*
3. The caller responds with a word
4. Vapi calls the `/webhook` endpoint with the caller's input
5. The server looks up today's word from a Google Sheet and fuzzy-matches it against the input
6. If it matches, the server responds with "Access granted" and Vapi sends DTMF digit `1` to unlock the door
7. After 6 failed attempts the call ends

## Project structure

```
src/server/
  index.ts               Express server entry point
  routes/webhook.ts      Vapi webhook handler
  services/auth.ts       Fuzzy identity verification (Levenshtein)
  services/sheets.ts     Google Sheets word-of-day lookup (cached daily)
  services/rateLimiter.ts  6 attempts per 5-minute window per caller
scripts/
  create-assistant.ts    Creates or updates the Vapi assistant
```

## Prerequisites

- Node.js 18+
- A [Vapi](https://vapi.ai) account with a phone number
- A Google Cloud service account with Sheets API access
- A Google Sheet with a `word_of_day` tab in this format:

| Day | Word |
|-----------|------|
| Monday | example |
| Tuesday | another |
| ... | ... |

## Setup

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
| `WEBHOOK_URL` | Public URL where this server is deployed (e.g. your ngrok or hosted URL) |
| `ASSISTANT_ID` | Filled in automatically after first run of `create-assistant` |

Generate a secure random secret for `VAPI_SERVER_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Add Google credentials

Place your Google Cloud service account key file at the project root as `credentials.json`. The service account needs read access to your spreadsheet.

### 4. Create the Vapi assistant

```bash
npm run create-assistant
```

Copy the printed `ASSISTANT_ID` into your `.env`. Re-run this command any time you change the assistant config.

### 5. Assign the assistant to your phone number

In the Vapi dashboard, go to your phone number settings and assign the assistant you just created.

## Running the server

```bash
npm start
```

The server runs on port `3000` by default. Set `PORT` in `.env` to override.

For local development, expose it with [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Use the ngrok URL as `WEBHOOK_URL` in `.env`, then re-run `npm run create-assistant` to update Vapi.

## Security notes

- `credentials.json` and `.env` are gitignored — never commit them
- The webhook validates the `x-vapi-secret` header on every request
- Callers are rate-limited to 6 attempts per 5-minute window
- Fuzzy matching allows 1 edit for short words (≤4 chars) and 2 edits for longer words
