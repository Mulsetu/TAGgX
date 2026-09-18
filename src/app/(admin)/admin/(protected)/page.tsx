import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAllPlansForAdmin, getCompanyBillingSnapshotsForAdmin } from "@/modules/billing/actions";
import { listCompaniesForAdmin } from "@/modules/companies/actions";
import { CompanyList } from "./company-list";

export default async function AdminCompaniesPage() {
  const [companies, plans, billing] = await Promise.all([
    listCompaniesForAdmin(),
    getAllPlansForAdmin(),
    getCompanyBillingSnapshotsForAdmin(),
  ]);

  const billingByCompanyId = Object.fromEntries(billing.map((row) => [row.companyId, row]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} total — click a company to edit, assign a plan, or delete it
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/companies/new">New company</Link>
        </Button>
      </div>

      <CompanyList companies={companies} plans={plans} billingByCompanyId={billingByCompanyId} />
    </div>
  );
}
