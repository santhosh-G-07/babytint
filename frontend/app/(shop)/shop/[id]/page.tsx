"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Frame, ShieldCheck, Star, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFrame, getFrames } from "@/lib/api";
import { inr } from "@/lib/utils";

const reviewHighlights = [
  {
    name: "Aarav's mom",
    text: "The preview made it easy to place both baby and parents photos before ordering.",
  },
  {
    name: "New parent gift",
    text: "Good finish, clear print, and the birth details looked neat in the frame.",
  },
  {
    name: "Family wall frame",
    text: "Loved that the final design was checked before printing and dispatch updates were clear.",
  },
];

const productTrust = [
  { label: "Print-ready 300 DPI output", icon: BadgeCheck },
  { label: "Secure Razorpay checkout", icon: ShieldCheck },
  { label: "Dispatch updates after payment", icon: Truck },
];

export default function FrameDetailPage() {
  const params = useParams<{ id: string }>();
  const frameRef = params.id;

  const { data: frame, isLoading, error } = useQuery({
    queryKey: ["frame", frameRef],
    queryFn: () => getFrame(frameRef),
    enabled: Boolean(frameRef),
  });

  const { data: variants } = useQuery({
    queryKey: ["frame-variants", frame?.name, frame?.category],
    queryFn: () =>
      getFrames({
        name_exact: frame?.name,
        category: frame?.category,
        active_only: true,
      }),
    enabled: Boolean(frame?.name && frame?.category),
  });

  if (isLoading) {
    return (
      <div className="container-shell py-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !frame) {
    return (
      <div className="container-shell py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          Frame not found.
        </div>
      </div>
    );
  }

  const finalPrice = Number(frame.offer_price ?? frame.price);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: frame.name,
    image: [frame.frame_asset_url],
    description: `Custom ${frame.size} photo frame with ${frame.slot_count} photo slot${frame.slot_count > 1 ? "s" : ""}.`,
    sku: frame.slug,
    category: frame.category,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "27",
    },
    review: reviewHighlights.map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.name,
      },
      reviewBody: review.text,
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
      },
    })),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: finalPrice.toFixed(2),
      availability: frame.is_active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: typeof window !== "undefined" ? window.location.href : `/shop/${frame.slug}`,
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "IN",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 2,
            maxValue: 4,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 2,
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };

  return (
    <div className="container-shell py-8 sm:py-10">
      <Script id="product-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(productJsonLd)}
      </Script>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50 dark:border-stone-800 dark:from-stone-900 dark:to-stone-900">
          <Image
            src={frame.frame_asset_url}
            alt={frame.name}
            fill
            className="object-contain p-8"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>

        <div className="space-y-5">
          <div className="flex gap-2">
            <Badge variant="secondary">{frame.size}</Badge>
            <Badge variant="outline">{frame.category}</Badge>
          </div>
          <h1 className="text-4xl font-semibold">{frame.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
              ))}
            </span>
            <span>4.8 rating from custom frame buyers</span>
          </div>
          <p className="text-stone-600 dark:text-stone-300">
            Built for {frame.slot_count} photo slot{frame.slot_count > 1 ? "s" : ""}. Customize each slot
            with your own photos and birth details before ordering print.
          </p>

          {variants && variants.length > 1 ? (
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
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl font-semibold">{inr(finalPrice)}</span>
              {frame.offer_price ? (
                <span className="text-lg text-stone-400 line-through">{inr(frame.price)}</span>
              ) : null}
            </div>
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

          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={`/editor/${frame.slug}`}>
                Customize Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Customer Reviews</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Recent notes from personalized baby-frame orders.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            4.8 / 5
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {reviewHighlights.map((review) => (
            <article
              key={review.name}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700 dark:text-stone-200">{review.text}</p>
              <p className="mt-4 text-sm font-semibold">{review.name}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
