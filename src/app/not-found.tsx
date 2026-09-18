import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#07343C]">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B9E3A]">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">This page is not in TagX</h1>
        <p className="text-sm leading-6 text-[#07343C]/70">
          The URL may be wrong, or the workspace slug does not exist. Head back to the product page
          or create a new workspace.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md bg-[#0F6E7A] px-4 text-sm font-medium text-white hover:bg-[#0c5c66]"
          >
            Back to TagX
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-md border border-[#0F6E7A]/20 px-4 text-sm font-medium text-[#0F6E7A]"
          >
            Create a workspace
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
