import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listCompaniesForAdmin } from "@/modules/companies/actions";
import { CompanyList } from "./company-list";

export default async function AdminCompaniesPage() {
  const companies = await listCompaniesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} total — click a company to edit or delete it
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/companies/new">New company</Link>
        </Button>
      </div>

      <CompanyList companies={companies} />
    </div>
  );
}
