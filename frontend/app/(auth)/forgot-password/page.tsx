"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await requestPasswordReset(email);
      setOtpSent(true);
      toast.success(response.dev_otp ? `Development OTP: ${response.dev_otp}` : "OTP sent if the account exists.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const otp = String(formData.get("otp") ?? "");
    const password = String(formData.get("password") ?? "");

    setLoading(true);
    try {
      await confirmPasswordReset({ email, otp, password });
      toast.success("Password updated. Please login.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
      </CardHeader>
      <CardContent>
        {!otpSent ? (
          <form className="space-y-4" onSubmit={sendOtp}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={resetPassword}>
            <div className="space-y-1.5">
              <Label htmlFor="otp">OTP</Label>
              <Input id="otp" name="otp" inputMode="numeric" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" minLength={6} required />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-amber-700">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
