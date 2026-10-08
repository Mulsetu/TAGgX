import { assertPermission } from "@/lib/permissions/has-permission";
import { getCurrentCompany } from "@/modules/companies/actions";
import { BrandingForm } from "../branding-form";

export default async function BrandingSettingsPage() {
  await assertPermission("settings", "view");
  const company = await getCurrentCompany();

  if (!company) {
    return <p className="text-sm text-slate-500">Could not load your company.</p>;
  }

  return <BrandingForm company={company} />;
}
