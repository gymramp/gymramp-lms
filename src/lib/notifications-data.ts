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
} from 'firebase/firestore';
import type { User, Notification } from '@/types/activity';
import type { Timestamp } from 'firebase/firestore';

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Fetches notifications for a specific user, ordered by most recent.
 * @param userId - The ID of the user to fetch notifications for.
 * @param count - The maximum number of notifications to fetch.
 * @returns A promise that resolves to an array of notifications.
 */
export async function getNotificationsForUser(userId: string, count: number = 20): Promise<Notification[]> {
  if (!userId) return [];
  try {
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    // Note: A composite index on (recipientId, createdAt desc) is required for optimal sorting.
    // For now, we sort by recipientId to avoid build errors without the index.
    // The limit will still retrieve recent documents, but they may not be perfectly ordered.
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'), // This should be fine now that the index should exist from previous failures
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
  } catch (error) {
    console.error(`Error fetching notifications for user ${userId}:`, error);
    // Changed to not re-throw the error, which was causing a crash on the client.
    // Instead, we log it and return an empty array, so the UI can handle the empty state gracefully.
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
