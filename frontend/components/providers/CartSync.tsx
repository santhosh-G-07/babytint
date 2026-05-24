"use client";

import { useEffect, useRef } from "react";

import { addServerCartItem, getFrame, listServerCart, removeServerCartItem } from "@/lib/api";
import { hasAuthToken } from "@/lib/local-admin-auth";
import { useCartStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { CustomizationData } from "@/types";

function serverKey(frameId: string, customizationData: unknown) {
  return `${frameId}::${JSON.stringify(customizationData)}`;
}

function localKey(item: { frame: { id: string }; customization: CustomizationData }) {
  return `${item.frame.id}::${JSON.stringify(item.customization)}`;
}

function normalizeCustomization(frameId: string, raw: unknown): CustomizationData {
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const slots = Array.isArray(value.slots) ? value.slots : [];
    const normalizedFrameId = typeof value.frame_id === "string" ? value.frame_id : frameId;
    const compositePreviewUrl =
      typeof value.composite_preview_url === "string"
        ? value.composite_preview_url
        : undefined;
    const compositeMeta =
      value.composite_export_meta &&
      typeof value.composite_export_meta === "object"
        ? (value.composite_export_meta as CustomizationData["composite_export_meta"])
        : undefined;
    return {
      frame_id: normalizedFrameId,
      slots: slots as CustomizationData["slots"],
      composite_preview_url: compositePreviewUrl,
      composite_export_meta: compositeMeta,
    };
  }
  return {
    frame_id: frameId,
    slots: [],
  };
}

export function CartSync() {
  const cart = useCartStore((state) => state.cart);
  const syncBusyRef = useRef(false);
  const hydratedForSessionRef = useRef<string | null>(null);
  const lastSyncedSignatureRef = useRef<string>("");

  useEffect(() => {
    let active = true;

    const sync = async () => {
      if (!active || syncBusyRef.current) {
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const localAuth = hasAuthToken();
      if (!session && !localAuth) {
        hydratedForSessionRef.current = null;
        lastSyncedSignatureRef.current = "";
        return;
      }

      const localSignature = JSON.stringify(
        cart
          .map((item) => ({ frameId: item.frame.id, customization: item.customization }))
          .sort((a, b) => a.frameId.localeCompare(b.frameId)),
      );
      if (
          hydratedForSessionRef.current === (session?.user.id ?? "local") &&
        lastSyncedSignatureRef.current === localSignature
      ) {
        return;
      }

      syncBusyRef.current = true;
      try {
        const serverItems = await listServerCart();

        // One-time hydration per authenticated session:
        // if server has items absent in local cart, pull them into local.
        if (hydratedForSessionRef.current !== (session?.user.id ?? "local")) {
          const localKeys = new Set(useCartStore.getState().cart.map(localKey));
          for (const serverItem of serverItems) {
            const key = serverKey(serverItem.frame_id, serverItem.customization_data);
            if (localKeys.has(key)) {
              continue;
            }
            try {
              const frame = await getFrame(serverItem.frame_id);
              const customization = normalizeCustomization(
                frame.id,
                serverItem.customization_data,
              );
              useCartStore.getState().addToCart({
                frame,
                quantity: 1,
                price: Number(frame.offer_price ?? frame.price),
                customization,
              });
              localKeys.add(key);
            } catch {
              // Ignore hydration failures for individual items.
            }
          }
        }

        // Reconcile server cart with current local cart.
        const latestLocalCart = useCartStore.getState().cart;
        const desiredKeys = new Set(latestLocalCart.map(localKey));
        const serverNow = await listServerCart();
        const serverByKey = new Map(serverNow.map((item) => [serverKey(item.frame_id, item.customization_data), item]));

        // Remove stale server items that are no longer in local cart.
        for (const [key, item] of Array.from(serverByKey.entries())) {
          if (!desiredKeys.has(key)) {
            try {
              await removeServerCartItem(item.id);
            } catch {
              // Best-effort cleanup.
            }
          }
        }

        // Add missing server items from local cart.
        for (const item of latestLocalCart) {
          const key = localKey(item);
          if (!serverByKey.has(key)) {
            try {
              await addServerCartItem({
                frame_id: item.frame.id,
                customization_data: item.customization,
              });
            } catch {
              // Best-effort sync.
            }
          }
        }

        hydratedForSessionRef.current = session?.user.id ?? "local";
        lastSyncedSignatureRef.current = localSignature;
      } finally {
        syncBusyRef.current = false;
      }
    };

    void sync();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      hydratedForSessionRef.current = null;
      lastSyncedSignatureRef.current = "";
      void sync();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [cart]);

  return null;
}
