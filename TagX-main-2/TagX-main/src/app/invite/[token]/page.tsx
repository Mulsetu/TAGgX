import { BrandLogo } from "@/components/layout/brand-logo";
import { notFound } from "next/navigation";
import { getInviteForAcceptPage } from "@/modules/users/actions";
import { AcceptInviteForm } from "./accept-invite-form";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const invite = await getInviteForAcceptPage(params.token);

  if (!invite) {
    notFound();
  }

  if (invite.isAccepted || invite.isExpired) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <BrandLogo alt="TagX" size={80} className="mx-auto h-20 w-20" />
        <h1 className="text-xl font-semibold">
          {invite.isAccepted ? "This invite has already been used" : "This invite has expired"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Contact {invite.companyName}&apos;s admin for a new invite.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo alt="TagX" size={80} className="h-20 w-20" />
        <h1 className="text-xl font-semibold">Welcome to {invite.companyName}</h1>
        <p className="text-sm text-muted-foreground">Set a password for {invite.email} to finish setup.</p>
      </div>
      <AcceptInviteForm token={params.token} />
    </main>
  );
}
