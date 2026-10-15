import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { getPlanForSignup } from "@/modules/billing/actions";
import { ContinueSignupForm } from "./continue-signup-form";

export const metadata: Metadata = {
  title: "Continue your signup",
  robots: { index: false, follow: false },
};

interface ContinueSignupPageProps {
  searchParams: { plan?: string };
}

/**
 * For someone who created an account earlier but never finished: verified
 * but no workspace yet, or a workspace whose first payment didn't complete.
 * Workspace logins (/{slug}/login) can't help them — they may have no slug.
 */
export default async function ContinueSignupPage({ searchParams }: ContinueSignupPageProps) {
  const plan = typeof searchParams.plan === "string" ? await getPlanForSignup(searchParams.plan) : null;

  return (
    <div className="flex min-h-svh flex-col bg-white text-[#003848]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Continue your signup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the email and password you used before. We&apos;ll take you to the step you left off at —
            verifying your email, setting up your workspace, or adding your card.
          </p>
        </div>
        <ContinueSignupForm planId={plan?.id} />
        <p className="text-center text-xs text-muted-foreground">
          New to TagX?{" "}
          <Link href={plan ? `/signup?plan=${plan.id}` : "/signup"} className="underline-offset-4 hover:underline">
            Create an account
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
