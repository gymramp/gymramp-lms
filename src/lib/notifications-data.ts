
// src/lib/notifications-data.ts
import { db } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  addDoc,
} from 'firebase/firestore';
import type { User, Notification, NotificationFormData } from '@/types/activity';
import type { Timestamp } from 'firebase/firestore';

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Creates a new notification for a user.
 * @param notificationData - The data for the notification to be created.
 * @returns A promise that resolves to true if successful, false otherwise.
 */
export async function createNotification(notificationData: NotificationFormData): Promise<boolean> {
  try {
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    await addDoc(notificationsRef, {
      ...notificationData,
      href: notificationData.href || null, // Ensure href is null if not provided
      isRead: false,
      createdAt: serverTimestamp(),
    });
    console.log(`Notification created for recipient ${notificationData.recipientId}`);
    return true;
  } catch (error) {
    console.error("Error creating notification:", error);
    return false;
  }
}

/**
 * Fetches notifications for a specific user, ordered by most recent.
 * THIS FUNCTION IS DEPRECATED in favor of the real-time listener in the Notifications component,
 * but kept for potential non-real-time use cases.
 * @param userId - The ID of the user to fetch notifications for.
 * @param count - The maximum number of notifications to fetch.
 * @returns A promise that resolves to an array of notifications.
 */
export async function getNotificationsForUser(userId: string, count: number = 20): Promise<Notification[]> {
  if (!userId) return [];
  try {
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    // Note: A composite index on (recipientId asc, createdAt desc) is required for this query to work.
    // The Firebase console will provide a link to create this index if it's missing.
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(), // Serialize timestamp
      } as unknown as Notification);
    });
    return notifications;
  } catch (error: any) {
    if (error.code === 'failed-precondition') {
      console.warn(
        `[Firestore Query Error] The query for user notifications requires a composite index. ` +
        `This is expected if the index has not been created yet. ` +
        `Please create the index in your Firebase console. The error contains the direct link. ` +
        `Original error:`, error
      );
    } else {
      console.error(`Error fetching notifications for user ${userId}:`, error);
    }
    // Return an empty array to prevent the UI from crashing.
    return [];
  }
}

/**
 * Marks a specific notification as read.
 * @param notificationId - The ID of the notification to update.
 * @returns A promise that resolves to true if successful, false otherwise.
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  if (!notificationId) return false;
  try {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
    });
    return true;
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read:`, error);
    return false;
  }
}

/**
 * Marks all unread notifications for a user as read.
 * @param userId - The ID of the user whose notifications should be updated.
 * @returns A promise that resolves to true if successful, false otherwise.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(
        notificationsRef,
        where('recipientId', '==', userId),
        where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return true; // No unread notifications to mark
    }
    
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error(`Error marking all notifications as read for user ${userId}:`, error);
    return false;
  }
}
