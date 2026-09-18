export type SubscriptionStatus = "pending_payment" | "active" | "past_due" | "halted" | "canceled";

export interface BillingPlan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  assetLimit: number;
  extraAssetQuantity: number;
  extraAssetPrice: number;
  isActive: boolean;
  sortOrder: number;
  razorpayPlanId: string | null;
  /** Null means every module is available on this plan. */
  includedModules: string[] | null;
  storageLimitBytes: number | null;
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  extraAssets: number;
  status: SubscriptionStatus;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  paymentConfirmToken: string | null;
}

export interface CompanyAssetQuota {
  plan: BillingPlan | null;
  extraAssets: number;
  assetCount: number;
  /** plan.assetLimit + extraAssets; null means no cap (no subscription). */
  effectiveLimit: number | null;
  remaining: number | null;
  atLimit: boolean;
  subscriptionStatus: SubscriptionStatus | "none";
}

export interface CompanyBillingSnapshot {
  companyId: string;
  planId: string | null;
  planName: string | null;
  priceMonthly: number | null;
  extraAssets: number;
  effectiveLimit: number | null;
  assetCount: number;
  pendingOrderCount: number;
  subscriptionStatus: SubscriptionStatus | null;
}

export interface BillingOrder {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  planId: string;
  packs: number;
  assetQuantity: number;
  amount: number;
  currency: string;
  status: "pending" | "fulfilled" | "canceled";
  razorpayOrderId: string | null;
  createdAt: string;
}

export interface RazorpayCheckoutSession {
  keyId: string;
  name: string;
  description: string;
  currency: string;
  amountPaise: number;
  prefillEmail: string;
  prefillName: string | null;
  subscriptionId?: string;
  orderId?: string;
  confirmToken?: string;
  billingOrderId?: string;
}

export interface PlanFormState {
  error: string | null;
  success?: boolean;
}

export interface SignupState {
  error: string | null;
  redirectPath?: string;
  checkout?: RazorpayCheckoutSession;
}

export interface ExtraAssetOrderState {
  error: string | null;
  success?: boolean;
  checkout?: RazorpayCheckoutSession;
}

export interface AssignPlanState {
  error: string | null;
  success?: boolean;
}

export interface OrderActionState {
  error: string | null;
  success?: boolean;
}

export interface ConfirmPaymentState {
  error: string | null;
  success?: boolean;
  redirectPath?: string;
}
