"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AssetOption, ConditionOption } from "@/modules/assets/types";

interface AssetFiltersProps {
  categories: AssetOption[];
  locations: AssetOption[];
  statuses: AssetOption[];
  vendors: AssetOption[];
  users: AssetOption[];
  conditions: ConditionOption[];
}

const FILTER_KEYS = [
  "q",
  "category",
  "location",
  "status",
  "vendor",
  "custodian",
  "condition",
  "warranty",
  "amc",
  "docs",
  "sort",
  "dir",
  "archived",
] as const;

export function AssetFilters({
  categories,
  locations,
  statuses,
  vendors,
  users,
  conditions,
}: AssetFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function applyParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  function updateFilter(key: string, value: string) {
    applyParams((params) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
  }

  function clearFilters() {
    router.push(pathname);
    setQuery("");
  }

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  const fields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <form
        className="sm:col-span-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilter("q", query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, code, serial, vendor, location, custodian"
          className="min-h-11"
        />
      </form>
      <NativeSelect value={searchParams.get("category") ?? ""} onChange={(event) => updateFilter("category", event.target.value)}>
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("location") ?? ""} onChange={(event) => updateFilter("location", event.target.value)}>
        <option value="">All locations</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("status") ?? ""} onChange={(event) => updateFilter("status", event.target.value)}>
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("condition") ?? ""} onChange={(event) => updateFilter("condition", event.target.value)}>
        <option value="">All conditions</option>
        {conditions.map((condition) => (
          <option key={condition.key} value={condition.key}>
            {condition.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("vendor") ?? ""} onChange={(event) => updateFilter("vendor", event.target.value)}>
        <option value="">All vendors</option>
        {vendors.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {vendor.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("custodian") ?? ""} onChange={(event) => updateFilter("custodian", event.target.value)}>
        <option value="">All custodians</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={searchParams.get("warranty") ?? ""} onChange={(event) => updateFilter("warranty", event.target.value)}>
        <option value="">Warranty: any</option>
        <option value="active">Warranty active</option>
        <option value="expired">Warranty expired</option>
        <option value="none">No warranty date</option>
      </NativeSelect>
      <NativeSelect value={searchParams.get("amc") ?? ""} onChange={(event) => updateFilter("amc", event.target.value)}>
        <option value="">AMC: any</option>
        <option value="active">AMC active</option>
        <option value="expired">AMC expired</option>
        <option value="none">No AMC date</option>
      </NativeSelect>
      <NativeSelect value={searchParams.get("docs") ?? ""} onChange={(event) => updateFilter("docs", event.target.value)}>
        <option value="">Documents: any</option>
        <option value="expired">Document expired</option>
        <option value="expiring">Document expiring in 30 days</option>
        <option value="none">No expiry dates</option>
      </NativeSelect>
      <NativeSelect value={searchParams.get("sort") ?? "created"} onChange={(event) => updateFilter("sort", event.target.value)}>
        <option value="created">Sort: newest</option>
        <option value="name">Sort: name</option>
        <option value="code">Sort: code</option>
        <option value="purchase">Sort: purchase date</option>
      </NativeSelect>
      <NativeSelect value={searchParams.get("dir") ?? "desc"} onChange={(event) => updateFilter("dir", event.target.value)}>
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </NativeSelect>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={searchParams.get("archived") === "1"}
          onChange={(event) => updateFilter("archived", event.target.checked ? "1" : "")}
        />
        Include archived
      </label>
      {hasFilters ? (
        <Button type="button" variant="outline" size="touch" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="touch" className="w-full">
              Search and filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{fields}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden md:block">{fields}</div>
    </>
  );
}
