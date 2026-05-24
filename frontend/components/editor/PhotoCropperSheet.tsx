"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Minus, Plus, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shouldRenderSlotAboveFrame } from "@/lib/frame-slot-layer";
import type { FrameTemplate, SlotPosition } from "@/types";

export interface CropSelection {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

interface Size {
  width: number;
  height: number;
}

interface Offset {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function geometry(container: Size, natural: Size, zoom: number) {
  const coverScale = Math.max(container.width / natural.width, container.height / natural.height);
  const imageScale = coverScale * zoom;
  return {
    imageScale,
    displayWidth: natural.width * imageScale,
    displayHeight: natural.height * imageScale,
  };
}

function freeShapeClipPath(slot: SlotPosition) {
  const points =
    slot.points && slot.points.length >= 3
      ? slot.points
      : [
          { x: 0.08, y: 0.08 },
          { x: 0.92, y: 0.04 },
          { x: 0.98, y: 0.76 },
          { x: 0.66, y: 0.98 },
          { x: 0.08, y: 0.9 },
          { x: 0.02, y: 0.3 },
        ];
  return `polygon(${points.map((point) => `${point.x * 100}% ${point.y * 100}%`).join(", ")})`;
}

export function PhotoCropperSheet({
  frame,
  slot,
  imageUrl,
  fileName,
  busy,
  onCancel,
  onApply,
}: {
  frame: FrameTemplate;
  slot: SlotPosition;
  imageUrl: string;
  fileName: string;
  busy: boolean;
  onCancel: () => void;
  onApply: (selection: CropSelection) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [frameNaturalSize, setFrameNaturalSize] = useState<Size | null>(null);
  const [slotAboveFrame, setSlotAboveFrame] = useState(false);
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const slotTitle = slot.label?.trim() || `Slot ${slot.slot_id}`;
  const isCircle = slot.shape === "circle";
  const slotClipPath = slot.shape === "free" ? freeShapeClipPath(slot) : undefined;
  const fallbackFrameSize = useMemo(
    () => ({
      width: Math.max(...frame.slot_positions.map((item) => item.x + item.width), 1200),
      height: Math.max(...frame.slot_positions.map((item) => item.y + item.height), 900),
    }),
    [frame.slot_positions],
  );
  const frameSize = frameNaturalSize ?? fallbackFrameSize;
  const slotStyle = {
    left: `${(slot.x / frameSize.width) * 100}%`,
    top: `${(slot.y / frameSize.height) * 100}%`,
    width: `${(slot.width / frameSize.width) * 100}%`,
    height: `${(slot.height / frameSize.height) * 100}%`,
    borderRadius: isCircle ? "9999px" : "10px",
    clipPath: slotClipPath,
  };

  useEffect(() => {
    const node = slotRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      setFrameNaturalSize({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      setSlotAboveFrame(shouldRenderSlotAboveFrame(image, slot));
    };
    image.src = frame.frame_asset_url;
    return () => {
      cancelled = true;
    };
  }, [frame.frame_asset_url, slot]);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      setNaturalSize({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, slot.slot_id]);

  const clampOffset = useCallback(
    (next: Offset, nextZoom = zoom): Offset => {
      if (!naturalSize || containerSize.width <= 0 || containerSize.height <= 0) {
        return next;
      }
      const { displayWidth, displayHeight } = geometry(containerSize, naturalSize, nextZoom);
      const maxX = Math.max(0, (displayWidth - containerSize.width) / 2);
      const maxY = Math.max(0, (displayHeight - containerSize.height) / 2);
      return {
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
    },
    [containerSize, naturalSize, zoom],
  );

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = clamp(nextZoom, 1, 4);
    setZoom(clampedZoom);
    setOffset((current) => clampOffset(current, clampedZoom));
  };

  const imageBox = useMemo(() => {
    if (!naturalSize || containerSize.width <= 0 || containerSize.height <= 0) {
      return null;
    }
    return geometry(containerSize, naturalSize, zoom);
  }, [containerSize, naturalSize, zoom]);

  const cropSelection = useCallback((): CropSelection | null => {
    if (!naturalSize || containerSize.width <= 0 || containerSize.height <= 0) {
      return null;
    }

    const { imageScale, displayWidth, displayHeight } = geometry(containerSize, naturalSize, zoom);
    const left = containerSize.width / 2 + offset.x - displayWidth / 2;
    const top = containerSize.height / 2 + offset.y - displayHeight / 2;
    const cropX = clamp(Math.round(-left / imageScale), 0, Math.max(0, naturalSize.width - 1));
    const cropY = clamp(Math.round(-top / imageScale), 0, Math.max(0, naturalSize.height - 1));
    const cropW = clamp(
      Math.round(containerSize.width / imageScale),
      1,
      Math.max(1, naturalSize.width - cropX),
    );
    const cropH = clamp(
      Math.round(containerSize.height / imageScale),
      1,
      Math.max(1, naturalSize.height - cropY),
    );

    return { cropX, cropY, cropW, cropH };
  }, [containerSize, naturalSize, offset, zoom]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
        aria-label={`Crop ${slotTitle}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Set {slotTitle}</h2>
            <p className="max-w-md truncate text-sm text-stone-500 dark:text-stone-400">{fileName}</p>
          </div>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>

        <div className="mt-4 rounded-xl bg-stone-100 p-3 dark:bg-stone-950 sm:p-4">
          <div
            className="relative mx-auto w-full max-w-[620px] bg-stone-100 dark:bg-stone-950"
            style={{
              aspectRatio: `${Math.max(1, frameSize.width)} / ${Math.max(1, frameSize.height)}`,
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              ref={slotRef}
              className="absolute touch-none overflow-hidden bg-stone-200 shadow-inner ring-2 ring-white/90 dark:bg-stone-800 dark:ring-stone-900"
              style={{
                ...slotStyle,
                zIndex: slotAboveFrame ? 20 : 10,
                cursor: busy ? "wait" : "grab",
              }}
              onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (busy) {
                return;
              }
              dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId || busy) {
                return;
              }
              const dx = event.clientX - drag.x;
              const dy = event.clientY - drag.y;
              dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
              setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }));
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
              {imageBox ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                  style={{
                    width: imageBox.displayWidth,
                    height: imageBox.displayHeight,
                    maxWidth: "none",
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  }}
                />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-stone-200 dark:bg-stone-800" />
              )}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.frame_asset_url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              style={{ zIndex: slotAboveFrame ? 10 : 20 }}
            />
            <div
              className="pointer-events-none absolute z-30 border-2 border-amber-500/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.06)]"
              style={slotStyle}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom out"
              onClick={() => updateZoom(zoom - 0.1)}
              disabled={busy || zoom <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <input
              className="h-2 w-44 accent-amber-700"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
              disabled={busy}
              aria-label="Zoom photo"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom in"
              onClick={() => updateZoom(zoom + 0.1)}
              disabled={busy || zoom >= 4}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Reset crop"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              disabled={busy}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move photo left"
              onClick={() => setOffset((current) => clampOffset({ x: current.x - 10, y: current.y }))}
              disabled={busy}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move photo right"
              onClick={() => setOffset((current) => clampOffset({ x: current.x + 10, y: current.y }))}
              disabled={busy}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move photo up"
              onClick={() => setOffset((current) => clampOffset({ x: current.x, y: current.y - 10 }))}
              disabled={busy}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move photo down"
              onClick={() => setOffset((current) => clampOffset({ x: current.x, y: current.y + 10 }))}
              disabled={busy}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => {
              const selection = cropSelection();
              if (selection) {
                onApply(selection);
              }
            }}
            disabled={busy || !naturalSize}
          >
            <Check className="mr-2 h-4 w-4" />
            {busy ? "Saving..." : "Use Photo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
