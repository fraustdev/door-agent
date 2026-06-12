import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function todayDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function getTodaysWord(): Promise<string> {
  const supabase = getClient();
  if (!supabase) return "";
  const { data, error } = await supabase
    .from("words")
    .select("word")
    .eq("date", todayDate())
    .single();
  if (error || !data) return "";
  return (data as { word: string }).word;
}
