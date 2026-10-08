import type { Metadata } from "next";
import { companyPageMetadata } from "@/lib/company-metadata";
import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getCurrentCompany } from "@/modules/companies/actions";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCurrentCompany();
  return {
    ...companyPageMetadata(company, "Floor audit"),
    robots: { index: false, follow: false },
  };
}

export default async function FloorLayout({ children }: { children: React.ReactNode }) {
  await assertModule("audits");
  await assertPermission("audits", "view");
  return children;
}
