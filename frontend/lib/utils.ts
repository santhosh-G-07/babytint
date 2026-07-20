import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { CustomizationData, FrameTemplate } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function framePreviewUrl(frame: FrameTemplate) {
  return frame.preview_image_url || frame.frame_asset_url;
}

export function framePreviewClassName(frame: FrameTemplate, previewClassName: string, fallbackClassName: string) {
  return frame.preview_image_url ? previewClassName : fallbackClassName;
}

export function inr(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function isAssistedCustomization(customization?: Pick<CustomizationData, "customization_mode"> | null) {
  return customization?.customization_mode === "assisted";
}

export function frameBasePrice(frame: FrameTemplate) {
  return Number(frame.offer_price ?? frame.price);
}

export function assistedCustomizationFee(frame: FrameTemplate) {
  return Number(frame.assisted_customization_price ?? 0);
}

export function cartItemPrice(frame: FrameTemplate, customization?: Pick<CustomizationData, "customization_mode"> | null) {
  const basePrice = frameBasePrice(frame);
  return isAssistedCustomization(customization)
    ? basePrice + assistedCustomizationFee(frame)
    : basePrice;
}
