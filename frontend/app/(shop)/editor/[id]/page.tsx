"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Konva from "konva";
import { X } from "lucide-react";
import { toast } from "sonner";

import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { PhotoCropperSheet, type CropSelection } from "@/components/editor/PhotoCropperSheet";
import { TextEditor } from "@/components/editor/TextEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addServerCartItem, authMe, getFrame, uploadImage } from "@/lib/api";
import { useCartStore, useEditorStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { SlotAdjustments, SlotPosition } from "@/types";

const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SUPPORTED_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

const DEFAULT_PHOTO_ADJUSTMENTS: SlotAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  rotation: 0,
  cropX: 0,
  cropY: 0,
  cropW: 0,
  cropH: 0,
  flipX: false,
  flipY: false,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

interface CropTask {
  slotId: number;
  file: File;
  objectUrl: string;
}

function isSupportedPhoto(file: File) {
  if (SUPPORTED_UPLOAD_MIME_TYPES.has(file.type)) {
    return true;
  }
  const name = file.name.toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
}

async function ensureImageIsRenderable(url: string) {
  await new Promise<void>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Uploaded image could not be rendered by browser canvas."));
    img.src = url;
  });
}

function slotTitle(slot: SlotPosition | null | undefined, fallbackId?: number) {
  return slot?.label?.trim() || (fallbackId ? `Slot ${fallbackId}` : "Photo Slot");
}

function hideEditorGuides(stage: Konva.Stage) {
  const guides = stage.find(".editor-guide");
  guides.forEach((node) => node.visible(false));
  stage.draw();
  return () => {
    guides.forEach((node) => node.visible(true));
    stage.draw();
  };
}

const FrameCanvas = dynamic(
  () =>
    import("@/components/editor/FrameCanvas").then(
      (module) => module.FrameCanvas,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[620px] rounded-2xl" />,
  },
);

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const stageRef = useRef<Konva.Stage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotIdRef = useRef<number | null>(null);
  const [savingComposite, setSavingComposite] = useState(false);
  const [uploadingSlotId, setUploadingSlotId] = useState<number | null>(null);
  const [cropTask, setCropTask] = useState<CropTask | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);

  const frameRef = params.id;
  const { data: frame, isLoading, error } = useQuery({
    queryKey: ["frame", frameRef],
    queryFn: () => getFrame(frameRef),
    enabled: Boolean(frameRef),
  });

  const {
    frameId,
    selectedSlotId,
    slots,
    texts,
    initializeFrame,
    selectSlot,
    setSlotImage,
    updateSlotAdjustments,
    updateTextValue,
    updateTextFont,
    updateTextStyle,
    styleTextRange,
    clearTextRangeStyle,
    updateTextBox,
    swapSlots,
    toCustomizationData,
  } = useEditorStore();

  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    if (!frame) {
      return;
    }
    initializeFrame(frame.id, frame.slot_positions.map((slot) => slot.slot_id), frame.text_positions);
  }, [frame, initializeFrame]);

  useEffect(() => {
    return () => {
      if (cropTask) {
        URL.revokeObjectURL(cropTask.objectUrl);
      }
    };
  }, [cropTask]);

  const selectedSlot = useMemo(
    () => frame?.slot_positions.find((slot) => slot.slot_id === selectedSlotId) ?? null,
    [frame, selectedSlotId],
  );

  const uploadPhoto = async (file: File) => {
    if (!isSupportedPhoto(file)) {
      throw new Error("Unsupported image format. Use JPG, PNG, or WEBP.");
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error("Image is too large. Use a file up to 20MB.");
    }

    const uploaded = await uploadImage(file);
    await ensureImageIsRenderable(uploaded.url);
    return uploaded.url;
  };

  const openFilePickerForSlot = (slotId: number) => {
    pendingSlotIdRef.current = slotId;
    selectSlot(slotId);
    setSelectedTextId(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0];
    const targetSlotId = pendingSlotIdRef.current ?? selectedSlotId;
    pendingSlotIdRef.current = null;

    if (!file || !targetSlotId) {
      return;
    }
    if (!isSupportedPhoto(file)) {
      toast.error("Unsupported image format. Use JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Image is too large. Use a file up to 20MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropTask({ slotId: targetSlotId, file, objectUrl });
  };

  const handleApplyCrop = async (selection: CropSelection) => {
    if (!cropTask || uploadingSlotId !== null) {
      return;
    }

    const task = cropTask;
    const targetSlot = frame?.slot_positions.find((slot) => slot.slot_id === task.slotId);
    setUploadingSlotId(task.slotId);
    try {
      const url = await uploadPhoto(task.file);
      setSlotImage(task.slotId, url);
      updateSlotAdjustments(task.slotId, {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        cropX: selection.cropX,
        cropY: selection.cropY,
        cropW: selection.cropW,
        cropH: selection.cropH,
      });
      selectSlot(task.slotId);
      setCropTask(null);
      toast.success(`${slotTitle(targetSlot, task.slotId)} photo ready.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploadingSlotId(null);
    }
  };

  const handleCancelCrop = () => {
    setCropTask(null);
  };

  const handleAddToCart = async () => {
    if (savingComposite) {
      return;
    }
    if (!frame) {
      return;
    }

    const missingSlot = frame.slot_positions.find((slot) => !slots[slot.slot_id]?.image_url);
    if (missingSlot) {
      toast.error(`Add ${slotTitle(missingSlot)} before adding to cart.`);
      return;
    }

    const customization = toCustomizationData();
    if (!customization || customization.slots.length === 0) {
      toast.error("Add at least one photo before adding to cart.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      try {
        await authMe();
      } catch {
        router.push(`/login?next=${encodeURIComponent(`/editor/${frameRef}`)}`);
        return;
      }
    }

    setSavingComposite(true);
    let finalizedCustomization = customization;
    try {
      const stage = stageRef.current;
      if (!stage) {
        throw new Error("Editor canvas is still loading. Please try again.");
      }

      const layer = stage.getLayers()[0];
      const layerScale = layer && layer.scaleX() > 0 ? layer.scaleX() : 1;
      const pixelRatio = Math.min(8, Math.max(2, 1 / layerScale));
      const restoreGuides = hideEditorGuides(stage);

      try {
        const dataUrl = stage.toDataURL({
          mimeType: "image/png",
          pixelRatio,
        });
        const blob = await fetch(dataUrl).then((res) => res.blob());
        const file = new File([blob], `${frame.slug}-composite.png`, { type: "image/png" });
        const uploaded = await uploadImage(file);

        finalizedCustomization = {
          ...customization,
          composite_preview_url: uploaded.url,
          composite_export_meta: {
            pixel_ratio: pixelRatio,
            width: Math.round(stage.width() * pixelRatio),
            height: Math.round(stage.height() * pixelRatio),
          },
        };
      } finally {
        restoreGuides();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to prepare customization.";
      toast.error(message);
      return;
    } finally {
      setSavingComposite(false);
    }

    const effectivePrice = Number(frame.offer_price ?? frame.price);
    addToCart({
      frame,
      quantity: 1,
      price: effectivePrice,
      customization: finalizedCustomization,
    });

    try {
      await addServerCartItem({
        frame_id: frame.id,
        customization_data: finalizedCustomization,
      });
    } catch {
      // Keep local cart even if server cart sync fails.
    }

    toast.success("Added to cart.");
    router.push("/cart");
  };

  const handleOpenPreview = () => {
    const stage = stageRef.current;
    if (!stage || !frameId) {
      return;
    }
    const restoreGuides = hideEditorGuides(stage);
    try {
      setPreviewUrl(stage.toDataURL({ pixelRatio: 2 }));
    } finally {
      restoreGuides();
    }
  };

  if (isLoading) {
    return (
      <div className="container-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[620px] rounded-2xl" />
          <Skeleton className="h-[620px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !frame) {
    return (
      <div className="container-shell py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          Frame not found.
        </div>
      </div>
    );
  }

  return (
    <div className="container-shell py-6 sm:py-8">
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          handleFileSelected(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Customize {frame.name}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Click directly on the frame to add photos and edit text where it appears.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/shop/${frame.slug}`)}>
          Back to details
        </Button>
      </div>

      <div className="space-y-4">
        <EditorToolbar
          slots={frame.slot_positions}
          slotState={slots}
          onPreview={handleOpenPreview}
          onAddToCart={handleAddToCart}
          addToCartBusy={savingComposite}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <FrameCanvas
            frame={frame}
            slotState={slots}
            textState={texts}
            selectedSlotId={selectedSlotId}
            onRequestSlotUpload={openFilePickerForSlot}
            onSelectSlot={(slotId) => {
              selectSlot(slotId);
              setSelectedTextId(null);
            }}
            onAdjustmentsChange={(slotId, patch) => updateSlotAdjustments(slotId, patch)}
            onSwapSlots={swapSlots}
            selectedTextId={selectedTextId}
            onSelectText={setSelectedTextId}
            onTextChange={updateTextValue}
            onTextBoxChange={(textId, patch) => updateTextBox(textId, patch)}
            textEditable
            stageRef={stageRef}
            showGuides={false}
          />
          <div className="space-y-4">
            <TextEditor
              textPositions={frame.text_positions}
              textState={texts}
              selectedTextId={selectedTextId}
              onSelectText={setSelectedTextId}
              onTextChange={updateTextValue}
              onFontChange={updateTextFont}
              onStyleChange={updateTextStyle}
              onRangeStyle={styleTextRange}
              onClearRangeStyle={clearTextRangeStyle}
            />
          </div>
        </div>
      </div>

      {cropTask ? (
        <PhotoCropperSheet
          key={cropTask.objectUrl}
          frame={frame}
          slot={frame.slot_positions.find((slot) => slot.slot_id === cropTask.slotId) ?? selectedSlot ?? frame.slot_positions[0]!}
          imageUrl={cropTask.objectUrl}
          fileName={cropTask.file.name}
          busy={uploadingSlotId === cropTask.slotId}
          onCancel={handleCancelCrop}
          onApply={handleApplyCrop}
        />
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900"
            role="dialog"
            aria-modal="true"
            aria-label="Frame preview"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 bg-white/80 dark:bg-stone-900/80"
              onClick={() => setPreviewUrl(null)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Frame preview"
              draggable={false}
              className="mx-auto max-h-[84vh] w-full select-none rounded-xl object-contain"
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
