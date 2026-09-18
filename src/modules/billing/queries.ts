import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  BillingOrder,
  BillingPlan,
  CompanyBillingSnapshot,
  CompanySubscription,
  SubscriptionStatus,
} from "./types";

const PLAN_COLUMNS =
  "id, name, description, price_monthly, currency, asset_limit, extra_asset_quantity, extra_asset_price, is_active, sort_order, razorpay_plan_id, included_modules, storage_limit_bytes";

const SUBSCRIPTION_COLUMNS =
  "id, company_id, plan_id, extra_assets, status, razorpay_customer_id, razorpay_subscription_id, payment_confirm_token";

const ORDER_COLUMNS =
  "id, company_id, plan_id, packs, asset_quantity, amount, currency, status, razorpay_order_id, created_at, companies(name, slug)";

interface BillingPlanRow {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  currency: string;
  asset_limit: number;
  extra_asset_quantity: number;
  extra_asset_price: number;
  is_active: boolean;
  sort_order: number;
  razorpay_plan_id: string | null;
  included_modules: unknown;
  storage_limit_bytes: number | null;
}

interface SubscriptionRow {
  id: string;
  company_id: string;
  plan_id: string;
  extra_assets: number;
  status: SubscriptionStatus;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  payment_confirm_token: string | null;
}

interface OrderRow {
  id: string;
  company_id: string;
  plan_id: string;
  packs: number;
  asset_quantity: number;
  amount: number;
  currency: string;
  status: "pending" | "fulfilled" | "canceled";
  razorpay_order_id: string | null;
  created_at: string;
  companies: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

function mapPlan(row: BillingPlanRow): BillingPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceMonthly: row.price_monthly,
    currency: row.currency,
    assetLimit: row.asset_limit,
    extraAssetQuantity: row.extra_asset_quantity,
    extraAssetPrice: row.extra_asset_price,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    razorpayPlanId: row.razorpay_plan_id,
    includedModules: Array.isArray(row.included_modules)
      ? row.included_modules.filter((entry): entry is string => typeof entry === "string")
      : null,
    storageLimitBytes: row.storage_limit_bytes,
  };
}

function mapSubscription(row: SubscriptionRow): CompanySubscription {
  return {
    id: row.id,
    companyId: row.company_id,
    planId: row.plan_id,
    extraAssets: row.extra_assets,
    status: row.status,
    razorpayCustomerId: row.razorpay_customer_id,
    razorpaySubscriptionId: row.razorpay_subscription_id,
    paymentConfirmToken: row.payment_confirm_token,
  };
}

function companyFromEmbed(
  companies: OrderRow["companies"],
): { name: string; slug: string } | null {
  if (!companies) {
    return null;
  }
  return Array.isArray(companies) ? (companies[0] ?? null) : companies;
}

/** Active plans for the public pricing page. Admin client: this is pre-auth. */
export async function listActivePlans(): Promise<BillingPlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .select(PLAN_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price_monthly", { ascending: true })
    .returns<BillingPlanRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map(mapPlan);
}

/** Every plan, including inactive ones. Super-admin session + RLS bypass. */
export async function listAllPlans(): Promise<BillingPlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .select(PLAN_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<BillingPlanRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map(mapPlan);
}

export async function getPlanById(planId: string): Promise<BillingPlan | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .maybeSingle<BillingPlanRow>();

  if (error || !data) {
    return null;
  }

  return mapPlan(data);
}

export async function getSubscriptionForCompany(companyId: string): Promise<CompanySubscription | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("company_id", companyId)
    .maybeSingle<SubscriptionRow>();

  if (error || !data) {
    return null;
  }

  return mapSubscription(data);
}

export async function countPlanSubscriptions(planId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("company_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

interface AssetCountRow {
  company_id: string;
  asset_count: string;
}

export async function getCompanyAssetCounts(): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_company_asset_counts");

  const counts = new Map<string, number>();
  if (error || !data) {
    return counts;
  }

  for (const row of data as AssetCountRow[]) {
    counts.set(row.company_id, Number(row.asset_count));
  }

  return counts;
}

export async function countAssetsForCompany(companyId: string): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

interface SubscriptionJoinRow {
  company_id: string;
  extra_assets: number;
  plan_id: string;
  status: SubscriptionStatus;
  billing_plans: {
    name: string;
    price_monthly: number;
    asset_limit: number;
  } | {
    name: string;
    price_monthly: number;
    asset_limit: number;
  }[] | null;
}

function planFromEmbed(plans: SubscriptionJoinRow["billing_plans"]): {
  name: string;
  price_monthly: number;
  asset_limit: number;
} | null {
  if (!plans) {
    return null;
  }
  return Array.isArray(plans) ? (plans[0] ?? null) : plans;
}

export async function listCompanyBillingSnapshots(): Promise<CompanyBillingSnapshot[]> {
  const supabase = createClient();

  const [subsRes, counts, ordersRes] = await Promise.all([
    supabase
      .from("company_subscriptions")
      .select("company_id, extra_assets, plan_id, status, billing_plans(name, price_monthly, asset_limit)")
      .returns<SubscriptionJoinRow[]>(),
    getCompanyAssetCounts(),
    supabase
      .from("billing_orders")
      .select("company_id")
      .eq("status", "pending")
      .returns<{ company_id: string }[]>(),
  ]);

  const pendingByCompany = new Map<string, number>();
  for (const row of ordersRes.data ?? []) {
    pendingByCompany.set(row.company_id, (pendingByCompany.get(row.company_id) ?? 0) + 1);
  }

  return (subsRes.data ?? []).map((row) => {
    const plan = planFromEmbed(row.billing_plans);
    const extraAssets = row.extra_assets;
    const assetLimit = plan?.asset_limit ?? null;
    return {
      companyId: row.company_id,
      planId: row.plan_id,
      planName: plan?.name ?? null,
      priceMonthly: plan?.price_monthly ?? null,
      extraAssets,
      effectiveLimit: assetLimit === null ? null : assetLimit + extraAssets,
      assetCount: counts.get(row.company_id) ?? 0,
      pendingOrderCount: pendingByCompany.get(row.company_id) ?? 0,
      subscriptionStatus: row.status,
    };
  });
}

export async function listBillingOrders(status?: "pending" | "fulfilled" | "canceled"): Promise<BillingOrder[]> {
  const supabase = createClient();

  let query = supabase
    .from("billing_orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<OrderRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const company = companyFromEmbed(row.companies);
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: company?.name ?? "Unknown company",
      companySlug: company?.slug ?? "",
      planId: row.plan_id,
      packs: row.packs,
      assetQuantity: row.asset_quantity,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      razorpayOrderId: row.razorpay_order_id,
      createdAt: row.created_at,
    };
  });
}

export async function listBillingOrdersForCompany(companyId: string): Promise<BillingOrder[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_orders")
    .select(ORDER_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<OrderRow[]>();

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const company = companyFromEmbed(row.companies);
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: company?.name ?? "Unknown company",
      companySlug: company?.slug ?? "",
      planId: row.plan_id,
      packs: row.packs,
      assetQuantity: row.asset_quantity,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      razorpayOrderId: row.razorpay_order_id,
      createdAt: row.created_at,
    };
  });
}

export async function getSubscriptionByConfirmToken(token: string): Promise<CompanySubscription | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("payment_confirm_token", token)
    .maybeSingle<SubscriptionRow>();

  if (error || !data) {
    return null;
  }

  return mapSubscription(data);
}

export async function getSubscriptionByRazorpayId(razorpaySubscriptionId: string): Promise<CompanySubscription | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .maybeSingle<SubscriptionRow>();

  if (error || !data) {
    return null;
  }

  return mapSubscription(data);
}

export async function getBillingOrderById(orderId: string): Promise<BillingOrder | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("billing_orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (error || !data) {
    return null;
  }

  const company = companyFromEmbed(data.companies);
  return {
    id: data.id,
    companyId: data.company_id,
    companyName: company?.name ?? "Unknown company",
    companySlug: company?.slug ?? "",
    planId: data.plan_id,
    packs: data.packs,
    assetQuantity: data.asset_quantity,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    razorpayOrderId: data.razorpay_order_id,
    createdAt: data.created_at,
  };
}

export async function getBillingOrderByRazorpayOrderId(razorpayOrderId: string): Promise<BillingOrder | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("billing_orders")
    .select(ORDER_COLUMNS)
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle<OrderRow>();

  if (error || !data) {
    return null;
  }

  const company = companyFromEmbed(data.companies);
  return {
    id: data.id,
    companyId: data.company_id,
    companyName: company?.name ?? "Unknown company",
    companySlug: company?.slug ?? "",
    planId: data.plan_id,
    packs: data.packs,
    assetQuantity: data.asset_quantity,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    razorpayOrderId: data.razorpay_order_id,
    createdAt: data.created_at,
  };
}

