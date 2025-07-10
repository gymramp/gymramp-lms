// src/types/user.ts

import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

export type UserRole = 'Super Admin' | 'Admin' | 'Owner' | 'Manager' | 'Staff';

// Represents a user in the system
export interface User {
  id: string; // Firestore document ID
  name: string;
  email: string;
  role: UserRole;
  companyId: string; // ID of the company/brand the user belongs to
  assignedLocationIds: string[]; // Array of location IDs assigned to the user
  assignedCourseIds?: string[]; // Optional: Array of course IDs assigned directly to this user
  isActive: boolean; // Whether the user account is active or deactivated
  profileImageUrl?: string | null; // Optional URL for profile image
  requiresPasswordChange?: boolean; // Added for password reset flow
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
    videoProgress?: Record<string, number>; // Added for video progress tracking
    timeSpentSeconds?: number; // Cumulative seconds spent on this course
    quizAttempts?: Record<string, number>; // Maps quiz ID (the part after 'quiz-') to attempt count
}


// Represents a company (now Brand) in the system
export interface Company { // Conceptually "Brand"
  id: string; // Firestore document ID
  name: string;
  subdomainSlug?: string | null;
  customDomain?: string | null;
  shortDescription?: string | null;
  logoUrl?: string | null;
  assignedCourseIds?: string[];
  maxUsers?: number | null;
  isTrial?: boolean;
  trialEndsAt?: Timestamp | null;
  saleAmount?: number | null;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp | Date;
  revenueSharePartners?: RevenueSharePartner[] | null;
  // White-labeling fields
  whiteLabelEnabled: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor?: string | null;
  brandBackgroundColor?: string | null;
  brandForegroundColor?: string | null;
  canManageCourses?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  // New fields for Brand Hierarchy
  parentBrandId?: string | null; // ID of the parent brand, if this is a child brand
  createdByUserId?: string | null; // ID of the user (likely Admin/Owner of parent) who created this brand
  userCount?: number; // Denormalized for UI display
  childBrandCount?: number; // Denormalized for UI display
}

// Type for the form data when adding/editing a company (now Brand)
export type CompanyFormData = Omit<Company, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'userCount' | 'childBrandCount'> & {
  revenueSharePartners?: RevenueSharePartner[];
  // parentBrandId and createdByUserId will be handled implicitly or passed directly in addCompany
};

// Represents a single revenue share partner
export interface RevenueSharePartner {
  name: string;
  companyName?: string | null; // Optional partner company
  percentage: number;
  shareBasis: 'coursePrice' | 'subscriptionPrice'; // Basis for the share
}


// Represents a physical location or branch of a company/brand
export interface Location {
  id: string; // Firestore document ID
  name: string;
  companyId: string; // ID of the specific Brand (Parent or Child) this location belongs to
  createdBy: string | null; // User ID of the Owner/Admin who created this location
  isDeleted?: boolean; // For soft deletes
  deletedAt?: Timestamp | null; // Timestamp of soft deletion
  createdAt?: Timestamp | Date; // Timestamp of location creation
  updatedAt?: Timestamp | Date; // Timestamp of last update
}

// Type for the form data when adding/editing a location
export type LocationFormData = Omit<Location, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'>;


// Type for the form data when adding/editing a user
export interface UserFormData {
  name: string;
  email: string;
  // password?: string; // Password handled by auto-generation or reset flow
  role: UserRole;
  companyId: string | null;
  assignedLocationIds: string[];
  assignedCourseIds?: string[];
  isActive?: boolean;
  profileImageUrl?: string | null;
}

// Type for checkout form data (Admin initiating for a new customer)
export interface CheckoutFormData extends Omit<UserFormData, 'role' | 'isActive' | 'profileImageUrl' | 'assignedCourseIds' | 'companyId'> {
  companyName: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  adminEmail: string;
  selectedProgramId: string;
  maxUsers?: number | null;
  paymentIntentId?: string | null;
  subtotalAmount?: number;
  appliedDiscountPercent?: number;
  appliedDiscountAmount?: number;
  finalTotalAmount?: number;
  isTrial?: boolean;
  trialDurationDays?: number;
  revenueSharePartners?: RevenueSharePartner[];
  partnerId?: string | null; // Added to track formal partner
}
