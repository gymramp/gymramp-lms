
'use client';

import React, { useEffect, useState, Suspense } from 'react'; // Import Suspense
import { useSearchParams, useRouter } from 'next/navigation';
// import { useStripe } from '@stripe/react-stripe-js'; // Not used directly here
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Renamed original component to TestCheckoutResultPageContent
function TestCheckoutResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); // This hook needs Suspense
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
  const redirectStatus = searchParams.get('redirect_status');


  useEffect(() => {
    if (!paymentIntentClientSecret && !redirectStatus) { // Check if redirectStatus is also missing
      setMessage('Payment details not found or invalid redirect. Please check your transaction history or contact support.');
      setStatus('error');
      setIsLoading(false);
      return;
    }

    switch (redirectStatus) {
      case 'succeeded':
        setMessage('Payment successful! Thank you for your test purchase.');
        setStatus('success');
        break;
      case 'processing':
        setMessage('Payment processing. We will update you when payment is complete.');
        setStatus('processing');
        break;
      case 'requires_payment_method':
        setMessage('Payment failed. Please try another payment method.');
        setStatus('error');
        break;
      default:
        setMessage('Something went wrong with the payment or the status is unknown. Please contact support.');
        setStatus('error');
        break;
    }
    setIsLoading(false);
  }, [paymentIntentClientSecret, redirectStatus]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verifying payment status...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20 flex justify-center">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          {status === 'success' && <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />}
          {status === 'processing' && <Loader2 className="h-16 w-16 mx-auto text-blue-500 animate-spin mb-4" />}
          {status === 'error' && <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />}
          {!status && <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />}

          <CardTitle className="text-2xl font-bold text-primary">
            {status === 'success' && 'Payment Successful'}
            {status === 'processing' && 'Payment Processing'}
            {status === 'error' && 'Payment Failed'}
            {!status && 'Payment Status Unknown'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {message || 'Verifying payment status...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentIntentClientSecret && (
            <p className="text-xs text-muted-foreground break-all">
              Payment Intent (partial for reference): {paymentIntentClientSecret.substring(0,40)}...
            </p>
          )}
          <Button asChild variant="outline">
            <Link href="/admin/test-checkout">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Checkout
            </Link>
          </Button>
          {status === 'success' && (
             <Button asChild>
                <Link href="/admin/dashboard">Go to Dashboard</Link>
             </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// New default export that wraps the content in Suspense
export default function TestCheckoutResultPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading payment result...</p>
      </div>
    }>
      <TestCheckoutResultPageContent />
    </Suspense>
  );
}
