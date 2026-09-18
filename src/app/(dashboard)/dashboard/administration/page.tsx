import { redirect } from "next/navigation";
import { getVisibleAdminSections } from "@/lib/permissions/admin-sections";

export default async function AdministrationPage() {
  const [firstSection] = await getVisibleAdminSections();
  redirect(firstSection?.href ?? "/dashboard");
}
