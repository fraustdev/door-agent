# Door — Product Reference

## What Door is

Door is the AI-powered entry system for the 2389 office. It answers the front-door callbox with a voice assistant, lets teammates manage expected visitors through a Slack bot with a personality, and surfaces everything on a live dashboard. It exists so nobody has to hand out keys, buzz people in manually, or wonder who came by — the door handles its own job, verifies who's at it, and keeps a record. Anyone arriving either speaks the word of the day or, if a teammate added them in Slack, speaks their own name. That's the whole product: two ways in, one source of truth, full visibility.

## Voice Access

This is the front door's brain. The callbox dials a Twilio number managed by Vapi, which runs an AI assistant that answers and asks the caller for the word of the day. Vapi transcribes the speech and POSTs it to our server at `/webhook`, where `verifyIdentity()` makes the access decision.

Verification checks the spoken input against two sources. First, the word of the day, fetched from a Google Sheet (column A is the weekday, column B is the word). Second, today's visitor list from Supabase. Both use the same fuzzy match: exact match for words of 4 characters or fewer, Levenshtein distance ≤1 for words of 5 or more. If either source matches, access is granted and Vapi sends DTMF tone "1", which physically unlocks the door. If neither matches, the caller is told to try again.

The flow is deliberately hostile to abuse. Every webhook request must carry the shared secret in the `x-vapi-secret` header, and the server fails closed if it's missing. Input is capped at 100 characters before anything else touches it. Regex patterns catch common prompt-injection phrases. A rate limiter allows 6 attempts per 5-minute window; exceeding it triggers a fixed 5-minute lockout.

**Working correctly means:** a caller speaking today's word (or their own name, if they're on the visitor list) gets in on the first try despite minor transcription errors; an unauthorized caller never gets in no matter how they phrase it; a missing secret or malformed request is rejected before any logic runs; and every attempt — granted or denied — lands in the access log.

## Slack Bot

The bot is how the team talks to the door. It lives in one Slack channel, and every message posted there hits our server at `/slack/events`. Requests are verified with Slack's HMAC-SHA256 signing, and anything older than 5 minutes is rejected as a replay.

Message text goes to Claude Haiku with a system prompt that defines the persona: Door — a sentient, sarcastic, deadpan door that takes its job seriously. Claude returns structured JSON: `{ intent: "add" | "remove" | "none", names: [...], reply: "..." }`. An `add` intent inserts each name into the Supabase `visitors` table with today's date (Chicago timezone) and the Slack user ID of whoever added them; duplicates are skipped. A `remove` intent deletes the name from today's list. The bot always replies in-thread, including to off-topic messages, where it leans on dry humor and door puns.

Every morning at 8am Chicago time it posts its standing prompt: "Any visitors today? I'm a door. This is my purpose."

**Working correctly means:** "expecting Jessica around 2" results in Jessica on today's list within seconds, attributed to the right teammate; removals take effect immediately; unsigned or stale requests are dropped; and the persona never breaks — even error states sound like Door.

## Visitor Flow

This is the bridge between Slack and the callbox. When a teammate adds a name in Slack, that visitor can get in by speaking *their own name* at the door instead of the word of the day. `verifyIdentity()` checks both sources on every call, so a visitor named Jessica says "Jessica" and the door opens.

Visitor entries are scoped to a single day — they're written with today's Chicago date and only today's list is checked. There is no standing access; tomorrow, Jessica is a stranger again unless someone re-adds her.

**Working correctly means:** a visitor added this morning gets in this afternoon by saying their name, with the same fuzzy-match tolerance as the word; the same name no longer works tomorrow; and the access log records the entry as a Visitor grant, not a word grant.

## Dashboard

The dashboard is the window into everything Door does. It's a dark-themed Next.js UI that polls the backend every 5 seconds and shows: today's stats (attempts, granted, denied, locked out), a 7-day activity bar chart, the word-of-the-day card (with a background GIF fetched for that word, editable inline), active lockouts with countdown timers, today's visitor list, and the full access log — last 50 entries with caller ID masked, the word spoken, a status badge (Granted / Denied / Visitor / Locked / Injection), and relative time.

It never talks to Supabase or the door directly. Next.js API routes proxy every request to the backend on Render, attaching a `DASHBOARD_API_KEY` header. The dashboard is read-mostly; the one write path is editing the word of the day.

**Working correctly means:** the log reflects a callbox attempt within one polling cycle; lockout timers count down accurately; caller IDs are never shown unmasked; and a word edited inline takes effect for the next caller.

## Infrastructure

The backend is Node/Express/TypeScript on Render's free tier, kept warm by cron-job.org pinging `/ping` every 10 minutes. Supabase (PostgreSQL) holds two tables: `access_log` (every call attempt) and `visitors` (Slack-added names). The word of the day lives in a Google Sheet; the server caches it and invalidates via Google Drive push notifications, with a 1-hour fallback TTL so a missed notification can't serve a stale word for long. Vapi sits on top of Twilio for the voice layer. The frontend is Next.js with Tailwind, deployed separately from the backend.

**Working correctly means:** the Render instance never cold-starts during business hours; a word change in the Sheet propagates within seconds (or an hour, worst case); and both tables stay the single source of truth — nothing access-related lives anywhere else.

## How it all fits together

Someone walks up to the office and presses the callbox. The callbox dials the Twilio number, Vapi's assistant answers and asks for the word of the day. The visitor speaks — either today's word or their own name. Vapi transcribes the audio and POSTs it to the backend's `/webhook` with the shared secret. The server validates the secret, caps and sanitizes the input, screens for injection patterns, and checks the rate limiter. Then `verifyIdentity()` fuzzy-matches the input against the word from the Google Sheet cache and against today's visitor list in Supabase — a list that exists because, earlier that day, a teammate told the Slack bot to expect someone, and Claude Haiku parsed that message into a database insert. On a match, the server tells Vapi to grant access, Vapi plays DTMF "1", and the door physically opens. The attempt — success or failure — is written to `access_log`, and within 5 seconds the dashboard's next poll picks it up and the team can see exactly what happened.

## Guiding principles

**Fail closed on auth.** Missing secret, bad signature, unverifiable anything — deny. The door's default state is locked, and no change should ever invert that.

**Validate before you think.** Length caps, injection screening, and rate limits run before any matching or LLM logic. Untrusted input never reaches the interesting code raw.

**Fuzzy on matching, strict on everything else.** Speech transcription is imperfect, so identity matching tolerates one edit. Nothing else does — signatures, secrets, and timestamps are exact.

**Visitor access expires daily.** No standing grants, no exceptions. If someone needs in tomorrow, add them tomorrow.

**The persona is part of the product.** Door is sarcastic, deadpan, and dutiful — in every reply, including errors and edge cases. A persona break is a bug.

**One source of truth per fact.** The word lives in the Sheet, visitors and logs live in Supabase, decisions live in the backend. Don't duplicate state across layers.

**Log everything, expose carefully.** Every attempt is recorded; the dashboard masks caller IDs and the backend is only reachable through keyed proxies. Visibility for the team, privacy for callers.
