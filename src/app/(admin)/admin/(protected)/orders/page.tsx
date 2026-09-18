import { getPendingBillingOrdersForAdmin } from "@/modules/billing/actions";
import { OrderList } from "./order-list";

export default async function AdminOrdersPage() {
  const orders = await getPendingBillingOrdersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Extra-asset orders</h1>
        <p className="text-sm text-muted-foreground">
          Extra-asset packs are paid through Razorpay and fulfill automatically. Use Mark paid
          only for offline payments.
        </p>
      </div>
      <OrderList orders={orders} />
    </div>
  );
}
