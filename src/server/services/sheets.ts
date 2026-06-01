import { google } from "googleapis";
import { randomUUID } from "crypto";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const SERVER_URL = process.env.SERVER_URL;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1-hour fallback if push notifications lapse
const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (Google max is 7)

const auth = new google.auth.GoogleAuth({
  ...(process.env.GOOGLE_CREDENTIALS
    ? { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS) }
    : { keyFile: "credentials.json" }),
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

let cache: { word: string; date: string; fetchedAt: number } | null = null;
let activeChannel: { id: string; resourceId: string; token: string } | null = null;

export function clearCache(): void {
  cache = null;
}

export function getChannelToken(): string | null {
  return activeChannel?.token ?? null;
}

export function getChannelId(): string | null {
  return activeChannel?.id ?? null;
}

export async function getTodaysWord(force = false): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const now = Date.now();

  if (!force && cache?.date === today && now - cache.fetchedAt < CACHE_TTL_MS) return cache.word;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "word_of_day!A:B",
  });
  const rows = res.data.values ?? [];
  const row = rows
    .slice(1)
    .find((r) => r[0]?.toString().toLowerCase() === today.toLowerCase());
  const word = row?.[1]?.toString().toLowerCase().trim() ?? "";

  cache = { word, date: today, fetchedAt: now };
  return word;
}

export async function registerWatch(): Promise<void> {
  if (!SERVER_URL) {
    console.warn("SERVER_URL not set — skipping Sheets push notification registration");
    return;
  }

  // Stop existing channel before re-registering
  if (activeChannel) {
    try {
      await drive.channels.stop({
        requestBody: { id: activeChannel.id, resourceId: activeChannel.resourceId },
      });
    } catch {
      // Channel may have already expired — safe to ignore
    }
  }

  const id = randomUUID();
  const token = randomUUID();

  const res = await drive.files.watch({
    fileId: SPREADSHEET_ID,
    requestBody: {
      id,
      type: "web_hook",
      address: `${SERVER_URL}/sheets-webhook`,
      token,
      expiration: String(Date.now() + WATCH_TTL_MS),
    },
  });

  if (!res.data.resourceId) throw new Error("Watch registration returned no resourceId");

  activeChannel = { id, resourceId: res.data.resourceId, token };
  console.log("Sheets watch registered — expires in 6 days");
}
