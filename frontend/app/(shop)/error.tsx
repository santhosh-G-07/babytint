"use client";

import { Button } from "@/components/ui/button";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-shell py-12">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-200">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
        <Button className="mt-4" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

