// src/app/account/security/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth, googleAuthProvider } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail, linkWithPopup, type UserInfo } from 'firebase/auth';
import { KeyRound, Loader2, CheckCircle } from 'lucide-react';

export default function AccountSecurityPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails) {
            setCurrentUser(userDetails);
            const googleProvider = firebaseUser.providerData.find(p => p.providerId === 'google.com');
            setIsGoogleLinked(!!googleProvider);
          } else {
            toast({ title: "Error", description: "Could not load profile.", variant: "destructive" });
          }
        } catch (error) {
           toast({ title: "Error", description: "Failed to load profile.", variant: "destructive" });
        } finally {
           setIsLoading(false);
        }
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  const handlePasswordReset = async () => {
    if (currentUser?.email) {
      try {
        await sendPasswordResetEmail(auth, currentUser.email);
        toast({
          title: "Password Reset Email Sent",
          description: "Check your inbox for instructions to reset your password.",
        });
      } catch (error: any) {
        toast({
          title: "Error Sending Reset Email",
          description: error.message || "Could not send password reset email.",
          variant: "destructive",
        });
      }
    }
  };

  const handleLinkGoogle = async () => {
    if (!auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to link an account.", variant: "destructive" });
      return;
    }
    setIsLinking(true);
    try {
      await linkWithPopup(auth.currentUser, googleAuthProvider);
      toast({ title: "Success!", description: "Your Google account has been successfully linked." });
      setIsGoogleLinked(true);
    } catch (error: any) {
      let description = "An unexpected error occurred.";
      if (error.code === 'auth/credential-already-in-use') {
        description = "This Google account is already linked to another user's account.";
      }
      toast({ title: "Linking Failed", description, variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  };
  
  if (isLoading) {
      return (
          <div className="space-y-6">
              <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-10 w-48" /></CardContent></Card>
              <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Password</CardTitle>
          <CardDescription>
            Change your password or request a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handlePasswordReset}>
            <KeyRound className="mr-2 h-4 w-4" /> Send Password Reset Email
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Linked Accounts</CardTitle>
          <CardDescription>
            Connect your social accounts for a seamless sign-in experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isGoogleLinked ? (
             <Button variant="outline" disabled className="w-full justify-start cursor-default">
              <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.4 56.2L364.6 120C324.4 86.6 289.4 68 248 68c-106 0-192 86-192 192s86 192 192 192c109.7 0 160.1-75.7 162.7-114.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Google Account Linked
              <CheckCircle className="ml-auto h-5 w-5 text-green-500" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleLinkGoogle} disabled={isLinking} className="w-full">
              {isLinking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.4 56.2L364.6 120C324.4 86.6 289.4 68 248 68c-106 0-192 86-192 192s86 192 192 192c109.7 0 160.1-75.7 162.7-114.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
              )}
              Link Google Account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
