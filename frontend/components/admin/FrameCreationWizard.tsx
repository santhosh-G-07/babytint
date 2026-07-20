"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SlotPositionMapper } from "@/components/admin/SlotPositionMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createFrame, uploadFrameAsset } from "@/lib/api";
import {
  fontOptionValue,
  fontStack,
  frameFontGroups,
  parseFontOption,
} from "@/lib/frame-fonts";
import type {
  FrameTemplate,
  SlotPosition,
  TextAlign,
  TextFontGroup,
  TextPosition,
  TextWeight,
} from "@/types";

type BuilderStep = "details" | "design";
type BackgroundMode = "solid" | "gradient";

interface ArtworkImage {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

interface ArtworkText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  font_group: TextFontGroup;
  font_family: string;
  font_weight: TextWeight;
  font_size: number;
  color: string;
  align: TextAlign;
}

type ArtworkSelection =
  | { type: "image"; id: string }
  | { type: "text"; id: string }
  | null;

interface FrameCreationWizardProps {
  onClose: () => void;
  onCreated: (frame: FrameTemplate) => void;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 1000,
        height: img.naturalHeight || img.height || 1000,
      });
    };
    img.onerror = () => reject(new Error("Could not load uploaded image dimensions."));
    img.src = url;
  });
}

function nextSlotId(slots: SlotPosition[]) {
  return slots.reduce((maxId, slot) => Math.max(maxId, slot.slot_id), 0) + 1;
}

function nextTextId(texts: TextPosition[]) {
  return texts.reduce((maxId, field) => Math.max(maxId, field.text_id), 0) + 1;
}

function defaultTemplateText(textId: number, frameWidth: number, frameHeight: number): TextPosition {
  const family = frameFontGroups.name[0]!;
  return {
    text_id: textId,
    label: `Text ${textId}`,
    placeholder: "Tap to type",
    default_text: "",
    x: Math.round(frameWidth * 0.28),
    y: Math.round(frameHeight * 0.42),
    width: Math.round(frameWidth * 0.44),
    height: Math.round(frameHeight * 0.12),
    font_group: "name",
    font_family: family.family,
    font_weight: family.weight,
    font_size: Math.max(28, Math.round(frameHeight * 0.06)),
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
}

function defaultSlot(slotId: number, frameWidth: number, frameHeight: number): SlotPosition {
  const width = Math.round(frameWidth * 0.34);
  const height = Math.round(frameHeight * 0.28);
  return {
    slot_id: slotId,
    x: Math.round(frameWidth * 0.33),
    y: Math.round(frameHeight * 0.28),
    width,
    height,
    shape: "rect",
    label: `Slot ${slotId}`,
  };
}

function ArtworkImageNode({
  item,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  registerNode,
}: {
  item: ArtworkImage;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (itemId: string, x: number, y: number) => void;
  onTransformEnd: (itemId: string, patch: Partial<ArtworkImage>) => void;
  registerNode: (itemId: string, node: Konva.Image | null) => void;
}) {
  const [image] = useImage(item.url, "anonymous");

  return (
    <KonvaImage
      ref={(node) => registerNode(item.id, node)}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      offsetX={item.width / 2}
      offsetY={item.height / 2}
      scaleX={item.flipX ? -1 : 1}
      scaleY={item.flipY ? -1 : 1}
      opacity={selected ? 0.98 : 1}
      stroke={selected ? "#d97706" : undefined}
      strokeWidth={selected ? 2 : 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(event) => onDragEnd(item.id, event.target.x(), event.target.y())}
      onTransformEnd={(event) => {
        const node = event.target as Konva.Image;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const nextFlipX = scaleX < 0;
        const nextFlipY = scaleY < 0;
        const nextWidth = Math.max(24, node.width() * Math.abs(scaleX));
        const nextHeight = Math.max(24, node.height() * Math.abs(scaleY));
        node.scaleX(nextFlipX ? -1 : 1);
        node.scaleY(nextFlipY ? -1 : 1);
        onTransformEnd(item.id, {
          x: node.x(),
          y: node.y(),
          width: nextWidth,
          height: nextHeight,
          rotation: node.rotation(),
          flipX: nextFlipX,
          flipY: nextFlipY,
        });
      }}
    />
  );
}

export function FrameCreationWizard({ onClose, onCreated }: FrameCreationWizardProps) {
  const [step, setStep] = useState<BuilderStep>("details");
  const [saving, setSaving] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [details, setDetails] = useState({
    name: "",
    slug: "",
    category: "family",
    size: "12x8",
    widthPx: 1200,
    heightPx: 1800,
    price: "1299",
    offerPrice: "",
    assistedCustomizationPrice: "300",
    isActive: true,
  });
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("solid");
  const [solidColor, setSolidColor] = useState("#f4f2f7");
  const [gradientFrom, setGradientFrom] = useState("#fff8f2");
  const [gradientTo, setGradientTo] = useState("#e8f2ff");
  const [gradientAngle, setGradientAngle] = useState(30);
  const [artworkImages, setArtworkImages] = useState<ArtworkImage[]>([]);
  const [artworkTexts, setArtworkTexts] = useState<ArtworkText[]>([]);
  const [selection, setSelection] = useState<ArtworkSelection>(null);
  const [mapperPreviewUrl, setMapperPreviewUrl] = useState<string>("");
  const [slotPositions, setSlotPositions] = useState<SlotPosition[]>([]);
  const [textPositions, setTextPositions] = useState<TextPosition[]>([]);

  const frameWidth = Math.max(240, Number(details.widthPx) || 1200);
  const frameHeight = Math.max(240, Number(details.heightPx) || 1800);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const imageRefs = useRef<Record<string, Konva.Image | null>>({});
  const textRefs = useRef<Record<string, Konva.Text | null>>({});
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasWrapWidth, setCanvasWrapWidth] = useState(760);
  const nextArtworkImageCounter = useRef(1);
  const nextArtworkTextCounter = useRef(1);

  useEffect(() => {
    const wrapper = canvasWrapRef.current;
    if (!wrapper) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasWrapWidth(entry.contentRect.width);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const stageWidth = Math.max(320, Math.min(Math.max(canvasWrapWidth - 18, 320), 760));
  const scale = stageWidth / frameWidth;
  const stageHeight = Math.max(260, frameHeight * scale);

  const selectedArtworkImage = selection?.type === "image"
    ? artworkImages.find((item) => item.id === selection.id) ?? null
    : null;
  const selectedArtworkText = selection?.type === "text"
    ? artworkTexts.find((item) => item.id === selection.id) ?? null
    : null;

  useEffect(() => {
    const node =
      selection?.type === "image"
        ? imageRefs.current[selection.id]
        : selection?.type === "text"
          ? textRefs.current[selection.id]
          : null;
    if (!node || !trRef.current) {
      trRef.current?.nodes([]);
      trRef.current?.getLayer()?.batchDraw();
      return;
    }
    trRef.current.nodes([node]);
    trRef.current.getLayer()?.batchDraw();
  }, [selection, artworkImages, artworkTexts]);

  const gradient = useMemo(
    () => gradientPoints(frameWidth, frameHeight, gradientAngle),
    [frameWidth, frameHeight, gradientAngle],
  );

  const snapshotMapperPreview = (toastOnSuccess = false) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 1 });
      setMapperPreviewUrl(dataUrl);
      if (toastOnSuccess) {
        toast.success("Mapper preview refreshed.");
      }
    } catch {
      toast.error("Could not refresh mapper preview. Check uploaded image CORS settings.");
    }
  };

  useEffect(() => {
    if (step !== "design" || mapperPreviewUrl) {
      return;
    }
    const timer = window.setTimeout(() => {
      snapshotMapperPreview(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [mapperPreviewUrl, step]);

  const handleAddArtworkImage = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    try {
      setUploadingArtwork(true);
      const uploaded = await uploadFrameAsset(file);
      const imageSize = await readImageSize(uploaded.url);
      const fitWidth = Math.min(frameWidth * 0.45, imageSize.width);
      const fitHeight = (fitWidth / imageSize.width) * imageSize.height;
      const boundedHeight = Math.min(frameHeight * 0.45, fitHeight);
      const boundedWidth = (boundedHeight / fitHeight) * fitWidth;

      const item: ArtworkImage = {
        id: crypto.randomUUID(),
        name: `Image ${nextArtworkImageCounter.current}`,
        url: uploaded.url,
        x: frameWidth / 2,
        y: frameHeight / 2,
        width: Math.max(24, Math.round(boundedWidth)),
        height: Math.max(24, Math.round(boundedHeight)),
        rotation: 0,
        flipX: false,
        flipY: false,
      };
      nextArtworkImageCounter.current += 1;
      setArtworkImages((previous) => [...previous, item]);
      setSelection({ type: "image", id: item.id });
      toast.success("Artwork image added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setUploadingArtwork(false);
    }
  };

  const handleAddStaticText = () => {
    const defaultFont = frameFontGroups.name[0]!;
    const text: ArtworkText = {
      id: crypto.randomUUID(),
      text: `Static Text ${nextArtworkTextCounter.current}`,
      x: Math.round(frameWidth * 0.22),
      y: Math.round(frameHeight * 0.12),
      width: Math.round(frameWidth * 0.56),
      height: Math.round(frameHeight * 0.08),
      rotation: 0,
      font_group: "name",
      font_family: defaultFont.family,
      font_weight: defaultFont.weight,
      font_size: Math.max(26, Math.round(frameHeight * 0.045)),
      color: "#1c1917",
      align: "center",
    };
    nextArtworkTextCounter.current += 1;
    setArtworkTexts((previous) => [...previous, text]);
    setSelection({ type: "text", id: text.id });
  };

  const handleAddPhotoSlot = () => {
    const slotId = nextSlotId(slotPositions);
    const created = defaultSlot(slotId, frameWidth, frameHeight);
    setSlotPositions((previous) => [...previous, created]);
    toast.success(`Photo slot ${slotId} added.`);
  };

  const handleAddEditableText = () => {
    const textId = nextTextId(textPositions);
    const created = defaultTemplateText(textId, frameWidth, frameHeight);
    setTextPositions((previous) => [...previous, created]);
    toast.success(`Editable text ${textId} added.`);
  };

  const moveArtworkImage = (id: string, direction: "up" | "down") => {
    setArtworkImages((previous) => {
      const index = previous.findIndex((item) => item.id === id);
      if (index < 0) {
        return previous;
      }
      const targetIndex = direction === "up" ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }
      const copy = [...previous];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const moveArtworkText = (id: string, direction: "up" | "down") => {
    setArtworkTexts((previous) => {
      const index = previous.findIndex((item) => item.id === id);
      if (index < 0) {
        return previous;
      }
      const targetIndex = direction === "up" ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }
      const copy = [...previous];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const createFromWizard = async () => {
    if (!details.name.trim()) {
      toast.error("Enter frame name.");
      return;
    }
    const resolvedSlug = details.slug.trim() || slugify(details.name);
    if (!resolvedSlug) {
      toast.error("Enter a valid slug.");
      return;
    }
    if (slotPositions.length === 0) {
      toast.error("Add at least one photo slot.");
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      toast.error("Frame canvas is not ready yet.");
      return;
    }

    setSaving(true);
    try {
      // Export at native frameWidth x frameHeight pixels so the saved PNG's
      // real pixel dimensions match the coordinate space slot/text
      // positions were authored in (the on-screen stage is scaled down by
      // `scale` to fit the wizard panel, so a fixed pixelRatio here would
      // export at the wrong physical size and misalign print output).
      const exportPixelRatio = stageWidth > 0 ? frameWidth / stageWidth : 1;
      const dataUrl = stage.toDataURL({ pixelRatio: exportPixelRatio, mimeType: "image/png" });
      const blob = await fetch(dataUrl).then((response) => response.blob());
      const file = new File([blob], `${resolvedSlug}-frame.png`, { type: "image/png" });
      const uploaded = await uploadFrameAsset(file);

      const frame = await createFrame({
        name: details.name.trim(),
        slug: resolvedSlug,
        category: details.category.trim() || "family",
        size: details.size.trim() || `${frameWidth}x${frameHeight}`,
        slot_count: slotPositions.length,
        price: String(Number(details.price) || 0),
        offer_price: details.offerPrice ? String(Number(details.offerPrice) || 0) : null,
        assisted_customization_price: details.assistedCustomizationPrice
          ? String(Number(details.assistedCustomizationPrice) || 0)
          : null,
        is_active: details.isActive,
        frame_asset_url: uploaded.url,
        preview_image_url: null,
        slot_positions: slotPositions,
        text_positions: textPositions,
      });

      toast.success("Frame created from wizard.");
      onCreated(frame);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create frame.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 p-2 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-[1450px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-950">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
              New Frame Wizard
            </p>
            <h2 className="text-lg font-semibold sm:text-xl">Build Frame Template Visually</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close wizard">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-2 text-xs dark:border-stone-800 sm:px-6">
          <span className={`rounded-full px-2 py-1 ${step === "details" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}>
            1. Details
          </span>
          <span className={`rounded-full px-2 py-1 ${step === "design" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}>
            2. Design + Zones
          </span>
        </div>

        {step === "details" ? (
          <div className="overflow-auto p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Enter frame size, name, and pricing first. Next step opens live builder.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Frame Name</Label>
                  <Input
                    value={details.name}
                    onChange={(event) =>
                      setDetails((previous) => ({
                        ...previous,
                        name: event.target.value,
                        slug: previous.slug ? previous.slug : slugify(event.target.value),
                      }))
                    }
                    placeholder="White 12x8 Frame"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input
                    value={details.slug}
                    onChange={(event) => setDetails((previous) => ({ ...previous, slug: slugify(event.target.value) }))}
                    placeholder="white-12x8-frame"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    value={details.category}
                    onChange={(event) => setDetails((previous) => ({ ...previous, category: event.target.value }))}
                    placeholder="family"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Display Size Label</Label>
                  <Input
                    value={details.size}
                    onChange={(event) => setDetails((previous) => ({ ...previous, size: event.target.value }))}
                    placeholder="12x8"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Canvas Width (px)</Label>
                  <Input
                    type="number"
                    min={240}
                    value={details.widthPx}
                    onChange={(event) =>
                      setDetails((previous) => ({
                        ...previous,
                        widthPx: Math.max(240, Number(event.target.value) || 240),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Canvas Height (px)</Label>
                  <Input
                    type="number"
                    min={240}
                    value={details.heightPx}
                    onChange={(event) =>
                      setDetails((previous) => ({
                        ...previous,
                        heightPx: Math.max(240, Number(event.target.value) || 240),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={details.price}
                    onChange={(event) => setDetails((previous) => ({ ...previous, price: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Offer Price (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={details.offerPrice}
                    onChange={(event) => setDetails((previous) => ({ ...previous, offerPrice: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Customize With Us Fee</Label>
                  <Input
                    type="number"
                    min={0}
                    value={details.assistedCustomizationPrice}
                    onChange={(event) =>
                      setDetails((previous) => ({ ...previous, assistedCustomizationPrice: event.target.value }))
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm dark:border-stone-800">
                <input
                  type="checkbox"
                  checked={details.isActive}
                  onChange={(event) => setDetails((previous) => ({ ...previous, isActive: event.target.checked }))}
                />
                Frame active for storefront
              </label>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!details.name.trim()) {
                      toast.error("Enter frame name first.");
                      return;
                    }
                    if (!details.slug.trim()) {
                      setDetails((previous) => ({ ...previous, slug: slugify(previous.name) }));
                    }
                    setStep("design");
                  }}
                >
                  Continue To Designer
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_400px]">
            <div className="min-h-0 overflow-auto border-b border-stone-200 p-3 dark:border-stone-800 lg:border-b-0 lg:border-r">
              <div ref={canvasWrapRef} className="rounded-xl border border-stone-200 bg-stone-100 p-2 dark:border-stone-800 dark:bg-stone-900/40">
                <Stage width={stageWidth} height={stageHeight} ref={stageRef}>
                  <Layer scaleX={scale} scaleY={scale}>
                    <Rect
                      x={0}
                      y={0}
                      width={frameWidth}
                      height={frameHeight}
                      fill={backgroundMode === "solid" ? solidColor : undefined}
                      fillPriority={backgroundMode === "solid" ? "color" : "linear-gradient"}
                      fillLinearGradientStartPoint={gradient.start}
                      fillLinearGradientEndPoint={gradient.end}
                      fillLinearGradientColorStops={[0, gradientFrom, 1, gradientTo]}
                    />

                    {artworkImages.map((item) => (
                      <ArtworkImageNode
                        key={item.id}
                        item={item}
                        selected={selection?.type === "image" && selection.id === item.id}
                        onSelect={() => setSelection({ type: "image", id: item.id })}
                        registerNode={(itemId, node) => {
                          imageRefs.current[itemId] = node;
                        }}
                        onDragEnd={(itemId, x, y) => {
                          setArtworkImages((previous) =>
                            previous.map((current) =>
                              current.id === itemId ? { ...current, x, y } : current,
                            ),
                          );
                        }}
                        onTransformEnd={(itemId, patch) => {
                          setArtworkImages((previous) =>
                            previous.map((current) =>
                              current.id === itemId ? { ...current, ...patch } : current,
                            ),
                          );
                        }}
                      />
                    ))}

                    {artworkTexts.map((item) => (
                      <KonvaText
                        key={item.id}
                        ref={(node) => {
                          textRefs.current[item.id] = node;
                        }}
                        x={item.x}
                        y={item.y}
                        width={item.width}
                        height={item.height}
                        rotation={item.rotation}
                        text={item.text}
                        fill={item.color}
                        fontSize={item.font_size}
                        fontFamily={fontStack(item.font_family)}
                        fontStyle={item.font_weight === "bold" ? "bold" : "normal"}
                        align={item.align}
                        verticalAlign="middle"
                        draggable
                        onClick={() => setSelection({ type: "text", id: item.id })}
                        onTap={() => setSelection({ type: "text", id: item.id })}
                        onDragEnd={(event) => {
                          const x = Math.max(0, event.target.x());
                          const y = Math.max(0, event.target.y());
                          setArtworkTexts((previous) =>
                            previous.map((current) =>
                              current.id === item.id ? { ...current, x, y } : current,
                            ),
                          );
                        }}
                        onTransformEnd={(event) => {
                          const node = event.target as Konva.Text;
                          const nextWidth = Math.max(24, node.width() * node.scaleX());
                          const nextHeight = Math.max(24, node.height() * node.scaleY());
                          const nextFontSize = Math.max(10, Math.round(item.font_size * node.scaleY()));
                          node.scaleX(1);
                          node.scaleY(1);
                          setArtworkTexts((previous) =>
                            previous.map((current) =>
                              current.id === item.id
                                ? {
                                    ...current,
                                    x: node.x(),
                                    y: node.y(),
                                    width: nextWidth,
                                    height: nextHeight,
                                    rotation: node.rotation(),
                                    font_size: nextFontSize,
                                  }
                                : current,
                            ),
                          );
                        }}
                      />
                    ))}
                    <Transformer ref={trRef} rotateEnabled enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]} />
                  </Layer>
                </Stage>
              </div>

              <div className="mt-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Photo And Editable Text Zones</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => snapshotMapperPreview(true)}>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Refresh Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleAddPhotoSlot}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Photo Slot
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleAddEditableText}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Editable Text
                    </Button>
                  </div>
                </div>
                <SlotPositionMapper
                  frameAssetUrl={mapperPreviewUrl}
                  slots={slotPositions}
                  textPositions={textPositions}
                  onChange={setSlotPositions}
                  onTextChange={setTextPositions}
                />
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-3 sm:p-4">
              <div className="space-y-3">
                <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                  <p className="text-sm font-semibold">Frame Info</p>
                  <div className="mt-2 grid gap-2">
                    <Input
                      value={details.name}
                      placeholder="Frame name"
                      onChange={(event) => setDetails((previous) => ({ ...previous, name: event.target.value }))}
                    />
                    <Input
                      value={details.slug}
                      placeholder="Slug"
                      onChange={(event) => setDetails((previous) => ({ ...previous, slug: slugify(event.target.value) }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={details.price}
                        onChange={(event) => setDetails((previous) => ({ ...previous, price: event.target.value }))}
                        placeholder="Price"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={details.offerPrice}
                        onChange={(event) => setDetails((previous) => ({ ...previous, offerPrice: event.target.value }))}
                        placeholder="Offer"
                      />
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={details.assistedCustomizationPrice}
                      onChange={(event) =>
                        setDetails((previous) => ({ ...previous, assistedCustomizationPrice: event.target.value }))
                      }
                      placeholder="Customize with us fee"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                  <p className="text-sm font-semibold">Background</p>
                  <div className="mt-2 space-y-2">
                    <Select value={backgroundMode} onValueChange={(value: BackgroundMode) => setBackgroundMode(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Single Color</SelectItem>
                        <SelectItem value="gradient">2-Color Gradient</SelectItem>
                      </SelectContent>
                    </Select>

                    {backgroundMode === "solid" ? (
                      <div className="space-y-1">
                        <Label>Background Color</Label>
                        <Input
                          className="h-10 p-1"
                          type="color"
                          value={solidColor}
                          onChange={(event) => setSolidColor(event.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label>Gradient From</Label>
                          <Input
                            className="h-10 p-1"
                            type="color"
                            value={gradientFrom}
                            onChange={(event) => setGradientFrom(event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Gradient To</Label>
                          <Input
                            className="h-10 p-1"
                            type="color"
                            value={gradientTo}
                            onChange={(event) => setGradientTo(event.target.value)}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label>Gradient Angle</Label>
                          <Input
                            type="number"
                            min={-360}
                            max={360}
                            value={gradientAngle}
                            onChange={(event) => setGradientAngle(Math.max(-360, Math.min(360, Number(event.target.value) || 0)))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Artwork Images</p>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-900">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          void handleAddArtworkImage(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {uploadingArtwork ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400">Uploading image...</p>
                  ) : null}
                  {artworkImages.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400">No images yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {artworkImages.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-left text-xs ${
                            selection?.type === "image" && selection.id === item.id
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                              : "border-stone-200 dark:border-stone-700"
                          }`}
                          onClick={() => setSelection({ type: "image", id: item.id })}
                        >
                          <span className="truncate">
                            {index + 1}. {item.name}
                          </span>
                          {selection?.type === "image" && selection.id === item.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Static Text On Frame</p>
                    <Button size="sm" variant="outline" onClick={handleAddStaticText}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  {artworkTexts.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400">No static texts yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {artworkTexts.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-left text-xs ${
                            selection?.type === "text" && selection.id === item.id
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                              : "border-stone-200 dark:border-stone-700"
                          }`}
                          onClick={() => setSelection({ type: "text", id: item.id })}
                        >
                          <span className="truncate">
                            {index + 1}. {item.text}
                          </span>
                          {selection?.type === "text" && selection.id === item.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedArtworkImage ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-700 dark:bg-amber-950/20">
                    <p className="text-sm font-semibold">Selected Artwork Image</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setArtworkImages((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkImage.id ? { ...item, flipX: !item.flipX } : item,
                            ),
                          )
                        }
                      >
                        Flip X
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setArtworkImages((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkImage.id ? { ...item, flipY: !item.flipY } : item,
                            ),
                          )
                        }
                      >
                        Flip Y
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => moveArtworkImage(selectedArtworkImage.id, "up")}>
                        <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                        Layer Up
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => moveArtworkImage(selectedArtworkImage.id, "down")}>
                        <ArrowDown className="mr-1.5 h-3.5 w-3.5" />
                        Layer Down
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="col-span-2"
                        onClick={() => {
                          setArtworkImages((previous) => previous.filter((item) => item.id !== selectedArtworkImage.id));
                          setSelection(null);
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete Image
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedArtworkText ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-700 dark:bg-amber-950/20">
                    <p className="text-sm font-semibold">Selected Static Text</p>
                    <div className="mt-2 space-y-2">
                      <Textarea
                        rows={2}
                        value={selectedArtworkText.text}
                        onChange={(event) =>
                          setArtworkTexts((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkText.id ? { ...item, text: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <Select
                        value={selectedArtworkText.font_group}
                        onValueChange={(nextGroup: TextFontGroup) => {
                          const defaultFont = frameFontGroups[nextGroup][0]!;
                          setArtworkTexts((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkText.id
                                ? {
                                    ...item,
                                    font_group: nextGroup,
                                    font_family: defaultFont.family,
                                    font_weight: defaultFont.weight,
                                  }
                                : item,
                            ),
                          );
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

                      <Select
                        value={fontOptionValue({
                          family: selectedArtworkText.font_family,
                          weight: selectedArtworkText.font_weight,
                        })}
                        onValueChange={(value) => {
                          const parsed = parseFontOption(value);
                          setArtworkTexts((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkText.id
                                ? { ...item, font_family: parsed.family, font_weight: parsed.weight }
                                : item,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(frameFontGroups[selectedArtworkText.font_group] ?? frameFontGroups.general).map((option) => (
                            <SelectItem key={fontOptionValue(option)} value={fontOptionValue(option)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min={8}
                          max={320}
                          value={selectedArtworkText.font_size}
                          onChange={(event) =>
                            setArtworkTexts((previous) =>
                              previous.map((item) =>
                                item.id === selectedArtworkText.id
                                  ? {
                                      ...item,
                                      font_size: Math.max(8, Math.min(320, Number(event.target.value) || 8)),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Input
                          className="h-10 p-1"
                          type="color"
                          value={selectedArtworkText.color}
                          onChange={(event) =>
                            setArtworkTexts((previous) =>
                              previous.map((item) =>
                                item.id === selectedArtworkText.id ? { ...item, color: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>

                      <Select
                        value={selectedArtworkText.align}
                        onValueChange={(align: TextAlign) =>
                          setArtworkTexts((previous) =>
                            previous.map((item) =>
                              item.id === selectedArtworkText.id ? { ...item, align } : item,
                            ),
                          )
                        }
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

                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => moveArtworkText(selectedArtworkText.id, "up")}>
                          <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                          Layer Up
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => moveArtworkText(selectedArtworkText.id, "down")}>
                          <ArrowDown className="mr-1.5 h-3.5 w-3.5" />
                          Layer Down
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setArtworkTexts((previous) => previous.filter((item) => item.id !== selectedArtworkText.id));
                          setSelection(null);
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete Text
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep("details")}>
                    Back
                  </Button>
                  <Button variant="outline" onClick={() => snapshotMapperPreview(true)}>
                    Refresh Zones Preview
                  </Button>
                  <Button onClick={createFromWizard} disabled={saving}>
                    {saving ? "Creating..." : "Create Frame"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
