import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import { DashboardForm } from "../workspace-form";

export default async function DashboardSettingsPage() {
  await assertPermission("settings", "view");
  const [workspace, canEdit] = await Promise.all([
    getWorkspaceSettingsForAdmin(),
    requirePermission("settings", "edit"),
  ]);

  if (!workspace) {
    return <p className="text-sm text-slate-500">Could not load workspace settings.</p>;
  }
  if (!canEdit) {
    return <p className="text-sm text-slate-500">You can view settings, but only an editor can change the dashboard.</p>;
  }

  return <DashboardForm settings={workspace} />;
}
