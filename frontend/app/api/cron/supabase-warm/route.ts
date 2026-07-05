import { NextResponse } from "next/server";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      detail: "Unauthorized cron request.",
    },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return unauthorizedResponse();
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        detail: "Supabase env vars are missing.",
      },
      { status: 500 },
    );
  }

  const startedAt = Date.now();
  const endpoint = `${trimTrailingSlash(supabaseUrl)}/auth/v1/settings`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "x-client-info": "babytint-supabase-warmup/1.0",
      },
      cache: "no-store",
    });
    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          elapsed_ms: elapsedMs,
          detail: "Supabase warm-up request failed.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: response.status,
      elapsed_ms: elapsedMs,
      target: "auth/v1/settings",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return NextResponse.json(
      {
        ok: false,
        detail: message,
      },
      { status: 502 },
    );
  }
}
