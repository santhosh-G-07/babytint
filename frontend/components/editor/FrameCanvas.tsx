"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Circle, Line, Text as KonvaText } from "react-konva";
import useImage from "use-image";

import { fontStack } from "@/lib/frame-fonts";
import { shouldRenderSlotAboveFrame } from "@/lib/frame-slot-layer";
import type { EditorSlotState, EditorTextState, FrameTemplate, SlotAdjustments, SlotPosition, TextPosition } from "@/types";

function normalizedPoints(slot: SlotPosition) {
  if (slot.points && slot.points.length >= 3) {
    return slot.points;
  }
  return [
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.04 },
    { x: 0.98, y: 0.76 },
    { x: 0.66, y: 0.98 },
    { x: 0.08, y: 0.9 },
    { x: 0.02, y: 0.3 },
  ];
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
  if (slot.shape === "free") {
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

function isPointInSlot(x: number, y: number, slot: SlotPosition) {
  if (slot.shape === "circle") {
    const cx = slot.x + slot.width / 2;
    const cy = slot.y + slot.height / 2;
    const radius = Math.min(slot.width, slot.height) / 2;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }
  if (slot.shape === "free") {
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

function TextLayer({
  textPositions,
  textState,
}: {
  textPositions: TextPosition[];
  textState: Record<number, EditorTextState>;
}) {
  return (
    <>
      {textPositions.map((field) => {
        const state = textState[field.text_id];
        const value = state?.value || field.default_text || "";
        const fontWeight = state?.font_weight ?? field.font_weight;
        if (!value.trim()) {
          return null;
        }
        return (
          <KonvaText
            key={`text-${field.text_id}`}
            x={field.x}
            y={field.y}
            width={field.width}
            height={field.height}
            text={value}
            fontSize={field.font_size}
            fontFamily={fontStack(state?.font_family ?? field.font_family)}
            fontStyle={fontWeight === "bold" ? "bold" : "normal"}
            fill={field.color}
            align={field.align}
            verticalAlign="middle"
            listening={false}
          />
        );
      })}
    </>
  );
}

function SlotImage({
  slot,
  slotState,
  isSelected,
  onSelect,
  onAdjustmentChange,
  onDragEnd,
  onDragStart,
}: {
  slot: SlotPosition;
  slotState: EditorSlotState;
  isSelected: boolean;
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
      shadowColor={isSelected ? "#b45309" : "transparent"}
      shadowBlur={isSelected ? 16 : 0}
      shadowOpacity={0.4}
    />
  );
}

export function FrameCanvas({
  frame,
  slotState,
  selectedSlotId,
  textState,
  onSelectSlot,
  onAdjustmentsChange,
  onSwapSlots,
  stageRef,
  showGuides = true,
}: {
  frame: FrameTemplate;
  slotState: Record<number, EditorSlotState>;
  textState: Record<number, EditorTextState>;
  selectedSlotId: number | null;
  onSelectSlot: (slotId: number) => void;
  onAdjustmentsChange: (slotId: number, patch: Partial<SlotAdjustments>) => void;
  onSwapSlots: (fromSlotId: number, toSlotId: number) => void;
  stageRef?: React.RefObject<Konva.Stage | null>;
  showGuides?: boolean;
}) {
  const [frameImage] = useImage(frame.frame_asset_url, "anonymous");
  const [containerWidth, setContainerWidth] = useState(940);
  const [dragSourceSlot, setDragSourceSlot] = useState<number | null>(null);
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

  const bounds = useMemo(() => {
    const x = Math.max(
      ...frame.slot_positions.map((slot) => slot.x + slot.width),
      ...frame.text_positions.map((field) => field.x + field.width),
      1200,
    );
    const y = Math.max(
      ...frame.slot_positions.map((slot) => slot.y + slot.height),
      ...frame.text_positions.map((field) => field.y + field.height),
      900,
    );
    return { width: x, height: y };
  }, [frame.slot_positions, frame.text_positions]);

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

  return (
    <div
      ref={wrapperRef}
      className="surface w-full overflow-auto p-3 sm:p-5"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Stage ref={sharedStageRef} width={stageWidth} height={stageHeight}>
        <Layer scaleX={scale} scaleY={scale}>
          <Rect x={0} y={0} width={baseWidth} height={baseHeight} fill="#f5f5f4" />

          {frame.slot_positions.map((slot) => {
            if (aboveFrameSlots.has(slot.slot_id)) {
              return null;
            }
            const state = slotState[slot.slot_id];
            return (
              <Group
                key={slot.slot_id}
                clipFunc={(ctx) => slotClipPath(ctx, slot)}
                onClick={() => onSelectSlot(slot.slot_id)}
                onTap={() => onSelectSlot(slot.slot_id)}
              >
                {state?.image_url ? (
                  <SlotImage
                    slot={slot}
                    slotState={state}
                    isSelected={selectedSlotId === slot.slot_id}
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
                ) : null}
              </Group>
            );
          })}

          {frameImage ? (
            <KonvaImage image={frameImage} x={0} y={0} width={baseWidth} height={baseHeight} listening={false} />
          ) : null}

          {frame.slot_positions.map((slot) => {
            if (!aboveFrameSlots.has(slot.slot_id)) {
              return null;
            }
            const state = slotState[slot.slot_id];
            return (
              <Group
                key={`above-${slot.slot_id}`}
                clipFunc={(ctx) => slotClipPath(ctx, slot)}
                onClick={() => onSelectSlot(slot.slot_id)}
                onTap={() => onSelectSlot(slot.slot_id)}
              >
                {state?.image_url ? (
                  <SlotImage
                    slot={slot}
                    slotState={state}
                    isSelected={selectedSlotId === slot.slot_id}
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
                ) : null}
              </Group>
            );
          })}

          <TextLayer textPositions={frame.text_positions} textState={textState} />

          {showGuides
            ? frame.slot_positions.map((slot) => (
                <Group
                  key={`outline-${slot.slot_id}`}
                  name="editor-guide"
                  onClick={() => onSelectSlot(slot.slot_id)}
                  onTap={() => onSelectSlot(slot.slot_id)}
                >
                  {slot.shape === "circle" ? (
                    <Circle
                      x={slot.x + slot.width / 2}
                      y={slot.y + slot.height / 2}
                      radius={Math.min(slot.width, slot.height) / 2}
                      fill={selectedSlotId === slot.slot_id ? "rgba(245, 158, 11, 0.16)" : "rgba(0, 0, 0, 0.04)"}
                      stroke={selectedSlotId === slot.slot_id ? "#d97706" : "#a8a29e"}
                      strokeWidth={selectedSlotId === slot.slot_id ? 4 : 2}
                      dash={selectedSlotId === slot.slot_id ? [] : [8, 8]}
                    />
                  ) : slot.shape === "free" ? (
                    <Line
                      points={polygonPoints(slot)}
                      closed
                      fill={selectedSlotId === slot.slot_id ? "rgba(245, 158, 11, 0.16)" : "rgba(0, 0, 0, 0.04)"}
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
                      fill={selectedSlotId === slot.slot_id ? "rgba(245, 158, 11, 0.16)" : "rgba(0, 0, 0, 0.04)"}
                      stroke={selectedSlotId === slot.slot_id ? "#d97706" : "#a8a29e"}
                      strokeWidth={selectedSlotId === slot.slot_id ? 4 : 2}
                      dash={selectedSlotId === slot.slot_id ? [] : [8, 8]}
                    />
                  )}
                </Group>
              ))
            : null}
        </Layer>
      </Stage>
    </div>
  );
}
