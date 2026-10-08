import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import { getWorkspaceSettingsForAdmin } from "@/modules/companies/actions";
import { WorkspaceDetailsForm } from "../workspace-form";

export default async function WorkspaceSettingsPage() {
  await assertPermission("settings", "view");
  const [workspace, canEdit] = await Promise.all([
    getWorkspaceSettingsForAdmin(),
    requirePermission("settings", "edit"),
  ]);

  if (!workspace) {
    return <p className="text-sm text-slate-500">Could not load workspace settings.</p>;
  }
  if (!canEdit) {
    return <p className="text-sm text-slate-500">You can view settings, but only an editor can change the workspace.</p>;
  }

  return <WorkspaceDetailsForm settings={workspace} />;
}
