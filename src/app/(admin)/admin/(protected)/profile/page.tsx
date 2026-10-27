import { redirect } from "next/navigation";
import { ProfileView } from "@/components/account/profile-view";
import { getAccountProfile } from "@/modules/users/actions";

export const metadata = { title: "Profile" };

// The (protected) layout already restricts this to super admins.
export default async function AdminProfilePage() {
  const profile = await getAccountProfile();
  if (!profile) {
    redirect("/admin/login");
  }
  return <ProfileView profile={profile} />;
}
