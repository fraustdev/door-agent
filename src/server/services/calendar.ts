import { createClient } from "@supabase/supabase-js";

const WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
const WINDOW_AFTER_MS  = 2 * 60 * 60 * 1000;

export interface VisitorWindow {
  firstName: string;
  displayName: string;
  email: string;
  meetingTitle: string;
  meetingStart: Date;
  meetingEnd: Date;
  windowStart: Date;
  windowEnd: Date;
  calendarOwner: string;
}

let cachedVisitors: VisitorWindow[] = [];

export function getActiveVisitors(): VisitorWindow[] {
  const now = Date.now();
  return cachedVisitors.filter(v => v.windowStart.getTime() <= now && v.windowEnd.getTime() >= now);
}

export function getAllVisitors(): VisitorWindow[] {
  return cachedVisitors;
}

// Words that appear in meeting titles but are never person names
const TITLE_STOP = new Set([
  "meeting", "call", "interview", "sync", "chat", "discussion", "review",
  "session", "catchup", "catch", "standup", "stand", "wrap", "check",
  "follow", "kickoff", "intro", "introduction", "presentation", "demo",
  "debrief", "planning", "retro", "retrospective", "briefing", "brainstorm",
  "workshop", "training", "onboarding", "orientation", "offboarding",
  "lunch", "coffee", "dinner", "breakfast", "happy", "hour",
  "with", "and", "the", "a", "an", "for", "to", "of", "in", "on", "at",
  "by", "from", "between", "about", "re", "vs", "regarding",
  "team", "group", "all", "hands", "company", "department", "office",
  "project", "quick", "brief", "weekly", "daily", "monthly", "bi",
  "one", "two", "three", "four", "five", "six", "seven", "eight",
]);

function extractNamesFromTitle(title: string): string[] {
  if (!title?.trim()) return [];
  const names: string[] = [];

  // Priority pattern: "with [Name]" — most explicit signal
  const withPattern = /\bwith\s+([A-Z][a-z]{1,})/g;
  let m: RegExpExecArray | null;
  while ((m = withPattern.exec(title)) !== null) {
    names.push(m[1].toLowerCase());
  }

  // Fallback: any capitalised word not in the stop list
  for (const word of title.split(/[\s\-|\/&,()[\]]+/)) {
    const clean = word.replace(/[^a-zA-Z]/g, "");
    const lower = clean.toLowerCase();
    if (clean.length < 2 || TITLE_STOP.has(lower)) continue;
    if (/^[A-Z][a-z]{1,}$/.test(clean) && !names.includes(lower)) {
      names.push(lower);
    }
  }

  return [...new Set(names)];
}

async function refreshToken(refreshTokenValue: string): Promise<{ accessToken: string; expiry: Date } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

async function fetchVisitorWindows(accessToken: string, ownerEmail: string): Promise<VisitorWindow[]> {
  const timeMin = new Date(Date.now() - WINDOW_BEFORE_MS).toISOString();
  const timeMax = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const windows: VisitorWindow[] = [];

  for (const event of data.items ?? []) {
    // Skip cancelled events
    if (event.status === "cancelled") continue;

    // Skip Google Meet / video calls — those are remote, not in-person visits
    if (event.conferenceData?.conferenceSolution?.key?.type === "hangoutsMeet") continue;

    // Skip all-day events (no specific time means no door window to calculate)
    if (!event.start?.dateTime) continue;

    const names = extractNamesFromTitle(event.summary ?? "");
    if (names.length === 0) continue;

    const meetingStart = new Date(event.start.dateTime);
    const meetingEnd   = new Date(event.end?.dateTime ?? event.start.dateTime);
    const windowStart  = new Date(meetingStart.getTime() - WINDOW_BEFORE_MS);
    const windowEnd    = new Date(meetingEnd.getTime()   + WINDOW_AFTER_MS);

    for (const firstName of names) {
      const display = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      windows.push({
        firstName,
        displayName: display,
        email: "",
        meetingTitle: event.summary ?? "Meeting",
        meetingStart,
        meetingEnd,
        windowStart,
        windowEnd,
        calendarOwner: ownerEmail,
      });
    }
  }

  return windows;
}

export async function refreshCalendarData(): Promise<void> {
  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cid  = process.env.GOOGLE_CLIENT_ID;
  const csec = process.env.GOOGLE_CLIENT_SECRET;
  if (!url || !key || !cid || !csec) return;

  const supabase = createClient(url, key);
  const { data: connections, error } = await supabase
    .from("calendar_connections")
    .select("*");

  if (error || !connections?.length) {
    cachedVisitors = [];
    return;
  }

  const allWindows: VisitorWindow[] = [];

  for (const conn of connections) {
    let accessToken = conn.access_token;
    const expired = !conn.token_expiry || new Date(conn.token_expiry) <= new Date(Date.now() + 60_000);

    if (expired) {
      const refreshed = await refreshToken(conn.refresh_token);
      if (!refreshed) {
        console.error(`Calendar token refresh failed for ${conn.email}`);
        continue;
      }
      accessToken = refreshed.accessToken;
      await supabase
        .from("calendar_connections")
        .update({ access_token: refreshed.accessToken, token_expiry: refreshed.expiry.toISOString() })
        .eq("email", conn.email);
    }

    const windows = await fetchVisitorWindows(accessToken, conn.email);
    allWindows.push(...windows);
  }

  // Deduplicate by firstName + windowStart to avoid duplicates across calendars
  const seen = new Set<string>();
  cachedVisitors = allWindows.filter(v => {
    const k = `${v.firstName}|${v.windowStart.toISOString()}|${v.meetingTitle}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`[${new Date().toISOString()}] Calendar refreshed — ${cachedVisitors.length} visitor window(s) loaded`);
}
