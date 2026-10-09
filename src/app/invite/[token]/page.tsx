import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandLogo } from "@/components/layout/brand-logo";
import { getInviteForAcceptPage } from "@/modules/users/actions";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = {
  title: "Accept invite",
  robots: { index: false, follow: false },
};

interface InvitePageProps {
  params: { token: string };
}

const logo = <BrandLogo alt="TagX by Mulsetu" size={80} className="h-14 w-auto max-w-[14rem]" />;

export default async function InvitePage({ params }: InvitePageProps) {
  const invite = await getInviteForAcceptPage(params.token);

  if (!invite) {
    notFound();
  }

  if (invite.isAccepted || invite.isExpired) {
    return (
      <AuthShell
        logo={logo}
        title={invite.isAccepted ? "This invite has already been used" : "This invite has expired"}
        subtitle={`Contact ${invite.companyName}'s admin for a new invite.`}
      >
        <Link href="/login" className="text-sm font-medium text-[hsl(var(--brand-primary))] hover:underline">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      logo={logo}
      title={`Welcome to ${invite.companyName}`}
      subtitle={`Set a password for ${invite.email} to finish setup.`}
    >
      <AcceptInviteForm token={params.token} />
    </AuthShell>
  );
}
