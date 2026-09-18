import { getCurrentCompany, getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import {
  getCurrentCompanyBillingOrders,
  getCurrentCompanyQuota,
} from "@/modules/billing/actions";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { BrandingForm } from "./branding-form";
import { BillingPanel } from "./billing-panel";
import { WorkspaceSettingsForm } from "./workspace-form";

export default async function SettingsPage() {
  await assertPermission("settings", "view");
  const [company, quota, orders, canEdit, workspace] = await Promise.all([
    getCurrentCompany(),
    getCurrentCompanyQuota(),
    getCurrentCompanyBillingOrders(),
    requirePermission("settings", "edit"),
    getWorkspaceSettingsForAdmin(),
  ]);

  if (!company) {
    return <p className="text-sm text-muted-foreground">Could not load your company.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          White-label your workspace (name, logo, colors) and manage the asset plan. Your team
          signs in at <span className="font-mono">/{company.slug}/login</span>.
        </p>
      </div>

      <BrandingForm company={company} />
      {workspace && canEdit ? <WorkspaceSettingsForm settings={workspace} /> : null}
      <BillingPanel quota={quota} orders={orders} canEdit={canEdit} />
    </div>
  );
}
