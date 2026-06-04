import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Shipping timelines, delivery guidance, and return policy for BabyTint orders.",
};

export default function ShippingReturnsPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Shipping & Returns</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Clear expectations so you can order with confidence.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Shipping timeline</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Order processing starts after payment confirmation.</li>
            <li>Typical print + dispatch time is 2-4 business days.</li>
            <li>Standard delivery usually takes 3-7 business days after dispatch, depending on pincode serviceability.</li>
            <li>Shipping charges, if any, are shown during checkout before payment.</li>
            <li>Tracking link is shared once order status becomes dispatched.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-xl font-semibold">Returns and replacements</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            <li>Customized items are generally non-returnable.</li>
            <li>Damaged items in transit are eligible for replacement review.</li>
            <li>Report damage within 48 hours with package and product photos.</li>
            <li>Orders can be cancelled only before the print file enters production.</li>
            <li>Approved refunds are initiated to the original payment method within 5-7 business days.</li>
            <li>For delivery issues, contact support with order ID and phone number.</li>
          </ul>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300">
        Policy note: Final replacement and refund decisions depend on verification of issue details
        and courier status. You can also review the dedicated{" "}
        <Link className="font-medium text-amber-700" href="/cancellation-refund">
          Cancellation & Refund
        </Link>{" "}
        page.
      </section>
    </div>
  );
}
