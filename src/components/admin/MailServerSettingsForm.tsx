'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { testSmtpConnection } from '@/actions/settings'; // Import the test action
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info } from 'lucide-react';

// Zod schema (remains useful for reference/potential future validation)
const mailSettingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().email("Invalid 'From' email address.").optional(),
  smtpSecure: z.boolean().default(true),
});

type MailSettingsFormValues = z.infer<typeof mailSettingsSchema>;

export function MailServerSettingsForm() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<MailSettingsFormValues>({
    resolver: zodResolver(mailSettingsSchema),
    // Initialize with placeholders or empty, as actual values come from env
    defaultValues: {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpFrom: '',
      smtpSecure: true, // Default to true, actual value comes from env
    },
  });

   // Read environment variables on the client-side (for display only)
   // Note: Only NEXT_PUBLIC_ variables are available client-side.
   // The actual connection test happens on the server using the real env vars.
   useEffect(() => {
        // Example: Displaying public env vars if available (not recommended for sensitive data)
        // form.setValue('smtpHost', process.env.NEXT_PUBLIC_SMTP_HOST || ''); // Only if you make it public
        // For display purposes, it's better to just show static placeholders
        // indicating that the values are read from the server environment.
   }, [form]);

  // Handle Test Connection button click
  const handleTestConnection = async () => {
    setIsTesting(true);
    console.log("[MailSettingsForm] Attempting to test SMTP connection (basic auth)...");
    try {
      // This action still tests the basic SMTP configuration from env vars
      const result = await testSmtpConnection();

      if (result.success) {
        toast({
          title: "SMTP Connection Successful!",
          description: result.message || "Basic SMTP server connection verified.",
          variant: "default",
        });
      } else {
        toast({
          title: "SMTP Connection Failed",
          description: result.error || "Could not connect to SMTP server using basic auth. Check environment variables (SMTP_HOST, PORT, USER, PASSWORD) and server logs.",
          variant: "destructive",
          duration: 7000,
        });
      }
    } catch (error: any) {
        console.error("[MailSettingsForm] Error during connection test:", error);
        toast({
            title: "Test Error",
            description: error.message || "An unexpected error occurred while testing the SMTP connection.",
            variant: "destructive",
            duration: 7000,
        });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Form {...form}>
        <Alert variant="default" className="mb-6 border-blue-300 bg-blue-50 dark:bg-blue-900/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">Email Configuration</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400 space-y-2">
               <p>
                Email sending primarily uses Google OAuth 2.0 (recommended). Please configure the following variables in your deployment environment:
                </p>
                <code className="block bg-blue-100 dark:bg-blue-800/50 p-2 rounded text-xs">
                    SMTP_USER=your-gmail-address@gmail.com<br />
                    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID<br />
                    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET<br />
                    GOOGLE_REDIRECT_URI=YOUR_GOOGLE_REDIRECT_URI<br />
                    GOOGLE_REFRESH_TOKEN=YOUR_GOOGLE_REFRESH_TOKEN<br />
                    SMTP_FROM="Your App Name &lt;your-gmail-address@gmail.com&gt;"
                </code>
                <p className="text-xs">
                Basic SMTP settings below are for reference or testing basic connectivity only. The "Test Connection" button uses the SMTP_HOST, PORT, USER, PASSWORD, and SECURE variables.
                </p>
            </AlertDescription>
        </Alert>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6"> {/* Prevent default form submission */}
        {/* Basic SMTP Fields (read-only placeholders) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <FormField control={form.control} name="smtpHost" render={({ field }) => (
                <FormItem>
                  <FormLabel>SMTP Host (for basic test)</FormLabel>
                  <FormControl><Input placeholder="Set SMTP_HOST in env" {...field} readOnly disabled /></FormControl>
                  <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="smtpPort" render={({ field }) => (
                <FormItem>
                  <FormLabel>SMTP Port (for basic test)</FormLabel>
                  <FormControl><Input type="number" placeholder="Set SMTP_PORT in env" {...field} readOnly disabled /></FormControl>
                  <FormMessage />
                </FormItem>
            )} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="smtpUser" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username (SMTP_USER)</FormLabel>
                  <FormControl><Input placeholder="Set SMTP_USER in env" {...field} readOnly disabled /></FormControl>
                  <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="smtpPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password (SMTP_PASSWORD)</FormLabel>
                  <FormControl><Input type="text" placeholder="Set SMTP_PASSWORD in env" readOnly disabled /></FormControl>
                  <FormMessage />
                </FormItem>
            )} />
        </div>
         <FormField control={form.control} name="smtpFrom" render={({ field }) => (
            <FormItem>
              <FormLabel>From Email (SMTP_FROM)</FormLabel>
              <FormControl><Input type="email" placeholder="Set SMTP_FROM in env" {...field} readOnly disabled /></FormControl>
              <FormMessage />
            </FormItem>
        )} />
        <FormField
            control={form.control}
            name="smtpSecure"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                 <div className="space-y-0.5">
                    <FormLabel>Use Secure (SMTP_SECURE)</FormLabel>
                     <p className="text-xs text-muted-foreground">
                        Should be 'true' for TLS/SSL (recommended).
                     </p>
                  </div>
                 <FormControl>
                    <Switch checked={true} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
             )}
        />

        <div className="flex justify-end gap-2 pt-4">
           {/* Test Connection Button (Tests Basic SMTP) */}
           <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isTesting ? 'Testing...' : 'Test SMTP Connection'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
