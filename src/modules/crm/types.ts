export type LeadSource = "demo" | "inquire";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed";

export interface CrmLead {
  id: string;
  source: LeadSource;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  assetCount: string | null;
  message: string | null;
  preferredDate: string | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFormState {
  error: string | null;
  success?: boolean;
}

export interface LeadListPage {
  leads: CrmLead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadFilters {
  source?: LeadSource;
  status?: LeadStatus;
  page?: number;
}

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "closed"];
export const LEAD_SOURCES: LeadSource[] = ["demo", "inquire"];
