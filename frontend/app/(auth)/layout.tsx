import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Link href="/" className="display-font text-3xl tracking-tight">
            BabyTint
          </Link>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Sign in to save cart, checkout, and track your orders.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
