import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z
  .object({
    tokenHash: z.string().regex(/^[a-f0-9]{20,128}$/i, "This reset link is invalid. Request a new one."),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export const transferCompanyAdminSchema = z.object({
  newAdminId: z.string().uuid(),
  previousRoleId: z.string().uuid("Choose your new role"),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  roleId: z.string().uuid("Choose a role"),
  vendorId: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().uuid().optional()),
});

/** hashed_token from auth.admin.generateLink — a hex digest. */
export const signupPlanIdSchema = z.string().uuid();

export const confirmSignupEmailSchema = z.object({
  tokenHash: z.string().regex(/^[a-f0-9]{20,128}$/i),
  planId: signupPlanIdSchema.optional(),
});

export const accountSignupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });
