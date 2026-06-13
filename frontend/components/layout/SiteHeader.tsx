"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu, Search, Sparkles, UserCircle2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const announcementItems = [
  "Live preview customization for every active frame",
  "Secure Razorpay checkout for customer orders",
  "Order tracking updates after payment confirmation",
  "Free design help on WhatsApp and email",
  "Print-ready export workflow for production orders",
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [searchValue, setSearchValue] = useState("");

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

  const marqueeItems = useMemo(() => [...announcementItems, ...announcementItems], []);

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const submitSearch = () => {
    const query = searchValue.trim();
    router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  const accountHref = profile?.role === "admin" ? "/admin" : "/orders";

  const authActionsDesktop = profile ? (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="rounded-xl border border-[#d6e7ff] bg-white text-[#1f3b5f] hover:bg-[#eef5ff]"
        asChild
      >
        <Link href={accountHref}>
          <UserCircle2 className="mr-2 h-4 w-4" />
          {profile.name?.split(" ")[0] ?? "Account"}
        </Link>
      </Button>
      <Button
        variant="outline"
        className="rounded-xl border-[#232323] bg-[#1f1f1f] text-white hover:bg-[#333333] hover:text-white"
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
      <Button
        variant="ghost"
        className="rounded-xl text-[#1f3b5f] hover:bg-[#eef5ff] hover:text-[#1f3b5f]"
        asChild
      >
        <Link href="/login">Login</Link>
      </Button>
      <Button className="rounded-xl border-0 bg-[#04a16b] text-white hover:bg-[#03875a]" asChild>
        <Link href="/register">Register</Link>
      </Button>
    </div>
  );

  const authActionsMobile = profile ? (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start border-[#d6e7ff] bg-white text-[#1f3b5f] hover:bg-[#eef5ff]"
        asChild
      >
        <Link href={accountHref}>
          <UserCircle2 className="mr-2 h-4 w-4" />
          {profile.name?.split(" ")[0] ?? "Account"}
        </Link>
      </Button>
      <Button
        variant="secondary"
        className="w-full justify-start border border-[#232323] bg-[#1f1f1f] text-white hover:bg-[#333333]"
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
      <Button
        variant="outline"
        className="w-full justify-start border-[#d6e7ff] bg-white text-[#1f3b5f] hover:bg-[#eef5ff]"
        asChild
      >
        <Link href="/login">Login</Link>
      </Button>
      <Button className="w-full justify-start border-0 bg-[#04a16b] text-white hover:bg-[#03875a]" asChild>
        <Link href="/register">Create account</Link>
      </Button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#d6e5ff] bg-white/95 backdrop-blur-md">
      <div className="relative overflow-hidden border-b border-[#3b77cb] bg-[#4d8ce8] text-white">
        <div className="announcement-track">
          {marqueeItems.map((item, index) => (
            <div key={`${item}-${index}`} className="announcement-item">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="container-shell flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[290px]">
              <div className="mt-6 space-y-3">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitSearch();
                  }}
                >
                  <Input
                    placeholder="Search frames..."
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                  />
                  <Button type="submit" size="icon" aria-label="Search">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActiveLink(item.href)
                        ? "bg-[#fc859a] text-white"
                        : "text-[#2a4d75] hover:bg-[#ffe8ee]",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-[#e3ecff] pt-3" />
                {loadingAuth ? (
                  <div className="h-10 w-full animate-pulse rounded-md bg-[#ecf4ff]" />
                ) : (
                  authActionsMobile
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="display-font text-[2rem] leading-none tracking-tight text-[#122f55]">
            BabyTint
          </Link>
        </div>

        <div className="hidden lg:flex flex-1 items-center gap-3 px-2">
          <nav className="flex items-center gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition",
                  isActiveLink(item.href)
                    ? "bg-[#fc859a] text-white"
                    : "text-[#506787] hover:bg-[#ffe8ee]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form
            className="ml-auto hidden max-w-[350px] flex-1 items-center gap-2 xl:flex"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <Input
              className="h-9 rounded-full border-[#d4e5ff] bg-[#f8fbff] text-[#1f3b5f] placeholder:text-[#7790ae]"
              placeholder="Search frames..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 rounded-full border-0 bg-[#f7b500] text-[#4f3500] hover:bg-[#e5a900]"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CartDrawer />
          <div className="hidden xl:block">
            {loadingAuth ? (
              <div className="h-10 w-28 animate-pulse rounded-md bg-[#ecf4ff]" />
            ) : (
              authActionsDesktop
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
