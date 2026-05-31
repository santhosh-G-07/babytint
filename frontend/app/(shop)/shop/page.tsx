"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { FilterBar } from "@/components/shop/FilterBar";
import { FrameCard } from "@/components/shop/FrameCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getFrames } from "@/lib/api";

export default function ShopPage() {
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get("search") ?? "";
  const [filters, setFilters] = useState({
    search: searchFromUrl,
    size: "",
    category: "",
    minPrice: "",
    maxPrice: "",
  });

  const queryParams = useMemo(
    () => ({
      search: filters.search || undefined,
      size: filters.size || undefined,
      category: filters.category || undefined,
      min_price: filters.minPrice || undefined,
      max_price: filters.maxPrice || undefined,
    }),
    [filters],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["frames", queryParams],
    queryFn: () => getFrames(queryParams),
  });

  const { data: allFrames } = useQuery({
    queryKey: ["frames", "filter-options"],
    queryFn: () => getFrames({ active_only: true }),
  });

  const sizeOptions = useMemo(
    () => Array.from(new Set((allFrames ?? []).map((item) => item.size))).sort(),
    [allFrames],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set((allFrames ?? []).map((item) => item.category))).sort(),
    [allFrames],
  );

  return (
    <div className="container-shell py-8 sm:py-10">
      <h1 className="text-3xl font-semibold">Shop Frames</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">
        Explore online baby and kids photo frames by size, category, and budget.
      </p>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        Need help choosing?{" "}
        <Link className="font-medium text-amber-700" href="/contact">
          Contact support
        </Link>
        .
      </p>

      <div className="mt-6">
        <FilterBar
          value={filters}
          sizes={sizeOptions}
          categories={categoryOptions}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters({ search: "", size: "", category: "", minPrice: "", maxPrice: "" })}
        />
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          Failed to load frames. Please check backend API and try again.
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <Skeleton className="aspect-[4/5] rounded-2xl" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))
          : data?.map((frame) => <FrameCard key={frame.id} frame={frame} />)}
      </div>
    </div>
  );
}
