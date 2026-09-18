export interface VendorSummary {
  id: string;
  name: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface VendorFormState {
  error: string | null;
}

export interface VendorOption {
  id: string;
  name: string;
  email: string | null;
}
