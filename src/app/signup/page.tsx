import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { SITE_PARENT } from "@/lib/site";
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

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">
            A {SITE_PARENT} product
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your TagX account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify your email, then create a company workspace and choose a plan. Existing companies
            add people by invitation — you cannot join one from this page.
          </p>
        </div>
        {searchParams.error === "confirm" ? (
          <p role="alert" className="text-sm text-destructive">
            That verification link is invalid or has expired. Create the account again or request a new
            email.
          </p>
        ) : null}
        <SignupForm planId={searchParams.plan} />
        <p className="text-center text-xs text-muted-foreground">
          Already have a workspace?{" "}
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
