export const SITE_NAME = "TagX";
export const SITE_PRODUCT_LINE = "Track. Scan. Manage.";
export const SITE_PARENT = "Mulsetu";
const SITE_PRODUCTION_URL = "https://tagx.mulsetu.com";

export const MULSETU_URL = "https://www.mulsetu.com";
export const MULSETU_PRODUCTS_URL = "https://www.mulsetu.com/products/";
export const MULSETU_ABOUT_URL = "https://www.mulsetu.com/about/";
export const MULSETU_PRIVACY_URL = "https://www.mulsetu.com/privacy/";
export const MULSETU_TERMS_URL = "https://www.mulsetu.com/terms/";
export const MULSETU_CONTACT_URL = "https://www.mulsetu.com/";

export const SITE_TITLE = "TagX | Asset Management System by Mulsetu";
export const SITE_DESCRIPTION =
  "TagX is an asset management system by Mulsetu. Track, scan, and manage equipment with QR tags, locations, maintenance tickets, and physical audits — white-labeled for every organization.";

export const SITE_KEYWORDS = [
  "asset management system",
  "asset management software",
  "asset management system India",
  "TagX",
  "Mulsetu",
  "QR code asset tracking",
  "asset tagging software",
  "white label asset management",
  "physical asset audit",
  "maintenance management",
  "fixed asset tracking",
];

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // fall through
    }
  }

  if (process.env.NODE_ENV === "production") {
    return SITE_PRODUCTION_URL;
  }

  return "http://localhost:3000";
}
