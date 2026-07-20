"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFrames, getSiteSettings, updateFrame, updateSiteSettings } from "@/lib/api";
import { siteThemes } from "@/lib/site-themes";
import { inr } from "@/lib/utils";
import type { SiteTheme } from "@/types";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [offers, setOffers] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["admin", "settings", "frames"],
    queryFn: () => getFrames({ active_only: false }),
  });

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSiteSettings,
  });

  const mutation = useMutation({
    mutationFn: ({ frameId, offerPrice }: { frameId: string; offerPrice: string }) =>
      updateFrame(frameId, { offer_price: offerPrice ? offerPrice : null }),
    onSuccess: () => {
      toast.success("Offer updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settings", "frames"] });
      void queryClient.invalidateQueries({ queryKey: ["frames"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed."),
  });

  const themeMutation = useMutation({
    mutationFn: (activeTheme: SiteTheme) => updateSiteSettings({ active_theme: activeTheme }),
    onSuccess: () => {
      toast.success("Theme updated.");
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Theme update failed."),
  });

  const frames = useMemo(() => data ?? [], [data]);
  const activeTheme = siteSettings?.active_theme ?? "classic";

  return (
    <div>
      <h1 className="text-3xl font-semibold">Store Settings</h1>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        Control storefront theme and per-frame offer pricing.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Storefront Theme</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {siteThemes.map((theme) => {
            const selected = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-amber-700 bg-amber-50 dark:border-amber-400 dark:bg-amber-900/20"
                    : "border-stone-200 bg-white hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900"
                }`}
                onClick={() => themeMutation.mutate(theme.id)}
                disabled={themeMutation.isPending}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{theme.name}</span>
                  {selected ? <Check className="h-4 w-4 text-amber-700" /> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  {theme.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-7 w-7 rounded-full border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pricing & Offers</h2>
      <div className="mt-6 space-y-3">
        {frames.map((frame) => (
          <div
            key={frame.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{frame.name}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Base: {inr(frame.price)}
              </p>
            </div>
            <Input
              className="w-40"
              type="number"
              placeholder="Offer price"
              value={offers[frame.id] ?? frame.offer_price ?? ""}
              onChange={(event) =>
                setOffers((prev) => ({
                  ...prev,
                  [frame.id]: event.target.value,
                }))
              }
            />
            <Button
              variant="outline"
              onClick={() =>
                mutation.mutate({
                  frameId: frame.id,
                  offerPrice: offers[frame.id] ?? frame.offer_price ?? "",
                })
              }
            >
              Save
            </Button>
          </div>
        ))}
      </div>
      </section>
    </div>
  );
}
