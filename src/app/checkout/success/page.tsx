
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { toast } = useToast();

  useEffect(() => {
    // Optionally verify the session ID on the server-side
    // This is a client-side example for simplicity
    if (sessionId) {
      console.log('Checkout successful, session ID:', sessionId);
      toast({
        title: "Payment Successful!",
        description: "Your course purchase is complete.",
        variant: "default", // Use success variant if available, otherwise default
      });

      // TODO: Trigger fulfillment logic here (e.g., grant access to the course)
      // This might involve making an API call with the sessionId or user info
      // to update the user's permissions or assigned courses in your database.
      // Example: fulfillOrder(sessionId);
    } else {
        toast({
            title: "Checkout Issue",
            description: "Could not verify payment session. Please contact support if issues persist.",
            variant: "destructive",
        })
    }
  }, [sessionId, toast]);

  return (
    <div className="container py-12 md:py-16 lg:py-20 flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <CardTitle className="text-2xl font-bold text-primary">Thank You!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your payment was successful and the course purchase is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            You should receive an email confirmation shortly. You can now access the course materials.
          </p>
           {sessionId && (
             <p className="text-xs text-muted-foreground">
                Session ID: {sessionId.substring(0, 15)}...
             </p>
           )}
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
             <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/courses/my-courses">
                    <Package className="mr-2 h-4 w-4" /> Go to My Courses
                 </Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/dashboard">
                    Go to Dashboard
                 </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
