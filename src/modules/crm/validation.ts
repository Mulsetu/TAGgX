import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

export const leadSourceSchema = z.enum(["demo", "inquire"]);
export const leadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "closed"]);

export const submitLeadSchema = z
  .object({
    source: leadSourceSchema,
    fullName: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().email("Enter a valid work email").max(254),
    phone: z
      .string()
      .trim()
      .max(20)
      .transform((value) => (value.length === 0 ? null : value))
      .refine((value) => value === null || value.length >= 7, "Enter a valid phone number"),
    companyName: optionalText(200),
    jobTitle: optionalText(120),
    assetCount: optionalText(40),
    message: optionalText(2000),
    preferredDate: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? null : value))
      .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Pick a valid date"),
  })
  .superRefine((data, ctx) => {
    if (data.source === "inquire" && !data.message) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "Tell us what you need",
      });
    }
  });

export const updateLeadSchema = z.object({
  id: z.string().uuid(),
  status: leadStatusSchema,
  notes: optionalText(2000),
});

export const leadListQuerySchema = z.object({
  source: leadSourceSchema.optional(),
  status: leadStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
