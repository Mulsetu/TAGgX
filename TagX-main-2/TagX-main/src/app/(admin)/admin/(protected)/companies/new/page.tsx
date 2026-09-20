import { CreateCompanyForm } from "./create-company-form";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New company</h1>
        <p className="text-sm text-muted-foreground">
          Creates the company record. Default roles and settings are set up separately.
        </p>
      </div>
      <CreateCompanyForm />
    </div>
  );
}
