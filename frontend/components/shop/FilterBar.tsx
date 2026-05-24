"use client";

import { Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterValues {
  search: string;
  size: string;
  category: string;
  minPrice: string;
  maxPrice: string;
}

export function FilterBar({
  value,
  sizes,
  categories,
  onChange,
  onReset,
}: {
  value: FilterValues;
  sizes: string[];
  categories: string[];
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
}) {
  return (
    <div className="surface p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Search frame name..."
            value={value.search}
            onChange={(event) => onChange({ search: event.target.value })}
            className="pl-9"
          />
        </div>
        <Select value={value.size || "all"} onValueChange={(next) => onChange({ size: next === "all" ? "" : next })}>
          <SelectTrigger>
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {sizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.category || "all"}
          onValueChange={(next) => onChange({ category: next === "all" ? "" : next })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min ₹"
            value={value.minPrice}
            onChange={(event) => onChange({ minPrice: event.target.value })}
          />
          <Input
            type="number"
            placeholder="Max ₹"
            value={value.maxPrice}
            onChange={(event) => onChange({ maxPrice: event.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={onReset}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
