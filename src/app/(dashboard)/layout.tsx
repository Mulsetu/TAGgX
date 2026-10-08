import type { Metadata } from "next";
import { CompanyAppShell } from "@/components/layout/company-app-shell";
import { companyPageMetadata } from "@/lib/company-metadata";
import { getCurrentCompany } from "@/modules/companies/actions";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCurrentCompany();
  return {
    ...companyPageMetadata(company),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <CompanyAppShell>{children}</CompanyAppShell>;
}
