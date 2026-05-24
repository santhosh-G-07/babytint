"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin, loginLocal } from "@/lib/api";
import { clearAdminToken, setAuthToken } from "@/lib/local-admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const nextPath = () => {
    if (typeof window === "undefined") {
      return "/orders";
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("next") ?? "/orders";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setLoading(true);
    try {
      let supabaseErrorMessage: string | null = null;
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          clearAdminToken();
          toast.success("Logged in successfully.");
          router.push(nextPath());
          return;
        }
        supabaseErrorMessage = error.message;
      }

      try {
        const local = await loginLocal({ email, password });
        setAuthToken(local.access_token);
        toast.success("Logged in successfully.");
        router.push(local.role === "admin" ? "/admin" : nextPath());
      } catch {
        try {
          const admin = await adminLogin({ email, password });
          setAuthToken(admin.access_token);
          toast.success("Admin login successful.");
          router.push("/admin");
          return;
        } catch (adminErr) {
          if (supabaseErrorMessage) {
            toast.error(supabaseErrorMessage);
            return;
          }
          const adminMessage =
            adminErr instanceof Error && adminErr.message
              ? adminErr.message
              : "Invalid credentials.";
          toast.error(adminMessage);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Invalid credentials or auth service is unavailable.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const redirectTo = `${window.location.origin}${nextPath()}`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message);
      }
    } catch {
      toast.error("Could not reach Supabase. Check your env vars and internet connection.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <Button variant="outline" className="mt-3 w-full" onClick={signInWithGoogle}>
          Continue with Google
        </Button>

        <p className="mt-3 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-amber-700">
            Forgot password?
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          New to BabyTint?{" "}
          <Link href="/register" className="font-medium text-amber-700">
            Create account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
