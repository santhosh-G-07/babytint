"use client";

import { useState } from "react";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadPrintFile, getAdminOrders, regeneratePrintFile, updateOrderStatus } from "@/lib/api";
import { inr, isAssistedCustomization } from "@/lib/utils";
import type { OrderItem, OrderRecord } from "@/types";

const statuses = ["received", "printing", "dispatched", "delivered", "cancelled"];

function valueFromAddress(address: Record<string, unknown>, key: string) {
  const value = address[key];
  return typeof value === "string" ? value : "";
}

function deliveryLines(order: OrderRecord) {
  const address = order.delivery_address ?? {};
  return [
    valueFromAddress(address, "fullName"),
    valueFromAddress(address, "phone"),
    valueFromAddress(address, "line1"),
    valueFromAddress(address, "line2"),
    [valueFromAddress(address, "city"), valueFromAddress(address, "state"), valueFromAddress(address, "postalCode")]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
}

function notes(order: OrderRecord) {
  return valueFromAddress(order.delivery_address ?? {}, "notes");
}

function previewUrl(item: OrderItem) {
  if (item.customization_data.composite_preview_url) {
    return item.customization_data.composite_preview_url;
  }
  return item.frame?.frame_asset_url ?? "";
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: getAdminOrders,
  });

  const mutation = useMutation({
    mutationFn: (payload: { orderId: string; status: string; tracking_link?: string }) =>
      updateOrderStatus(payload.orderId, {
        status: payload.status,
        tracking_link: payload.tracking_link ?? null,
      }),
    onSuccess: () => {
      toast.success("Order updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", "me"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update order."),
  });

  const printMutation = useMutation({
    mutationFn: regeneratePrintFile,
    onSuccess: () => {
      toast.success("Full-HD print file generated.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not generate print file."),
  });

  const handleDownload = async (item: OrderItem) => {
    setDownloadingItemId(item.id);
    try {
      const blob = await downloadPrintFile(item.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `babytint-${item.order_id.slice(0, 8)}-${item.id.slice(0, 6)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloadingItemId(null);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">Manage Orders</h1>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        Fulfill paid orders, confirm delivery details, and download authenticated full-HD print files.
      </p>

      <div className="mt-6 space-y-5">
        {isLoading ? <p className="text-sm text-stone-500 dark:text-stone-400">Loading orders...</p> : null}
        {!isLoading && data?.length === 0 ? (
          <p className="rounded-xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No orders yet.
          </p>
        ) : null}

        {data?.map((order) => {
          const isPaid = order.payment_status === "paid";
          return (
            <div
              key={order.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
            >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {new Date(order.created_at).toLocaleString()} | {order.items.length} item(s) | {inr(order.total_amount)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{order.status}</Badge>
                <Badge variant={order.payment_status === "paid" ? "success" : "outline"}>
                  Payment: {order.payment_status}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <section className="rounded-xl bg-stone-50 p-4 dark:bg-stone-950/60">
                <h2 className="font-medium">Customer & Delivery</h2>
                <div className="mt-2 space-y-1 text-sm text-stone-600 dark:text-stone-300">
                  <p>{order.user?.name || valueFromAddress(order.delivery_address, "fullName") || "Customer name missing"}</p>
                  <p>{order.user?.email || "Email missing"}</p>
                  {deliveryLines(order).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {notes(order) ? <p>Notes: {notes(order)}</p> : null}
                </div>
              </section>

              <section className="rounded-xl bg-stone-50 p-4 dark:bg-stone-950/60">
                <h2 className="font-medium">Payment</h2>
                <div className="mt-2 space-y-1 text-sm text-stone-600 dark:text-stone-300">
                  <p>Status: {order.payment_status}</p>
                  <p>Razorpay order: {order.razorpay_order_id ?? "Not created"}</p>
                  <p>Payment ID: {order.razorpay_payment_id ?? "Not captured"}</p>
                  <p>Total: {inr(order.total_amount)}</p>
                </div>
                {!isPaid ? (
                  <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Fulfillment actions stay locked until payment is completed.
                  </p>
                ) : null}
              </section>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <div>
                <Label>Status</Label>
                <Select
                  value={order.status}
                  disabled={!isPaid}
                  onValueChange={(nextStatus) =>
                    mutation.mutate({
                      orderId: order.id,
                      status: nextStatus,
                      tracking_link: trackingInputs[order.id] ?? order.tracking_link ?? "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tracking link</Label>
                <Input
                  placeholder="https://courier.example/track/..."
                  value={trackingInputs[order.id] ?? order.tracking_link ?? ""}
                  onChange={(event) =>
                    setTrackingInputs((prev) => ({
                      ...prev,
                      [order.id]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="self-end">
                <Button
                  variant="outline"
                  disabled={!isPaid}
                  onClick={() =>
                    mutation.mutate({
                      orderId: order.id,
                      status: order.status,
                      tracking_link: trackingInputs[order.id] ?? order.tracking_link ?? "",
                    })
                  }
                >
                  Save Link
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                (() => {
                  const assisted = isAssistedCustomization(item.customization_data);
                  return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800 md:grid-cols-[96px_1fr_auto]"
                >
                  <div className="h-24 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950">
                    {previewUrl(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl(item)} alt="" className="h-full w-full object-contain p-1" />
                    ) : null}
                  </div>

                  <div className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.frame?.name ?? `Frame ${item.frame_id.slice(0, 8)}`}</p>
                      {assisted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <Sparkles className="h-3 w-3" />
                          Customize With Us
                        </span>
                      ) : null}
                    </div>
                    <p className="text-stone-500 dark:text-stone-400">
                      Qty {item.quantity} | {inr(item.price)} | {item.frame?.size ?? "Size missing"}
                    </p>
                    <p className="mt-1 text-stone-500 dark:text-stone-400">
                      Print: {item.print_file_status}
                      {item.print_file_error ? ` (${item.print_file_error})` : ""}
                    </p>
                    {assisted ? (
                      <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                        Customer asked BabyTint to prepare the design manually before print export.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => printMutation.mutate(item.id)}
                      disabled={printMutation.isPending || !isPaid || assisted}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleDownload(item)}
                      disabled={downloadingItemId === item.id || !isPaid || assisted}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloadingItemId === item.id ? "Preparing..." : "Full-HD PNG"}
                    </Button>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
