// src/types/activity.ts
import type { Timestamp } from 'firebase/firestore';

export type ActivityType = 'user_added' | 'course_progress_updated';

export interface ActivityLog {
  id: string; // Unique ID for the log entry (can be user ID for user_added, or composite ID)
  timestamp: Timestamp | Date; // Firestore Timestamp or Date object
  type: ActivityType;
  userId: string;
  userName: string;
  companyId: string;
  locationIds: string[]; // Locations the user belongs to
  details: {
    message: string; // e.g., "John Doe was added", "Jane Doe completed 'Sales Basics'"
    courseId?: string;
    courseTitle?: string;
    status?: string; // e.g., "Completed", "In Progress"
  };
}
