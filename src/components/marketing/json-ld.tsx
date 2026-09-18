import { TAGX_LOGO_SRC } from "@/lib/brand";
import { LANDING_FAQS } from "@/components/marketing/content";
import { getSiteUrl, MULSETU_URL, SITE_DESCRIPTION, SITE_NAME, SITE_PARENT } from "@/lib/site";
import type { BillingPlan } from "@/modules/billing/types";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LandingJsonLd({ plans }: { plans: BillingPlan[] }) {
  const siteUrl = getSiteUrl();

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: SITE_NAME,
            url: siteUrl,
            logo: `${siteUrl}${TAGX_LOGO_SRC}`,
            description: SITE_DESCRIPTION,
            parentOrganization: {
              "@type": "Organization",
              name: SITE_PARENT,
              url: MULSETU_URL,
            },
            sameAs: [MULSETU_URL],
          },
          {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            url: siteUrl,
            name: SITE_NAME,
            description: SITE_DESCRIPTION,
            inLanguage: "en-IN",
            publisher: { "@id": `${siteUrl}/#organization` },
          },
          {
            "@type": "SoftwareApplication",
            name: SITE_NAME,
            alternateName: "TagX Asset Management System",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: siteUrl,
            description: SITE_DESCRIPTION,
            image: `${siteUrl}${TAGX_LOGO_SRC}`,
            brand: { "@type": "Brand", name: SITE_PARENT },
            provider: { "@id": `${siteUrl}/#organization` },
            offers:
              plans.length > 0
                ? plans.map((plan) => ({
                    "@type": "Offer",
                    name: plan.name,
                    price: String(plan.priceMonthly),
                    priceCurrency: plan.currency || "INR",
                    url: `${siteUrl}/signup?plan=${plan.id}`,
                  }))
                : {
                    "@type": "Offer",
                    priceCurrency: "INR",
                    availability: "https://schema.org/InStock",
                    url: `${siteUrl}/signup`,
                  },
          },
          {
            "@type": "FAQPage",
            mainEntity: LANDING_FAQS.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          },
        ],
      }}
    />
  );
}
