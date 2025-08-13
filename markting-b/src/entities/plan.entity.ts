export enum PlanType {
  FREE = 'free',
  PAID = 'paid',
}

export class Plan {
  id: number;
  type: PlanType;
  name: string;
  mergeGroupLimit: number | null; // null for unlimited
  contactLimit: number | null; // null for unlimited
  durationDays: number | null; // null for paid
  price: number; // 0 for free, dynamic for paid
  billingType: 'monthly' | 'yearly' | null;
}
