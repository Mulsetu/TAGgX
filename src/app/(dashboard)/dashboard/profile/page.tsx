import { redirect } from "next/navigation";
import { ProfileView } from "@/components/account/profile-view";
import { getAccountProfile } from "@/modules/users/actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getAccountProfile();
  if (!profile) {
    redirect("/login");
  }
  return <ProfileView profile={profile} />;
}
