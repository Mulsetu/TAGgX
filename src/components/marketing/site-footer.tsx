import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  MULSETU_ABOUT_URL,
  MULSETU_CONTACT_URL,
  MULSETU_PRIVACY_URL,
  MULSETU_PRODUCTS_URL,
  MULSETU_TERMS_URL,
  MULSETU_URL,
  SITE_NAME,
  SITE_PARENT,
  SITE_PRODUCT_LINE,
} from "@/lib/site";

export function MarketingFooter() {
  return (
    <footer className="border-t bg-[#07343C] text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-1">
          <div className="flex items-center">
            <BrandLogo alt={SITE_NAME} size={40} className="h-10 w-auto max-w-[12.5rem] rounded-md bg-white p-1" />
          </div>
          <p className="mt-4 text-sm leading-6 text-white/75">
            {SITE_PRODUCT_LINE} Asset management system by {SITE_PARENT} for teams that still run
            equipment on spreadsheets.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8BC34A]">Product</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-white/80">
            <li>
              <Link href="/asset-management-system" className="hover:text-white">
                Asset management system
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/demo" className="hover:text-white">
                Book a demo
              </Link>
            </li>
            <li>
              <Link href="/inquire" className="hover:text-white">
                Inquire
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="hover:text-white">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8BC34A]">
            {SITE_PARENT}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-white/80">
            <li>
              <a href={MULSETU_ABOUT_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                About {SITE_PARENT}
              </a>
            </li>
            <li>
              <a href={MULSETU_PRODUCTS_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                Other products
              </a>
            </li>
            <li>
              <a href={MULSETU_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                {SITE_PARENT}.com
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8BC34A]">Legal</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-white/80">
            <li>
              <a href={MULSETU_PRIVACY_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href={MULSETU_TERMS_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                Terms &amp; Conditions
              </a>
            </li>
            <li>
              <a href={MULSETU_CONTACT_URL} className="hover:text-white" rel="noreferrer" target="_blank">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-white/60 md:flex-row md:items-center md:justify-between md:px-6">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}. A {SITE_PARENT} product. All rights reserved.
          </span>
          <span>Think of us as your in-house asset system — built to stay.</span>
        </p>
      </div>
    </footer>
  );
}
