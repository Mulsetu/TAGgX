export interface StatusSummary {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
}

export interface StatusFormState {
  error: string | null;
}
