import type { MetadataRoute } from "next";

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function productRoutes(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const response = await fetch(`${API_BASE}/api/frames`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const frames = (await response.json()) as { slug: string; created_at?: string }[];
    return frames.map((frame) => ({
      url: `${base}/shop/${frame.slug}`,
      lastModified: frame.created_at ? new Date(frame.created_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const routes = [
    "",
    "/shop",
    "/about",
    "/faq",
    "/contact",
    "/shipping-returns",
    "/privacy",
    "/terms",
  ];

  return [
    ...routes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "daily" as const : "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...(await productRoutes(base)),
  ];
}
