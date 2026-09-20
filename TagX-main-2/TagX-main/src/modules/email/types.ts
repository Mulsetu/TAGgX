export interface AdminRecipient {
  email: string;
  name: string | null;
}

export interface EmailBatchResult {
  sent: number;
  failed: number;
}
