
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, updatePassword, signOut } from 'firebase/auth';
import { getUserByEmail, updateUser } from '@/lib/user-data';
import type { User } from '@/types/user';
import { Loader2 } from 'lucide-react';

const passwordResetSchema = z.object({
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters long.' }),
  confirmPassword: z.string().min(6, { message: 'Please confirm your password.' }),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], // Error will be shown on confirmPassword field
});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export default function ForceResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails) {
            if (userDetails.requiresPasswordChange === true) {
              setCurrentUser(userDetails);
            } else {
              // User doesn't need to change password, redirect to their dashboard
              toast({ title: "No Action Needed", description: "Your password does not need to be reset.", variant: "default" });
              router.push(userDetails.role === 'Super Admin' ? '/admin/dashboard' : (userDetails.role === 'Staff' ? '/courses/my-courses' : '/dashboard'));
            }
          } else {
            // No user profile found, redirect to login
            toast({ title: "Error", description: "Could not load user profile.", variant: "destructive" });
            router.push('/');
          }
        } catch (error) {
          toast({ title: "Error", description: "Failed to load user details.", variant: "destructive" });
          router.push('/');
        }
      } else {
        // No Firebase user, redirect to login
        router.push('/');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router, toast]);

  const onSubmit = async (data: PasswordResetFormValues) => {
    if (!auth.currentUser || !currentUser) {
      toast({ title: "Error", description: "No authenticated user found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePassword(auth.currentUser, data.newPassword);
      await updateUser(currentUser.id, { requiresPasswordChange: false });

      toast({
        title: "Password Updated Successfully!",
        description: "Please log in with your new password.",
      });

      await signOut(auth); // Sign out the user
      if (typeof window !== 'undefined') {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
      }
      router.push('/'); // Redirect to login page

    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Password Update Failed",
        description: error.message || "Could not update your password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback or if redirect hasn't happened yet.
    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Redirecting...</p>
        </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Set Your New Password</CardTitle>
          <CardDescription>
            Welcome, {currentUser.name}! For security, please create a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set New Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
