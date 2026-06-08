import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface AccessLogEntry {
  caller_id: string;
  word_spoken: string;
  word_expected: string | null;
  match_distance: number | null;
  granted: boolean;
  locked_out: boolean;
  granted_by?: string | null;
  is_injection?: boolean;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export function logAttempt(entry: AccessLogEntry): void {
  const supabase = getClient();
  if (!supabase) return;

  supabase
    .from("access_log")
    .insert(entry)
    .then(({ error }) => {
      if (error) console.error("Failed to log access attempt:", error.message);
    });
}
