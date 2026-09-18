import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SITE_NAME, SITE_PARENT } from "@/lib/site";

const NAV = [
  { href: "/#product-tour", label: "Product" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
  { href: "/inquire", label: "Inquire" },
] as const;

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#0F6E7A]/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex min-w-0 items-center">
          <BrandLogo
            alt={`${SITE_NAME} by ${SITE_PARENT}`}
            size={40}
            className="h-9 w-auto max-w-[11rem] md:h-10 md:max-w-[13.5rem]"
          />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-[#07343C]/80 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#0F6E7A]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <details className="relative md:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-[#0F6E7A]/20 text-sm font-medium text-[#0F6E7A] [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border bg-white p-2 shadow-lg">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-3 text-sm text-[#07343C] hover:bg-[#0F6E7A]/5"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="mt-1 block rounded-md px-3 py-3 text-sm font-medium text-[#0F6E7A] hover:bg-[#0F6E7A]/5"
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                className="mt-1 block rounded-md bg-[#0F6E7A] px-3 py-3 text-center text-sm font-medium text-white"
              >
                Book a demo
              </Link>
            </div>
          </details>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-md border border-[#0F6E7A]/20 px-4 text-sm font-medium text-[#0F6E7A] hover:bg-[#0F6E7A]/5"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="hidden h-11 items-center rounded-md bg-[#0F6E7A] px-4 text-sm font-medium text-white hover:bg-[#0c5c66] sm:inline-flex"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </header>
  );
}
