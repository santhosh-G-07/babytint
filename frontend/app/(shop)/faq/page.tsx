import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ordering, customization, shipping, and payments.",
};

const faqs = [
  {
    question: "Can I use the same photo in multiple slots?",
    answer:
      "Yes. In multi-slot frames you can assign one image to multiple slots or use different images in each slot.",
  },
  {
    question: "How many photos can I upload?",
    answer:
      "You can upload multiple photos from your gallery and choose exactly which image should go into each frame slot.",
  },
  {
    question: "How long does delivery usually take?",
    answer:
      "Typical dispatch happens within 2-4 business days after payment confirmation. Delivery timelines vary by destination.",
  },
  {
    question: "Do you provide order tracking?",
    answer:
      "Yes. You can track status from your Orders page. Tracking links are added once your package is dispatched.",
  },
  {
    question: "What payment methods are supported?",
    answer:
      "Checkout is powered by Razorpay, so cards, UPI, net banking, and supported wallets can be used.",
  },
  {
    question: "Can I edit my design after placing order?",
    answer:
      "Usually no, because print files begin processing quickly. Contact support immediately if you need urgent changes.",
  },
];

export default function FaqPage() {
  return (
    <div className="container-shell py-10 sm:py-12">
      <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900/70 sm:p-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Frequently Asked Questions</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Everything most customers ask before and after ordering.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
          >
            <summary className="cursor-pointer list-none text-base font-semibold">
              {faq.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">{faq.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
