import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME, SITE_PARENT } from "@/lib/site";

export function marketingMetadata({
  title,
  description,
  path,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const siteUrl = getSiteUrl();
  const url = new URL(path, `${siteUrl}/`).toString();
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    authors: [{ name: SITE_PARENT, url: "https://www.mulsetu.com" }],
  };
}
