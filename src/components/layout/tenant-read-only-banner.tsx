import Link from "next/link";
import type { TenantAccessState } from "@/lib/permissions/tenant-access";

export function TenantReadOnlyBanner({ access }: { access: TenantAccessState }) {
  if (access.writable) {
    return null;
  }

  const reason = access.suspended
    ? "This organization is suspended."
    : `This workspace is read-only (${access.subscriptionStatus.replace(/_/g, " ")}).`;

  return (
    <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
      {reason} You can still open{" "}
      <Link href="/dashboard/administration/settings" className="font-medium underline">
        Settings
      </Link>{" "}
      to update billing.
    </div>
  );
}
