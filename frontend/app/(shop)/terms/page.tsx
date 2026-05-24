import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Rules and conditions for using BabyTint and placing custom frame orders.",
};

export default function TermsPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Terms & Conditions</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Last updated: May 21, 2026
        </p>
      </section>

      <section className="mt-8 space-y-4 text-sm leading-6 text-stone-700 dark:text-stone-300">
        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">1. Order acceptance</h2>
          <p className="mt-2">
            Orders are confirmed after successful payment and are subject to production feasibility
            and serviceability of delivery location.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">2. Customization responsibility</h2>
          <p className="mt-2">
            Customers are responsible for reviewing photo placement, crop, and design before payment.
            Print output follows the approved customization data.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">3. Pricing and payment</h2>
          <p className="mt-2">
            Listed prices and offers are subject to change without prior notice. Taxes, shipping, and
            payment terms are applied as shown during checkout.
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-base font-semibold">4. Support and dispute handling</h2>
          <p className="mt-2">
            For order support, contact{" "}
            <a className="font-medium text-amber-700" href="mailto:support@babytintstore.com">
              support@babytintstore.com
            </a>
            . We aim to resolve concerns fairly with available order and shipment records.
          </p>
        </article>
      </section>
    </div>
  );
}
