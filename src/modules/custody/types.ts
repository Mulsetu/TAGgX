export interface LifecycleEvent {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
}

export interface CustodyFormState {
  error: string | null;
  success?: string;
}

export interface HandoverRecord {
  id: string;
  toUserId: string;
  handedOverAt: string;
  accessories: string | null;
  notes: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface PendingTransfer {
  id: string;
  toUserId: string | null;
  fromUserId: string | null;
  status: "pending" | "accepted" | "rejected";
  reason: string | null;
  transferredAt: string;
}
