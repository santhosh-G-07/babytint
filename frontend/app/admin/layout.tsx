import Link from "next/link";
import type { Metadata } from "next";

import { AdminGuard } from "@/components/layout/AdminGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/frames", label: "Frames" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <AdminGuard>
        <div className="container-shell py-8">
          <div className="flex flex-wrap gap-2">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </AdminGuard>
      <SiteFooter />
    </div>
  );
}
