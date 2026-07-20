import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BabyTint collects, uses, and protects customer information.",
};

export default function PrivacyPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Last updated: May 21, 2026
        </p>
      </section>

      <section className="mt-8 space-y-4 text-sm leading-6 text-stone-700 dark:text-stone-300">
        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">1. Information we collect</h2>
          <p className="mt-2">
            We may collect contact details, delivery address, order details, customization data, and
            payment status metadata required to process and support your orders.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">2. How we use information</h2>
          <p className="mt-2">
            Data is used for account authentication, order processing, customer support, fraud
            prevention, and service improvements.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">3. Payments and third parties</h2>
          <p className="mt-2">
            Payments are processed via Razorpay. Authentication and storage services may be provided
            through integrated third-party providers as configured by BabyTint.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">4. Contact for privacy requests</h2>
          <p className="mt-2">
            For privacy-related questions, email{" "}
            <a className="font-medium text-amber-700" href="mailto:support@babytintstore.com">
              support@babytintstore.com
            </a>
            .
          </p>
        </article>
      </section>
    </div>
  );
}
