import { assertPermission } from "@/lib/permissions/has-permission";
import { getCurrentCompany } from "@/modules/companies/actions";
import { getCurrentUser } from "@/modules/users/actions";
import { DataPrivacyPanel } from "../data-privacy-panel";

export default async function DataSettingsPage() {
  await assertPermission("settings", "view");
  const [company, user] = await Promise.all([getCurrentCompany(), getCurrentUser()]);

  if (!company) {
    return <p className="text-sm text-slate-500">Could not load your company.</p>;
  }
  // Export and deletion requests are Company-Admin-only on the server
  // (exportWorkspaceDataAction / requestWorkspaceDeletionAction), so don't
  // show other editors buttons that would only fail.
  if (!user?.isCompanyAdmin) {
    return (
      <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
        Only the Company Admin can export this workspace&apos;s data or request its deletion.
      </p>
    );
  }

  return <DataPrivacyPanel company={company} />;
}
