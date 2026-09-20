export interface CompanyBranding {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  adminEmail: string | null;
  isDedicatedInfra: boolean;
  suspendedAt: string | null;
  createdAt: string;
}

export interface CreateCompanyState {
  error: string | null;
  /**
   * Present when there's a setup link worth showing directly instead of
   * relying on the email having arrived — always in development (so
   * Brevo is never hit while testing), or in production only if the
   * email actually failed to send.
   */
  inviteUrl?: string;
}

export interface UpdateCompanyState {
  error: string | null;
  success?: boolean;
}

export interface DeleteCompanyState {
  error: string | null;
  success?: boolean;
}

export interface UpdateCompanyBrandingState {
  error: string | null;
  success?: boolean;
}

export interface CompanyWorkspaceSettings {
  assetCodeFormat: string;
  enabledModules: Record<string, boolean>;
  planModules: string[] | null;
  assetFieldConfig: Record<string, { enabled: boolean; required: boolean; label: string; order: number }>;
  dashboardWidgets: Record<string, { enabled: boolean; order: number; size: "sm" | "md" | "lg" }>;
  dashboardLayouts: { roles: Record<string, Record<string, { enabled: boolean; order: number; size: "sm" | "md" | "lg" }>> };
  workflowConfig: Record<string, boolean>;
  departments: string[];
  disposalMethods: string[];
}

export interface UpdateWorkspaceSettingsState {
  error: string | null;
  success?: boolean;
}
