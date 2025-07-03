
import type { Timestamp } from 'firebase/firestore';

// This is the main Partner entity stored in Firestore
export interface Partner {
  id: string;
  name: string;
  email: string;
  companyName?: string | null;
  percentage: number;
  logoUrl?: string | null; // Added logoUrl
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// This is the data structure for the form when creating/editing a Partner
export type PartnerFormData = Omit<Partner, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'>;
