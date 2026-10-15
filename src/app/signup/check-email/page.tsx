import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { SignupSteps } from "@/components/marketing/signup-steps";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-svh flex-col bg-white text-[#003848]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-10">
        <SignupSteps current={2} />
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          We sent a verification link to the address you used. Open it to confirm your account, then
          create your company workspace.
        </p>
        <p className="text-sm text-muted-foreground">
          After verifying, you&apos;ll name your workspace and add a card to start your plan.
        </p>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#005068]/15 bg-[#F2F7F8] p-4">
          <p className="text-sm font-semibold">Link expired or didn&apos;t arrive?</p>
          <ResendVerificationForm />
        </div>
        <p className="text-xs text-muted-foreground">
          Already verified?{" "}
          <Link href="/signup/continue" className="font-medium text-[#005068] underline-offset-4 hover:underline">
            Continue your signup
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
