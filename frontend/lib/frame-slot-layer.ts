import type { SlotPosition } from "@/types";

const TRANSPARENT_ALPHA_THRESHOLD = 245;
const TRANSPARENT_RATIO_FOR_FRAME_HOLE = 0.15;
const SAMPLE_SIZE = 120;

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

function slotPoints(slot: SlotPosition) {
  if (slot.points && slot.points.length >= 3) {
    return slot.points;
  }
  return defaultPointsForShape(slot.shape);
}

function pointInSlotShape(slot: SlotPosition, x: number, y: number) {
  if (slot.shape === "circle") {
    const dx = x - 0.5;
    const dy = y - 0.5;
    return dx * dx + dy * dy <= 0.25;
  }

  if (isPolygonShape(slot.shape)) {
    const points = slotPoints(slot);
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

  return true;
}

export function shouldRenderSlotAboveFrame(
  frameImage: HTMLImageElement | null | undefined,
  slot: SlotPosition,
) {
  if (!frameImage || slot.width <= 0 || slot.height <= 0) {
    return false;
  }

  const width = Math.max(8, Math.min(SAMPLE_SIZE, Math.round(slot.width)));
  const height = Math.max(8, Math.min(SAMPLE_SIZE, Math.round(slot.height)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return false;
  }

  try {
    ctx.drawImage(frameImage, slot.x, slot.y, slot.width, slot.height, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let sampled = 0;
    let transparent = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x + 0.5) / width;
        const ny = (y + 0.5) / height;
        if (!pointInSlotShape(slot, nx, ny)) {
          continue;
        }
        sampled += 1;
        if (pixels[(y * width + x) * 4 + 3] < TRANSPARENT_ALPHA_THRESHOLD) {
          transparent += 1;
        }
      }
    }

    if (sampled === 0) {
      return false;
    }
    return transparent / sampled < TRANSPARENT_RATIO_FOR_FRAME_HOLE;
  } catch {
    return false;
  }
}
