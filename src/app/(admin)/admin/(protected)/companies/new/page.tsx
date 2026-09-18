import { getAllPlansForAdmin } from "@/modules/billing/actions";
import { CreateCompanyForm } from "./create-company-form";

export default async function NewCompanyPage() {
  const plans = await getAllPlansForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New company</h1>
        <p className="text-sm text-muted-foreground">
          Creates the company record and optionally assigns a pricing plan. Default roles
          and settings are set up automatically.
        </p>
      </div>
      <CreateCompanyForm plans={plans} />
    </div>
  );
}
