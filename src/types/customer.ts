
// src/types/customer.ts
import type { Timestamp } from 'firebase/firestore';
import type { RevenueSharePartner } from './user'; // Assuming RevenueSharePartner is in user.ts

export interface CustomerPurchaseRecord {
  id: string; // Firestore document ID for this purchase record
  brandId: string;
  brandName: string;
  adminUserId: string;
  adminUserEmail: string;
  purchaseDate: Timestamp;
  totalAmountPaid: number;
  paymentIntentId: string | null; // Can be null if amount was $0
  selectedCourseIds: string[];
  selectedCourseTitles?: string[]; // For easier display
  revenueSharePartners?: RevenueSharePartner[] | null;
  maxUsersConfigured?: number | null;
  // For future use, e.g., linking to Stripe Customer ID or Subscription ID
  // stripeCustomerId?: string | null;
  // stripeSubscriptionId?: string | null;
  // subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
}

export type CustomerPurchaseRecordFormData = Omit<CustomerPurchaseRecord, 'id' | 'purchaseDate'> & {
  purchaseDate?: Timestamp; // Optional for creation, serverTimestamp will be used
};
