import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="display-font text-3xl tracking-tight">BabyTint</h1>
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="max-w-sm text-stone-600 dark:text-stone-300">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="font-medium text-amber-700">
        Back to home
      </Link>
    </div>
  );
}
