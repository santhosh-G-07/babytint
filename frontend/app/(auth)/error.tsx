"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
        <Button className="mt-4 w-full" onClick={() => reset()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
