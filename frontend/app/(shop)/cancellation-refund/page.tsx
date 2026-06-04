import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description: "Cancellation, replacement, and refund policy for BabyTint custom frame orders.",
};

export default function CancellationRefundPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Cancellation & Refund Policy</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">Last updated: May 31, 2026</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Order cancellation</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Cancellation is allowed before production starts.</li>
            <li>Once print production begins, cancellation is usually not possible for personalized items.</li>
            <li>To request cancellation, contact support quickly with your order ID.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Damaged or incorrect product</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Report issues within 48 hours of delivery.</li>
            <li>Share clear photos/videos of product and outer packaging.</li>
            <li>After verification, we may provide replacement, correction, or refund.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Refund timeline</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Approved refunds are initiated to the original payment method.</li>
            <li>Typical processing time is 5-7 business days.</li>
            <li>Actual credit time can vary by bank or payment provider.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Non-refundable situations</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Customer-approved customization with no manufacturing or shipping issue.</li>
            <li>Incorrect text/photo uploaded by customer after order confirmation.</li>
            <li>Minor color differences due to monitor/display variance.</li>
          </ul>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300">
        Support contact:{" "}
        <a className="font-medium text-amber-700" href="mailto:support@babytintstore.com">
          support@babytintstore.com
        </a>
        . Please include your order ID and phone number for faster help.
      </section>
    </div>
  );
}
