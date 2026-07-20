"use client";

import { useEffect, useRef } from "react";

import {
  addServerCartItem,
  ApiError,
  getFrame,
  listServerCart,
  removeServerCartItem,
  updateServerCartItem,
} from "@/lib/api";
import { hasAuthToken } from "@/lib/local-admin-auth";
import { cartSyncKey, useCartStore } from "@/lib/store";
import { cartItemPrice } from "@/lib/utils";
import type { CustomizationData } from "@/types";

type ServerCartItem = Awaited<ReturnType<typeof listServerCart>>[number];

function serverKey(frameId: string, customizationData: unknown) {
  return cartSyncKey(frameId, normalizeCustomization(frameId, customizationData));
}

function localKey(item: { frame: { id: string }; customization: CustomizationData }) {
  return item.customization ? cartSyncKey(item.frame.id, item.customization) : "";
}

type CartSnapshotItem = ReturnType<typeof useCartStore.getState>["cart"][number];
type RemovedSnapshotItem = ReturnType<typeof useCartStore.getState>["removedCartItems"][number];

function signatureFor(cart: CartSnapshotItem[], removed: RemovedSnapshotItem[]) {
  return JSON.stringify({
    cart: cart
      .map((item) => ({
        key: item.sync_key ?? localKey(item),
        quantity: item.quantity,
        serverCartItemId: item.server_cart_item_id ?? "",
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    removed: removed
      .map((item) => ({
        key: item.key,
        serverCartItemId: item.server_cart_item_id ?? "",
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
}

function syncSignature() {
  const state = useCartStore.getState();
  return signatureFor(state.cart, state.removedCartItems);
}

async function removeServerItemsForDeletedKeys(
  serverItems: ServerCartItem[],
  removedItems: { key: string; server_cart_item_id?: string }[],
) {
  const deletedKeys: string[] = [];
  for (const removed of removedItems) {
    const matches = serverItems.filter((item) => {
      const key = serverKey(item.frame_id, item.customization_data);
      return key === removed.key || item.id === removed.server_cart_item_id;
    });

    if (!matches.length) {
      deletedKeys.push(removed.key);
      continue;
    }

    let allDeleted = true;
    for (const item of matches) {
      try {
        await removeServerCartItem(item.id);
      } catch {
        allDeleted = false;
      }
    }
    if (allDeleted) {
      deletedKeys.push(removed.key);
    }
  }
  if (deletedKeys.length) {
    useCartStore.getState().forgetRemovedCartItems(deletedKeys);
  }
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
    const customizationMode =
      value.customization_mode === "assisted" || value.customization_mode === "self"
        ? value.customization_mode
        : undefined;
    return {
      frame_id: normalizedFrameId,
      slots: slots as CustomizationData["slots"],
      customization_mode: customizationMode,
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
  const removedCartItems = useCartStore((state) => state.removedCartItems);
  const syncBusyRef = useRef(false);
  const hydratedForSessionRef = useRef<string | null>(null);
  const lastSyncedSignatureRef = useRef<string>("");

  useEffect(() => {
    let active = true;

    const sync = async () => {
      if (!active || syncBusyRef.current) {
        return;
      }

      const localAuth = hasAuthToken();
      if (!localAuth) {
        hydratedForSessionRef.current = null;
        lastSyncedSignatureRef.current = "";
        return;
      }

      const localSignature = syncSignature();
      if (
        hydratedForSessionRef.current === "local" &&
        lastSyncedSignatureRef.current === localSignature
      ) {
        return;
      }

      syncBusyRef.current = true;
      const authKey = "local";
      try {
        const serverItems = await listServerCart();
        await removeServerItemsForDeletedKeys(
          serverItems,
          useCartStore.getState().removedCartItems,
        );

        // One-time hydration per authenticated session:
        // - server item absent locally -> pull it into local as-is.
        // - server item present locally but not yet linked to that exact
        //   server row -> genuinely separate quantity (e.g. added on
        //   another device) that hasn't been merged in yet, so sum it in
        //   once via addToCart's additive-merge path.
        // - server item present locally AND already linked to that same
        //   server row id -> this is just the same cart line we already
        //   merged/synced before (e.g. logging out and back in); skip, or
        //   re-summing here would double the quantity on every re-login.
        if (hydratedForSessionRef.current !== "local") {
          const removedKeys = new Set(useCartStore.getState().removedCartItems.map((item) => item.key));
          const serverAfterRemovals = await listServerCart();
          for (const serverItem of serverAfterRemovals) {
            const key = serverKey(serverItem.frame_id, serverItem.customization_data);
            if (removedKeys.has(key)) {
              continue;
            }
            const existingLocalItem = useCartStore.getState().cart.find((item) => localKey(item) === key);
            if (existingLocalItem && existingLocalItem.server_cart_item_id === serverItem.id) {
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
                quantity: Math.max(1, serverItem.quantity ?? 1),
                price: cartItemPrice(frame, customization),
                customization,
                serverCartItemId: serverItem.id,
              });
            } catch {
              // Ignore hydration failures for individual items.
            }
          }
        }

        // Reconcile server cart with current local cart. Snapshot both
        // arrays together so we can tell, after the async work below, if a
        // new mutation happened mid-flight (which the reconciliation below
        // would not have accounted for).
        const latestLocalCart = useCartStore.getState().cart;
        const latestRemovedItems = useCartStore.getState().removedCartItems;
        const capturedSignature = signatureFor(latestLocalCart, latestRemovedItems);
        const desiredKeys = new Set(latestLocalCart.map(localKey));
        const removedKeys = new Set(latestRemovedItems.map((item) => item.key));
        const serverNow = await listServerCart();
        const serverByKey = new Map<string, ServerCartItem>();
        const duplicateServerItems: ServerCartItem[] = [];
        for (const item of serverNow) {
          const key = serverKey(item.frame_id, item.customization_data);
          if (serverByKey.has(key)) {
            duplicateServerItems.push(item);
          } else {
            serverByKey.set(key, item);
          }
        }

        // Remove stale server items that are no longer in local cart.
        for (const [key, item] of Array.from(serverByKey.entries())) {
          if (!desiredKeys.has(key) || removedKeys.has(key)) {
            try {
              await removeServerCartItem(item.id);
            } catch {
              // Best-effort cleanup.
            }
          }
        }

        // Remove duplicate server rows for the same local cart item.
        for (const item of duplicateServerItems) {
          try {
            await removeServerCartItem(item.id);
          } catch {
            // Best-effort cleanup.
          }
        }

        // Add missing server items from local cart.
        for (const item of latestLocalCart) {
          const key = localKey(item);
          const serverItem = serverByKey.get(key);
          if (serverItem) {
            useCartStore.getState().markServerCartItem(item.id, serverItem.id);
            if ((serverItem.quantity ?? 1) !== item.quantity) {
              try {
                await updateServerCartItem(serverItem.id, {
                  quantity: item.quantity,
                });
              } catch {
                // Best-effort sync.
              }
            }
            continue;
          }
          if (!removedKeys.has(key)) {
            try {
              const created = await addServerCartItem({
                frame_id: item.frame.id,
                quantity: item.quantity,
                customization_data: item.customization,
              });
              useCartStore.getState().markServerCartItem(item.id, created.id);
            } catch {
              // Best-effort sync.
            }
          }
        }

        hydratedForSessionRef.current = "local";
        lastSyncedSignatureRef.current = capturedSignature;
      } catch (error) {
        if (error instanceof ApiError) {
          const isAuthProviderUnavailable =
            /Authentication provider is not configured|Authentication service is unavailable/i.test(error.message);
          if (isAuthProviderUnavailable) {
            // Backend auth provider is unavailable: keep local cart working without hard-failing UI.
            hydratedForSessionRef.current = authKey;
            lastSyncedSignatureRef.current = localSignature;
            return;
          }
        }
        // Prevent runtime crash from sync failures (network/downstream/backend).
        console.warn("Cart sync skipped:", error);
      } finally {
        syncBusyRef.current = false;
        // A cart mutation that happened while this sync was in flight isn't
        // reflected in what we just reconciled (lastSyncedSignatureRef was
        // stamped from the pre-mutation snapshot), so immediately re-run
        // instead of silently dropping it until some unrelated future edit
        // happens to trigger another pass.
        if (active && lastSyncedSignatureRef.current !== syncSignature()) {
          void sync();
        }
      }
    };

    void sync();
    const handleAuthChange = () => {
      hydratedForSessionRef.current = null;
      lastSyncedSignatureRef.current = "";
      void sync();
    };
    window.addEventListener("babytint-auth-change", handleAuthChange);

    return () => {
      active = false;
      window.removeEventListener("babytint-auth-change", handleAuthChange);
    };
  }, [cart, removedCartItems]);

  return null;
}
