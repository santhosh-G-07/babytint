import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Frame, ShieldCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssistedCustomizationButton } from "@/components/shop/AssistedCustomizationButton";
import { framePreviewClassName, framePreviewUrl, inr } from "@/lib/utils";
import type { FrameTemplate } from "@/types";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const productTrust = [
  { label: "Print-ready 300 DPI output", icon: BadgeCheck },
  { label: "Secure Razorpay checkout", icon: ShieldCheck },
  { label: "Dispatch updates after payment", icon: Truck },
];

const expectationCards = [
  {
    title: "Customize online",
    detail: "Upload every photo slot, edit text placement, and preview the final layout before the order is created.",
  },
  {
    title: "Resume payment if needed",
    detail: "If Razorpay closes before completion, the same order can be reopened from the Orders page without rebuilding the design.",
  },
  {
    title: "Track fulfillment after payment",
    detail: "Paid orders move through printing and dispatch, then receive a tracking link once shipment is ready.",
  },
];

async function fetchFrame(frameRef: string): Promise<FrameTemplate | null> {
  const response = await fetch(`${API_BASE}/api/frames/${encodeURIComponent(frameRef)}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Could not load frame details.");
  }

  return (await response.json()) as FrameTemplate;
}

async function fetchVariants(frame: FrameTemplate): Promise<FrameTemplate[]> {
  const params = new URLSearchParams({
    name_exact: frame.name,
    category: frame.category,
    active_only: "true",
  });
  const response = await fetch(`${API_BASE}/api/frames?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as FrameTemplate[];
}

export default async function FrameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const frame = await fetchFrame(id);

  if (!frame) {
    notFound();
  }

  const variants = await fetchVariants(frame);
  const finalPrice = Number(frame.offer_price ?? frame.price);
  const assistedFee = Number(frame.assisted_customization_price ?? 0);
  const assistedTotal = finalPrice + assistedFee;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}/shop/${frame.slug}`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: frame.name,
    image: [framePreviewUrl(frame)],
    description: `Custom ${frame.size} photo frame with ${frame.slot_count} photo slot${frame.slot_count > 1 ? "s" : ""}.`,
    sku: frame.slug,
    category: frame.category,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: finalPrice.toFixed(2),
      availability: frame.is_active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonicalUrl,
    },
  };

  return (
    <div className="container-shell py-8 sm:py-10">
      <Script id="product-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(productJsonLd)}
      </Script>

      {!frame.is_active ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          This frame is currently unavailable for new checkout. Browse the shop for active designs.
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] xl:items-start">
        <div className="relative aspect-[1/1.02] overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50 dark:border-stone-800 dark:from-stone-900 dark:to-stone-900">
          <Image
            src={framePreviewUrl(frame)}
            alt={frame.name}
            fill
            className={framePreviewClassName(frame, "object-cover", "object-contain p-8")}
            sizes="(max-width: 1280px) 100vw, 52vw"
            priority
          />
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{frame.size}</Badge>
            <Badge variant="outline">{frame.category}</Badge>
            {!frame.is_active ? <Badge variant="outline">Unavailable</Badge> : null}
          </div>

          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">{frame.name}</h1>
            <p className="mt-3 text-stone-600 dark:text-stone-300">
              Built for {frame.slot_count} photo slot{frame.slot_count > 1 ? "s" : ""}. Customize each slot
              with your own photos and birth details before ordering print.
            </p>
          </div>

          {variants.length > 1 ? (
            <div className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
              <p className="text-sm text-stone-500 dark:text-stone-400">Available sizes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants
                  .slice()
                  .sort((a, b) => a.size.localeCompare(b.size))
                  .map((variant) => (
                    <Link
                      key={variant.id}
                      href={`/shop/${variant.slug}`}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        variant.id === frame.id
                          ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                          : "border-stone-300 text-stone-700 hover:border-stone-500 dark:border-stone-700 dark:text-stone-300"
                      }`}
                    >
                      {variant.size}
                    </Link>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
            <p className="text-sm text-stone-500 dark:text-stone-400">Price</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold">{inr(finalPrice)}</span>
              {frame.offer_price ? (
                <span className="text-lg text-stone-400 line-through">{inr(frame.price)}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Shipping is currently included in the displayed total.</p>
            {frame.assisted_customization_price != null ? (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Customize With Us total: {inr(assistedTotal)} including {inr(assistedFee)} design help.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {productTrust.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-medium text-stone-700 dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-200"
                >
                  <Icon className="h-4 w-4 text-emerald-600" />
                  {item.label}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {frame.is_active ? (
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link href={`/editor/${frame.slug}`}>
                  Customize Myself
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" className="w-full sm:w-auto" disabled>
                Currently unavailable
              </Button>
            )}
            {frame.assisted_customization_price != null ? (
              <AssistedCustomizationButton frame={frame} />
            ) : null}
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/shop">
                <Frame className="mr-2 h-4 w-4" />
                Continue Browsing
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300">
            Need policy details before ordering? Read{" "}
            <Link href="/shipping-returns" className="font-medium text-amber-700">
              Shipping & Returns
            </Link>{" "}
            and{" "}
            <Link href="/faq" className="font-medium text-amber-700">
              FAQ
            </Link>
            .
          </div>
        </div>
      </div>

      <section className="mt-12">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">What to Expect</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            The customer flow around this frame is designed to stay clear even if payment needs to be retried.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {expectationCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
            >
              <h3 className="text-base font-semibold">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-700 dark:text-stone-200">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
