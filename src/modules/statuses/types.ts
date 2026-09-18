export interface StatusSummary {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  color: string | null;
  isFinal: boolean;
  allowsAssignment: boolean;
  createdAt: string;
}

export interface StatusFormState {
  error: string | null;
}
