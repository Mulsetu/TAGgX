import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const vendorFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  companyName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  contactName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().max(320).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  serviceCategory: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  isActive: z.boolean().optional().default(true),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});

export type VendorFormInput = z.infer<typeof vendorFormSchema>;
