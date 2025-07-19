
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck } from 'lucide-react';
import { getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications-data';
import type { User, Notification } from '@/types/activity';
import { ScrollArea } from '../ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../ui/badge';
import { useRouter } from 'next/navigation';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import db for onSnapshot
import type { Timestamp } from 'firebase/firestore';

interface NotificationsProps {
  user: User;
}

export function Notifications({ user }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const router = useRouter();

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!user?.id) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedNotifications: Notification[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedNotifications.push({
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as unknown as Notification);
      });
      setNotifications(fetchedNotifications);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [user?.id]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      // No need to manually refetch, onSnapshot will update the state
    }
    if (notification.href) {
      router.push(notification.href);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.id);
    // No need to manually refetch, onSnapshot will update the state
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle Notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
          <SheetTitle>Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
            </Button>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              You have no new notifications.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-secondary cursor-pointer ${notification.isRead ? 'opacity-60' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`h-2 w-2 rounded-full ${notification.isRead ? 'bg-transparent' : 'bg-primary'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt.toString()), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
