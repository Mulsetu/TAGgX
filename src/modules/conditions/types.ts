export interface ConditionSummary {
  id: string;
  key: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ConditionFormState {
  error: string | null;
}

export interface ConditionOption {
  key: string;
  name: string;
}
