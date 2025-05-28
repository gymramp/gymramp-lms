
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <CardTitle className="text-2xl font-bold text-primary">Checkout Cancelled</CardTitle>
          <CardDescription className="text-muted-foreground">
            The payment process was cancelled. No charge was made.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            You can return to the checkout page to try again.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
             <Button asChild variant="outline">
                <Link href="/admin/checkout">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Checkout
                 </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    