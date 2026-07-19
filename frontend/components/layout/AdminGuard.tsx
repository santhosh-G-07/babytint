"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { authMe } from "@/lib/api";
import { hasAdminToken } from "@/lib/local-admin-auth";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const canTryAdminToken = hasAdminToken();
        if (!canTryAdminToken) {
          if (active) {
            setAllowed(false);
          }
          return;
        }
        const me = await authMe();
        if (active) {
          setAllowed(me.role === "admin");
        }
      } catch {
        if (active) {
          setAllowed(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();
    const handleAuthChange = () => {
      void run();
    };
    window.addEventListener("babytint-auth-change", handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener("babytint-auth-change", handleAuthChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="container-shell py-20">
        <div className="h-10 w-64 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="container-shell py-20">
        <div className="max-w-lg rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            You need an admin account to view this page.
          </p>
          <div className="mt-4">
            <Link href="/login" className="text-sm font-medium text-amber-700">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
