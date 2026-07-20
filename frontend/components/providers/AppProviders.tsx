"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";

import { CartSync } from "@/components/providers/CartSync";
import { getSiteSettings } from "@/lib/api";
import { initCrossTabAuthSync } from "@/lib/local-admin-auth";
import { defaultSiteTheme } from "@/lib/site-themes";

function CrossTabAuthSync() {
  useEffect(() => initCrossTabAuthSync(), []);
  return null;
}

function SiteThemeSync() {
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSiteSettings,
    staleTime: 60_000,
  });

  useEffect(() => {
    document.documentElement.dataset.siteTheme = data?.active_theme ?? defaultSiteTheme;
  }, [data?.active_theme]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SiteThemeSync />
        <CrossTabAuthSync />
        <CartSync />
        {children}
        <Toaster richColors position="top-right" />
        {process.env.NODE_ENV !== "production" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
