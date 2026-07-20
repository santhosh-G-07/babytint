import Link from "next/link";
import type { Metadata } from "next";
import { Clock3, Mail, MessageSquareMore } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get help with customization, bulk gifting, order support, and delivery queries.",
};

const channels = [
  {
    title: "Email support",
    detail: "Share order ID and screenshots for the fastest help.",
    value: "support@babytintstore.com",
    href: "mailto:support@babytintstore.com",
    icon: Mail,
  },
  {
    title: "WhatsApp assistance",
    detail: "Quick design and order help during business hours.",
    value: "+91 90000 00000",
    href: "https://wa.me/919000000000",
    icon: MessageSquareMore,
  },
  {
    title: "Support window",
    detail: "Monday to Saturday",
    value: "10:00 AM - 7:00 PM IST",
    href: "#",
    icon: Clock3,
  },
];

export default function ContactPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Contact BabyTint</h1>
        <p className="mt-3 max-w-3xl text-stone-600 dark:text-stone-300">
          Need help with your customization, payment, delivery, or a bulk gifting request? Reach
          out and our team will help you quickly.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {channels.map((item) => {
          const Icon = item.icon;
          const cardClassName =
            "rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-amber-700";
          if (item.href === "#") {
            return (
              <div key={item.title} className={cardClassName}>
                <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{item.detail}</p>
                <p className="mt-2 text-sm font-medium text-stone-700 dark:text-stone-200">{item.value}</p>
              </div>
            );
          }

          return (
            <a
              key={item.title}
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              className={cardClassName}
            >
              <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{item.detail}</p>
              <p className="mt-2 text-sm font-medium text-stone-700 dark:text-stone-200">{item.value}</p>
            </a>
          );
        })}
      </section>

      <section className="mt-8 rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50 p-6 dark:border-stone-800 dark:from-stone-900 dark:to-stone-900">
        <h2 className="text-2xl font-semibold">Before you contact support</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
          <li>Keep your order ID ready if you already placed an order.</li>
          <li>Attach screenshots for upload or checkout issues.</li>
          <li>Mention device and browser if customization UI behaves unexpectedly.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/orders">Open My Orders</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/faq">Read FAQ</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
