import { z } from "zod";
import { slugSchema } from "@/modules/companies/validation";

export const planFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value.length === 0 ? null : value)),
  priceMonthly: z.coerce.number().int().min(0, "Price can't be negative"),
  assetLimit: z.coerce.number().int().min(1, "Asset limit must be at least 1"),
  extraAssetQuantity: z.coerce.number().int().min(1, "Pack size must be at least 1"),
  extraAssetPrice: z.coerce.number().int().min(0, "Extra pack price can't be negative"),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  includedModules: z.array(z.string().min(1).max(64)).nullable(),
  storageLimitBytes: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.coerce.number().int().min(0).nullable(),
  ),
});

export const assignPlanSchema = z.object({
  planId: z.string().uuid("Choose a plan"),
});

export const grantExtraAssetsSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Enter at least 1 asset").max(100_000),
});

export const extraAssetOrderSchema = z.object({
  packs: z.coerce.number().int().min(1, "Choose at least 1 pack").max(50),
});

export const razorpayPaymentResultSchema = z.object({
  razorpayPaymentId: z.string().min(1).max(40),
  razorpaySignature: z.string().min(1).max(128),
  razorpayOrderId: z.string().min(1).max(40).optional(),
  razorpaySubscriptionId: z.string().min(1).max(40).optional(),
  confirmToken: z.string().min(16).max(128).optional(),
  billingOrderId: z.string().uuid().optional(),
});

export const signupSchema = z
  .object({
    planId: z.string().uuid("Choose a plan"),
    name: z.string().trim().min(1, "Company name is required").max(200),
    slug: slugSchema,
    adminEmail: z.string().trim().email("Enter a valid email"),
    fullName: z
      .string()
      .trim()
      .max(200)
      .transform((value) => (value.length === 0 ? null : value)),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });
