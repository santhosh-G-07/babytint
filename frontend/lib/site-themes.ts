import type { SiteTheme } from "@/types";

export const siteThemes: Array<{
  id: SiteTheme;
  name: string;
  description: string;
  swatches: string[];
}> = [
  {
    id: "classic",
    name: "Classic Studio",
    description: "Warm, calm, premium. Best all-round storefront theme.",
    swatches: ["#faf7f1", "#8a6a42", "#1f1a17"],
  },
  {
    id: "blush",
    name: "Baby Blush",
    description: "Soft pink and sage, made for newborn gifting.",
    swatches: ["#fff7f8", "#c7667a", "#52705d"],
  },
  {
    id: "midnight",
    name: "Midnight Luxe",
    description: "Dark luxury look for premium frame collections.",
    swatches: ["#101014", "#d4af37", "#f7f0dc"],
  },
];

export const defaultSiteTheme: SiteTheme = "classic";
