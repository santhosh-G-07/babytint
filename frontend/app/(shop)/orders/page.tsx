"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyOrders } from "@/lib/api";
import { inr } from "@/lib/utils";

const timeline = ["received", "printing", "dispatched", "delivered"] as const;

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function OrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", "me"],
    queryFn: getMyOrders,
  });

  return (
    <AuthGuard>
      <div className="container-shell py-8 sm:py-10">
        <h1 className="text-3xl font-semibold">My Orders</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Track each order from received to doorstep delivery.
        </p>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            Failed to load orders.
          </div>
        ) : null}

        {!isLoading && !error && !data?.length ? (
          <div className="mt-6 rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-300">No orders yet.</p>
            <Button className="mt-4" asChild>
              <Link href="/shop">Start shopping</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {data?.map((order) => {
            const activeIndex = timeline.findIndex((step) => step === order.status);
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      Order #{order.id.slice(0, 8)}
                    </p>
                    <p className="font-semibold">{inr(order.total_amount)}</p>
                  </div>
                  <Badge>{statusLabel(order.status)}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {timeline.map((step, index) => (
                    <div
                      key={step}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        index <= activeIndex
                          ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
                          : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"
                      }`}
                    >
                      {statusLabel(step)}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">
                    {order.items.length} item{order.items.length > 1 ? "s" : ""}
                  </span>
                  {order.tracking_link ? (
                    <a
                      href={order.tracking_link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-700"
                    >
                      Track shipment
                    </a>
                  ) : (
                    <span className="text-stone-500 dark:text-stone-400">Tracking link pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AuthGuard>
  );
}

