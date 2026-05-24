import Link from "next/link";

const shopLinks = [
  { href: "/shop", label: "Browse Frames" },
  { href: "/about", label: "About BabyTint" },
  { href: "/faq", label: "FAQ" },
];

const supportLinks = [
  { href: "/contact", label: "Contact Support" },
  { href: "/shipping-returns", label: "Shipping & Returns" },
  { href: "/orders", label: "Track Orders" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-stone-200 py-10 dark:border-stone-800">
      <div className="container-shell grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="display-font text-2xl">BabyTint</p>
          <p className="mt-3 max-w-sm text-sm text-stone-600 dark:text-stone-300">
            Personalized baby and family frames with live customization, secure checkout, and
            print-ready output.
          </p>
          <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
            Need quick help? Write to{" "}
            <a className="font-medium text-amber-700" href="mailto:support@babytintstore.com">
              support@babytintstore.com
            </a>
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">Shop</p>
          <div className="mt-3 space-y-2">
            {shopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Support</p>
          <div className="mt-3 space-y-2">
            {supportLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Legal</p>
          <div className="mt-3 space-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container-shell mt-8 flex flex-col gap-2 border-t border-stone-200 pt-5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright {new Date().getFullYear()} BabyTint. All rights reserved.</p>
        <p>Secure checkout | Premium matte prints | Pan-India delivery</p>
      </div>
    </footer>
  );
}
