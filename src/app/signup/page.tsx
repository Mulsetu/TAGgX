import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { SignupSteps } from "@/components/marketing/signup-steps";
import { formatInr } from "@/lib/money";
import { getPlanForSignup } from "@/modules/billing/actions";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a TagX account, verify your email, then set up your company workspace. A Mulsetu product.",
  alternates: { canonical: "/signup" },
  openGraph: {
    url: "/signup",
    title: "Create your TagX account",
    description: "Create an account, verify your email, and start a TagX workspace for your company.",
  },
};

interface SignupPageProps {
  searchParams: { plan?: string; error?: string };
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const plan = typeof searchParams.plan === "string" ? await getPlanForSignup(searchParams.plan) : null;

  return (
    <div className="flex min-h-svh flex-col bg-white text-[#003848]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
        <SignupSteps current={1} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your TagX account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Next you&apos;ll verify your email, name your workspace, and add a card. Joining an existing
            company? Ask its admin for an invitation instead.
          </p>
        </div>
        {plan ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#005068]/15 bg-[#F2F7F8] px-4 py-3">
            <div>
              <p className="text-xs text-[#003848]/60">Selected plan</p>
              <p className="font-semibold">
                {plan.name} · {formatInr(plan.priceMonthly)}
                <span className="font-normal text-[#003848]/60"> / month</span>
              </p>
              <p className="text-xs text-[#003848]/60">Up to {plan.assetLimit.toLocaleString("en-IN")} assets · cancel anytime</p>
            </div>
            <Link href="/#pricing" className="shrink-0 text-sm font-medium text-[#005068] underline-offset-4 hover:underline">
              Change
            </Link>
          </div>
        ) : null}
        {searchParams.error === "confirm" ? (
          <p role="alert" className="text-sm text-destructive">
            That verification link is invalid or has expired. Create the account again or request a new
            email.
          </p>
        ) : null}
        <SignupForm planId={plan?.id} />
        <p className="text-center text-xs text-muted-foreground">
          Started before and didn&apos;t finish?{" "}
          <Link
            href={plan ? `/signup/continue?plan=${plan.id}` : "/signup/continue"}
            className="underline-offset-4 hover:underline"
          >
            Continue your signup
          </Link>
          . Already have a workspace?{" "}
          <Link href="/login" className="underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
