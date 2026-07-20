"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminDashboard } from "@/lib/api";
import { inr } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        Failed to load admin summary.
      </div>
    );
  }

  const cards = [
    { label: "Total users", value: String(data.total_users) },
    { label: "Frame templates", value: String(data.total_frames) },
    { label: "Total orders", value: String(data.total_orders) },
    { label: "Revenue", value: inr(data.revenue) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-stone-500 dark:text-stone-400">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Printing queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {data.printing_orders} order(s) currently in printing stage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

