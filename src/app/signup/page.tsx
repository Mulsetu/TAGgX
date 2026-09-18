import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { MULSETU_CONTACT_URL, SITE_PARENT } from "@/lib/site";
import { getActivePlansForPublic, getPlanForSignup } from "@/modules/billing/actions";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your workspace",
  description:
    "Create a TagX workspace for your company. Pick a unique slug, choose a plan, and white-label asset tracking with your logo. A Mulsetu product.",
  alternates: { canonical: "/signup" },
  openGraph: {
    url: "/signup",
    title: "Create your TagX workspace",
    description:
      "Claim a unique organization URL and start tagging assets with TagX - white-labeled asset tracking by Mulsetu.",
  },
};

interface SignupPageProps {
  searchParams: { plan?: string };
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const plans = await getActivePlansForPublic();
  const selected =
    typeof searchParams.plan === "string" ? await getPlanForSignup(searchParams.plan) : null;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            A {SITE_PARENT} product
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your TagX workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your slug becomes the login URL for everyone in your company. You can upload a logo now
            or later in Settings.
          </p>
        </div>
        {plans.length === 0 ? (
          <div className="rounded-xl border border-[#0F6E7A]/15 p-5 text-sm leading-6 text-[#07343C]/75">
            Plans are not published yet. Check the{" "}
            <Link href="/#pricing" className="font-medium text-[#0F6E7A] underline-offset-4 hover:underline">
              pricing section
            </Link>{" "}
            shortly, or{" "}
            <a
              href={MULSETU_CONTACT_URL}
              className="font-medium text-[#0F6E7A] underline-offset-4 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              talk to {SITE_PARENT}
            </a>
            .
          </div>
        ) : (
          <SignupForm plans={plans} selectedPlanId={selected?.id ?? plans[0]?.id ?? ""} />
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
