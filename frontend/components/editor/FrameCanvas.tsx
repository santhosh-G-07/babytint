"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Circle,
  Line,
  Text as KonvaText,
  Shape,
  Transformer,
} from "react-konva";
import useImage from "use-image";

import { fontStack } from "@/lib/frame-fonts";
import { shouldRenderSlotAboveFrame } from "@/lib/frame-slot-layer";
import type { EditorSlotState, EditorTextState, FrameTemplate, RichTextRun, SlotAdjustments, SlotPosition, TextPosition } from "@/types";

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

function normalizedPoints(slot: SlotPosition) {
  if (slot.points && slot.points.length >= 3) {
    return slot.points;
  }
  return defaultPointsForShape(slot.shape);
}

function polygonPoints(slot: SlotPosition) {
  return normalizedPoints(slot).flatMap((point) => [
    slot.x + point.x * slot.width,
    slot.y + point.y * slot.height,
  ]);
}

function slotClipPath(ctx: Konva.Context, slot: SlotPosition) {
  if (slot.shape === "circle") {
    const radius = Math.min(slot.width, slot.height) / 2;
    ctx.beginPath();
    ctx.arc(slot.x + slot.width / 2, slot.y + slot.height / 2, radius, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  if (isPolygonShape(slot.shape)) {
    const points = normalizedPoints(slot);
    ctx.beginPath();
    ctx.moveTo(slot.x + points[0].x * slot.width, slot.y + points[0].y * slot.height);
    points.slice(1).forEach((point) => {
      ctx.lineTo(slot.x + point.x * slot.width, slot.y + point.y * slot.height);
    });
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.width, slot.height);
  ctx.closePath();
}

function normalizedAdjustment(adjustments: SlotAdjustments) {
  return {
    ...adjustments,
    scale: adjustments.scale ?? 1,
    offsetX: adjustments.offsetX ?? 0,
    offsetY: adjustments.offsetY ?? 0,
  };
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

function resolvedTextField(field: TextPosition, state: EditorTextState | undefined) {
  return {
    ...field,
    x: state?.x ?? field.x,
    y: state?.y ?? field.y,
    width: Math.max(32, state?.width ?? field.width),
    height: Math.max(24, state?.height ?? field.height),
    font_size: Math.max(8, state?.font_size ?? field.font_size),
    color: state?.color ?? field.color,
    align: state?.align ?? field.align,
    line_height: state?.line_height ?? field.line_height ?? 1.2,
    letter_spacing: state?.letter_spacing ?? field.letter_spacing ?? 0,
    font_family: state?.font_family ?? field.font_family,
    font_weight: state?.font_weight ?? field.font_weight,
  };
}

type ResolvedTextField = ReturnType<typeof resolvedTextField>;

interface RichCharStyle {
  font_family: string;
  font_weight: "normal" | "bold";
  color: string;
  font_size: number;
}

interface RichGlyph {
  char: string;
  x: number;
  y: number;
  style: RichCharStyle;
}

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext() {
  if (measureContext) {
    return measureContext;
  }
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  measureContext = canvas.getContext("2d");
  return measureContext;
}

function toFont(style: RichCharStyle) {
  return `${style.font_weight === "bold" ? "bold " : ""}${Math.max(8, style.font_size)}px ${fontStack(style.font_family)}`;
}

function buildCharStyles(value: string, resolved: ResolvedTextField, runs?: RichTextRun[]) {
  const baseStyle: RichCharStyle = {
    font_family: resolved.font_family,
    font_weight: resolved.font_weight,
    color: resolved.color,
    font_size: resolved.font_size,
  };
  const styles: RichCharStyle[] = Array.from({ length: value.length }, () => ({ ...baseStyle }));
  for (const run of runs ?? []) {
    const start = Math.max(0, Math.min(value.length, Math.floor(run.start)));
    const end = Math.max(0, Math.min(value.length, Math.floor(run.end)));
    if (end <= start) {
      continue;
    }
    for (let index = start; index < end; index += 1) {
      styles[index] = {
        font_family: run.font_family ?? styles[index].font_family,
        font_weight: run.font_weight ?? styles[index].font_weight,
        color: run.color ?? styles[index].color,
        font_size: run.font_size ?? styles[index].font_size,
      };
    }
  }
  return styles;
}

function layoutRichGlyphs(
  value: string,
  resolved: ResolvedTextField,
  runs: RichTextRun[] | undefined,
) {
  if (!value.trim()) {
    return [];
  }

  const ctx = getMeasureContext();
  if (!ctx) {
    return [];
  }

  const boxWidth = Math.max(1, resolved.width);
  const boxHeight = Math.max(1, resolved.height);
  const letterSpacing = resolved.letter_spacing ?? 0;
  const lineHeightRatio = resolved.line_height ?? 1.2;
  const charStyles = buildCharStyles(value, resolved, runs);

  const lines: Array<{ glyphs: RichGlyph[]; width: number; maxFont: number }> = [];
  let line: { glyphs: RichGlyph[]; width: number; maxFont: number } = { glyphs: [], width: 0, maxFont: 0 };

  const pushLine = () => {
    lines.push(line);
    line = { glyphs: [], width: 0, maxFont: 0 };
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\r") {
      continue;
    }
    if (char === "\n") {
      pushLine();
      continue;
    }
    const style = charStyles[index];
    ctx.font = toFont(style);
    const charWidth = ctx.measureText(char).width;
    const advance = charWidth + letterSpacing;

    if (line.glyphs.length > 0 && line.width + advance > boxWidth) {
      pushLine();
    }

    const glyph: RichGlyph = {
      char,
      x: line.width,
      y: 0,
      style,
    };
    line.glyphs.push(glyph);
    line.width += advance;
    line.maxFont = Math.max(line.maxFont, style.font_size);
  }

  pushLine();

  const lineHeights = lines.map((item) => Math.max(1, item.maxFont * lineHeightRatio));
  const totalHeight = lineHeights.reduce((sum, height) => sum + height, 0);
  let cursorY = Math.max(0, (boxHeight - totalHeight) / 2);
  const positioned: RichGlyph[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const lineHeight = lineHeights[index];
    const visualWidth = Math.max(0, currentLine.width - letterSpacing);
    const offsetX =
      resolved.align === "right"
        ? Math.max(0, boxWidth - visualWidth)
        : resolved.align === "center"
          ? Math.max(0, (boxWidth - visualWidth) / 2)
          : 0;
    for (const glyph of currentLine.glyphs) {
      positioned.push({
        ...glyph,
        x: glyph.x + offsetX,
        y: cursorY,
      });
    }
    cursorY += lineHeight;
  }

  return positioned;
}

function isPointInSlot(x: number, y: number, slot: SlotPosition) {
  if (slot.shape === "circle") {
    const cx = slot.x + slot.width / 2;
    const cy = slot.y + slot.height / 2;
    const radius = Math.min(slot.width, slot.height) / 2;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }
  if (isPolygonShape(slot.shape)) {
    const points = normalizedPoints(slot).map((point) => ({
      x: slot.x + point.x * slot.width,
      y: slot.y + point.y * slot.height,
    }));
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const intersects =
        points[i].y > y !== points[j].y > y &&
        x < ((points[j].x - points[i].x) * (y - points[i].y)) / (points[j].y - points[i].y) + points[i].x;
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }
  return x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height;
}

function slotPrompt(slot: SlotPosition, index: number) {
  const customLabel = slot.label?.trim();
  if (customLabel) {
    return customLabel.toLowerCase().startsWith("add ") ? customLabel : `Add ${customLabel}`;
  }
  if (index === 0) {
    return "Add Baby Photo";
  }
  if (index === 1) {
    return "Add Parent Photo";
  }
  return `Add Photo ${index + 1}`;
}

function textPrompt(field: TextPosition, index: number) {
  const source = `${field.label ?? ""} ${field.placeholder ?? ""}`.toLowerCase();
  if (source.includes("baby") && source.includes("name")) {
    return "Add Baby Name here";
  }
  if (source.includes("hospital")) {
    return "Add Hospital Name here";
  }
  if (source.includes("dob") || source.includes("born") || source.includes("date")) {
    return "Add DOB here";
  }
  if (source.includes("place")) {
    return "Add Place of Birth here";
  }
  if (source.includes("parent") || source.includes("mom") || source.includes("dad")) {
    return "Add Parent Name here";
  }
  return `Add Text ${index + 1} here`;
}

function TextLayer({
  textPositions,
  textState,
  editable = false,
  selectedTextId = null,
  onSelectText,
  onTextBoxChange,
  onStartTextEdit,
}: {
  textPositions: TextPosition[];
  textState: Record<number, EditorTextState>;
  editable?: boolean;
  selectedTextId?: number | null;
  onSelectText?: (textId: number | null) => void;
  onTextBoxChange?: (textId: number, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  onStartTextEdit?: (textId: number) => void;
}) {
  const textRefs = useRef<Record<number, Konva.Rect | null>>({});
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!editable || !transformerRef.current) {
      return;
    }
    if (selectedTextId === null) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    const selectedNode = textRefs.current[selectedTextId];
    if (!selectedNode) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    transformerRef.current.nodes([selectedNode]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [editable, selectedTextId, textPositions, textState]);

  return (
    <>
      {textPositions.map((field, index) => {
        const state = textState[field.text_id];
        const value = state?.value ?? field.default_text ?? "";
        const resolved = resolvedTextField(field, state);
        const fontWeight = resolved.font_weight;
        const richRuns = state?.rich_runs ?? [];
        const hasRichRuns = value.trim().length > 0 && richRuns.length > 0;
        const richGlyphs = hasRichRuns ? layoutRichGlyphs(value, resolved, richRuns) : [];
        const gradient = hasRichRuns ? null : textGradient(resolved);
        const preview = value.trim() ? value : field.placeholder || field.label || textPrompt(field, index);
        if (!preview.trim() && !editable) {
          return null;
        }
        return (
          <Group key={`text-${field.text_id}`}>
            {editable && selectedTextId === field.text_id ? (
              <Rect
                name="editor-guide"
                ref={(node) => {
                  textRefs.current[field.text_id] = node;
                }}
                x={resolved.x}
                y={resolved.y}
                width={resolved.width}
                height={resolved.height}
                fill="rgba(245, 158, 11, 0.10)"
                stroke="#d97706"
                strokeWidth={3}
                dash={[]}
                draggable
                onClick={() => {
                  const shouldOpenEditor = !value.trim() || selectedTextId === field.text_id;
                  onSelectText?.(field.text_id);
                  if (editable && shouldOpenEditor) {
                    onStartTextEdit?.(field.text_id);
                  }
                }}
                onTap={() => {
                  const shouldOpenEditor = !value.trim() || selectedTextId === field.text_id;
                  onSelectText?.(field.text_id);
                  if (editable && shouldOpenEditor) {
                    onStartTextEdit?.(field.text_id);
                  }
                }}
                onDblClick={() => onStartTextEdit?.(field.text_id)}
                onDblTap={() => onStartTextEdit?.(field.text_id)}
                onDragStart={() => onSelectText?.(field.text_id)}
                onDragEnd={(event) => {
                  onSelectText?.(field.text_id);
                  onTextBoxChange?.(field.text_id, {
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
                  onSelectText?.(field.text_id);
                  onTextBoxChange?.(field.text_id, { x, y, width, height });
                }}
              />
            ) : null}
            {hasRichRuns ? (
              <Shape
                listening={false}
                sceneFunc={(context) => {
                  const native = (context as unknown as { _context: CanvasRenderingContext2D })._context;
                  native.save();
                  native.textBaseline = "top";
                  for (const glyph of richGlyphs) {
                    native.font = toFont(glyph.style);
                    native.fillStyle = glyph.style.color;
                    native.fillText(glyph.char, resolved.x + glyph.x, resolved.y + glyph.y);
                  }
                  native.restore();
                }}
              />
            ) : (
              <KonvaText
                x={resolved.x}
                y={resolved.y}
                width={resolved.width}
                height={resolved.height}
                text={preview}
                fontSize={resolved.font_size}
                fontFamily={fontStack(resolved.font_family)}
                fontStyle={fontWeight === "bold" ? "bold" : "normal"}
                fill={value.trim() ? resolved.color : "rgba(100, 116, 139, 0.75)"}
                fillPriority={value.trim() && gradient ? "linear-gradient" : "color"}
                fillLinearGradientStartPoint={gradient?.start}
                fillLinearGradientEndPoint={gradient?.end}
                fillLinearGradientColorStops={gradient?.colorStops}
                align={resolved.align}
                lineHeight={resolved.line_height}
                letterSpacing={resolved.letter_spacing}
                verticalAlign="middle"
                listening={editable}
                onClick={() => {
                  if (!editable) {
                    return;
                  }
                  const shouldOpenEditor = !value.trim() || selectedTextId === field.text_id;
                  onSelectText?.(field.text_id);
                  if (shouldOpenEditor) {
                    onStartTextEdit?.(field.text_id);
                  }
                }}
                onTap={() => {
                  if (!editable) {
                    return;
                  }
                  const shouldOpenEditor = !value.trim() || selectedTextId === field.text_id;
                  onSelectText?.(field.text_id);
                  if (shouldOpenEditor) {
                    onStartTextEdit?.(field.text_id);
                  }
                }}
                onDblClick={() => (editable ? onStartTextEdit?.(field.text_id) : undefined)}
                onDblTap={() => (editable ? onStartTextEdit?.(field.text_id) : undefined)}
              />
            )}
          </Group>
        );
      })}
      {editable ? <Transformer name="editor-guide" ref={transformerRef} rotateEnabled={false} /> : null}
    </>
  );
}

function SlotImage({
  slot,
  slotState,
  onSelect,
  onAdjustmentChange,
  onDragEnd,
  onDragStart,
}: {
  slot: SlotPosition;
  slotState: EditorSlotState;
  onSelect: () => void;
  onAdjustmentChange: (patch: Partial<SlotAdjustments>) => void;
  onDragStart: () => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
}) {
  const [image] = useImage(slotState.image_url, "anonymous");
  const imageRef = useRef<Konva.Image>(null);
  const adjustments = normalizedAdjustment(slotState.adjustments);
  const cropX = Math.max(0, adjustments.cropX);
  const cropY = Math.max(0, adjustments.cropY);
  const cropW = Math.max(0, adjustments.cropW);
  const cropH = Math.max(0, adjustments.cropH);
  const useCrop = cropW > 0 && cropH > 0;

  const displayWidth = slot.width * adjustments.scale;
  const displayHeight = slot.height * adjustments.scale;
  const baseX = slot.x + (slot.width - displayWidth) / 2;
  const baseY = slot.y + (slot.height - displayHeight) / 2;
  const x = baseX + adjustments.offsetX;
  const y = baseY + adjustments.offsetY;

  useEffect(() => {
    const node = imageRef.current;
    if (!node || !image) {
      return;
    }
    node.filters([Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]);
    node.brightness(adjustments.brightness - 1);
    node.contrast((adjustments.contrast - 1) * 100);
    node.saturation((adjustments.saturation - 1) * 2);
    node.cache();
  }, [adjustments.brightness, adjustments.contrast, adjustments.saturation, image]);

  if (!image) {
    return null;
  }

  const safeCropX = image ? Math.min(cropX, Math.max(0, image.width - 1)) : 0;
  const safeCropY = image ? Math.min(cropY, Math.max(0, image.height - 1)) : 0;
  const safeCropWidth = image ? Math.max(1, Math.min(cropW, image.width - safeCropX)) : 1;
  const safeCropHeight = image ? Math.max(1, Math.min(cropH, image.height - safeCropY)) : 1;

  return (
    <KonvaImage
      ref={imageRef}
      image={image}
      x={x}
      y={y}
      width={displayWidth}
      height={displayHeight}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        onDragEnd(event);
        const node = event.target;
        onAdjustmentChange({
          offsetX: node.x() - baseX,
          offsetY: node.y() - baseY,
        });
      }}
      rotation={adjustments.rotation}
      scaleX={adjustments.flipX ? -1 : 1}
      scaleY={adjustments.flipY ? -1 : 1}
      offsetX={adjustments.flipX ? displayWidth : 0}
      offsetY={adjustments.flipY ? displayHeight : 0}
      crop={
        useCrop
          ? {
              x: safeCropX,
              y: safeCropY,
              width: safeCropWidth,
              height: safeCropHeight,
            }
          : undefined
      }
    />
  );
}

export function FrameCanvas({
  frame,
  slotState,
  selectedSlotId,
  textState,
  onSelectSlot,
  onRequestSlotUpload,
  onAdjustmentsChange,
  onSwapSlots,
  selectedTextId = null,
  onSelectText,
  onTextChange,
  onTextBoxChange,
  textEditable = false,
  stageRef,
  showGuides = true,
}: {
  frame: FrameTemplate;
  slotState: Record<number, EditorSlotState>;
  textState: Record<number, EditorTextState>;
  selectedSlotId: number | null;
  onSelectSlot: (slotId: number) => void;
  onRequestSlotUpload?: (slotId: number) => void;
  onAdjustmentsChange: (slotId: number, patch: Partial<SlotAdjustments>) => void;
  onSwapSlots: (fromSlotId: number, toSlotId: number) => void;
  selectedTextId?: number | null;
  onSelectText?: (textId: number | null) => void;
  onTextChange?: (textId: number, value: string) => void;
  onTextBoxChange?: (textId: number, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  textEditable?: boolean;
  stageRef?: React.RefObject<Konva.Stage | null>;
  showGuides?: boolean;
}) {
  const [frameImage] = useImage(frame.frame_asset_url, "anonymous");
  const [containerWidth, setContainerWidth] = useState(940);
  const [dragSourceSlot, setDragSourceSlot] = useState<number | null>(null);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const localStageRef = useRef<Konva.Stage>(null);
  const sharedStageRef = stageRef ?? localStageRef;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const resolvedTextFields = useMemo(
    () =>
      frame.text_positions.map((field) => resolvedTextField(field, textState[field.text_id])),
    [frame.text_positions, textState],
  );

  const bounds = useMemo(() => {
    const x = Math.max(
      ...frame.slot_positions.map((slot) => slot.x + slot.width),
      ...resolvedTextFields.map((field) => field.x + field.width),
      1200,
    );
    const y = Math.max(
      ...frame.slot_positions.map((slot) => slot.y + slot.height),
      ...resolvedTextFields.map((field) => field.y + field.height),
      900,
    );
    return { width: x, height: y };
  }, [frame.slot_positions, resolvedTextFields]);

  const baseWidth = frameImage?.width ?? bounds.width;
  const baseHeight = frameImage?.height ?? bounds.height;
  const aboveFrameSlots = useMemo(() => {
    if (!frameImage) {
      return new Set<number>();
    }
    return new Set(
      frame.slot_positions
        .filter((slot) => shouldRenderSlotAboveFrame(frameImage, slot))
        .map((slot) => slot.slot_id),
    );
  }, [frame.slot_positions, frameImage]);

  const stageWidth = Math.max(300, Math.min(containerWidth || 940, 940));
  const scale = stageWidth / baseWidth;
  const stageHeight = Math.max(280, baseHeight * scale);

  const editingField = useMemo(() => {
    if (!textEditable || editingTextId === null || selectedTextId !== editingTextId) {
      return null;
    }
    const field = frame.text_positions.find((item) => item.text_id === editingTextId);
    if (!field) {
      return null;
    }
    const state = textState[field.text_id];
    return resolvedTextField(field, state);
  }, [editingTextId, frame.text_positions, selectedTextId, textEditable, textState]);

  const beginInlineTextEdit = (textId: number) => {
    if (!textEditable || !onTextChange) {
      return;
    }
    onSelectText?.(textId);
    setEditingTextId(textId);
  };

  const commitInlineTextEdit = () => {
    setEditingTextId(null);
  };

  return (
    <div
      ref={wrapperRef}
      className="surface w-full overflow-auto p-3 sm:p-5"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative inline-block">
      <Stage
        ref={sharedStageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={(event) => {
          if (!textEditable || !onSelectText) {
            return;
          }
          const isBackground =
            event.target === event.target.getStage() || event.target.name() === "canvas-bg";
          if (isBackground) {
            if (editingTextId !== null) {
              commitInlineTextEdit();
            }
            onSelectText(null);
          }
        }}
        onTouchStart={(event) => {
          if (!textEditable || !onSelectText) {
            return;
          }
          const isBackground =
            event.target === event.target.getStage() || event.target.name() === "canvas-bg";
          if (isBackground) {
            if (editingTextId !== null) {
              commitInlineTextEdit();
            }
            onSelectText(null);
          }
        }}
      >
        <Layer scaleX={scale} scaleY={scale}>
          <Rect name="canvas-bg" x={0} y={0} width={baseWidth} height={baseHeight} fill="#f5f5f4" />

          {frame.slot_positions.map((slot, slotIndex) => {
            if (aboveFrameSlots.has(slot.slot_id)) {
              return null;
            }
            const state = slotState[slot.slot_id];
            return (
              <Group
                key={slot.slot_id}
                clipFunc={(ctx) => slotClipPath(ctx, slot)}
                onClick={() => {
                  onSelectSlot(slot.slot_id);
                  if (!state?.image_url) {
                    onRequestSlotUpload?.(slot.slot_id);
                  }
                }}
                onTap={() => {
                  onSelectSlot(slot.slot_id);
                  if (!state?.image_url) {
                    onRequestSlotUpload?.(slot.slot_id);
                  }
                }}
                onDblClick={() => onRequestSlotUpload?.(slot.slot_id)}
                onDblTap={() => onRequestSlotUpload?.(slot.slot_id)}
              >
                {state?.image_url ? (
                  <SlotImage
                    slot={slot}
                    slotState={state}
                    onSelect={() => onSelectSlot(slot.slot_id)}
                    onAdjustmentChange={(patch) => onAdjustmentsChange(slot.slot_id, patch)}
                    onDragStart={() => setDragSourceSlot(slot.slot_id)}
                    onDragEnd={(event) => {
                      const stage = event.target.getStage();
                      const pointer = stage?.getPointerPosition();
                      if (!pointer || dragSourceSlot === null) {
                        setDragSourceSlot(null);
                        return;
                      }
                      const pointX = pointer.x / scale;
                      const pointY = pointer.y / scale;
                      const targetSlot = frame.slot_positions.find((candidate) =>
                        isPointInSlot(pointX, pointY, candidate),
                      );
                      if (targetSlot && targetSlot.slot_id !== dragSourceSlot) {
                        onSwapSlots(dragSourceSlot, targetSlot.slot_id);
                      }
                      setDragSourceSlot(null);
                    }}
                  />
                ) : (
                  <>
                    <Rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      fill="rgba(255, 255, 255, 0.72)"
                      stroke="#7c95b5"
                      strokeWidth={2}
                      dash={[8, 6]}
                    />
                    <KonvaText
                      x={slot.x + 10}
                      y={slot.y + slot.height / 2 - 14}
                      width={Math.max(20, slot.width - 20)}
                      text={slotPrompt(slot, slotIndex)}
                      fontSize={15}
                      fontStyle="bold"
                      fontFamily={fontStack("Poppins")}
                      fill="#1f4e8c"
                      align="center"
                    />
                  </>
                )}
              </Group>
            );
          })}

          {frameImage ? (
            <KonvaImage image={frameImage} x={0} y={0} width={baseWidth} height={baseHeight} listening={false} />
          ) : null}

          {frame.slot_positions.map((slot, slotIndex) => {
            if (!aboveFrameSlots.has(slot.slot_id)) {
              return null;
            }
            const state = slotState[slot.slot_id];
            return (
              <Group
                key={`above-${slot.slot_id}`}
                clipFunc={(ctx) => slotClipPath(ctx, slot)}
                onClick={() => {
                  onSelectSlot(slot.slot_id);
                  if (!state?.image_url) {
                    onRequestSlotUpload?.(slot.slot_id);
                  }
                }}
                onTap={() => {
                  onSelectSlot(slot.slot_id);
                  if (!state?.image_url) {
                    onRequestSlotUpload?.(slot.slot_id);
                  }
                }}
                onDblClick={() => onRequestSlotUpload?.(slot.slot_id)}
                onDblTap={() => onRequestSlotUpload?.(slot.slot_id)}
              >
                {state?.image_url ? (
                  <SlotImage
                    slot={slot}
                    slotState={state}
                    onSelect={() => onSelectSlot(slot.slot_id)}
                    onAdjustmentChange={(patch) => onAdjustmentsChange(slot.slot_id, patch)}
                    onDragStart={() => setDragSourceSlot(slot.slot_id)}
                    onDragEnd={(event) => {
                      const stage = event.target.getStage();
                      const pointer = stage?.getPointerPosition();
                      if (!pointer || dragSourceSlot === null) {
                        setDragSourceSlot(null);
                        return;
                      }
                      const pointX = pointer.x / scale;
                      const pointY = pointer.y / scale;
                      const targetSlot = frame.slot_positions.find((candidate) =>
                        isPointInSlot(pointX, pointY, candidate),
                      );
                      if (targetSlot && targetSlot.slot_id !== dragSourceSlot) {
                        onSwapSlots(dragSourceSlot, targetSlot.slot_id);
                      }
                      setDragSourceSlot(null);
                    }}
                  />
                ) : (
                  <>
                    <Rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      fill="rgba(255, 255, 255, 0.72)"
                      stroke="#7c95b5"
                      strokeWidth={2}
                      dash={[8, 6]}
                    />
                    <KonvaText
                      x={slot.x + 10}
                      y={slot.y + slot.height / 2 - 14}
                      width={Math.max(20, slot.width - 20)}
                      text={slotPrompt(slot, slotIndex)}
                      fontSize={15}
                      fontStyle="bold"
                      fontFamily={fontStack("Poppins")}
                      fill="#1f4e8c"
                      align="center"
                    />
                  </>
                )}
              </Group>
            );
          })}

          <TextLayer
            textPositions={frame.text_positions}
            textState={textState}
            editable={textEditable}
            selectedTextId={selectedTextId}
            onSelectText={onSelectText}
            onTextBoxChange={onTextBoxChange}
            onStartTextEdit={beginInlineTextEdit}
          />

          {showGuides
            ? frame.slot_positions.map((slot) => {
                const hasImage = Boolean(slotState[slot.slot_id]?.image_url);
                return (
                  <Group
                    key={`outline-${slot.slot_id}`}
                    name="editor-guide"
                    onClick={() => {
                      onSelectSlot(slot.slot_id);
                      if (!hasImage) {
                        onRequestSlotUpload?.(slot.slot_id);
                      }
                    }}
                    onTap={() => {
                      onSelectSlot(slot.slot_id);
                      if (!hasImage) {
                        onRequestSlotUpload?.(slot.slot_id);
                      }
                    }}
                    onDblClick={() => onRequestSlotUpload?.(slot.slot_id)}
                    onDblTap={() => onRequestSlotUpload?.(slot.slot_id)}
                  >
                  {slot.shape === "circle" ? (
                    <Circle
                      x={slot.x + slot.width / 2}
                      y={slot.y + slot.height / 2}
                      radius={Math.min(slot.width, slot.height) / 2}
                      fill="rgba(0, 0, 0, 0)"
                      stroke={selectedSlotId === slot.slot_id ? "#d97706" : "#a8a29e"}
                      strokeWidth={selectedSlotId === slot.slot_id ? 4 : 2}
                      dash={selectedSlotId === slot.slot_id ? [] : [8, 8]}
                    />
                  ) : isPolygonShape(slot.shape) ? (
                    <Line
                      points={polygonPoints(slot)}
                      closed
                      fill="rgba(0, 0, 0, 0)"
                      stroke={selectedSlotId === slot.slot_id ? "#d97706" : "#a8a29e"}
                      strokeWidth={selectedSlotId === slot.slot_id ? 4 : 2}
                      dash={selectedSlotId === slot.slot_id ? [] : [8, 8]}
                    />
                  ) : (
                    <Rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      fill="rgba(0, 0, 0, 0)"
                      stroke={selectedSlotId === slot.slot_id ? "#d97706" : "#a8a29e"}
                      strokeWidth={selectedSlotId === slot.slot_id ? 4 : 2}
                      dash={selectedSlotId === slot.slot_id ? [] : [8, 8]}
                    />
                  )}
                  </Group>
                );
              })
            : null}
        </Layer>
      </Stage>
      {textEditable && editingField && onTextChange ? (
        <textarea
          autoFocus
          value={textState[editingField.text_id]?.value ?? editingField.default_text ?? ""}
          placeholder={editingField.placeholder || editingField.label || "Type text..."}
          onChange={(event) => {
            onTextChange(editingField.text_id, event.target.value);
          }}
          onBlur={commitInlineTextEdit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setEditingTextId(null);
              return;
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              commitInlineTextEdit();
            }
          }}
          className="absolute resize-none rounded-md border-2 border-amber-500 bg-white/95 p-1.5 text-sm text-stone-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
          style={{
            left: `${editingField.x * scale}px`,
            top: `${editingField.y * scale}px`,
            width: `${Math.max(80, editingField.width * scale)}px`,
            height: `${Math.max(36, editingField.height * scale)}px`,
            fontSize: `${Math.max(10, editingField.font_size * scale)}px`,
            fontFamily: fontStack(editingField.font_family),
            fontWeight: editingField.font_weight,
            lineHeight: String(editingField.line_height ?? 1.2),
            letterSpacing: `${editingField.letter_spacing ?? 0}px`,
            color: editingField.color,
            textAlign: editingField.align,
          }}
        />
      ) : null}
      </div>
    </div>
  );
}
