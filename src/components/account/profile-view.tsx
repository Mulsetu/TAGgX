import { KeyRound, UserRound } from "lucide-react";
import { LocalTime } from "@/components/layout/local-time";
import type { AccountProfile } from "@/modules/users/types";
import { ChangePasswordForm } from "./change-password-form";

function initials(profile: AccountProfile): string {
  return (profile.fullName ?? profile.email).slice(0, 2).toUpperCase();
}

/** Shared by the workspace (/dashboard/profile) and platform admin (/admin/profile) shells. */
export function ProfileView({ profile }: { profile: AccountProfile }) {
  const details: [string, React.ReactNode][] = [
    ["Name", profile.fullName ?? "—"],
    ["Email", profile.email],
    ...(profile.companyName ? ([["Workspace", profile.companyName]] as [string, React.ReactNode][]) : []),
    ["Role", profile.isCompanyAdmin ? `${profile.roleName ?? "Member"} · Company admin` : (profile.roleName ?? "—")],
    ...(profile.lastSignInAt
      ? ([["Last sign-in", <LocalTime key="last" iso={profile.lastSignInAt} />]] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-primary))] text-lg font-semibold text-white">
          {initials(profile)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.fullName ?? profile.email}</h1>
          <p className="truncate text-sm text-slate-500">{profile.email}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <UserRound className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Account details</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-sm @md:grid-cols-[10rem_minmax(0,1fr)]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="break-words text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <KeyRound className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
        </div>
        <div className="px-5 py-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
