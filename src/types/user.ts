
// src/types/user.ts

import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

export type UserRole = 'Super Admin' | 'Admin' | 'Owner' | 'Manager' | 'Staff';

// Represents a user in the system
export interface User {
  id: string; // Firestore document ID
  name: string;
  email: string;
  role: UserRole;
  companyId: string; // ID of the company the user belongs to
  assignedLocationIds: string[]; // Array of location IDs assigned to the user
  assignedCourseIds?: string[]; // Optional: Array of course IDs assigned directly to this user
  isActive: boolean; // Whether the user account is active or deactivated
  profileImageUrl?: string | null; // Optional URL for profile image
  isDeleted?: boolean; // For soft deletes
  deletedAt?: Timestamp | null; // Timestamp of soft deletion
  createdAt?: Timestamp | Date; // Timestamp of user creation
  lastLogin?: Timestamp | Date | null; // Timestamp of last login
  courseProgress?: { // Optional: To store progress for each assigned course
    [courseId: string]: UserCourseProgressData;
  };
  // Add company name for convenience if needed, but typically fetched via companyId
  company?: string; // Optional: Denormalized company name
}

// Data structure for individual course progress within a User document
export interface UserCourseProgressData {
    progress: number; // Percentage completion (0-100)
    status: "Not Started" | "Started" | "In Progress" | "Completed";
    completedItems: string[]; // Array of completed lesson/quiz IDs (prefixed)
    lastUpdated?: Timestamp | Date | null; // Firestore Timestamp of last progress update
}


// Represents a company in the system
export interface Company {
  id: string; // Firestore document ID
  name: string;
  shortDescription?: string | null;
  logoUrl?: string | null;
  assignedCourseIds?: string[]; // Courses assigned to the company from the library
  maxUsers?: number | null; // Maximum number of users allowed, null for unlimited
  isTrial?: boolean; // Indicates if the company is on a trial
  trialEndsAt?: Timestamp | null; // Timestamp when the trial period ends
  isDeleted?: boolean; // For soft deletes
  deletedAt?: Timestamp | null; // Timestamp of soft deletion
  // Revenue Share Fields
  revSharePartnerName?: string | null;
  revSharePartnerCompany?: string | null;
  revSharePartnerPercentage?: number | null;
  // White-labeling fields
  whiteLabelEnabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

// Type for the form data when adding/editing a company
export type CompanyFormData = Omit<Company, 'id' | 'isDeleted' | 'deletedAt'>;


// Represents a physical location or branch of a company
export interface Location {
  id: string; // Firestore document ID
  name: string;
  companyId: string; // ID of the company this location belongs to
  createdBy: string | null; // User ID of the Owner who created this location, if applicable
  isDeleted?: boolean; // For soft deletes
  deletedAt?: Timestamp | null; // Timestamp of soft deletion
}

// Type for the form data when adding/editing a location
export type LocationFormData = Omit<Location, 'id' | 'isDeleted' | 'deletedAt'>;


// Type for the form data when adding/editing a user
export interface UserFormData {
  name: string;
  email: string;
  password?: string; // Password is for creation, not typically stored directly in Firestore user doc
  role: UserRole;
  companyId: string | null; // Allow null if user is not yet assigned to a company (e.g. Super Admin)
  assignedLocationIds: string[];
  assignedCourseIds?: string[]; // Optional: Array of course IDs
  isActive?: boolean;
  profileImageUrl?: string | null;
}

// Type for checkout form data (Admin initiating for a new customer)
export interface CheckoutFormData extends Omit<UserFormData, 'role' | 'isActive' | 'profileImageUrl' | 'assignedCourseIds' | 'companyId'> {
  companyName: string;
  // Billing address fields (optional, can be expanded)
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  adminEmail: string; // Email for the new admin user
  password?: string; // Password for the new admin user
  selectedCourseIds?: string[]; // Courses to be assigned to the new company
  maxUsers?: number | null; // Max users for the new company
  // Payment related fields
  paymentIntentId?: string | null; // Store Stripe PaymentIntent ID after successful payment
  subtotalAmount?: number;
  appliedDiscountPercent?: number;
  appliedDiscountAmount?: number;
  finalTotalAmount?: number;
  // Trial related fields
  isTrial?: boolean;
  trialDurationDays?: number; // Optional: duration in days if it's a trial
  // Revenue Share Fields
  revSharePartnerName?: string;
  revSharePartnerCompany?: string;
  revSharePartnerPercentage?: number;
}

