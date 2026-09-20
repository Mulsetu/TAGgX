"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import type { AssetOption } from "@/modules/assets/types";

interface AssetFiltersProps {
  categories: AssetOption[];
  locations: AssetOption[];
  statuses: AssetOption[];
}

export function AssetFilters({ categories, locations, statuses }: AssetFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <NativeSelect
        className="w-auto"
        value={searchParams.get("category") ?? ""}
        onChange={(event) => updateFilter("category", event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        className="w-auto"
        value={searchParams.get("location") ?? ""}
        onChange={(event) => updateFilter("location", event.target.value)}
      >
        <option value="">All locations</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        className="w-auto"
        value={searchParams.get("status") ?? ""}
        onChange={(event) => updateFilter("status", event.target.value)}
      >
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
