"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  authMe,
  createCheckout,
  createRazorpayOrder,
  getFrame,
  getMyOrder,
  verifyRazorpayPayment,
} from "@/lib/api";
import { cartSyncKey, useCartStore } from "@/lib/store";
import { inr, isAssistedCustomization } from "@/lib/utils";
import type { LocalCartItem, OrderRecord } from "@/types";

export const dynamic = "force-dynamic";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

interface RazorpayCheckout {
  open: () => void;
  on: (event: "payment.failed", callback: (response: RazorpayFailureResponse) => void) => void;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
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

function orderCartKeys(order: OrderRecord) {
  return order.items.map((item) => cartSyncKey(item.frame_id, item.customization_data));
}

function orderMatchesCart(order: OrderRecord, cart: LocalCartItem[]) {
  if (order.items.length !== cart.length) {
    return false;
  }

  const cartByKey = new Map(
    cart.map((item) => [cartSyncKey(item.frame.id, item.customization), item.quantity]),
  );

  if (cartByKey.size !== cart.length) {
    return false;
  }

  for (const item of order.items) {
    const key = cartSyncKey(item.frame_id, item.customization_data);
    if (cartByKey.get(key) !== item.quantity) {
      return false;
    }
  }

  return true;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const retryOrderId = searchParams.get("order");
  const { cart, subtotal, removeItemsByKeys } = useCartStore();
  const [paying, setPaying] = useState(false);
  const [draftOrder, setDraftOrder] = useState<OrderRecord | null>(null);
  const [razorpayLoadFailed, setRazorpayLoadFailed] = useState(false);
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

  const retryOrderQuery = useQuery({
    queryKey: ["orders", "me", retryOrderId],
    queryFn: () => getMyOrder(retryOrderId as string),
    enabled: Boolean(retryOrderId),
    retry: 0,
  });

  const cartFrameIds = useMemo(
    () => Array.from(new Set(cart.map((item) => item.frame.id))).sort(),
    [cart],
  );

  // Cart items cache the frame's is_active flag from when they were added;
  // re-check live availability at checkout so a frame an admin deactivated
  // in the meantime doesn't sail through the whole form before failing.
  const { data: liveActiveById } = useQuery({
    queryKey: ["checkout-frame-availability", cartFrameIds],
    queryFn: async () => {
      const entries = await Promise.all(
        cartFrameIds.map(async (frameId) => {
          try {
            const frame = await getFrame(frameId);
            return [frameId, frame.is_active] as const;
          } catch {
            return [frameId, false] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, boolean>;
    },
    enabled: cartFrameIds.length > 0,
    staleTime: 30_000,
  });

  const paymentOrder = retryOrderQuery.data ?? draftOrder;
  const isExistingOrderFlow = Boolean(paymentOrder);
  const hasUnavailableCartItems =
    !paymentOrder && cart.some((item) => !(liveActiveById?.[item.frame.id] ?? item.frame.is_active));
  const hasUnavailableOrderItems = Boolean(
    paymentOrder?.items.some((item) => item.frame && !item.frame.is_active),
  );
  const missingComposite = !paymentOrder
    ? cart.find((item) => !isAssistedCustomization(item.customization) && !item.customization.composite_preview_url)
    : null;
  const total = paymentOrder
    ? Number(paymentOrder.total_amount)
    : subtotal();

  const summaryItems = useMemo(
    () =>
      paymentOrder
        ? paymentOrder.items.map((item) => ({
            id: item.id,
            name: `${item.frame?.name ?? `Frame ${item.frame_id.slice(0, 8)}`}${
              isAssistedCustomization(item.customization_data) ? " + Customize With Us" : ""
            }`,
            quantity: item.quantity,
            total: Number(item.price) * item.quantity,
          }))
        : cart.map((item) => ({
            id: item.id,
            name: `${item.frame.name}${isAssistedCustomization(item.customization) ? " + Customize With Us" : ""}`,
            quantity: item.quantity,
            total: item.price * item.quantity,
          })),
    [cart, paymentOrder],
  );

  useEffect(() => {
    if (window.Razorpay) {
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onerror = () => {
      setRazorpayLoadFailed(true);
      toast.error("Failed to load Razorpay checkout. Check your connection and refresh.");
    };
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!paymentOrder) {
      return;
    }
    const address = paymentOrder.delivery_address ?? {};
    form.reset({
      fullName: address.fullName ?? "",
      phone: address.phone ?? "",
      line1: address.line1 ?? "",
      line2: address.line2 ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      postalCode: address.postalCode ?? "",
      notes: address.notes ?? "",
    });
  }, [form, paymentOrder]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!window.Razorpay) {
      toast.error("Razorpay SDK not loaded. Refresh and try again.");
      return;
    }

    if (!paymentOrder) {
      if (!cart.length) {
        toast.error("Cart is empty.");
        return;
      }
      if (hasUnavailableCartItems) {
        toast.error("Remove unavailable items before checkout.");
        return;
      }
      if (missingComposite) {
        toast.error(
          "One or more cart items are missing preview data. Please re-open customization and save them again.",
        );
        return;
      }
    }

    if (paymentOrder?.payment_status === "paid") {
      toast.message("This order is already paid.");
      router.push("/orders");
      return;
    }
    if (hasUnavailableOrderItems) {
      toast.error("This order contains an unavailable frame and can no longer be paid.");
      return;
    }

    setPaying(true);
    let modalOpened = false;
    try {
      let userEmail = "";
      try {
        userEmail = (await authMe()).email;
      } catch {
        userEmail = "";
      }

      let order = paymentOrder;
      if (!order) {
        order = await createCheckout({
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
        setDraftOrder(order);
      }

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
          name: order.delivery_address.fullName ?? values.fullName,
          email: userEmail,
          contact: order.delivery_address.phone ?? values.phone,
        },
        notes: {
          app_order_id: order.id,
        },
        theme: {
          color: "#8A6A42",
        },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            await verifyRazorpayPayment({
              app_order_id: order.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            const currentCart = useCartStore.getState().cart;
            if (orderMatchesCart(order, currentCart)) {
              removeItemsByKeys(orderCartKeys(order));
            }
            setDraftOrder(null);
            toast.success("Payment verified. Your order is confirmed.");
            router.push("/orders");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Payment verification failed.";
            toast.error(message);
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast.message("Payment window closed. You can resume this order here or from Orders.");
            setPaying(false);
          },
        },
      });

      instance.on("payment.failed", (response) => {
        const message = response.error?.description || response.error?.reason || "Payment failed.";
        toast.error(message);
        setPaying(false);
      });

      modalOpened = true;
      instance.open();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      toast.error(message);
    } finally {
      if (!modalOpened) {
        setPaying(false);
      }
    }
  });

  if (retryOrderId && retryOrderQuery.isLoading) {
    return (
      <AuthGuard>
        <div className="container-shell py-8 sm:py-10">
          <Skeleton className="h-10 w-48" />
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Skeleton className="h-[420px] rounded-2xl" />
            <Skeleton className="h-[320px] rounded-2xl" />
          </div>
        </div>
      </AuthGuard>
    );
  }

  const showEmptyState = !paymentOrder && cart.length === 0;
  const retryOrderError = retryOrderQuery.error instanceof Error ? retryOrderQuery.error.message : null;
  const payButtonLabel = paying
    ? "Processing..."
    : paymentOrder
      ? "Resume payment"
      : "Pay with Razorpay";

  return (
    <AuthGuard>
      <div className="container-shell py-8 sm:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Checkout</h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              Secure payment via Razorpay. Print-ready files are generated after payment capture.
            </p>
          </div>
          {paymentOrder ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Order #{paymentOrder.id.slice(0, 8)} | Payment {paymentOrder.payment_status}
            </p>
          ) : null}
        </div>

        {retryOrderError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {retryOrderError}
          </div>
        ) : null}

        {paymentOrder ? (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            This order is already created. Address and items are locked while you complete payment.
          </div>
        ) : null}

        {razorpayLoadFailed ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            Payment SDK failed to load. Check your connection and refresh the page before paying.
          </div>
        ) : null}

        {hasUnavailableOrderItems ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            This order includes a frame that is no longer available. Contact support before retrying payment.
          </div>
        ) : null}

        {showEmptyState ? (
          <div className="mt-6 rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-300">Your cart is empty.</p>
            <Button className="mt-4" onClick={() => router.push("/shop")}>
              Go to shop
            </Button>
          </div>
        ) : (
          <form className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={onSubmit}>
            <div className="surface p-5">
              <h2 className="text-lg font-semibold">Delivery Address</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    disabled={isExistingOrderFlow}
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
                    disabled={isExistingOrderFlow}
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
                    disabled={isExistingOrderFlow}
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
                  <Input id="line2" disabled={isExistingOrderFlow} {...form.register("line2")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    disabled={isExistingOrderFlow}
                    {...form.register("city", { required: "City is required." })}
                  />
                  {form.formState.errors.city ? (
                    <p className="text-xs text-red-600">{form.formState.errors.city.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    disabled={isExistingOrderFlow}
                    {...form.register("state", { required: "State is required." })}
                  />
                  {form.formState.errors.state ? (
                    <p className="text-xs text-red-600">{form.formState.errors.state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input
                    id="postalCode"
                    inputMode="numeric"
                    disabled={isExistingOrderFlow}
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
                  <Textarea id="notes" rows={3} disabled={isExistingOrderFlow} {...form.register("notes")} />
                </div>
              </div>
            </div>

            <div className="surface h-fit p-5">
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="mt-4 space-y-2 text-sm">
                {summaryItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span className="line-clamp-2 pr-2">
                      {item.name} x {item.quantity}
                    </span>
                    <span>{inr(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-stone-500 dark:text-stone-400">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{inr(total)}</span>
                </div>
              </div>
              <Button
                type="submit"
                className="mt-4 w-full"
                disabled={
                  paying ||
                  razorpayLoadFailed ||
                  hasUnavailableCartItems ||
                  hasUnavailableOrderItems ||
                  paymentOrder?.payment_status === "paid"
                }
              >
                {payButtonLabel}
              </Button>
              {paymentOrder?.payment_status === "paid" ? (
                <Button variant="outline" className="mt-3 w-full" asChild>
                  <Link href="/orders">View order status</Link>
                </Button>
              ) : null}
              {hasUnavailableCartItems ? (
                <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                  Remove unavailable items from the cart before checkout.
                </p>
              ) : null}
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
