import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingMetadata } from "@/lib/seo";
import { getSiteUrl, SITE_NAME } from "@/lib/site";
import { isValidTenantSlug, TENANT_SLUG_COOKIE } from "@/lib/tenant";
import { WorkspaceLoginForm } from "./workspace-login-form";

export const metadata: Metadata = {
  ...marketingMetadata({
    title: "Sign in",
    description: `Sign in to your ${SITE_NAME} workspace. Enter your company URL to open the branded login page.`,
    path: "/login",
  }),
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const siteUrl = getSiteUrl();
  const remembered = cookies().get(TENANT_SLUG_COOKIE)?.value;
  const defaultSlug = remembered && isValidTenantSlug(remembered) ? remembered : "";

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Sign in", item: `${siteUrl}/login` },
          ],
        }}
      />
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-12 md:px-6 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            Workspace sign in
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Sign in to {SITE_NAME}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#07343C]/70">
            Each company has its own login URL. Enter the workspace slug from your address bar —
            for example <span className="font-mono text-[#0F6E7A]">acme</span> if you sign in at{" "}
            <span className="font-mono">/acme/login</span>.
          </p>
        </div>
        <div className="rounded-2xl border border-[#0F6E7A]/10 bg-white p-6 shadow-sm">
          <WorkspaceLoginForm defaultSlug={defaultSlug} />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
