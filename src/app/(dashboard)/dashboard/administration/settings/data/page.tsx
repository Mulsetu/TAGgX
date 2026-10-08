import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getCurrentCompany } from "@/modules/companies/actions";
import { DataPrivacyPanel } from "../data-privacy-panel";

export default async function DataSettingsPage() {
  await assertPermission("settings", "view");
  const [company, canEdit] = await Promise.all([getCurrentCompany(), requirePermission("settings", "edit")]);

  if (!company) {
    return <p className="text-sm text-slate-500">Could not load your company.</p>;
  }
  if (!canEdit) {
    return <p className="text-sm text-slate-500">Only an editor can export or request deletion of this workspace.</p>;
  }

  return <DataPrivacyPanel company={company} />;
}
