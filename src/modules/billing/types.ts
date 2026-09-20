export type SubscriptionStatus =
  | "draft"
  | "trial"
  | "pending_payment"
  | "active"
  | "past_due"
  | "expired"
  | "suspended"
  | "halted"
  | "canceled";

export type SubscriptionType =
  | "self_service"
  | "sales_assisted"
  | "demo"
  | "trial"
  | "enterprise"
  | "complimentary";

export type BillingCycle = "monthly" | "yearly" | "custom";

export type PaymentMethod =
  | "razorpay"
  | "upi"
  | "bank_transfer"
  | "neft"
  | "rtgs"
  | "cash"
  | "cheque"
  | "other";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "partially_paid"
  | "refunded"
  | "waived";

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
  userLimit: number | null;
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  extraAssets: number;
  status: SubscriptionStatus;
  subscriptionType: SubscriptionType;
  billingCycle: BillingCycle;
  startsAt: string;
  endsAt: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
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
  subscriptionType: SubscriptionType | null;
  billingCycle: BillingCycle | null;
  startsAt: string | null;
  endsAt: string | null;
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

export interface BillingPayment {
  id: string;
  companyId: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  referenceNumber: string | null;
  paymentDate: string;
  provider: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RecordPaymentState {
  error: string | null;
  success?: boolean;
}

export interface SubscriptionActionState {
  error: string | null;
  success?: boolean;
}

export interface AccountSignupState {
  error: string | null;
  checkEmail?: boolean;
  redirectPath?: string;
}

export interface CreateWorkspaceState {
  error: string | null;
  redirectPath?: string;
  checkout?: RazorpayCheckoutSession;
}
