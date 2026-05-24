"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu, UserCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authMe } from "@/lib/api";
import { clearAdminToken, hasAdminToken } from "@/lib/local-admin-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AuthProfile } from "@/types";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/orders", label: "Orders" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session && !hasAdminToken()) {
          if (active) {
            setProfile(null);
          }
          return;
        }
        const me = await authMe();
        if (active) {
          setProfile(me);
        }
      } catch {
        if (active) {
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoadingAuth(false);
        }
      }
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    window.addEventListener("babytint-auth-change", load);
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("babytint-auth-change", load);
    };
  }, []);

  const navLinks = useMemo(() => {
    if (profile?.role === "admin") {
      return [...links, { href: "/admin", label: "Admin" }];
    }
    return links;
  }, [profile?.role]);

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const accountHref = profile?.role === "admin" ? "/admin" : "/orders";

  const authActionsDesktop = profile ? (
    <div className="flex items-center gap-2">
      <Button variant="ghost" asChild>
        <Link href={accountHref}>
          <UserCircle2 className="mr-2 h-4 w-4" />
          {profile.name?.split(" ")[0] ?? "Account"}
        </Link>
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          await supabase.auth.signOut();
          clearAdminToken();
          setProfile(null);
        }}
      >
        Logout
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Button variant="ghost" asChild>
        <Link href="/login">Login</Link>
      </Button>
      <Button asChild>
        <Link href="/register">Register</Link>
      </Button>
    </div>
  );

  const authActionsMobile = profile ? (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-start" asChild>
        <Link href={accountHref}>
          <UserCircle2 className="mr-2 h-4 w-4" />
          {profile.name?.split(" ")[0] ?? "Account"}
        </Link>
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={async () => {
          await supabase.auth.signOut();
          clearAdminToken();
          setProfile(null);
        }}
      >
        Logout
      </Button>
    </div>
  ) : (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-start" asChild>
        <Link href="/login">Login</Link>
      </Button>
      <Button className="w-full justify-start" asChild>
        <Link href="/register">Create account</Link>
      </Button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[hsl(var(--background))/0.9] backdrop-blur dark:border-stone-800/80">
      <div className="border-b border-stone-200/70 bg-stone-100/70 text-xs text-stone-600 dark:border-stone-800/70 dark:bg-stone-900/50 dark:text-stone-300">
        <div className="container-shell flex h-8 items-center justify-between">
          <p>Free design support on WhatsApp and email.</p>
          <p>Secure Razorpay checkout | Pan-India delivery</p>
        </div>
      </div>
      <div className="container-shell flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px]">
              <div className="mt-6 space-y-3">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm",
                      isActiveLink(item.href)
                        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                        : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-stone-200 pt-3 dark:border-stone-800" />
                {loadingAuth ? (
                  <div className="h-10 w-full animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
                ) : (
                  authActionsMobile
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="display-font text-2xl tracking-tight">
            BabyTint
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                isActiveLink(item.href)
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CartDrawer />
          <div className="hidden md:block">
            {loadingAuth ? (
              <div className="h-10 w-28 animate-pulse rounded-md bg-stone-200 dark:bg-stone-800" />
            ) : (
              authActionsDesktop
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
