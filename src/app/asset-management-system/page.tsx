import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingMetadata } from "@/lib/seo";
import { getSiteUrl, SITE_NAME, SITE_PARENT } from "@/lib/site";

export const metadata: Metadata = marketingMetadata({
  title: "Asset Management System",
  description:
    "TagX is an asset management system by Mulsetu. Register every asset, print a QR tag, track location, run physical audits, and close maintenance — in a white-labeled workspace.",
  path: "/asset-management-system",
  keywords: [
    "asset management system",
    "asset management software",
    "fixed asset management system",
    "QR asset management system",
    "asset management system India",
  ],
});

const PILLAR_FAQS = [
  {
    question: "What is an asset management system?",
    answer:
      "An asset management system is software that keeps a live register of equipment, vehicles, IT, and plant items — where each unit is, who owns it, and what happened to it. TagX is Mulsetu's asset management system: every record is opened by scanning a QR tag.",
  },
  {
    question: "How is TagX different from a spreadsheet?",
    answer:
      "Spreadsheets drift from the floor. TagX ties the physical tag to the digital record, so location moves, audits, photos, and maintenance tickets stay on the same asset instead of in email and shared drives.",
  },
  {
    question: "Who uses a TagX asset management system?",
    answer:
      "Operations, facilities, biomedical, IT, and plant teams in India that need a branded workspace for each organization — factories, campuses, hospitals, warehouses, and field-service companies.",
  },
] as const;

export default function AssetManagementSystemPage() {
  const siteUrl = getSiteUrl();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Asset management system",
                  item: `${siteUrl}/asset-management-system`,
                },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: PILLAR_FAQS.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
              })),
            },
            {
              "@type": "SoftwareApplication",
              name: `${SITE_NAME} Asset Management System`,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: `${siteUrl}/asset-management-system`,
              brand: { "@type": "Brand", name: SITE_PARENT },
              description:
                "QR-first asset management system for Indian operations teams. White-labeled workspaces by Mulsetu.",
            },
          ],
        }}
      />
      <MarketingHeader />
      <main>
        <section className="marketing-hero px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6B9E3A]">
              Asset management system
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              An asset management system that matches the floor, not the spreadsheet
            </h1>
            <p className="mt-5 text-base leading-7 text-[#07343C]/75">
              {SITE_NAME} is {SITE_PARENT}&apos;s asset management system for teams that still count
              equipment in Excel. Each organization gets a private workspace. Each asset gets a QR
              tag. Location, maintenance, and physical audits live on that tag — not in a shared
              file that went stale last quarter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex h-11 items-center rounded-md bg-[#0F6E7A] px-6 text-sm font-medium text-white hover:bg-[#0c5c66]"
              >
                Book a demo
              </Link>
              <Link
                href="/inquire"
                className="inline-flex h-11 items-center rounded-md border border-[#0F6E7A]/20 px-6 text-sm font-medium text-[#0F6E7A]"
              >
                Inquire
              </Link>
            </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#0F6E7A]/10 bg-white shadow-[0_28px_80px_-28px_rgba(7,52,60,0.45)]">
              <Image
                src="/marketing/tagx-dashboard-hero.png"
                alt="TagX asset management dashboard"
                width={1600}
                height={900}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[#0F6E7A]/10 px-4 py-16 md:px-6">
          <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-3">
            <article className="rounded-xl border border-[#0F6E7A]/10 p-6">
              <h2 className="text-lg font-semibold">Register and tag</h2>
              <p className="mt-2 text-sm leading-6 text-[#07343C]/70">
                Create the asset once with photos, custom fields, and a unique code. Print the TagX
                QR label and stick it on the unit.
              </p>
            </article>
            <article className="rounded-xl border border-[#0F6E7A]/10 p-6">
              <h2 className="text-lg font-semibold">Track and audit</h2>
              <p className="mt-2 text-sm leading-6 text-[#07343C]/70">
                Move assets between sites and rooms. Walk the floor, scan what is there, and see
                what is missing in a physical audit session.
              </p>
            </article>
            <article className="rounded-xl border border-[#0F6E7A]/10 p-6">
              <h2 className="text-lg font-semibold">Maintain and brand</h2>
              <p className="mt-2 text-sm leading-6 text-[#07343C]/70">
                Raise tickets on the same record. Your team signs in at yourcompany/login with your
                logo — {SITE_NAME} stays underneath.
              </p>
            </article>
          </div>
        </section>

        <section className="border-t border-[#0F6E7A]/10 bg-[#f4faf8] px-4 py-16 md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              Asset management system FAQs
            </h2>
            <div className="mt-8 divide-y divide-[#0F6E7A]/10 border-y border-[#0F6E7A]/10">
              {PILLAR_FAQS.map((item) => (
                <details key={item.question} className="py-5">
                  <summary className="cursor-pointer list-none text-base font-medium">{item.question}</summary>
                  <p className="mt-2 text-sm leading-6 text-[#07343C]/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
