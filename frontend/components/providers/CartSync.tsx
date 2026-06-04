"use client";

import { useEffect, useRef } from "react";

import { addServerCartItem, ApiError, getFrame, listServerCart, removeServerCartItem } from "@/lib/api";
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
    const texts = Array.isArray(value.texts) ? value.texts : undefined;
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
      texts: texts as CustomizationData["texts"],
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
  const previousLocalKeysRef = useRef<Set<string> | null>(null);
  const locallyDeletedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    const currentLocalKeys = new Set(cart.map(localKey));
    if (previousLocalKeysRef.current) {
      for (const previousKey of previousLocalKeysRef.current) {
        if (!currentLocalKeys.has(previousKey)) {
          locallyDeletedKeysRef.current.add(previousKey);
        }
      }
    }
    for (const currentKey of currentLocalKeys) {
      locallyDeletedKeysRef.current.delete(currentKey);
    }
    previousLocalKeysRef.current = currentLocalKeys;

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
      const authKey = session?.user.id ?? "local";
      try {
        const serverItems = await listServerCart();

        // One-time hydration per authenticated session:
        // if server has items absent in local cart, pull them into local.
        if (hydratedForSessionRef.current !== (session?.user.id ?? "local")) {
          const localKeys = new Set(useCartStore.getState().cart.map(localKey));
          for (const serverItem of serverItems) {
            const key = serverKey(serverItem.frame_id, serverItem.customization_data);
            if (localKeys.has(key) || locallyDeletedKeysRef.current.has(key)) {
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
              locallyDeletedKeysRef.current.delete(key);
            } catch {
              // Best-effort cleanup.
            }
          }
        }

        // Add missing server items from local cart.
        for (const item of latestLocalCart) {
          const key = localKey(item);
          if (!serverByKey.has(key) && !locallyDeletedKeysRef.current.has(key)) {
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
        lastSyncedSignatureRef.current = JSON.stringify(
          useCartStore
            .getState()
            .cart.map((item) => ({ frameId: item.frame.id, customization: item.customization }))
            .sort((a, b) => a.frameId.localeCompare(b.frameId)),
        );
      } catch (error) {
        if (error instanceof ApiError) {
          const isAuthProviderMissing = /Authentication provider is not configured/i.test(error.message);
          if (isAuthProviderMissing) {
            // Backend auth provider is disabled/missing: keep local cart working without hard-failing UI.
            hydratedForSessionRef.current = authKey;
            lastSyncedSignatureRef.current = localSignature;
            return;
          }
        }
        // Prevent runtime crash from sync failures (network/downstream/backend).
        console.warn("Cart sync skipped:", error);
      } finally {
        syncBusyRef.current = false;
      }
    };

    void sync();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      hydratedForSessionRef.current = null;
      lastSyncedSignatureRef.current = "";
      previousLocalKeysRef.current = null;
      locallyDeletedKeysRef.current.clear();
      void sync();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [cart]);

  return null;
}
