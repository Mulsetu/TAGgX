import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          We sent a verification link to the address you used. Open it to confirm your account, then
          create your company workspace.
        </p>
        <p className="text-sm text-muted-foreground">
          After verifying, you&apos;ll continue to plan selection and payment if your plan requires it.
        </p>
        <Link href="/login" className="text-sm font-medium text-[#0F6E7A] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
