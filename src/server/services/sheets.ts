import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

let cache: { word: string; date: string } | null = null;

export async function getTodaysWord(): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  if (cache?.date === today) return cache.word;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "word_of_day!A:B",
  });
  const rows = res.data.values ?? [];
  const row = rows
    .slice(1)
    .find((r) => r[0]?.toString().toLowerCase() === today.toLowerCase());
  const word = row?.[1]?.toString().toLowerCase().trim() ?? "";

  cache = { word, date: today };
  return word;
}
