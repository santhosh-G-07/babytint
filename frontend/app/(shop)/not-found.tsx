import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ShopNotFound() {
  return (
    <div className="container-shell py-16 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">
        We couldn&apos;t find what you were looking for. It may have moved or is no longer available.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/shop">Back to shop</Link>
      </Button>
    </div>
  );
}
