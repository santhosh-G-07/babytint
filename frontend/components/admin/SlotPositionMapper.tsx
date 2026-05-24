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

const defaultFreePoints = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.04 },
  { x: 0.98, y: 0.76 },
  { x: 0.66, y: 0.98 },
  { x: 0.08, y: 0.9 },
  { x: 0.02, y: 0.3 },
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

function pointsForSlot(slot: SlotPosition) {
  return slot.points && slot.points.length >= 3 ? slot.points : defaultFreePoints;
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

  const updateSlot = (slotId: number, patch: Partial<SlotPosition>) => {
    onChange(slots.map((slot) => (slot.slot_id === slotId ? { ...slot, ...patch } : slot)));
  };

  const updateText = (textId: number, patch: Partial<TextPosition>) => {
    onTextChange(textPositions.map((field) => (field.text_id === textId ? { ...field, ...patch } : field)));
  };

  const selectedSlot = effectiveSelection?.type === "slot"
    ? slots.find((slot) => slot.slot_id === effectiveSelection.id)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
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
          }}
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
              align: "center",
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

      <div ref={wrapperRef} className="overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-950/50">
        <Stage width={stageWidth} height={stageHeight}>
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
                    opacity={slot.shape === "free" ? 0.3 : 1}
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
                  {slot.shape === "free" ? (
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
                    fontSize={field.font_size}
                    fontFamily={fontStack(field.font_family)}
                    fontStyle={field.font_weight === "bold" ? "bold" : "normal"}
                    align={field.align}
                    verticalAlign="middle"
                    listening={false}
                  />
                </Fragment>
              );
            })}
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

      <div className="grid gap-2 sm:grid-cols-2">
        {slots.map((slot) => {
          const selected = effectiveSelection?.type === "slot" && effectiveSelection.id === slot.slot_id;
          return (
            <div
              key={`meta-${slot.slot_id}`}
              className={`rounded-lg border p-2 ${
                selected
                  ? "border-amber-600 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-900/20"
                  : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <button
                type="button"
                className="text-sm font-medium"
                onClick={() => setSelection({ type: "slot", id: slot.slot_id })}
              >
                Slot {slot.slot_id}
              </button>
              <Input
                className="mt-2 h-8"
                value={slot.label ?? ""}
                placeholder="Baby / Parents"
                onChange={(event) => updateSlot(slot.slot_id, { label: event.target.value })}
              />
              <Select
                value={slot.shape}
                onValueChange={(nextShape: "rect" | "circle" | "free") =>
                  updateSlot(slot.slot_id, {
                    shape: nextShape,
                    points: nextShape === "free" ? pointsForSlot(slot) : slot.points,
                  })
                }
              >
                <SelectTrigger className="mt-2 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rect">rect</SelectItem>
                  <SelectItem value="circle">circle</SelectItem>
                  <SelectItem value="free">free shape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}

        {textPositions.map((field) => {
          const selected = effectiveSelection?.type === "text" && effectiveSelection.id === field.text_id;
          const fontOptions = frameFontGroups[field.font_group] ?? frameFontGroups.general;
          return (
            <div
              key={`text-meta-${field.text_id}`}
              className={`rounded-lg border p-2 ${
                selected
                  ? "border-amber-600 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-900/20"
                  : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <button
                type="button"
                className="text-sm font-medium"
                onClick={() => setSelection({ type: "text", id: field.text_id })}
              >
                Text {field.text_id}
              </button>
              <div className="mt-2 grid gap-2">
                <Input
                  className="h-8"
                  value={field.label}
                  onChange={(event) => updateText(field.text_id, { label: event.target.value })}
                />
                <Input
                  className="h-8"
                  value={field.placeholder ?? ""}
                  placeholder="Placeholder"
                  onChange={(event) => updateText(field.text_id, { placeholder: event.target.value })}
                />
                <Input
                  className="h-8"
                  value={field.default_text ?? ""}
                  placeholder="Default text"
                  onChange={(event) => updateText(field.text_id, { default_text: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
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
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">name</SelectItem>
                      <SelectItem value="numbers">numbers</SelectItem>
                      <SelectItem value="details">details</SelectItem>
                      <SelectItem value="general">general</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <SelectTrigger className="h-8">
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
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    className="h-8"
                    type="number"
                    value={field.font_size}
                    onChange={(event) => updateText(field.text_id, { font_size: Number(event.target.value) })}
                  />
                  <Input
                    className="h-8 p-1"
                    type="color"
                    value={field.color}
                    onChange={(event) => updateText(field.text_id, { color: event.target.value })}
                  />
                  <Select
                    value={field.align}
                    onValueChange={(align: TextAlign) => updateText(field.text_id, { align })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">left</SelectItem>
                      <SelectItem value="center">center</SelectItem>
                      <SelectItem value="right">right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
                  <input
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
