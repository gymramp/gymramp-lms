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
  totalAmountPaid: number; // This will be the Program's base price
  paymentIntentId: string | null; // Can be null if amount was $0
  selectedProgramId: string; // ID of the Program purchased
  selectedProgramTitle?: string; // Title of the Program purchased
  selectedCourseIds: string[]; // Courses included in the purchased Program
  selectedCourseTitles?: string[]; // For easier display, titles of courses in Program
  revenueSharePartners?: RevenueSharePartner[] | null;
  maxUsersConfigured?: number | null;
  partnerId?: string | null; // ID of the formal Partner who brought this customer
}

export type CustomerPurchaseRecordFormData = Omit<CustomerPurchaseRecord, 'id' | 'purchaseDate'> & {
  purchaseDate?: Timestamp; // Optional for creation, serverTimestamp will be used
};
