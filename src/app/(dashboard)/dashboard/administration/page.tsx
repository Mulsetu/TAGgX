import { redirect } from "next/navigation";
import { getSidebarAdminNav } from "@/lib/permissions/admin-sections";

export default async function AdministrationPage() {
  const nav = await getSidebarAdminNav();
  redirect(nav.catalogSections[0]?.href ?? "/dashboard");
}
