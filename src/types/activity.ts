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

export type NotificationType = 'message' | 'reminder' | 'badge' | 'announcement' | 'course_completion';

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string; // 'SYSTEM' or a userId
  senderName: string; // 'System' or the sender's name
  type: NotificationType;
  content: string;
  isRead: boolean;
  href?: string; // Optional link to navigate to, e.g., a course page
  createdAt: Timestamp;
}

// Data required when creating a new notification
export type NotificationFormData = Omit<Notification, 'id' | 'isRead' | 'createdAt'>;
