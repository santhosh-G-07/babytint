"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { inr } from "@/lib/utils";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, subtotal } = useCartStore();

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
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950">
                      <Image
                        src={item.frame.frame_asset_url}
                        alt={item.frame.name}
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold">{item.frame.name}</h2>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {item.frame.size} • {item.frame.slot_count} slots
                      </p>
                      <div className="mt-3 flex items-center gap-2">
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
                          variant="ghost"
                          size="icon"
                          className="ml-auto"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right">
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
                <span>Calculated at checkout</span>
              </div>
              <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-semibold">{inr(subtotal())}</span>
                </div>
              </div>
              <Button className="mt-4 w-full" asChild>
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

