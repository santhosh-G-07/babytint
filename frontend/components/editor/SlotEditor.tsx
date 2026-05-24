"use client";

import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EditorSlotState, SlotPosition } from "@/types";

export function SlotEditor({
  slots,
  slotState,
  selectedSlotId,
  uploadingSlotId,
  onSelectSlot,
  onStartUpload,
  onClearSlot,
}: {
  slots: SlotPosition[];
  slotState: Record<number, EditorSlotState>;
  selectedSlotId: number | null;
  uploadingSlotId: number | null;
  onSelectSlot: (slotId: number) => void;
  onStartUpload: (slotId?: number) => void;
  onClearSlot: (slotId: number) => void;
}) {
  const slotTitle = (slot: SlotPosition) => slot.label?.trim() || `Slot ${slot.slot_id}`;

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Photo Slots</p>
          <h3 className="font-semibold">Choose Photos</h3>
        </div>
        <Button size="sm" onClick={() => onStartUpload()}>
          <ImagePlus className="mr-2 h-4 w-4" />
          Upload Photo
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {slots.map((slot) => {
          const hasImage = Boolean(slotState[slot.slot_id]?.image_url);
          const isSelected = selectedSlotId === slot.slot_id;
          const isUploading = uploadingSlotId === slot.slot_id;

          return (
            <div
              key={slot.slot_id}
              className={cn(
                "rounded-xl border p-3 transition",
                isSelected
                  ? "border-amber-500 bg-amber-50/70 dark:border-amber-600 dark:bg-amber-950/30"
                  : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => onSelectSlot(slot.slot_id)}
              >
                <span className="font-medium">{slotTitle(slot)}</span>
                <Badge variant={hasImage ? "secondary" : "outline"}>
                  {hasImage ? "Ready" : "Empty"}
                </Badge>
              </button>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Button
                  variant={hasImage ? "outline" : "default"}
                  onClick={() => onStartUpload(slot.slot_id)}
                  disabled={isUploading}
                >
                  {hasImage ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? "Saving..." : hasImage ? "Change" : "Upload"}
                </Button>
                {hasImage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${slotTitle(slot)}`}
                    onClick={() => onClearSlot(slot.slot_id)}
                    disabled={isUploading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
