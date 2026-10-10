import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { ConfirmEmailForm } from "./confirm-email-form";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

interface ConfirmPageProps {
  searchParams: { token_hash?: string; plan?: string };
}

export default function ConfirmEmailPage({ searchParams }: ConfirmPageProps) {
  const tokenHash = typeof searchParams.token_hash === "string" ? searchParams.token_hash : "";
  const planId = typeof searchParams.plan === "string" ? searchParams.plan : "";

  return (
    <div className="flex min-h-svh flex-col bg-white text-[#003848]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
        {tokenHash ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Confirm your email to continue to company setup, plan selection, and payment.
            </p>
            <ConfirmEmailForm tokenHash={tokenHash} planId={planId} />
          </>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            This verification link is incomplete. Open the link from your email again, or{" "}
            <Link href="/signup" className="underline underline-offset-4">
              sign up again
            </Link>
            .
          </p>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
