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

function extractFirstName(displayName: string, email: string): string {
  const name = displayName?.trim() || email.split("@")[0];
  return name.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
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
    const attendees: { email: string; displayName?: string; self?: boolean }[] = event.attendees ?? [];
    if (attendees.length <= 1) continue;

    const meetingStart = new Date(event.start?.dateTime ?? event.start?.date);
    const meetingEnd   = new Date(event.end?.dateTime   ?? event.end?.date);
    const windowStart  = new Date(meetingStart.getTime() - WINDOW_BEFORE_MS);
    const windowEnd    = new Date(meetingEnd.getTime()   + WINDOW_AFTER_MS);

    for (const attendee of attendees) {
      if (attendee.email?.toLowerCase() === ownerEmail.toLowerCase()) continue;
      if (attendee.self) continue;

      const firstName = extractFirstName(attendee.displayName ?? "", attendee.email ?? "");
      if (!firstName || firstName.length < 2) continue;

      windows.push({
        firstName,
        displayName: attendee.displayName ?? attendee.email ?? "Unknown",
        email: attendee.email ?? "",
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
    const key = `${v.firstName}|${v.windowStart.toISOString()}|${v.email}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[${new Date().toISOString()}] Calendar refreshed — ${cachedVisitors.length} visitor window(s) loaded`);
}
