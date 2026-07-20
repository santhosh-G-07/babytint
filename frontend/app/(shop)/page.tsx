"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  BadgeCheck,
  HeartHandshake,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFrames } from "@/lib/api";
import { framePreviewClassName, framePreviewUrl, inr } from "@/lib/utils";
import type { FrameTemplate } from "@/types";

const processSteps = [
  {
    title: "Choose your frame",
    detail: "Pick one of our ready templates in the size you like.",
    icon: Search,
  },
  {
    title: "Customize with live preview",
    detail: "Add a photo, move slots, style text, and preview before checkout.",
    icon: Sparkles,
  },
  {
    title: "Pay safely",
    detail: "Checkout with Razorpay UPI, cards, net banking, and wallets.",
    icon: ShieldCheck,
  },
  {
    title: "Track order",
    detail: "Follow payment, printing, dispatch, and delivery updates from your account.",
    icon: Truck,
  },
];

const trustPoints = [
  "Every frame template is quality checked",
  "Free design help on WhatsApp and email",
  "Secure payments and tracked delivery updates",
];

const ageFinds = [
  {
    label: "Newborn Moments",
    detail: "Birth details and first memories",
  },
  {
    label: "6 to 12 Months",
    detail: "Milestone smiles and family shots",
  },
  {
    label: "1 to 3 Years",
    detail: "Playful collage with text styling",
  },
  {
    label: "Gift Picks",
    detail: "Ready-to-gift personalized designs",
  },
];

const serviceHighlights = [
  {
    title: "Preview before payment",
    detail: "Your saved preview is attached to the order so production can verify the design before printing.",
    tag: "Design review",
  },
  {
    title: "Payment recovery built in",
    detail: "If the payment window closes or fails, the same order can be resumed without rebuilding the cart.",
    tag: "Retry flow",
  },
  {
    title: "Status updates after payment",
    detail: "Orders move from received to printing, then dispatched with a tracking link once shipment is ready.",
    tag: "Fulfillment",
  },
];

const faqPreview = [
  {
    question: "Can I customize font style and color in each text box?",
    answer:
      "Yes. You can edit text, font family, font size, color, line height, alignment, and partial text style directly in the editor.",
  },
  {
    question: "Can I move and resize text/photo slots?",
    answer:
      "Yes. Select the text box or slot in editor and drag or resize it. This works for both admin templates and customer customization.",
  },
  {
    question: "How many frame options do you have now?",
    answer:
      "The homepage highlights a subset of active templates, while the Shop page lists the full active catalog.",
  },
];

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "BabyTint Store",
  description:
    "Online store for custom baby photo frames, kids collage wall frames, and personalized family frame gifts.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://babytintstore.com",
  areaServed: "IN",
  sameAs: [],
};

export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["frames", "featured"],
    queryFn: () => getFrames({ active_only: true }),
  });

  const frames = data ?? [];
  const featuredSix = frames.slice(0, 6);
  const heroFrame = featuredSix[0];

  const categoryCards = frames
    .reduce<Array<{ category: string; frame: FrameTemplate }>>((acc, frame) => {
      if (!acc.some((entry) => entry.category === frame.category)) {
        acc.push({ category: frame.category, frame });
      }
      return acc;
    }, [])
    .slice(0, 6);

  const hasFrames = !isLoading && !error && featuredSix.length > 0;

  return (
    <div className="pb-16">
      <Script id="home-jsonld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(homeJsonLd)}
      </Script>

      <div className="container-shell pt-6 sm:pt-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#b6d4ff] bg-[linear-gradient(125deg,#f8fbff_0%,#ffffff_45%,#ffeef4_100%)] px-5 py-7 shadow-[0_22px_52px_-34px_rgba(20,64,127,0.45)] sm:px-8 sm:py-10 lg:px-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#4d8ce8]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-[#fc859a]/24 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-[#4d8ce8]/35 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2f63a7]">
                <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                Premium Custom Frame Studio
              </p>
              <h1 className="mt-4 max-w-2xl text-[1.95rem] font-semibold leading-tight text-[#113566] sm:text-[2.75rem]">
                Every frame verified, safe payments, and full baby memory customization.
              </h1>
              <p className="mt-4 max-w-xl text-[1.04rem] leading-relaxed text-[#37577f]">
                Design your frame online with text styling, font control, alignment, and live preview.
                Perfect for baby memories, gifts, and family keepsakes.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="w-full rounded-full border-0 bg-[#04a16b] px-7 text-white hover:bg-[#03875a] sm:w-auto"
                >
                  <Link href="/shop">
                    Browse Frames
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full border-[#4d8ce8]/50 bg-white text-[#2f63a7] hover:bg-[#eaf3ff] sm:w-auto"
                >
                  <Link href="/orders">Track Order</Link>
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {trustPoints.map((point) => (
                  <span
                    key={point}
                    className="inline-flex items-center rounded-full border border-[#d4e4ff] bg-white px-3 py-1 text-xs font-medium text-[#36557d]"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative pt-6">
              <div className="absolute left-4 top-0 z-10 rounded-full bg-[#4d8ce8] px-3 py-1 text-xs font-bold text-white shadow-sm">
                Live Preview
              </div>
              <div className="rounded-[1.8rem] border border-[#d6e6ff] bg-white p-4 shadow-lg sm:p-5">
                <div className="overflow-hidden rounded-2xl border border-[#e3ecff] bg-[linear-gradient(180deg,#f5faff_0%,#fff1f6_100%)] p-4 sm:p-5">
                  <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-xl">
                    {heroFrame ? (
                      <Image
                        src={framePreviewUrl(heroFrame)}
                        alt={heroFrame.name}
                        fill
                        className={framePreviewClassName(heroFrame, "object-cover", "object-contain")}
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-stone-500">
                        Frame preview loading...
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#113566]">{heroFrame?.name ?? "BabyTint Frame"}</p>
                    <p className="text-xs text-[#4d6b90]">Live editor with text styling and drag-resize tools</p>
                  </div>
                  <Link
                    href={heroFrame ? `/shop/${heroFrame.slug}` : "/shop"}
                    className="rounded-full bg-[#f7b500] px-3 py-1.5 text-xs font-bold text-[#493503] transition hover:bg-[#e7a800]"
                  >
                    View
                  </Link>
                </div>
                <Image
                  src="/images/cute-baby-hero.png"
                  alt="Cute baby hero sticker"
                  width={96}
                  height={96}
                  className="pointer-events-none absolute -bottom-1 right-3 hidden h-20 w-20 object-contain drop-shadow-md sm:block"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[#19457b] sm:text-3xl">Featured Frames</h2>
              <p className="mt-1 text-sm text-[#4b6790]">Active BabyTint frames ready for customization.</p>
            </div>
            <Link href="/shop" className="text-sm font-semibold text-[#fc6488] hover:text-[#e5456d]">
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-3 rounded-2xl border border-[#dce9ff] bg-white p-3">
                    <Skeleton className="aspect-[4/4.2] rounded-xl" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                ))
              : featuredSix.map((frame) => {
                  const finalPrice = Number(frame.offer_price ?? frame.price);
                  const oldPrice = Number(frame.price);
                  const hasDiscount = frame.offer_price !== null && finalPrice < oldPrice;
                  return (
                    <Link
                      key={frame.id}
                      href={`/shop/${frame.slug}`}
                      className="group rounded-2xl border border-[#dce9ff] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="relative overflow-hidden rounded-xl border border-[#e6efff] bg-[#f7fbff]">
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#fc859a] px-2.5 py-1 text-[0.67rem] font-bold text-white">
                          {hasDiscount ? "Offer" : "Ready to customize"}
                        </span>
                        <div className="relative aspect-[4/4.2]">
                          <Image
                            src={framePreviewUrl(frame)}
                            alt={frame.name}
                            fill
                            className={framePreviewClassName(
                              frame,
                              "object-cover transition duration-300 group-hover:scale-[1.03]",
                              "object-contain p-3 transition duration-300 group-hover:scale-[1.03]",
                            )}
                          />
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-1 text-sm font-semibold text-[#203a5e]">{frame.name}</p>
                      <p className="mt-0.5 text-xs text-[#6780a1]">{frame.slot_count} photo slots</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-[#0f693f]">{inr(finalPrice)}</span>
                          {hasDiscount ? (
                            <span className="text-xs text-stone-400 line-through">{inr(oldPrice)}</span>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-[#04a16b] px-3 py-1 text-xs font-bold text-white">
                          Customize
                        </span>
                      </div>
                    </Link>
                  );
                })}
          </div>
          {!isLoading && error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Could not load frames from backend. Please check API is running on port 8000.
            </p>
          ) : null}
        </section>

        <section className="mt-11">
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-semibold text-[#19457b]">Order Confidence</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {serviceHighlights.map((story) => (
              <article
                key={story.title}
                className="relative overflow-hidden rounded-2xl border border-[#dce9ff] bg-[linear-gradient(135deg,#1f3553_0%,#2f4f7a_62%,#4f7db4_100%)] p-5 text-white shadow-sm"
              >
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
                <p className="text-sm font-bold text-[#ffe293]">{story.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/90">{story.detail}</p>
                <p className="mt-4 text-xs font-semibold text-[#ffcbda]">{story.tag}</p>
                <span className="absolute right-4 top-4 rounded-full bg-[#fc859a] px-2 py-1 text-[0.64rem] font-bold">
                  Verified flow
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-11 rounded-[2rem] border border-[#dce9ff] bg-white px-5 py-7 sm:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#19457b]">Shop by Category</h2>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categoryCards.map((item, index) => (
              <Link
                key={`${item.category}-${item.frame.id}`}
                href={`/shop/${item.frame.slug}`}
                className="group rounded-2xl border border-[#e2ecff] bg-[#fafcff] p-3 text-center transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#d9e7ff] bg-white sm:h-28 sm:w-28">
                  <div className="relative h-full w-full">
                    <Image
                      src={framePreviewUrl(item.frame)}
                      alt={item.category}
                      fill
                      className={framePreviewClassName(item.frame, "object-cover", "object-contain p-3")}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#29496f]">{item.category}</p>
                <p className="text-[0.68rem] text-[#6a85a6]">Collection {index + 1}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[1.9rem] border border-[#2d9f76] bg-[linear-gradient(180deg,#06ab72_0%,#048f61_100%)] px-5 py-6 text-white sm:px-8">
          <h2 className="text-center text-2xl font-semibold">Every Age&apos;s Find</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ageFinds.map((item) => (
              <div key={item.label} className="rounded-full border border-white/35 bg-white/10 px-4 py-3 text-center">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-white/85">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {hasFrames ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#19457b]">Latest Finds</h2>
                <p className="mt-1 text-sm text-[#4b6790]">Explore all six highlighted frames in one view.</p>
              </div>
              <Link href="/shop" className="text-sm font-semibold text-[#fc6488] hover:text-[#e5456d]">
                Go to shop
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredSix.map((frame) => (
                <Link
                  key={`latest-${frame.id}`}
                  href={`/shop/${frame.slug}`}
                  className="group overflow-hidden rounded-2xl border border-[#dce9ff] bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[5/3.8] bg-[linear-gradient(180deg,#f8fbff_0%,#fff4f7_100%)]">
                    <Image
                      src={framePreviewUrl(frame)}
                      alt={frame.name}
                      fill
                      className={framePreviewClassName(
                        frame,
                        "object-cover transition duration-300 group-hover:scale-[1.03]",
                        "object-contain p-4 transition duration-300 group-hover:scale-[1.03]",
                      )}
                    />
                  </div>
                  <div className="border-t border-[#e3edff] p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-[#1f3b5f]">{frame.name}</p>
                    <p className="mt-1 text-xs text-[#6780a1]">Try text styling and custom font controls</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10 rounded-[2rem] border border-[#ffe2a8] bg-[#fff8e8] px-5 py-7 sm:px-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[#7c5a16]">How It Works</h2>
            <Link href="/faq" className="text-sm font-semibold text-[#e09500] hover:text-[#be7a00]">
              Learn more
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-2xl border border-[#f7dcaa] bg-white p-4 shadow-sm">
                  <div className="inline-flex rounded-full bg-[#fff2cc] p-2 text-[#b27600]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-wide text-[#be8a2d]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[#5b4316]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[#7d6540]">{step.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-[#dce9ff] bg-[#f9fbff] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#2f63a7]">
            <HeartHandshake className="h-5 w-5" />
            <h2 className="text-2xl font-semibold">Need-to-know before checkout</h2>
          </div>
          <div className="mt-5 space-y-3">
            {faqPreview.map((faq) => (
              <details key={faq.question} className="rounded-xl border border-[#d9e7ff] bg-white p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#1f3b5f]">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm text-[#5a7598]">{faq.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" asChild className="rounded-full border-[#7ca8e5] text-[#2f63a7]">
              <Link href="/shipping-returns">Shipping & Returns</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-full border-[#7ca8e5] text-[#2f63a7]">
              <Link href="/privacy">Privacy</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-full border-[#7ca8e5] text-[#2f63a7]">
              <Link href="/terms">Terms</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
