import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  CustomizationData,
  EditorTextState,
  EditorSlotState,
  FrameTemplate,
  LocalCartItem,
  SlotAdjustments,
  TextPosition,
} from "@/types";

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function cartId(frameId: string, customization: CustomizationData) {
  return `${frameId}-${hashString(JSON.stringify(customization))}`;
}

interface CartStore {
  cart: LocalCartItem[];
  addToCart: (item: {
    frame: FrameTemplate;
    quantity?: number;
    price: number;
    customization: CustomizationData;
  }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: [],
      addToCart: ({ frame, quantity = 1, price, customization }) => {
        const id = cartId(frame.id, customization);
        const existing = get().cart.find((item) => item.id === id);
        if (existing) {
          set({
            cart: get().cart.map((item) =>
              item.id === id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            ),
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
            },
            ...get().cart,
          ],
        });
      },
      removeFromCart: (id) => set({ cart: get().cart.filter((item) => item.id !== id) }),
      updateQuantity: (id, quantity) =>
        set({
          cart: get()
            .cart.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item))
            .filter((item) => item.quantity > 0),
        }),
      clearCart: () => set({ cart: [] }),
      subtotal: () =>
        get().cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    }),
    {
      name: "babytint-cart",
      version: 2,
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
    set((state) => ({
      texts: {
        ...state.texts,
        [textId]: {
          text_id: textId,
          value,
          font_family: state.texts[textId]?.font_family,
          font_weight: state.texts[textId]?.font_weight,
        },
      },
    })),
  updateTextFont: (textId, font) =>
    set((state) => ({
      texts: {
        ...state.texts,
        [textId]: {
          text_id: textId,
          value: state.texts[textId]?.value ?? "",
          font_family: font.font_family,
          font_weight: font.font_weight,
        },
      },
    })),
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
