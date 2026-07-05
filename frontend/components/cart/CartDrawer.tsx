"use client";

import Link from "next/link";
import { ShoppingBag, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/lib/store";
import { inr, isAssistedCustomization } from "@/lib/utils";

export function CartDrawer() {
  const { cart, removeFromCart, subtotal } = useCartStore();
  const hasUnavailableItems = cart.some((item) => !item.frame.is_active);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="relative rounded-xl border-[#d6e7ff] bg-white text-[#1f3b5f] hover:bg-[#eef5ff]"
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          Cart
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f7b500] px-1.5 text-xs font-bold text-[#4f3500]">
            {cart.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
          <SheetDescription>Review custom frames before checkout.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex h-[calc(100vh-12rem)] flex-col">
          <div className="flex-1 space-y-4 overflow-auto pr-2">
            {cart.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Your cart is empty.</p>
            ) : null}
            {cart.map((item) => {
              const assisted = isAssistedCustomization(item.customization);
              return (
              <div key={item.id} className="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.frame.name}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      Qty {item.quantity} | {inr(item.price)}
                    </p>
                    {assisted ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <Sparkles className="h-3 w-3" />
                        Customize With Us
                      </p>
                    ) : null}
                    {!item.frame.is_active ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        No longer available for checkout
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/cart">View</Link>
                      </Button>
                      {!assisted ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/editor/${item.frame.slug}?cart_item=${encodeURIComponent(item.id)}`}>Edit</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCart(item.id)}
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500 dark:text-stone-400">Subtotal</span>
              <span className="text-lg font-semibold">{inr(subtotal())}</span>
            </div>
            {hasUnavailableItems ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Remove unavailable items before checkout.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild>
                <Link href="/cart">View Cart</Link>
              </Button>
              {hasUnavailableItems || cart.length === 0 ? (
                <Button disabled>Checkout</Button>
              ) : (
                <Button asChild>
                  <Link href="/checkout">Checkout</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
