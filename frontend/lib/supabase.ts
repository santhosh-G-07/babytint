import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const placeholderUrl = "https://placeholder.supabase.co";
const placeholderKey = "placeholder-anon-key";

function normalizeSupabaseUrl(url: string | undefined): string {
  if (!url) {
    return placeholderUrl;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    // Invalid URL format; we intentionally fall back to placeholder.
  }
  return placeholderUrl;
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = rawSupabaseAnonKey || placeholderKey;
const hasValidSupabaseUrl = Boolean(rawSupabaseUrl && supabaseUrl !== placeholderUrl);
const hasSupabaseAnonKey = Boolean(rawSupabaseAnonKey);

export const isSupabaseConfigured = Boolean(
  hasValidSupabaseUrl &&
    hasSupabaseAnonKey &&
    supabaseAnonKey !== placeholderKey,
);

if (typeof window !== "undefined" && (!hasValidSupabaseUrl || !hasSupabaseAnonKey)) {
  console.warn(
    "Supabase env vars are missing or invalid. Auth and uploads will fail until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly.",
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
