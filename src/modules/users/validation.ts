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
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  roleId: z.string().uuid("Choose a role"),
  vendorId: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().uuid().optional()),
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
