import type { MetadataRoute } from "next";
import { TAGX_ICON_SRC } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} by Mulsetu`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0F6E7A",
    icons: [
      { src: TAGX_ICON_SRC, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: TAGX_ICON_SRC, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
