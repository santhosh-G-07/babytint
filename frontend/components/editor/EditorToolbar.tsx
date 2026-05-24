"use client";

import { Eye, ShoppingCart, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EditorSlotState, SlotPosition } from "@/types";

export function EditorToolbar({
  slots,
  slotState,
  selectedSlotId,
  onSelectSlot,
  onPreview,
  onAddToCart,
  addToCartBusy = false,
}: {
  slots: SlotPosition[];
  slotState: Record<number, EditorSlotState>;
  selectedSlotId: number | null;
  onSelectSlot: (slotId: number) => void;
  onPreview: () => void;
  onAddToCart: () => void;
  addToCartBusy?: boolean;
}) {
  const filled = slots.filter((slot) => Boolean(slotState[slot.slot_id]?.image_url)).length;
  const slotTitle = (slot: SlotPosition) => slot.label?.trim() || `Slot ${slot.slot_id}`;

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filled}/{slots.length} slots filled
          </Badge>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Drag a photo from one slot to another to swap.
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

      <div className="mt-4 flex flex-wrap gap-2">
        {slots.map((slot) => {
          const hasImage = Boolean(slotState[slot.slot_id]?.image_url);
          return (
            <button
              key={slot.slot_id}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                selectedSlotId === slot.slot_id
                  ? "border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200"
                  : "border-stone-300 text-stone-600 hover:border-stone-500 dark:border-stone-700 dark:text-stone-300",
              )}
              onClick={() => onSelectSlot(slot.slot_id)}
            >
              {slotTitle(slot)} {hasImage ? "- Ready" : "- Empty"}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
        <WandSparkles className="h-4 w-4" />
        Print-ready file is prepared privately for your order.
      </div>
    </div>
  );
}
