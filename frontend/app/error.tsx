"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="display-font text-3xl tracking-tight">BabyTint</h1>
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-stone-600 dark:text-stone-300">{error.message}</p>
      <button
        className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
