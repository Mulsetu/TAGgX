import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import {
  getBillingOverview,
  getCurrentCompanyBillingOrders,
  getCurrentCompanyQuota,
  getPaymentsForCurrentCompany,
} from "@/modules/billing/actions";
import { BillingPanel } from "../billing-panel";

export default async function BillingSettingsPage() {
  await assertPermission("settings", "view");
  const [quota, orders, payments, overview, canEdit] = await Promise.all([
    getCurrentCompanyQuota(),
    getCurrentCompanyBillingOrders(),
    getPaymentsForCurrentCompany(),
    getBillingOverview(),
    requirePermission("settings", "edit"),
  ]);

  return (
    <BillingPanel
      quota={quota}
      orders={orders}
      payments={payments}
      overview={overview}
      canEdit={canEdit}
      currentPlanId={quota.plan?.id ?? null}
    />
  );
}
