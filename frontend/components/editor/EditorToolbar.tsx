"use client";

import { Eye, ShoppingCart, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EditorSlotState, SlotPosition } from "@/types";

export function EditorToolbar({
  slots,
  slotState,
  onPreview,
  onAddToCart,
  addToCartBusy = false,
}: {
  slots: SlotPosition[];
  slotState: Record<number, EditorSlotState>;
  onPreview: () => void;
  onAddToCart: () => void;
  addToCartBusy?: boolean;
}) {
  const filled = slots.filter((slot) => Boolean(slotState[slot.slot_id]?.image_url)).length;

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filled}/{slots.length} slots filled
          </Badge>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Tap frame placeholders to add photo and tap text directly to edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button onClick={onAddToCart} disabled={addToCartBusy}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            {addToCartBusy ? "Preparing..." : "Add To Cart"}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
        <WandSparkles className="h-4 w-4" />
        Print-ready file is prepared privately for your order.
      </div>
    </div>
  );
}
