
// src/components/dashboard/SendNotificationDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import type { User, NotificationFormData } from '@/types/activity';
import { createNotification } from '@/lib/notifications-data';

const notificationFormSchema = z.object({
  content: z.string().min(10, { message: 'Message must be at least 10 characters.' }).max(500, { message: 'Message cannot exceed 500 characters.' }),
  href: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

interface SendNotificationDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  recipient: User | null;
  sender: User | null;
}

export function SendNotificationDialog({ isOpen, setIsOpen, recipient, sender }: SendNotificationDialogProps) {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: { content: '', href: '' },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsSending(false);
    }
  }, [isOpen, form]);

  const onSubmit = async (data: NotificationFormValues) => {
    if (!recipient || !sender) {
      toast({ title: 'Error', description: 'Sender or recipient is missing.', variant: 'destructive' });
      return;
    }
    setIsSending(true);

    const notificationData: NotificationFormData = {
      recipientId: recipient.id,
      senderId: sender.id,
      senderName: sender.name,
      type: 'message',
      content: data.content,
      href: data.href || null, // Fix: Use null instead of undefined for empty href
    };

    try {
      const success = await createNotification(notificationData);
      if (success) {
        toast({ title: 'Message Sent', description: `Your message has been sent to ${recipient.name}.` });
        setIsOpen(false);
      } else {
        throw new Error('Failed to send notification via server action.');
      }
    } catch (error: any) {
      toast({ title: 'Sending Failed', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  if (!recipient || !sender) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Message to {recipient.name}</DialogTitle>
          <DialogDescription>
            The user will receive this message as a notification.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`Hi ${recipient.name.split(' ')[0]}, please remember to...`}
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="href"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Optional Link</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., https://yourapp.com/courses/my-courses"
                      rows={1}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
