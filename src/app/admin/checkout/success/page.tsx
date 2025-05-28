
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

// This page might be used if Stripe redirects back after payment confirmation,
// though the current implementation handles the result directly.
export default function CheckoutSuccessPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <CardTitle className="text-2xl font-bold text-primary">Payment Successful!</CardTitle>
          <CardDescription className="text-muted-foreground">
            The payment was processed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            If the checkout process was initiated from the admin panel, the account setup should be complete.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
             <Button asChild variant="outline">
                <Link href="/admin/checkout">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Checkout
                 </Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/admin/companies">
                    View Brands
                 </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    