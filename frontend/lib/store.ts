import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyStyleToRange, clearStyleFromRange, remapRunsForTextChange } from "@/lib/rich-text";
import type {
  CustomizationData,
  EditorTextState,
  EditorSlotState,
  FrameTemplate,
  LocalCartItem,
  RemovedCartItem,
  SlotAdjustments,
  TextPosition,
} from "@/types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const nextValue = (value as Record<string, unknown>)[key];
      if (nextValue !== undefined) {
        result[key] = canonicalize(nextValue);
      }
    }
    return result;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? "";
}

export function cartSyncKey(frameId: string, customization: CustomizationData) {
  return `${frameId}::${stableStringify(customization)}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function cartId(frameId: string, customization: CustomizationData) {
  return `${frameId}-${hashString(stableStringify(customization))}`;
}

interface CartStore {
  cart: LocalCartItem[];
  removedCartItems: RemovedCartItem[];
  addToCart: (item: {
    frame: FrameTemplate;
    quantity?: number;
    price: number;
    customization: CustomizationData;
    serverCartItemId?: string;
  }) => void;
  replaceCartItem: (
    oldId: string,
    item: {
      frame: FrameTemplate;
      quantity?: number;
      price: number;
      customization: CustomizationData;
      serverCartItemId?: string;
    },
  ) => void;
  removeFromCart: (id: string) => void;
  removeItemsByKeys: (keys: string[]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  markServerCartItem: (id: string, serverCartItemId: string) => void;
  forgetRemovedCartItems: (keys: string[]) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: [],
      removedCartItems: [],
      addToCart: ({ frame, quantity = 1, price, customization, serverCartItemId }) => {
        const id = cartId(frame.id, customization);
        const syncKey = cartSyncKey(frame.id, customization);
        const existing = get().cart.find((item) => item.id === id);
        if (existing) {
          set({
            cart: get().cart.map((item) =>
              item.id === id
                ? {
                    ...item,
                    quantity: Math.min(50, item.quantity + quantity),
                    server_cart_item_id: serverCartItemId ?? item.server_cart_item_id,
                    sync_key: item.sync_key ?? syncKey,
                  }
                : item,
            ),
            removedCartItems: get().removedCartItems.filter((item) => item.key !== syncKey),
          });
          return;
        }
        set({
          cart: [
            {
              id,
              frame,
              quantity,
              price,
              customization,
              sync_key: syncKey,
              server_cart_item_id: serverCartItemId,
            },
            ...get().cart,
          ],
          removedCartItems: get().removedCartItems.filter((item) => item.key !== syncKey),
        });
      },
      replaceCartItem: (oldId, { frame, quantity = 1, price, customization, serverCartItemId }) => {
        const nextId = cartId(frame.id, customization);
        const nextSyncKey = cartSyncKey(frame.id, customization);
        const previous = get().cart.find((item) => item.id === oldId);
        const remainingCart = get().cart.filter((item) => item.id !== oldId);
        const removedCartItems = get().removedCartItems.filter((item) => item.key !== nextSyncKey);

        if (previous) {
          const previousKey = previous.sync_key ?? cartSyncKey(previous.frame.id, previous.customization);
          if (previousKey !== nextSyncKey) {
            removedCartItems.unshift({
              key: previousKey,
              server_cart_item_id: previous.server_cart_item_id,
            });
          }
        }

        const existing = remainingCart.find((item) => item.id === nextId);
        if (existing) {
          set({
            cart: remainingCart.map((item) =>
              item.id === nextId
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    price,
                    frame,
                    customization,
                    server_cart_item_id: serverCartItemId ?? item.server_cart_item_id,
                    sync_key: nextSyncKey,
                  }
                : item,
            ),
            removedCartItems,
          });
          return;
        }

        set({
          cart: [
            {
              id: nextId,
              frame,
              quantity,
              price,
              customization,
              sync_key: nextSyncKey,
              server_cart_item_id: serverCartItemId,
            },
            ...remainingCart,
          ],
          removedCartItems,
        });
      },
      removeFromCart: (id) => {
        const item = get().cart.find((cartItem) => cartItem.id === id);
        if (!item) {
          return;
        }
        const key = item.sync_key ?? cartSyncKey(item.frame.id, item.customization);
        const removedCartItems = get().removedCartItems.filter((removed) => removed.key !== key);
        removedCartItems.unshift({
          key,
          server_cart_item_id: item.server_cart_item_id,
        });
        set({
          cart: get().cart.filter((cartItem) => cartItem.id !== id),
          removedCartItems,
        });
      },
      removeItemsByKeys: (keys) => {
        const keySet = new Set(keys);
        const removedCartItems = [...get().removedCartItems];
        const removedKeys = new Set(removedCartItems.map((item) => item.key));
        const remainingCart = get().cart.filter((item) => {
          const key = item.sync_key ?? cartSyncKey(item.frame.id, item.customization);
          if (!keySet.has(key)) {
            return true;
          }
          if (!removedKeys.has(key)) {
            removedCartItems.push({
              key,
              server_cart_item_id: item.server_cart_item_id,
            });
            removedKeys.add(key);
          }
          return false;
        });
        set({
          cart: remainingCart,
          removedCartItems,
        });
      },
      updateQuantity: (id, quantity) =>
        set({
          cart: get()
            .cart.map((item) =>
              item.id === id ? { ...item, quantity: Math.min(50, Math.max(1, quantity)) } : item,
            )
            .filter((item) => item.quantity > 0),
        }),
      markServerCartItem: (id, serverCartItemId) =>
        set({
          cart: get().cart.map((item) =>
            item.id === id ? { ...item, server_cart_item_id: serverCartItemId } : item,
          ),
        }),
      forgetRemovedCartItems: (keys) => {
        const keySet = new Set(keys);
        set({
          removedCartItems: get().removedCartItems.filter((item) => !keySet.has(item.key)),
        });
      },
      clearCart: () => {
        const removedCartItems = [...get().removedCartItems];
        const removedKeys = new Set(removedCartItems.map((item) => item.key));
        for (const item of get().cart) {
          const key = item.sync_key ?? cartSyncKey(item.frame.id, item.customization);
          if (!removedKeys.has(key)) {
            removedCartItems.push({
              key,
              server_cart_item_id: item.server_cart_item_id,
            });
          }
        }
        set({ cart: [], removedCartItems });
      },
      subtotal: () =>
        get().cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    }),
    {
      name: "babytint-cart",
      version: 4,
      migrate: (persistedState) => {
        const previous = (persistedState ?? {}) as Partial<CartStore>;
        const cart = Array.isArray(previous.cart)
          ? previous.cart.map((item) => ({
              ...item,
              quantity: Math.max(1, item.quantity ?? 1),
              sync_key: item.sync_key ?? cartSyncKey(item.frame.id, item.customization),
            }))
          : [];
        return {
          ...previous,
          cart,
          removedCartItems: Array.isArray(previous.removedCartItems)
            ? previous.removedCartItems
            : [],
        } as CartStore;
      },
    },
  ),
);

const defaultAdjustments: SlotAdjustments = {
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

interface EditorStore {
  frameId: string | null;
  selectedSlotId: number | null;
  slots: Record<number, EditorSlotState>;
  texts: Record<number, EditorTextState>;
  initializeFrame: (frameId: string, slotIds: number[], textPositions?: TextPosition[]) => void;
  selectSlot: (slotId: number) => void;
  setSlotImage: (slotId: number, imageUrl: string) => void;
  updateSlotAdjustments: (slotId: number, patch: Partial<SlotAdjustments>) => void;
  updateTextValue: (textId: number, value: string) => void;
  updateTextFont: (textId: number, font: Pick<EditorTextState, "font_family" | "font_weight">) => void;
  updateTextStyle: (
    textId: number,
    patch: Partial<Omit<EditorTextState, "text_id" | "value">>,
  ) => void;
  styleTextRange: (
    textId: number,
    start: number,
    end: number,
    patch: Pick<EditorTextState, "font_family" | "font_weight" | "color" | "font_size">,
  ) => void;
  clearTextRangeStyle: (textId: number, start: number, end: number) => void;
  updateTextBox: (
    textId: number,
    patch: Pick<Partial<EditorTextState>, "x" | "y" | "width" | "height">,
  ) => void;
  loadCustomization: (customization: CustomizationData) => void;
  swapSlots: (fromSlotId: number, toSlotId: number) => void;
  copySlotToSlot: (fromSlotId: number, toSlotId: number) => void;
  clearEditor: () => void;
  toCustomizationData: () => CustomizationData | null;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  frameId: null,
  selectedSlotId: null,
  slots: {},
  texts: {},
  initializeFrame: (frameId, slotIds, textPositions = []) =>
    set((state) => {
      const prevSlots = state.frameId === frameId ? state.slots : {};
      const prevTexts = state.frameId === frameId ? state.texts : {};
      const nextSlots: Record<number, EditorSlotState> = {};
      const nextTexts: Record<number, EditorTextState> = {};
      for (const slotId of slotIds) {
        nextSlots[slotId] = prevSlots[slotId] ?? {
          slot_id: slotId,
          image_url: "",
          adjustments: { ...defaultAdjustments },
        };
      }
      for (const text of textPositions) {
        nextTexts[text.text_id] = prevTexts[text.text_id] ?? {
          text_id: text.text_id,
          value: text.default_text ?? "",
          font_family: text.font_family,
          font_weight: text.font_weight,
          x: text.x,
          y: text.y,
          width: text.width,
          height: text.height,
          font_size: text.font_size,
          color: text.color,
          align: text.align,
          line_height: text.line_height ?? 1.2,
          letter_spacing: text.letter_spacing ?? 0,
          rich_runs: prevTexts[text.text_id]?.rich_runs ?? [],
        };
      }
      return {
        frameId,
        selectedSlotId: slotIds[0] ?? null,
        slots: nextSlots,
        texts: nextTexts,
      };
    }),
  selectSlot: (slotId) => set({ selectedSlotId: slotId }),
  setSlotImage: (slotId, imageUrl) =>
    set((state) => ({
      slots: {
        ...state.slots,
        [slotId]: {
          slot_id: slotId,
          image_url: imageUrl,
          adjustments: {
            ...defaultAdjustments,
            ...(state.slots[slotId]?.adjustments ?? {}),
          },
        },
      },
    })),
  updateSlotAdjustments: (slotId, patch) =>
    set((state) => ({
      slots: {
        ...state.slots,
        [slotId]: {
          slot_id: slotId,
          image_url: state.slots[slotId]?.image_url ?? "",
          adjustments: {
            ...defaultAdjustments,
            ...(state.slots[slotId]?.adjustments ?? {}),
            ...patch,
          },
        },
      },
    })),
  updateTextValue: (textId, value) =>
    set((state) => {
      const prev = state.texts[textId];
      const prevValue = prev?.value ?? "";
      const remappedRuns = remapRunsForTextChange(prevValue, value, prev?.rich_runs);
      return {
        texts: {
          ...state.texts,
          [textId]: {
            ...(state.texts[textId] ?? { text_id: textId }),
            value,
            rich_runs: remappedRuns,
          },
        },
      };
    }),
  updateTextFont: (textId, font) =>
    set((state) => ({
      texts: {
        ...state.texts,
        [textId]: {
          ...(state.texts[textId] ?? { text_id: textId, value: "" }),
          font_family: font.font_family,
          font_weight: font.font_weight,
        },
      },
    })),
  updateTextStyle: (textId, patch) =>
    set((state) => ({
      texts: {
        ...state.texts,
        [textId]: {
          ...(state.texts[textId] ?? { text_id: textId, value: "" }),
          ...patch,
        },
      },
    })),
  styleTextRange: (textId, start, end, patch) =>
    set((state) => {
      const current = state.texts[textId] ?? { text_id: textId, value: "" };
      const nextRuns = applyStyleToRange(
        current.value ?? "",
        current.rich_runs,
        start,
        end,
        {
          font_family: patch.font_family,
          font_weight: patch.font_weight,
          color: patch.color,
          font_size: patch.font_size,
        },
      );
      return {
        texts: {
          ...state.texts,
          [textId]: {
            ...current,
            rich_runs: nextRuns,
          },
        },
      };
    }),
  clearTextRangeStyle: (textId, start, end) =>
    set((state) => {
      const current = state.texts[textId] ?? { text_id: textId, value: "" };
      const nextRuns = clearStyleFromRange(current.value ?? "", current.rich_runs, start, end);
      return {
        texts: {
          ...state.texts,
          [textId]: {
            ...current,
            rich_runs: nextRuns,
          },
        },
      };
    }),
  updateTextBox: (textId, patch) =>
    set((state) => ({
      texts: {
        ...state.texts,
        [textId]: {
          ...(state.texts[textId] ?? { text_id: textId, value: "" }),
          ...patch,
        },
      },
    })),
  loadCustomization: (customization) =>
    set((state) => {
      if (!customization.frame_id) {
        return {};
      }
      const nextSlots = { ...state.slots };
      for (const slot of customization.slots ?? []) {
        nextSlots[slot.slot_id] = {
          slot_id: slot.slot_id,
          image_url: slot.image_url,
          adjustments: {
            ...defaultAdjustments,
            ...slot.adjustments,
          },
        };
      }
      const nextTexts = { ...state.texts };
      for (const text of customization.texts ?? []) {
        const previous = nextTexts[text.text_id] ?? { text_id: text.text_id, value: "" };
        nextTexts[text.text_id] = {
          ...previous,
          value: text.value ?? previous.value ?? "",
          font_family: text.font_family ?? previous.font_family,
          font_weight: text.font_weight ?? previous.font_weight,
          x: text.x ?? previous.x,
          y: text.y ?? previous.y,
          width: text.width ?? previous.width,
          height: text.height ?? previous.height,
          font_size: text.font_size ?? previous.font_size,
          color: text.color ?? previous.color,
          align: text.align ?? previous.align,
          line_height: text.line_height ?? previous.line_height,
          letter_spacing: text.letter_spacing ?? previous.letter_spacing,
          rich_runs: text.rich_runs ?? previous.rich_runs ?? [],
        };
      }
      return {
        frameId: customization.frame_id,
        slots: nextSlots,
        texts: nextTexts,
      };
    }),
  swapSlots: (fromSlotId, toSlotId) =>
    set((state) => {
      const from = state.slots[fromSlotId];
      const to = state.slots[toSlotId];
      if (!from || !to) {
        return {};
      }
      return {
        slots: {
          ...state.slots,
          [fromSlotId]: { ...to, slot_id: fromSlotId },
          [toSlotId]: { ...from, slot_id: toSlotId },
        },
      };
    }),
  copySlotToSlot: (fromSlotId, toSlotId) =>
    set((state) => {
      const from = state.slots[fromSlotId];
      const to = state.slots[toSlotId];
      if (!from || !to || !from.image_url || fromSlotId === toSlotId) {
        return {};
      }
      return {
        slots: {
          ...state.slots,
          [toSlotId]: {
            slot_id: toSlotId,
            image_url: from.image_url,
            adjustments: {
              ...defaultAdjustments,
              ...from.adjustments,
            },
          },
        },
      };
    }),
  clearEditor: () => set({ frameId: null, selectedSlotId: null, slots: {}, texts: {} }),
  toCustomizationData: () => {
    const state = get();
    if (!state.frameId) {
      return null;
    }
    return {
      frame_id: state.frameId,
      slots: Object.values(state.slots).filter((slot) => slot.image_url),
      texts: Object.values(state.texts).filter((text) => text.value.trim()),
    };
  },
}));
