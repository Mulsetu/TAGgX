"use server";

import { headers } from "next/headers";
import { sendCrmLeadNotificationEmail } from "@/lib/email";
import { clientIpFromHeaders, consumeRateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site";
import { isCurrentUserSuperAdmin } from "@/lib/permissions/super-admin";
import { countNewLeadsForAdmin, listLeadsForAdmin } from "./queries";
import { insertLead, updateLeadStatus } from "./mutations";
import type { LeadFormState, LeadFilters, LeadListPage } from "./types";
import { leadListQuerySchema, submitLeadSchema, updateLeadSchema } from "./validation";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitLeadAction(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const honeypot = formString(formData, "website").trim();
  if (honeypot.length > 0) {
    return { error: null, success: true };
  }

  const parsed = submitLeadSchema.safeParse({
    source: formString(formData, "source"),
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    companyName: formString(formData, "companyName"),
    jobTitle: formString(formData, "jobTitle"),
    assetCount: formString(formData, "assetCount"),
    message: formString(formData, "message"),
    preferredDate: formString(formData, "preferredDate"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Check the form and try again." };
  }

  const ip = clientIpFromHeaders(headers());
  if (!consumeRateLimit(`crm-lead:${ip}`, 8, 60 * 60 * 1000)) {
    return { error: "Too many requests. Please try again later." };
  }

  let result: Awaited<ReturnType<typeof insertLead>>;
  try {
    result = await insertLead(parsed.data);
  } catch {
    return { error: "Could not save your request. Try again in a moment." };
  }

  if ("error" in result) {
    return { error: result.error };
  }

  const adminUrl = `${getSiteUrl()}/admin/leads`;
  await sendCrmLeadNotificationEmail({
    source: parsed.data.source,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    companyName: parsed.data.companyName,
    message: parsed.data.message,
    preferredDate: parsed.data.preferredDate,
    adminUrl,
  }).catch(() => undefined);

  return { error: null, success: true };
}

export async function getLeadsForAdmin(filters: LeadFilters): Promise<LeadListPage> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { leads: [], total: 0, page: 1, pageSize: 50 };
  }

  const parsed = leadListQuerySchema.safeParse(filters);
  if (!parsed.success) {
    return listLeadsForAdmin({});
  }

  return listLeadsForAdmin(parsed.data);
}

export async function getNewLeadCountForAdmin(): Promise<number> {
  if (!(await isCurrentUserSuperAdmin())) {
    return 0;
  }
  return countNewLeadsForAdmin();
}

export async function updateLeadAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  if (!(await isCurrentUserSuperAdmin())) {
    return { error: "Not allowed." };
  }

  const parsed = updateLeadSchema.safeParse({
    id: formString(formData, "id"),
    status: formString(formData, "status"),
    notes: formString(formData, "notes"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Could not update this lead." };
  }

  const result = await updateLeadStatus(parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  return { error: null };
}
