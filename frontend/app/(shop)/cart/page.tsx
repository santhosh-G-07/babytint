"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Eye, Minus, Pencil, Plus, Trash2, X } from "lucide-react";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { inr } from "@/lib/utils";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, subtotal } = useCartStore();
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const previewItem = cart.find((item) => item.id === previewItemId) ?? null;
  const previewUrl = previewItem?.customization.composite_preview_url ?? previewItem?.frame.frame_asset_url ?? null;
  const hasUnavailableItems = cart.some((item) => !item.frame.is_active);

  return (
    <AuthGuard>
      <div className="container-shell py-8 sm:py-10">
        <h1 className="text-3xl font-semibold">Your Cart</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Review your customized frames before payment.
        </p>

        {cart.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
            <p className="text-stone-600 dark:text-stone-300">Your cart is empty.</p>
            <Button className="mt-4" asChild>
              <Link href="/shop">Browse frames</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {hasUnavailableItems ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                One or more items in your cart are no longer available. Remove them before checkout.
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950">
                      <Image
                        src={item.frame.frame_asset_url}
                        alt={item.frame.name}
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{item.frame.name}</h2>
                        {!item.frame.is_active ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            Unavailable
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {item.frame.size} | {item.frame.slot_count} slots
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => setPreviewItemId(item.id)}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/editor/${item.frame.slug}?cart_item=${encodeURIComponent(item.id)}`}>
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold">{inr(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="surface h-fit p-5">
              <h3 className="text-lg font-semibold">Order Summary</h3>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">Subtotal</span>
                <span>{inr(subtotal())}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">Shipping</span>
                <span>Free</span>
              </div>
              <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-semibold">{inr(subtotal())}</span>
                </div>
              </div>
              {hasUnavailableItems ? (
                <Button className="mt-4 w-full" disabled>
                  Remove unavailable items
                </Button>
              ) : (
                <Button className="mt-4 w-full" asChild>
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {previewItem && previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 bg-white/80 dark:bg-stone-900/80"
              onClick={() => setPreviewItemId(null)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="mb-3 pr-12">
              <p className="text-sm text-stone-500 dark:text-stone-400">Preview</p>
              <h3 className="font-semibold">{previewItem.frame.name}</h3>
            </div>
            <div className="mx-auto flex max-h-[78vh] w-full items-center justify-center overflow-auto rounded-xl bg-stone-200/70 p-5 dark:bg-stone-800/60">
              <div className="rounded-[10px] bg-[#f3f3f3] p-3 shadow-[0_26px_42px_-26px_rgba(0,0,0,0.7)]">
                <div className="rounded-[3px] border-[10px] border-white bg-white shadow-inner sm:border-[12px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`${previewItem.frame.name} preview`}
                    draggable={false}
                    className="block max-h-[68vh] max-w-full select-none object-contain"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewItemId(null)}>
                Close
              </Button>
              <Button asChild>
                <Link href={`/editor/${previewItem.frame.slug}?cart_item=${encodeURIComponent(previewItem.id)}`}>
                  Edit this design
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthGuard>
  );
}
