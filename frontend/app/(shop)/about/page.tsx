import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how BabyTint helps families turn everyday photos into premium wall-ready frame prints.",
};

const promises = [
  {
    title: "Print-first quality",
    detail: "Every output is generated in high-resolution PNG suitable for lab-grade printing.",
    icon: ShieldCheck,
  },
  {
    title: "Easy live customization",
    detail: "Upload each photo, crop it in the frame slot, preview the design, and order confidently.",
    icon: Sparkles,
  },
  {
    title: "Reliable delivery support",
    detail: "Track order status from received to dispatched with clear updates in your account.",
    icon: Truck,
  },
];

export default function AboutPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Our Story</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Built for memory-led gifting</h1>
        <p className="mt-4 max-w-3xl text-stone-600 dark:text-stone-300">
          BabyTint started with one goal: make custom family frames feel effortless online. Instead
          of sending photos on chat and waiting days for previews, you can now see your design
          instantly, adjust each slot, and place your order with confidence.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {promises.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{item.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50 p-7 dark:border-stone-800 dark:from-stone-900 dark:to-stone-900 sm:p-10">
        <h2 className="text-2xl font-semibold">How ordering works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            "Pick your frame size and style",
            "Upload photos and customize every slot",
            "Checkout securely with Razorpay",
            "We process and dispatch your print order",
          ].map((step, index) => (
            <div key={step} className="rounded-xl border border-stone-200 bg-white/70 p-4 dark:border-stone-700 dark:bg-stone-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Step {index + 1}</p>
              <p className="mt-2 text-sm text-stone-700 dark:text-stone-200">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/shop">
              Browse Frames
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
