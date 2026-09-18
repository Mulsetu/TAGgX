import type { Metadata } from "next";
import { LeadForm } from "@/components/marketing/lead-form";
import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingMetadata } from "@/lib/seo";
import { getSiteUrl, SITE_NAME, SITE_PARENT } from "@/lib/site";

export const metadata: Metadata = marketingMetadata({
  title: "Book a TagX demo",
  description:
    "Book a live demo of TagX, the asset management system by Mulsetu. See QR tagging, audits, maintenance, and white-label workspaces on your own inventory.",
  path: "/demo",
  keywords: ["TagX demo", "asset management system demo", "asset tracking software demo India"],
});

export default function DemoPage() {
  const siteUrl = getSiteUrl();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Book a demo", item: `${siteUrl}/demo` },
          ],
        }}
      />
      <MarketingHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1fr_1.1fr] md:px-6 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            Live walkthrough
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Book a TagX asset management demo
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#07343C]/70 md:text-base">
            Thirty minutes with the {SITE_PARENT} team that built {SITE_NAME}. We will tag a sample
            of your assets, show location moves, raise a maintenance ticket, and run a physical
            audit — on the same workspace your team would use.
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-sm text-[#07343C]/75">
            <li>QR tags that open the live record</li>
            <li>White-label login at yourcompany/login</li>
            <li>Plans priced by asset count, billed in INR</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#0F6E7A]/10 bg-white p-6 shadow-sm">
          <LeadForm source="demo" />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
