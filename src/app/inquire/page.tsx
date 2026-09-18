import type { Metadata } from "next";
import { LeadForm } from "@/components/marketing/lead-form";
import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingMetadata } from "@/lib/seo";
import { getSiteUrl, SITE_NAME, SITE_PARENT } from "@/lib/site";

export const metadata: Metadata = marketingMetadata({
  title: "Inquire about TagX",
  description:
    "Ask Mulsetu about TagX — the asset management system for QR tagging, audits, and maintenance. Tell us your sites, asset volume, and timeline.",
  path: "/inquire",
  keywords: ["TagX inquiry", "asset management system quote", "asset tracking software India"],
});

export default function InquirePage() {
  const siteUrl = getSiteUrl();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Inquire", item: `${siteUrl}/inquire` },
          ],
        }}
      />
      <MarketingHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1fr_1.1fr] md:px-6 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            Talk to {SITE_PARENT}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Inquire about the TagX asset management system
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#07343C]/70 md:text-base">
            Plants, campuses, hospitals, and field teams use {SITE_NAME} when spreadsheets stop
            matching the floor. Share your volume, sites, and what “done” looks like. A human from{" "}
            {SITE_PARENT} replies — this is not a ticket queue.
          </p>
        </div>
        <div className="rounded-2xl border border-[#0F6E7A]/10 bg-white p-6 shadow-sm">
          <LeadForm source="inquire" />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
