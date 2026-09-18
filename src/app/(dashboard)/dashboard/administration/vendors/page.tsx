import { assertModule } from "@/lib/permissions/features";
import { assertPermission } from "@/lib/permissions/has-permission";
import { getVendorsForAdmin } from "@/modules/vendors/actions";
import { VendorList } from "./vendor-list";

export default async function VendorsPage() {
  await assertModule("vendors");
  await assertPermission("vendors", "view");
  const vendors = await getVendorsForAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Service partners assigned to assets and maintenance. Vendor logins only see their tickets.
        </p>
      </div>
      <VendorList vendors={vendors} />
    </div>
  );
}
