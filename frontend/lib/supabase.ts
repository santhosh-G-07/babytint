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

export async function assertSupabaseReachable() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Supabase auth is unavailable. Check the Supabase project URL and auth settings.");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Supabase auth timed out. Check the Supabase project status.");
    }
    throw new Error("Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL and restore/fix the Supabase project.");
  } finally {
    window.clearTimeout(timeout);
  }
}

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
