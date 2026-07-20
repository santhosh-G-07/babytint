import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3001");
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "BabyTint | Custom Photo Frames",
    template: "%s | BabyTint",
  },
  description:
    "BabyTint Store for custom baby photo frames, kids photo frame gifts, and online family collage frames with live editing and print-ready ordering.",
  applicationName: "BabyTint",
  keywords: [
    "babytint",
    "babytint store",
    "custom photo frames",
    "baby photo frame",
    "photo frame for children",
    "kids photo frame",
    "online frames",
    "online photo frame store",
    "personalized frame gifts",
    "photo collage frame",
    "print ready frame design",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BabyTint | Custom Photo Frames",
    description:
      "Design personalized baby and family photo frames online with live editing and print-ready output at BabyTint Store.",
    url: "/",
    siteName: "BabyTint",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "BabyTint | Custom Photo Frames",
    description:
      "Design personalized baby and family photo frames online with live editing and print-ready output at BabyTint Store.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-site-theme="classic" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
