
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, KeyRound, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { sendTestWelcomeEmailAction } from '@/actions/emailActions'; // New action
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// MailServerSettingsForm removed

// Zod schema for the new form
const sendTestEmailFormSchema = z.object({
  recipientEmail: z.string().email({ message: "Please enter a valid email address." }),
  recipientName: z.string().min(2, { message: "Recipient name must be at least 2 characters." }),
});

type SendTestEmailFormValues = z.infer<typeof sendTestEmailFormSchema>;

function SendTestWelcomeEmailFormComponent() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [lastSentPassword, setLastSentPassword] = useState<string | null>(null);

  const form = useForm<SendTestEmailFormValues>({
    resolver: zodResolver(sendTestEmailFormSchema),
    defaultValues: {
      recipientEmail: '',
      recipientName: '',
    },
  });

  const onSubmit = async (data: SendTestEmailFormValues) => {
    setIsSending(true);
    setLastSentPassword(null);
    const formData = new FormData();
    formData.append('recipientEmail', data.recipientEmail);
    formData.append('recipientName', data.recipientName);

    const result = await sendTestWelcomeEmailAction(formData);

    if (result.success) {
      toast({
        title: "Email Sent!",
        description: result.message,
        variant: "default",
      });
      if (result.tempPasswordUsed) {
        setLastSentPassword(result.tempPasswordUsed);
      }
      form.reset();
    } else {
      toast({
        title: "Sending Failed",
        description: result.message,
        variant: "destructive",
        duration: 10000, // Longer duration for error messages
      });
    }
    setIsSending(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="recipientEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="test.user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recipientName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient Name</FormLabel>
              <FormControl>
                <Input placeholder="Test User Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSending}>
          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {isSending ? 'Sending...' : 'Send Test Welcome Email'}
        </Button>
        {lastSentPassword && (
          <Alert variant="success" className="mt-4 border-green-300 bg-green-50 dark:bg-green-900/30">
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-300">Email Sent & Password Generated</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400">
              The test email included this temporary password: <strong className="font-bold">{lastSentPassword}</strong>
              <p className="text-xs mt-1">This is the password the recipient would use to log in for the first time.</p>
            </AlertDescription>
          </Alert>
        )}
      </form>
    </Form>
  );
}


export default function AdminSettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails?.role === 'Super Admin') {
            setCurrentUser(userDetails);
          } else {
            toast({ title: "Access Denied", description: "Only Super Admins can access this page.", variant: "destructive" });
            router.push('/');
          }
        } catch (error) {
          console.error("Auth check error:", error);
          toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
          router.push('/');
        }
      } else {
        toast({ title: "Authentication Required", description: "Please log in as a Super Admin.", variant: "destructive" });
        router.push('/');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router, toast]);

  if (isLoading || !currentUser) {
    return (
      <div className="container mx-auto text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">Application Settings</h1>
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Test Welcome Email</CardTitle>
          <CardDescription>Send a sample welcome email to any address to test the template and email delivery. This helps ensure your email settings are configured correctly.</CardDescription>
        </CardHeader>
        <CardContent>
          <SendTestWelcomeEmailFormComponent />
        </CardContent>
      </Card>
    </div>
  );
}
