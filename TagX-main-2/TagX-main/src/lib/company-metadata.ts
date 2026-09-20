import type { Metadata } from "next";
import { TAGX_ICON_SRC } from "@/lib/brand";
import { mediaSrc } from "@/lib/media-url";

/** Browser tab title + favicon from the tenant's name and logo. */
export function companyPageMetadata(
  company: { name: string; logoUrl: string | null } | null,
  fallbackTitle = "TagX",
): Metadata {
  const title = company?.name || fallbackTitle;
  const icon = mediaSrc(company?.logoUrl) ?? TAGX_ICON_SRC;

  return {
    title,
    icons: { icon, shortcut: icon, apple: icon },
  };
}
