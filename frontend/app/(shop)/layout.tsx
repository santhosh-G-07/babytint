import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[hsl(var(--background))]">
      <div className="mesh-bg absolute inset-x-0 top-0 h-[520px] -z-10 opacity-80 dark:opacity-20" />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

