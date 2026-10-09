import { redirect } from "next/navigation";

/**
 * Floor audit was merged into the single Audits list (running audits get a
 * Scan button there). Kept as a redirect so old bookmarks, phone shortcuts
 * and the /tag "Walk an audit" link still land somewhere useful. The
 * per-audit scanner stays at /floor/audits/[id].
 */
export default function FloorAuditsPage(): never {
  redirect("/dashboard/administration/audits?status=active");
}
