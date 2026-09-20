import { getCurrentCompany } from "@/modules/companies/actions";
import { BrandingForm } from "./branding-form";

export default async function SettingsPage() {
  const company = await getCurrentCompany();

  if (!company) {
    return <p className="text-sm text-muted-foreground">Could not load your company.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your company&apos;s name, logo, and brand colors — applied across the workspace and the login page.
        </p>
      </div>

      <BrandingForm company={company} />
    </div>
  );
}
