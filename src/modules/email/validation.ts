import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const updateTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  htmlBody: z.string().trim().min(1).max(20000),
  textBody: z.string().trim().min(1).max(20000),
  isEnabled: z.boolean(),
});

export const toggleRuleSchema = z.object({
  isEnabled: z.boolean(),
});

export const testEmailSchema = z.object({
  eventKey: z.string().trim().min(1).max(64),
  to: z.preprocess(emptyToUndefined, z.string().trim().email().optional()),
});
