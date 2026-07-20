"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StorefrontPreviewEditor } from "@/components/admin/StorefrontPreviewEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createFrame,
  deleteFrame,
  getFrames,
  resetFrameCatalog,
  updateFrame,
  uploadFrameAsset,
} from "@/lib/api";
import type { FrameTemplate } from "@/types";
import { inr } from "@/lib/utils";

const SlotPositionMapper = dynamic(
  () =>
    import("@/components/admin/SlotPositionMapper").then(
      (module) => module.SlotPositionMapper,
    ),
  { ssr: false },
);

const FrameCreationWizard = dynamic(
  () =>
    import("@/components/admin/FrameCreationWizard").then(
      (module) => module.FrameCreationWizard,
    ),
  { ssr: false },
);

const slotSample = JSON.stringify(
  [{ slot_id: 1, x: 120, y: 80, width: 300, height: 250, shape: "rect" }],
  null,
  2,
);

const textSample = JSON.stringify(
  [
    {
      text_id: 1,
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
    },
  ],
  null,
  2,
);

function toForm(frame?: FrameTemplate) {
  return {
    name: frame?.name ?? "",
    slug: frame?.slug ?? "",
    category: frame?.category ?? "family",
    size: frame?.size ?? "A4",
    slot_count: String(frame?.slot_count ?? 1),
    price: String(frame?.price ?? "0"),
    offer_price: frame?.offer_price ?? "",
    assisted_customization_price: frame?.assisted_customization_price ?? "300",
    frame_asset_url: frame?.frame_asset_url ?? "",
    preview_image_url: frame?.preview_image_url ?? "",
    is_active: frame?.is_active ?? true,
    slot_positions: JSON.stringify(frame?.slot_positions ?? JSON.parse(slotSample), null, 2),
    text_positions: JSON.stringify(frame?.text_positions ?? [], null, 2),
  };
}

export default function AdminFramesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FrameTemplate | null>(null);
  const [form, setForm] = useState(toForm());
  const [uploading, setUploading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "frames", showInactive],
    queryFn: () => getFrames({ active_only: !showInactive }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsedSlots = JSON.parse(form.slot_positions);
      const parsedTextPositions = JSON.parse(form.text_positions);
      const payload = {
        name: form.name,
        slug: form.slug,
        category: form.category,
        size: form.size,
        slot_count: parsedSlots.length,
        price: String(form.price),
        offer_price: form.offer_price ? String(form.offer_price) : null,
        assisted_customization_price: form.assisted_customization_price
          ? String(form.assisted_customization_price)
          : null,
        is_active: form.is_active,
        frame_asset_url: form.frame_asset_url,
        preview_image_url: form.preview_image_url || null,
        slot_positions: parsedSlots,
        text_positions: parsedTextPositions,
      };

      if (editing) {
        return updateFrame(editing.id, payload);
      }
      return createFrame(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Frame updated." : "Frame created.");
      setEditing(null);
      setForm(toForm());
      void queryClient.invalidateQueries({ queryKey: ["admin", "frames"] });
      void queryClient.invalidateQueries({ queryKey: ["frames"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save frame.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFrame,
    onSuccess: () => {
      toast.success("Frame deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "frames"] });
      void queryClient.invalidateQueries({ queryKey: ["frames"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  const resetCatalogMutation = useMutation({
    mutationFn: resetFrameCatalog,
    onSuccess: (result) => {
      toast.success(
        `Catalog reset. Deleted ${result.deleted_frames}, archived ${result.deactivated_frames}, cleared ${result.cleared_cart_items} cart items.`,
      );
      setEditing(null);
      setForm(toForm());
      void queryClient.invalidateQueries({ queryKey: ["admin", "frames"] });
      void queryClient.invalidateQueries({ queryKey: ["frames"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Catalog reset failed.");
    },
  });

  const sorted = useMemo(() => (data ?? []).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const { parsedSlots, jsonError } = useMemo(() => {
    try {
      const parsed = JSON.parse(form.slot_positions);
      if (!Array.isArray(parsed)) {
        return {
          parsedSlots: [],
          jsonError: "Slot positions must be a JSON array.",
        };
      }
      return {
        parsedSlots: parsed,
        jsonError: null,
      };
    } catch {
      return {
        parsedSlots: [],
        jsonError: "Invalid JSON format in slot positions.",
      };
    }
  }, [form.slot_positions]);

  const { parsedTextPositions, textJsonError } = useMemo(() => {
    try {
      const parsed = JSON.parse(form.text_positions);
      if (!Array.isArray(parsed)) {
        return {
          parsedTextPositions: [],
          textJsonError: "Text positions must be a JSON array.",
        };
      }
      return {
        parsedTextPositions: parsed,
        textJsonError: null,
      };
    } catch {
      return {
        parsedTextPositions: [],
        textJsonError: "Invalid JSON format in text positions.",
      };
    }
  }, [form.text_positions]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Frame Templates</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInactive((value) => !value)}
              >
                {showInactive ? "Hide Inactive" : "Show Inactive"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={resetCatalogMutation.isPending || sorted.length === 0}
                onClick={() => {
                  const confirmed = window.confirm(
                    "Reset the frame catalog? This deletes unused frames, archives ordered frames, and clears all carts.",
                  );
                  if (confirmed) {
                    resetCatalogMutation.mutate();
                  }
                }}
              >
                {resetCatalogMutation.isPending ? "Resetting..." : "Reset Catalog"}
              </Button>
              <Button
                size="sm"
                onClick={() => setWizardOpen(true)}
              >
                Create With Wizard
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading frames...</p>
          ) : null}
          {!isLoading && sorted.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No {showInactive ? "" : "active "}frames yet. Create the first one with the wizard.
            </p>
          ) : null}
          {sorted.map((frame) => (
            <div
              key={frame.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800"
            >
              <div>
                <p className="font-medium">{frame.name}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {frame.size} | {frame.category} | {inr(frame.offer_price ?? frame.price)}
                  {frame.assisted_customization_price != null
                    ? ` | Assisted +${inr(frame.assisted_customization_price)}`
                    : " | Assisted off"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(frame);
                    setForm(toForm(frame));
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete "${frame.name}"? This cannot be undone.`,
                    );
                    if (confirmed) {
                      deleteMutation.mutate(frame.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit Frame" : "Create Frame"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Size</Label>
              <Input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Slots</Label>
              <Input type="number" value={parsedSlots.length} disabled readOnly />
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Derived from Slot Positions below — add/remove slots there.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Offer Price</Label>
              <Input
                type="number"
                value={form.offer_price}
                onChange={(event) => setForm({ ...form, offer_price: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Customize With Us Fee</Label>
              <Input
                type="number"
                min={0}
                value={form.assisted_customization_price}
                onChange={(event) => setForm({ ...form, assisted_customization_price: event.target.value })}
                placeholder="300"
              />
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Added on top of frame price when customer asks BabyTint to customize. Leave blank to hide this option.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Frame Asset URL</Label>
            <Input
              value={form.frame_asset_url}
              onChange={(event) => setForm({ ...form, frame_asset_url: event.target.value })}
            />
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  setUploading(true);
                  const uploaded = await uploadFrameAsset(file);
                  setForm((prev) => ({ ...prev, frame_asset_url: uploaded.url }));
                  toast.success("Frame asset uploaded.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Upload failed.");
                } finally {
                  setUploading(false);
                  event.target.value = "";
                }
              }}
            />
            {uploading ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">Uploading frame asset...</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Storefront Preview</Label>
            <StorefrontPreviewEditor
              value={form.preview_image_url}
              fallbackUrl={form.frame_asset_url}
              onChange={(previewImageUrl) =>
                setForm((prev) => ({ ...prev, preview_image_url: previewImageUrl }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Visual Frame Mapper</Label>
            <SlotPositionMapper
              frameAssetUrl={form.frame_asset_url}
              slots={parsedSlots}
              textPositions={parsedTextPositions}
              onChange={(nextSlots) =>
                setForm((prev) => ({
                  ...prev,
                  slot_positions: JSON.stringify(nextSlots, null, 2),
                }))
              }
              onTextChange={(nextTextPositions) =>
                setForm((prev) => ({
                  ...prev,
                  text_positions: JSON.stringify(nextTextPositions, null, 2),
                }))
              }
            />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Main flow: add slot/text, then drag and resize directly on the canvas.
            </p>
          </div>
          <details className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
            <summary className="cursor-pointer text-sm font-medium">Advanced JSON (optional)</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label>Slot Positions JSON</Label>
                <Textarea
                  rows={10}
                  value={form.slot_positions}
                  onChange={(event) => setForm({ ...form, slot_positions: event.target.value })}
                />
                {jsonError ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{jsonError}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Text Positions JSON</Label>
                <Textarea
                  rows={10}
                  value={form.text_positions}
                  placeholder={textSample}
                  onChange={(event) => setForm({ ...form, text_positions: event.target.value })}
                />
                {textJsonError ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{textJsonError}</p>
                ) : null}
              </div>
            </div>
          </details>
          <div className="flex gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || Boolean(jsonError) || Boolean(textJsonError)}
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Update Frame" : "Create Frame"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(toForm());
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {wizardOpen ? (
        <FrameCreationWizard
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ["admin", "frames"] });
            void queryClient.invalidateQueries({ queryKey: ["frames"] });
          }}
        />
      ) : null}
    </div>
  );
}
