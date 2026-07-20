import { useEffect, useState } from "react";
import {
  Baloo_2,
  Caveat,
  Dancing_Script,
  Fredoka,
  Montserrat,
  Pacifico,
  Playfair_Display,
  Quicksand,
  Yellowtail,
} from "next/font/google";

import type { TextFontGroup, TextWeight } from "@/types";

export interface FrameFontOption {
  label: string;
  family: string;
  weight: TextWeight;
}

const dancingScript = Dancing_Script({ subsets: ["latin"], weight: ["400", "700"] });
const yellowtail = Yellowtail({ subsets: ["latin"], weight: "400" });
const baloo2 = Baloo_2({ subsets: ["latin"], weight: ["400", "600", "700"] });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "600", "700"] });
const caveat = Caveat({ subsets: ["latin"], weight: ["400", "700"] });
const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "600"] });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700"] });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"] });

// Maps each frame-text font family name to its actual loaded CSS font-family string.
// Anything not listed here (e.g. "Arial") renders with the plain fallback stack below.
const FRAME_FONT_STACKS: Record<string, string> = {
  "Dancing Script": dancingScript.style.fontFamily,
  Yellowtail: yellowtail.style.fontFamily,
  "Baloo 2": baloo2.style.fontFamily,
  Quicksand: quicksand.style.fontFamily,
  Caveat: caveat.style.fontFamily,
  Fredoka: fredoka.style.fontFamily,
  Pacifico: pacifico.style.fontFamily,
  Montserrat: montserrat.style.fontFamily,
  "Playfair Display": playfairDisplay.style.fontFamily,
};

export const frameFontGroups: Record<TextFontGroup, FrameFontOption[]> = {
  name: [
    { label: "Dancing Script", family: "Dancing Script", weight: "normal" },
    { label: "Yellowtail", family: "Yellowtail", weight: "normal" },
    { label: "Baloo 2 Bold", family: "Baloo 2", weight: "bold" },
    { label: "Quicksand Bold", family: "Quicksand", weight: "bold" },
  ],
  numbers: [
    { label: "Dancing Script", family: "Dancing Script", weight: "normal" },
    { label: "Quicksand Bold", family: "Quicksand", weight: "bold" },
    { label: "Caveat", family: "Caveat", weight: "normal" },
    { label: "Fredoka", family: "Fredoka", weight: "normal" },
    { label: "Pacifico", family: "Pacifico", weight: "normal" },
    { label: "Montserrat", family: "Montserrat", weight: "normal" },
    { label: "Arial", family: "Arial", weight: "normal" },
  ],
  details: [
    { label: "Arial", family: "Arial", weight: "normal" },
    { label: "Quicksand", family: "Quicksand", weight: "normal" },
    { label: "Baloo 2", family: "Baloo 2", weight: "normal" },
    { label: "Yellowtail", family: "Yellowtail", weight: "normal" },
    { label: "Playfair Display", family: "Playfair Display", weight: "normal" },
  ],
  general: [
    { label: "Montserrat", family: "Montserrat", weight: "normal" },
    { label: "Arial", family: "Arial", weight: "normal" },
    { label: "Playfair Display", family: "Playfair Display", weight: "normal" },
  ],
};

export function fontOptionValue(option: Pick<FrameFontOption, "family" | "weight">) {
  return `${option.family}::${option.weight}`;
}

export function parseFontOption(value: string): Pick<FrameFontOption, "family" | "weight"> {
  const [family, weight] = value.split("::");
  return {
    family: family || "Arial",
    weight: weight === "bold" ? "bold" : "normal",
  };
}

export function fontStack(family: string) {
  const resolved = FRAME_FONT_STACKS[family];
  if (resolved) {
    return `${resolved}, Arial, sans-serif`;
  }
  return `"${family}", Arial, sans-serif`;
}

// Every (family, weight) combination a customer can pick, for preloading.
export const ALL_FRAME_FONT_OPTIONS: FrameFontOption[] = Array.from(
  new Map(
    Object.values(frameFontGroups)
      .flat()
      .map((option) => [fontOptionValue(option), option]),
  ).values(),
);

export function framePreloadFontFace(option: Pick<FrameFontOption, "family" | "weight">): string | null {
  const resolved = FRAME_FONT_STACKS[option.family];
  if (!resolved) {
    return null;
  }
  const weight = option.weight === "bold" ? "700" : "400";
  return `${weight} 16px ${resolved}`;
}

// Canvas text (Konva) does not wait for web fonts to finish loading the way
// DOM text does, so the first draw can silently use a fallback font. This
// hook explicitly requests every frame-text font/weight combo up front and
// flips to `true` once the browser confirms they're ready to paint, so
// callers can trigger a redraw at that point.
export function useFrameFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (typeof document === "undefined" || !("fonts" in document)) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const specs = ALL_FRAME_FONT_OPTIONS.map(framePreloadFontFace).filter(
      (spec): spec is string => Boolean(spec),
    );

    Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => null)))
      .then(() => document.fonts.ready)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
