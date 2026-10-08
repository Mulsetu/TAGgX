import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import {
  getCurrentCompanyBillingOrders,
  getCurrentCompanyQuota,
  getPaymentsForCurrentCompany,
} from "@/modules/billing/actions";
import { BillingPanel } from "../billing-panel";

export default async function BillingSettingsPage() {
  await assertPermission("settings", "view");
  const [quota, orders, payments, canEdit] = await Promise.all([
    getCurrentCompanyQuota(),
    getCurrentCompanyBillingOrders(),
    getPaymentsForCurrentCompany(),
    requirePermission("settings", "edit"),
  ]);

  return <BillingPanel quota={quota} orders={orders} payments={payments} canEdit={canEdit} />;
}
