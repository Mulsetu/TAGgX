import { getCurrentCompany, getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import { getRolesForAdministration } from "@/modules/roles/actions";
import {
  getCurrentCompanyBillingOrders,
  getCurrentCompanyQuota,
  getPaymentsForCurrentCompany,
} from "@/modules/billing/actions";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { BrandingForm } from "./branding-form";
import { BillingPanel } from "./billing-panel";
import { WorkspaceSettingsForm } from "./workspace-form";
import { DataPrivacyPanel } from "./data-privacy-panel";

export default async function SettingsPage() {
  await assertPermission("settings", "view");
  const [company, quota, orders, payments, canEdit, workspace, roles] = await Promise.all([
    getCurrentCompany(),
    getCurrentCompanyQuota(),
    getCurrentCompanyBillingOrders(),
    getPaymentsForCurrentCompany(),
    requirePermission("settings", "edit"),
    getWorkspaceSettingsForAdmin(),
    getRolesForAdministration(),
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
      {workspace && canEdit ? (
        <WorkspaceSettingsForm
          settings={workspace}
          roles={roles.filter((role) => !role.isSystem).map((role) => ({ id: role.id, name: role.name }))}
        />
      ) : null}
      <BillingPanel quota={quota} orders={orders} payments={payments} canEdit={canEdit} />
      {canEdit ? <DataPrivacyPanel company={company} /> : null}
    </div>
  );
}
