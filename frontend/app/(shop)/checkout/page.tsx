"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authMe, createCheckout, createRazorpayOrder } from "@/lib/api";
import { useCartStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { inr } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface CheckoutForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, clearCart } = useCartStore();
  const [paying, setPaying] = useState(false);
  const total = subtotal();
  const form = useForm<CheckoutForm>({
    defaultValues: {
      fullName: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      notes: "",
    },
  });

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!cart.length) {
      toast.error("Cart is empty.");
      return;
    }
    const missingComposite = cart.find((item) => !item.customization.composite_preview_url);
    if (missingComposite) {
      toast.error(
        "One or more cart items are missing preview data. Please re-open customization and add again.",
      );
      return;
    }
    if (!window.Razorpay) {
      toast.error("Razorpay SDK not loaded. Refresh and try again.");
      return;
    }

    setPaying(true);
    try {
      const { data } = await supabase.auth.getSession();
      let userEmail = data.session?.user.email ?? "";
      if (!userEmail) {
        try {
          userEmail = (await authMe()).email;
        } catch {
          userEmail = "";
        }
      }

      const order = await createCheckout({
        delivery_address: {
          fullName: values.fullName,
          phone: values.phone,
          line1: values.line1,
          line2: values.line2,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          notes: values.notes,
        },
        items: cart.map((item) => ({
          frame_id: item.frame.id,
          quantity: item.quantity,
          price: item.price,
          customization_data: item.customization,
        })),
      });

      const razor = await createRazorpayOrder(order.id);
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) {
        throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is missing.");
      }

      const instance = new window.Razorpay({
        key,
        amount: razor.amount,
        currency: razor.currency,
        name: "BabyTint Photography",
        description: `Order ${order.id.slice(0, 8)}`,
        order_id: razor.razorpay_order_id,
        prefill: {
          name: values.fullName,
          email: userEmail,
          contact: values.phone,
        },
        notes: {
          app_order_id: order.id,
        },
        theme: {
          color: "#8A6A42",
        },
        handler: () => {
          toast.success("Payment successful. Your order is confirmed.");
          clearCart();
          router.push("/orders");
        },
        modal: {
          ondismiss: () => {
            toast.message("Payment window closed.");
          },
        },
      });

      instance.open();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      toast.error(message);
    } finally {
      setPaying(false);
    }
  });

  return (
    <AuthGuard>
      <div className="container-shell py-8 sm:py-10">
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Secure payment via Razorpay. Print-ready files are generated after payment capture.
        </p>

        {!cart.length ? (
          <div className="mt-6 rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-300">Your cart is empty.</p>
            <Button className="mt-4" onClick={() => router.push("/shop")}>
              Go to shop
            </Button>
          </div>
        ) : (
          <form className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]" onSubmit={onSubmit}>
            <div className="surface p-5">
              <h2 className="text-lg font-semibold">Delivery Address</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    {...form.register("fullName", {
                      required: "Full name is required.",
                      minLength: { value: 2, message: "Enter the receiver name." },
                    })}
                  />
                  {form.formState.errors.fullName ? (
                    <p className="text-xs text-red-600">{form.formState.errors.fullName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    {...form.register("phone", {
                      required: "Phone number is required.",
                      pattern: {
                        value: /^[0-9+\-\s()]{8,20}$/,
                        message: "Enter a valid phone number.",
                      },
                    })}
                  />
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-red-600">{form.formState.errors.phone.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="line1">Address line 1</Label>
                  <Input
                    id="line1"
                    {...form.register("line1", {
                      required: "Address line 1 is required.",
                      minLength: { value: 4, message: "Enter the house number and street." },
                    })}
                  />
                  {form.formState.errors.line1 ? (
                    <p className="text-xs text-red-600">{form.formState.errors.line1.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="line2">Address line 2</Label>
                  <Input id="line2" {...form.register("line2")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...form.register("city", { required: "City is required." })} />
                  {form.formState.errors.city ? (
                    <p className="text-xs text-red-600">{form.formState.errors.city.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...form.register("state", { required: "State is required." })} />
                  {form.formState.errors.state ? (
                    <p className="text-xs text-red-600">{form.formState.errors.state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input
                    id="postalCode"
                    inputMode="numeric"
                    {...form.register("postalCode", {
                      required: "Postal code is required.",
                      pattern: {
                        value: /^[0-9A-Za-z\-\s]{4,16}$/,
                        message: "Enter a valid postal code.",
                      },
                    })}
                  />
                  {form.formState.errors.postalCode ? (
                    <p className="text-xs text-red-600">{form.formState.errors.postalCode.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Delivery notes</Label>
                  <Textarea id="notes" rows={3} {...form.register("notes")} />
                </div>
              </div>
            </div>

            <div className="surface h-fit p-5">
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="mt-4 space-y-2 text-sm">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="line-clamp-1 pr-2">
                      {item.frame.name} × {item.quantity}
                    </span>
                    <span>{inr(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{inr(total)}</span>
                </div>
              </div>
              <Button type="submit" className="mt-4 w-full" disabled={paying}>
                {paying ? "Processing..." : "Pay with Razorpay"}
              </Button>
              <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
                By placing this order, you agree to our{" "}
                <Link href="/terms" className="text-amber-700">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-amber-700">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </form>
        )}
      </div>
    </AuthGuard>
  );
}
