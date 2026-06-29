"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerLocal } from "@/lib/api";
import { setAuthToken } from "@/lib/local-admin-auth";
import { assertSupabaseReachable, isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setLoading(true);
    try {
      const created = await registerLocal({ name, email, password });
      setAuthToken(created.access_token);
      toast.success("Account created.");
      router.push("/orders");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (googleLoading) {
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setGoogleLoading(true);
    try {
      await assertSupabaseReachable();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/orders` },
      });
      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach Supabase.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>

        <Button variant="outline" className="mt-3 w-full" onClick={signInWithGoogle} disabled={googleLoading}>
          {googleLoading ? "Checking Google login..." : "Continue with Google"}
        </Button>

        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-amber-700">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
