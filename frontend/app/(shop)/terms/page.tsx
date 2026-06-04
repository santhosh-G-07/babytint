import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for ordering personalized photo frames from BabyTint Store.",
};

export default function TermsPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Terms of Service</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Last updated: May 31, 2026
        </p>
      </section>

      <section className="mt-8 space-y-4 text-sm leading-6 text-stone-700 dark:text-stone-300">
        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">1. Scope and acceptance</h2>
          <p className="mt-2">
            These terms apply when you browse, customize, or order on BabyTint. By using the site,
            you agree to these terms, along with the privacy and shipping policies.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">2. Product customization responsibility</h2>
          <p className="mt-2">
            You are responsible for reviewing uploaded photos, text, spelling, and placement before
            checkout. Production follows approved customization data and preview flow.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">3. Pricing, payments, and offers</h2>
          <p className="mt-2">
            Prices, discounts, and availability can change without notice. Final payable amount,
            including shipping and taxes (if applicable), is shown at checkout before payment.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">4. Cancellation, returns, and refunds</h2>
          <p className="mt-2">
            Custom-made products are generally non-returnable unless they are damaged or incorrect.
            See full policy on{" "}
            <Link className="font-medium text-amber-700" href="/cancellation-refund">
              Cancellation & Refund
            </Link>
            .
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">5. Delivery and failed attempts</h2>
          <p className="mt-2">
            Delivery timelines are estimates. Delays due to courier network, weather, public events,
            or incomplete address details may occur. Additional re-delivery charges may apply for
            repeated failed delivery attempts.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">6. Intellectual property</h2>
          <p className="mt-2">
            All site design, branding, and content belong to BabyTint unless stated otherwise. You
            confirm that uploaded photos/content are owned by you or used with permission.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">7. Limitation of liability</h2>
          <p className="mt-2">
            BabyTint is not liable for indirect or consequential losses. Any liability related to an
            order is limited to the amount paid for that order, to the extent allowed by law.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">8. Contact and policy updates</h2>
          <p className="mt-2">
            For order or policy support, contact{" "}
            <a className="font-medium text-amber-700" href="mailto:support@babytintstore.com">
              support@babytintstore.com
            </a>
            . Terms may be updated periodically; updated versions are posted on this page with the
            latest date.
          </p>
        </article>
      </section>
    </div>
  );
}
