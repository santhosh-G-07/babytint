import type { TextFontGroup, TextWeight } from "@/types";

export interface FrameFontOption {
  label: string;
  family: string;
  weight: TextWeight;
}

export const frameFontGroups: Record<TextFontGroup, FrameFontOption[]> = {
  name: [
    { label: "Segoe Script", family: "Segoe Script", weight: "normal" },
    { label: "Gabriola Bold", family: "Gabriola", weight: "bold" },
    { label: "MV Boli Bold", family: "MV Boli", weight: "bold" },
    { label: "Leelawadee Bold", family: "Leelawadee", weight: "bold" },
  ],
  numbers: [
    { label: "Segoe Script", family: "Segoe Script", weight: "normal" },
    { label: "Leelawadee Bold", family: "Leelawadee", weight: "bold" },
    { label: "Kristen ITC", family: "Kristen ITC", weight: "normal" },
    { label: "Hobo Std", family: "Hobo Std", weight: "normal" },
    { label: "Illuma", family: "Illuma", weight: "normal" },
    { label: "Montserrat", family: "Montserrat", weight: "normal" },
    { label: "Arial", family: "Arial", weight: "normal" },
  ],
  details: [
    { label: "Arial", family: "Arial", weight: "normal" },
    { label: "Leelawadee", family: "Leelawadee", weight: "normal" },
    { label: "MV Boli", family: "MV Boli", weight: "normal" },
    { label: "Gabriola", family: "Gabriola", weight: "normal" },
    { label: "Cambria", family: "Cambria", weight: "normal" },
  ],
  general: [
    { label: "Montserrat", family: "Montserrat", weight: "normal" },
    { label: "Arial", family: "Arial", weight: "normal" },
    { label: "Cambria", family: "Cambria", weight: "normal" },
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
  return `"${family}", Arial, sans-serif`;
}
