"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authMe } from "@/lib/api";
import { hasAuthToken } from "@/lib/local-admin-auth";
import { supabase } from "@/lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && hasAuthToken()) {
        try {
          await authMe();
          if (active) {
            setAuthed(true);
            setLoading(false);
          }
          return;
        } catch {
          if (active) {
            setAuthed(false);
            setLoading(false);
          }
          return;
        }
      }
      if (active) {
        setAuthed(Boolean(data.session));
        setLoading(false);
      }
    };
    void run();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="container-shell py-16">
        <div className="h-10 w-48 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="container-shell py-16">
        <div className="max-w-lg rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
          <h2 className="text-xl font-semibold">Login required</h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Please sign in to continue.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="mt-4 inline-block text-sm font-medium text-amber-700"
          >
            Continue to login
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
