"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import { ImageIcon, Plus, Trash2, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fontOptionValue, fontStack, frameFontGroups, parseFontOption } from "@/lib/frame-fonts";
import type { SlotPosition, TextAlign, TextFontGroup, TextPosition } from "@/types";

type Selection = { type: "slot"; id: number } | { type: "text"; id: number } | null;
type FencePoint = { x: number; y: number };

const defaultFreePoints = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.04 },
  { x: 0.98, y: 0.76 },
  { x: 0.66, y: 0.98 },
  { x: 0.08, y: 0.9 },
  { x: 0.02, y: 0.3 },
];
const defaultDiamondPoints = [
  { x: 0.5, y: 0.02 },
  { x: 0.98, y: 0.5 },
  { x: 0.5, y: 0.98 },
  { x: 0.02, y: 0.5 },
];
const defaultHexagonPoints = [
  { x: 0.25, y: 0.02 },
  { x: 0.75, y: 0.02 },
  { x: 0.98, y: 0.5 },
  { x: 0.75, y: 0.98 },
  { x: 0.25, y: 0.98 },
  { x: 0.02, y: 0.5 },
];

function nextSlotId(slots: SlotPosition[]) {
  return slots.reduce((maxId, slot) => Math.max(maxId, slot.slot_id), 0) + 1;
}

function nextTextId(textPositions: TextPosition[]) {
  return textPositions.reduce((maxId, field) => Math.max(maxId, field.text_id), 0) + 1;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function gradientPoints(width: number, height: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  const radius = Math.max(1, Math.hypot(width, height) / 2);
  const centerX = width / 2;
  const centerY = height / 2;
  const dx = Math.cos(radians) * radius;
  const dy = Math.sin(radians) * radius;
  return {
    start: { x: centerX - dx, y: centerY - dy },
    end: { x: centerX + dx, y: centerY + dy },
  };
}

function textGradient(field: TextPosition) {
  if (!field.gradient_enabled || !field.gradient_from || !field.gradient_to) {
    return null;
  }
  const angle = Number.isFinite(field.gradient_angle) ? Number(field.gradient_angle) : 0;
  return {
    ...gradientPoints(field.width, field.height, angle),
    colorStops: [0, field.gradient_from, 1, field.gradient_to],
  };
}

function isPolygonShape(shape: SlotPosition["shape"]) {
  return shape === "free" || shape === "diamond" || shape === "hexagon";
}

function defaultPointsForShape(shape: SlotPosition["shape"]) {
  if (shape === "diamond") {
    return defaultDiamondPoints;
  }
  if (shape === "hexagon") {
    return defaultHexagonPoints;
  }
  return defaultFreePoints;
}

function pointsForSlot(slot: SlotPosition) {
  return slot.points && slot.points.length >= 3 ? slot.points : defaultPointsForShape(slot.shape);
}

function linePoints(slot: SlotPosition) {
  return pointsForSlot(slot).flatMap((point) => [
    slot.x + point.x * slot.width,
    slot.y + point.y * slot.height,
  ]);
}

function selectedExists(selection: Selection, slots: SlotPosition[], textPositions: TextPosition[]) {
  if (!selection) {
    return false;
  }
  return selection.type === "slot"
    ? slots.some((slot) => slot.slot_id === selection.id)
    : textPositions.some((field) => field.text_id === selection.id);
}

function buildFreeSlotFromFence(slotId: number, fence: FencePoint[]): SlotPosition | null {
  if (fence.length < 3) {
    return null;
  }

  const xs = fence.map((point) => point.x);
  const ys = fence.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(24, maxX - minX);
  const height = Math.max(24, maxY - minY);

  return {
    slot_id: slotId,
    x: minX,
    y: minY,
    width,
    height,
    shape: "free",
    label: `Slot ${slotId}`,
    points: fence.map((point) => ({
      x: clamp((point.x - minX) / width),
      y: clamp((point.y - minY) / height),
    })),
  };
}

export function SlotPositionMapper({
  frameAssetUrl,
  slots,
  textPositions,
  onChange,
  onTextChange,
}: {
  frameAssetUrl: string;
  slots: SlotPosition[];
  textPositions: TextPosition[];
  onChange: (slots: SlotPosition[]) => void;
  onTextChange: (textPositions: TextPosition[]) => void;
}) {
  const [selection, setSelection] = useState<Selection>(slots[0] ? { type: "slot", id: slots[0].slot_id } : null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [showAddSlotPrompt, setShowAddSlotPrompt] = useState(false);
  const [isDrawingFence, setIsDrawingFence] = useState(false);
  const [fencePoints, setFencePoints] = useState<FencePoint[]>([]);
  const [fencePointer, setFencePointer] = useState<FencePoint | null>(null);
  const [image] = useImage(frameAssetUrl || "", "anonymous");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const slotRefs = useRef<Record<number, Konva.Rect | null>>({});
  const textRefs = useRef<Record<number, Konva.Rect | null>>({});
  const effectiveSelection = useMemo(
    () =>
      selectedExists(selection, slots, textPositions)
        ? selection
        : slots[0]
          ? { type: "slot", id: slots[0].slot_id }
          : textPositions[0]
            ? { type: "text", id: textPositions[0].text_id }
            : null,
    [selection, slots, textPositions],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!effectiveSelection) {
      trRef.current?.nodes([]);
      return;
    }
    const node =
      effectiveSelection.type === "slot"
        ? slotRefs.current[effectiveSelection.id]
        : textRefs.current[effectiveSelection.id];
    if (!node || !trRef.current) {
      return;
    }
    trRef.current.nodes([node]);
    trRef.current.getLayer()?.batchDraw();
  }, [effectiveSelection, slots, textPositions]);

  const stageBounds = useMemo(() => {
    if (image) {
      return { width: image.width, height: image.height };
    }
    const slotMaxX = slots.map((slot) => slot.x + slot.width);
    const slotMaxY = slots.map((slot) => slot.y + slot.height);
    const textMaxX = textPositions.map((field) => field.x + field.width);
    const textMaxY = textPositions.map((field) => field.y + field.height);
    return {
      width: Math.max(1200, ...slotMaxX, ...textMaxX),
      height: Math.max(900, ...slotMaxY, ...textMaxY),
    };
  }, [image, slots, textPositions]);

  const stageWidth = Math.max(320, Math.min(containerWidth || 720, 720));
  const scale = stageWidth / stageBounds.width;
  const stageHeight = Math.max(260, stageBounds.height * scale);
  const fencePreviewPoints = useMemo(
    () => (fencePointer ? [...fencePoints, fencePointer] : fencePoints),
    [fencePoints, fencePointer],
  );

  const updateSlot = (slotId: number, patch: Partial<SlotPosition>) => {
    onChange(slots.map((slot) => (slot.slot_id === slotId ? { ...slot, ...patch } : slot)));
  };

  const updateText = (textId: number, patch: Partial<TextPosition>) => {
    onTextChange(textPositions.map((field) => (field.text_id === textId ? { ...field, ...patch } : field)));
  };

  const selectedSlot = effectiveSelection?.type === "slot"
    ? slots.find((slot) => slot.slot_id === effectiveSelection.id)
    : null;

  const createRectSlot = () => {
    const slotId = nextSlotId(slots);
    const created: SlotPosition = {
      slot_id: slotId,
      x: 120,
      y: 80,
      width: 260,
      height: 220,
      shape: "rect",
      label: `Slot ${slotId}`,
    };
    onChange([...slots, created]);
    setSelection({ type: "slot", id: slotId });
    setShowAddSlotPrompt(false);
  };

  const startFenceDraw = () => {
    setShowAddSlotPrompt(false);
    setIsDrawingFence(true);
    setFencePoints([]);
    setFencePointer(null);
    setSelection(null);
  };

  const cancelFenceDraw = () => {
    setIsDrawingFence(false);
    setFencePoints([]);
    setFencePointer(null);
  };

  const finalizeFenceDraw = () => {
    const slotId = nextSlotId(slots);
    const created = buildFreeSlotFromFence(slotId, fencePoints);
    if (!created) {
      return;
    }
    onChange([...slots, created]);
    setSelection({ type: "slot", id: slotId });
    cancelFenceDraw();
  };

  const pointerFromStage = (stage: Konva.Stage): FencePoint | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return null;
    }
    return {
      x: clamp(pointer.x / scale, 0, stageBounds.width),
      y: clamp(pointer.y / scale, 0, stageBounds.height),
    };
  };

  const handleFencePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawingFence) {
      return;
    }
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }
    const point = pointerFromStage(stage);
    if (!point) {
      return;
    }
    setFencePoints((previous) => [...previous, point]);
    event.cancelBubble = true;
  };

  const handleFencePointerMove = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawingFence) {
      return;
    }
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }
    setFencePointer(pointerFromStage(stage));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddSlotPrompt((current) => !current)}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Add Slot
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const textId = nextTextId(textPositions);
            const created: TextPosition = {
              text_id: textId,
              label: "Baby Name",
              placeholder: "Baby name",
              default_text: "",
              x: 160,
              y: 160,
              width: 420,
              height: 120,
              font_group: "name",
              font_family: "Segoe Script",
              font_weight: "normal",
              font_size: 82,
              color: "#1c1917",
              gradient_enabled: false,
              gradient_from: "#1c1917",
              gradient_to: "#92400e",
              gradient_angle: 0,
              align: "center",
              line_height: 1.2,
              letter_spacing: 0,
              allow_customer_font: true,
            };
            onTextChange([...textPositions, created]);
            setSelection({ type: "text", id: textId });
          }}
        >
          <Type className="mr-2 h-4 w-4" />
          Add Text
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!effectiveSelection}
          onClick={() => {
            if (!effectiveSelection) {
              return;
            }
            if (effectiveSelection.type === "slot") {
              onChange(slots.filter((slot) => slot.slot_id !== effectiveSelection.id));
            } else {
              onTextChange(textPositions.filter((field) => field.text_id !== effectiveSelection.id));
            }
            setSelection(null);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Selected
        </Button>
      </div>

      {showAddSlotPrompt ? (
        <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-stone-700 dark:text-stone-200">Free shape slot?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={createRectSlot}>
              No, regular slot
            </Button>
            <Button size="sm" onClick={startFenceDraw}>
              Yes, draw fence
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddSlotPrompt(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isDrawingFence ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p>Fence draw mode: click on the canvas to place points around your shape.</p>
          <p className="mt-1 text-xs opacity-90">Add at least 3 points, then finalize.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={fencePoints.length === 0}
              onClick={() => setFencePoints((previous) => previous.slice(0, -1))}
            >
              Undo Point
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={fencePoints.length === 0}
              onClick={() => setFencePoints([])}
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={fencePoints.length < 3}
              onClick={finalizeFenceDraw}
            >
              Finalize Free Shape
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelFenceDraw}>
              Cancel Drawing
            </Button>
          </div>
        </div>
      ) : null}

      <div ref={wrapperRef} className="overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-950/50">
        <Stage
          width={stageWidth}
          height={stageHeight}
          onMouseDown={handleFencePointerDown}
          onTouchStart={handleFencePointerDown}
          onMouseMove={handleFencePointerMove}
          onTouchMove={handleFencePointerMove}
          onMouseLeave={() => setFencePointer(null)}
          onTouchEnd={() => setFencePointer(null)}
        >
          <Layer scaleX={scale} scaleY={scale}>
            <Rect x={0} y={0} width={stageBounds.width} height={stageBounds.height} fill="#e7e5e4" />
            {image ? (
              <KonvaImage
                image={image}
                x={0}
                y={0}
                width={stageBounds.width}
                height={stageBounds.height}
                listening={false}
              />
            ) : null}

            {isDrawingFence ? (
              <>
                {fencePreviewPoints.length >= 2 ? (
                  <Line
                    points={fencePreviewPoints.flatMap((point) => [point.x, point.y])}
                    closed={!fencePointer && fencePoints.length >= 3}
                    stroke="#d97706"
                    strokeWidth={3}
                    dash={[8, 6]}
                    fill={fencePoints.length >= 3 ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)"}
                    listening={false}
                  />
                ) : null}
                {fencePoints.map((point, index) => (
                  <Circle
                    key={`fence-point-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={9}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={2}
                    listening={false}
                  />
                ))}
              </>
            ) : null}

            {slots.map((slot) => {
              const selected = effectiveSelection?.type === "slot" && effectiveSelection.id === slot.slot_id;
              return (
                <Fragment key={slot.slot_id}>
                  <Rect
                    ref={(node) => {
                      slotRefs.current[slot.slot_id] = node;
                    }}
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    cornerRadius={slot.shape === "circle" ? Math.min(slot.width, slot.height) / 2 : 8}
                    fill={selected ? "rgba(245, 158, 11, 0.18)" : "rgba(15, 23, 42, 0.1)"}
                    stroke={selected ? "#d97706" : "#334155"}
                    strokeWidth={selected ? 3 : 2}
                    dash={selected ? [] : [8, 6]}
                    opacity={isPolygonShape(slot.shape) ? 0.3 : 1}
                    draggable
                    onClick={() => setSelection({ type: "slot", id: slot.slot_id })}
                    onTap={() => setSelection({ type: "slot", id: slot.slot_id })}
                    onDragEnd={(event) => {
                      updateSlot(slot.slot_id, {
                        x: Math.max(0, event.target.x()),
                        y: Math.max(0, event.target.y()),
                      });
                    }}
                    onTransformEnd={(event) => {
                      const node = event.target as Konva.Rect;
                      const width = Math.max(24, node.width() * node.scaleX());
                      const height = Math.max(24, node.height() * node.scaleY());
                      const x = Math.max(0, node.x());
                      const y = Math.max(0, node.y());
                      node.scaleX(1);
                      node.scaleY(1);
                      updateSlot(slot.slot_id, { x, y, width, height });
                    }}
                  />
                  {isPolygonShape(slot.shape) ? (
                    <Line
                      points={linePoints(slot)}
                      closed
                      fill={selected ? "rgba(245, 158, 11, 0.22)" : "rgba(20, 184, 166, 0.16)"}
                      stroke={selected ? "#d97706" : "#0f766e"}
                      strokeWidth={selected ? 4 : 2}
                      dash={selected ? [] : [8, 6]}
                      onClick={() => setSelection({ type: "slot", id: slot.slot_id })}
                      onTap={() => setSelection({ type: "slot", id: slot.slot_id })}
                    />
                  ) : null}
                  {selected && slot.shape === "free"
                    ? pointsForSlot(slot).map((point, index) => (
                        <Circle
                          key={`${slot.slot_id}-${index}`}
                          x={slot.x + point.x * slot.width}
                          y={slot.y + point.y * slot.height}
                          radius={12}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={3}
                          draggable
                          onDragMove={(event) => {
                            event.cancelBubble = true;
                            const nextPoints = [...pointsForSlot(slot)];
                            nextPoints[index] = {
                              x: clamp((event.target.x() - slot.x) / slot.width),
                              y: clamp((event.target.y() - slot.y) / slot.height),
                            };
                            updateSlot(slot.slot_id, { points: nextPoints });
                          }}
                        />
                      ))
                    : null}
                </Fragment>
              );
            })}

            {textPositions.map((field) => {
              const selected = effectiveSelection?.type === "text" && effectiveSelection.id === field.text_id;
              const preview = field.default_text || field.placeholder || field.label;
              const gradient = textGradient(field);
              return (
                <Fragment key={`text-${field.text_id}`}>
                  <Rect
                    ref={(node) => {
                      textRefs.current[field.text_id] = node;
                    }}
                    x={field.x}
                    y={field.y}
                    width={field.width}
                    height={field.height}
                    fill={selected ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.08)"}
                    stroke={selected ? "#d97706" : "#64748b"}
                    strokeWidth={selected ? 3 : 2}
                    dash={selected ? [] : [7, 5]}
                    draggable
                    onClick={() => setSelection({ type: "text", id: field.text_id })}
                    onTap={() => setSelection({ type: "text", id: field.text_id })}
                    onDragEnd={(event) => {
                      updateText(field.text_id, {
                        x: Math.max(0, event.target.x()),
                        y: Math.max(0, event.target.y()),
                      });
                    }}
                    onTransformEnd={(event) => {
                      const node = event.target as Konva.Rect;
                      const width = Math.max(32, node.width() * node.scaleX());
                      const height = Math.max(24, node.height() * node.scaleY());
                      const x = Math.max(0, node.x());
                      const y = Math.max(0, node.y());
                      node.scaleX(1);
                      node.scaleY(1);
                      updateText(field.text_id, { x, y, width, height });
                    }}
                  />
                  <KonvaText
                    x={field.x}
                    y={field.y}
                    width={field.width}
                    height={field.height}
                    text={preview}
                    fill={field.color}
                    fillPriority={gradient ? "linear-gradient" : "color"}
                    fillLinearGradientStartPoint={gradient?.start}
                    fillLinearGradientEndPoint={gradient?.end}
                    fillLinearGradientColorStops={gradient?.colorStops}
                    fontSize={field.font_size}
                    fontFamily={fontStack(field.font_family)}
                    fontStyle={field.font_weight === "bold" ? "bold" : "normal"}
                    align={field.align}
                    lineHeight={field.line_height ?? 1.2}
                    letterSpacing={field.letter_spacing ?? 0}
                    verticalAlign="middle"
                    listening={false}
                  />
                </Fragment>
              );
            })}
            {isDrawingFence ? (
              <Rect
                x={0}
                y={0}
                width={stageBounds.width}
                height={stageBounds.height}
                fill="rgba(0, 0, 0, 0)"
                onMouseDown={handleFencePointerDown}
                onTouchStart={handleFencePointerDown}
                onMouseMove={handleFencePointerMove}
                onTouchMove={handleFencePointerMove}
              />
            ) : null}
            <Transformer ref={trRef} rotateEnabled={false} />
          </Layer>
        </Stage>
      </div>

      {selectedSlot?.shape === "free" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateSlot(selectedSlot.slot_id, { points: [...pointsForSlot(selectedSlot), { x: 0.5, y: 0.5 }] })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Point
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pointsForSlot(selectedSlot).length <= 3}
            onClick={() => updateSlot(selectedSlot.slot_id, { points: pointsForSlot(selectedSlot).slice(0, -1) })}
          >
            Remove Point
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateSlot(selectedSlot.slot_id, { points: defaultFreePoints })}
          >
            Reset Shape
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {slots.map((slot) => {
          const selected = effectiveSelection?.type === "slot" && effectiveSelection.id === slot.slot_id;
          return (
            <div
              key={`meta-${slot.slot_id}`}
              className={`rounded-xl border p-3 ${
                selected
                  ? "border-amber-600 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-900/20"
                  : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <button
                type="button"
                className="w-full text-left text-sm font-semibold"
                onClick={() => setSelection({ type: "slot", id: slot.slot_id })}
              >
                Slot {slot.slot_id}
              </button>
              <div className="mt-3 space-y-2.5">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Slot Label
                  </p>
                  <Input
                    className="h-9"
                    value={slot.label ?? ""}
                    placeholder="Baby / Parents"
                    onChange={(event) => updateSlot(slot.slot_id, { label: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Shape
                  </p>
                  <Select
                    value={slot.shape}
                    onValueChange={(nextShape: SlotPosition["shape"]) => {
                      const nextPoints =
                        nextShape === "free"
                          ? slot.shape === "free"
                            ? pointsForSlot(slot)
                            : defaultPointsForShape("free")
                          : nextShape === "diamond"
                            ? defaultPointsForShape("diamond")
                            : nextShape === "hexagon"
                              ? defaultPointsForShape("hexagon")
                              : null;
                      updateSlot(slot.slot_id, {
                        shape: nextShape,
                        points: nextPoints,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rect">rect</SelectItem>
                      <SelectItem value="circle">circle</SelectItem>
                      <SelectItem value="diamond">diamond</SelectItem>
                      <SelectItem value="hexagon">hexagon</SelectItem>
                      <SelectItem value="free">free shape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}

        {textPositions.map((field) => {
          const selected = effectiveSelection?.type === "text" && effectiveSelection.id === field.text_id;
          const fontOptions = frameFontGroups[field.font_group] ?? frameFontGroups.general;
          return (
            <div
              key={`text-meta-${field.text_id}`}
              className={`rounded-xl border p-3 ${
                selected
                  ? "border-amber-600 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-900/20"
                  : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <button
                type="button"
                className="w-full text-left text-sm font-semibold"
                onClick={() => setSelection({ type: "text", id: field.text_id })}
              >
                Text {field.text_id}
              </button>
              <div className="mt-3 space-y-2.5">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Text Label
                  </p>
                  <Input
                    className="h-9"
                    value={field.label}
                    onChange={(event) => updateText(field.text_id, { label: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Placeholder
                  </p>
                  <Input
                    className="h-9"
                    value={field.placeholder ?? ""}
                    placeholder="Placeholder"
                    onChange={(event) => updateText(field.text_id, { placeholder: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Default Text
                  </p>
                  <Textarea
                    className="min-h-[88px] p-2 text-sm"
                    value={field.default_text ?? ""}
                    placeholder="Default text"
                    onChange={(event) => updateText(field.text_id, { default_text: event.target.value })}
                  />
                </div>
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Font Group
                    </p>
                    <Select
                      value={field.font_group}
                      onValueChange={(fontGroup: TextFontGroup) => {
                        const defaultFont = frameFontGroups[fontGroup][0];
                        updateText(field.text_id, {
                          font_group: fontGroup,
                          font_family: defaultFont.family,
                          font_weight: defaultFont.weight,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">name</SelectItem>
                        <SelectItem value="numbers">numbers</SelectItem>
                        <SelectItem value="details">details</SelectItem>
                        <SelectItem value="general">general</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Font Style
                    </p>
                    <Select
                      value={fontOptionValue({ family: field.font_family, weight: field.font_weight })}
                      onValueChange={(value) => {
                        const parsed = parseFontOption(value);
                        updateText(field.text_id, {
                          font_family: parsed.family,
                          font_weight: parsed.weight,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map((option) => (
                          <SelectItem key={fontOptionValue(option)} value={fontOptionValue(option)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(128px,1fr))]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Font Size
                    </p>
                    <Input
                      className="h-9"
                      type="number"
                      min={8}
                      max={320}
                      value={field.font_size}
                      onChange={(event) =>
                        updateText(field.text_id, {
                          font_size: Math.max(8, Math.min(320, Number(event.target.value) || 8)),
                        })}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Line Height
                    </p>
                    <Input
                      className="h-9"
                      type="number"
                      min={0.8}
                      max={3}
                      step={0.05}
                      value={field.line_height ?? 1.2}
                      onChange={(event) =>
                        updateText(field.text_id, {
                          line_height: Math.max(0.8, Math.min(3, Number(event.target.value) || 1.2)),
                        })}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Letter Spacing
                    </p>
                    <Input
                      className="h-9"
                      type="number"
                      min={-2}
                      max={40}
                      step={0.25}
                      value={field.letter_spacing ?? 0}
                      onChange={(event) =>
                        updateText(field.text_id, {
                          letter_spacing: Math.max(-2, Math.min(40, Number(event.target.value) || 0)),
                        })}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Font Color
                    </p>
                    <Input
                      className="h-9 p-1"
                      type="color"
                      value={field.color}
                      onChange={(event) => updateText(field.text_id, { color: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1 [grid-column:1/-1]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Alignment
                    </p>
                    <Select
                      value={field.align}
                      onValueChange={(align: TextAlign) => updateText(field.text_id, { align })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">left</SelectItem>
                        <SelectItem value="center">center</SelectItem>
                        <SelectItem value="right">right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <input
                    className="h-3.5 w-3.5"
                    type="checkbox"
                    checked={field.gradient_enabled ?? false}
                    onChange={(event) =>
                      updateText(field.text_id, {
                        gradient_enabled: event.target.checked,
                        gradient_from: field.gradient_from ?? field.color,
                        gradient_to: field.gradient_to ?? "#92400e",
                        gradient_angle: field.gradient_angle ?? 0,
                      })}
                  />
                  Use gradient fill
                </label>
                {field.gradient_enabled ? (
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        Start
                      </p>
                      <Input
                        className="h-9 p-1"
                        type="color"
                        value={field.gradient_from ?? field.color}
                        onChange={(event) => updateText(field.text_id, { gradient_from: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        End
                      </p>
                      <Input
                        className="h-9 p-1"
                        type="color"
                        value={field.gradient_to ?? "#92400e"}
                        onChange={(event) => updateText(field.text_id, { gradient_to: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        Angle
                      </p>
                      <Input
                        className="h-9"
                        type="number"
                        min={-360}
                        max={360}
                        value={field.gradient_angle ?? 0}
                        onChange={(event) =>
                          updateText(field.text_id, {
                            gradient_angle: Math.max(-360, Math.min(360, Number(event.target.value) || 0)),
                          })}
                      />
                    </div>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <input
                    className="h-3.5 w-3.5"
                    type="checkbox"
                    checked={field.allow_customer_font ?? true}
                    onChange={(event) => updateText(field.text_id, { allow_customer_font: event.target.checked })}
                  />
                  Customer can change font
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
