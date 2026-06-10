import { createClient } from "@supabase/supabase-js";

export interface VisitorRow {
  id: string;
  created_at: string;
  name: string;
  added_by: string | null;
  date: string;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function todayInChicago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function getTodaysVisitors(): Promise<string[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("visitors")
    .select("name")
    .eq("date", todayInChicago());
  if (error) {
    console.error("Failed to fetch visitors:", error.message);
    return [];
  }
  return data.map((r: { name: string }) => r.name.toLowerCase());
}

export async function getVisitorRows(): Promise<VisitorRow[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("date", todayInChicago())
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to fetch visitor rows:", error.message);
    return [];
  }
  return data as VisitorRow[];
}

export async function addVisitor(name: string, addedBy: string): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;
  const today = todayInChicago();
  const { data } = await supabase
    .from("visitors")
    .select("id")
    .eq("name", name.toLowerCase())
    .eq("date", today)
    .limit(1);
  if (data && data.length > 0) return;
  const { error } = await supabase
    .from("visitors")
    .insert({ name: name.toLowerCase(), added_by: addedBy, date: today });
  if (error) console.error("Failed to add visitor:", error.message);
}

export async function removeVisitor(name: string): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("visitors")
    .delete()
    .eq("name", name.toLowerCase())
    .eq("date", todayInChicago())
    .select("id");
  if (error) {
    console.error("Failed to remove visitor:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
