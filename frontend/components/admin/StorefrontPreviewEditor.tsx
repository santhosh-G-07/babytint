"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFrameAsset } from "@/lib/api";

const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 400;
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 1500;

function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  offsetX: number,
  offsetY: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const outputWidth = canvas.width;
  const outputHeight = canvas.height;
  const coverScale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight);
  const scale = coverScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const maxShiftX = Math.max(0, (drawWidth - outputWidth) / 2);
  const maxShiftY = Math.max(0, (drawHeight - outputHeight) / 2);
  const x = (outputWidth - drawWidth) / 2 + (offsetX / 100) * maxShiftX;
  const y = (outputHeight - drawHeight) / 2 + (offsetY / 100) * maxShiftY;

  context.clearRect(0, 0, outputWidth, outputHeight);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Could not create the preview image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function StorefrontPreviewEditor({
  value,
  fallbackUrl,
  onChange,
}: {
  value: string;
  fallbackUrl: string;
  onChange: (url: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas && image) {
      drawCrop(canvas, image, zoom, offsetX, offsetY);
    }
  }, [zoom, offsetX, offsetY, sourceName]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    [],
  );

  const selectFile = (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSourceName(file.name);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      const canvas = canvasRef.current;
      if (canvas) drawCrop(canvas, image, 1, 0, 0);
    };
    image.onerror = () => toast.error("Could not read that image.");
    image.src = objectUrl;
  };

  const cropAndUpload = async () => {
    const image = imageRef.current;
    if (!image) {
      toast.error("Choose a preview image first.");
      return;
    }

    try {
      setUploading(true);
      const output = document.createElement("canvas");
      output.width = OUTPUT_WIDTH;
      output.height = OUTPUT_HEIGHT;
      drawCrop(output, image, zoom, offsetX, offsetY);
      const blob = await canvasBlob(output);
      const uploaded = await uploadFrameAsset(
        new File([blob], "storefront-preview.jpg", { type: "image/jpeg" }),
      );
      onChange(uploaded.url);
      toast.success("Storefront preview uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const visibleUrl = value || fallbackUrl;

  return (
    <div className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="storefront-preview-file">Storefront Image</Label>
          <Input
            id="storefront-preview-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) selectFile(file);
              event.target.value = "";
            }}
          />
          {sourceName ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="storefront-preview-zoom">Zoom</Label>
                <input
                  id="storefront-preview-zoom"
                  className="w-full accent-emerald-600"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="storefront-preview-x">Horizontal Position</Label>
                <input
                  id="storefront-preview-x"
                  className="w-full accent-emerald-600"
                  type="range"
                  min="-100"
                  max="100"
                  value={offsetX}
                  onChange={(event) => setOffsetX(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="storefront-preview-y">Vertical Position</Label>
                <input
                  id="storefront-preview-y"
                  className="w-full accent-emerald-600"
                  type="range"
                  min="-100"
                  max="100"
                  value={offsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-[240px]">
          {sourceName ? (
            <canvas
              ref={canvasRef}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              className="aspect-[4/5] w-full rounded-md border border-stone-200 bg-white object-cover dark:border-stone-700"
            />
          ) : visibleUrl ? (
            // Admin-selected URLs may be local storage or any configured remote image host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visibleUrl}
              alt="Current storefront preview"
              className="aspect-[4/5] w-full rounded-md border border-stone-200 bg-white object-cover dark:border-stone-700"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-stone-400 dark:border-stone-700 dark:bg-stone-900">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={cropAndUpload} disabled={!sourceName || uploading}>
          <Crop className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Crop & Upload"}
        </Button>
        {value ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange("")}>
            <Trash2 className="mr-2 h-4 w-4" />
            Use Frame Asset
          </Button>
        ) : null}
      </div>
    </div>
  );
}
