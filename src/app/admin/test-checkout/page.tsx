
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createTestPaymentIntent } from '@/actions/stripe';
import { getAllCourses } from '@/lib/firestore-data';
import type { Course } from '@/types/course';
import { Loader2, CreditCard, AlertTriangle, BookOpen, Percent } from 'lucide-react';
import { useRouter } from 'next/navigation';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ amountInDollars }: { amountInDollars: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setPaymentStatus(null);

    if (!stripe || !elements) {
      setErrorMessage('Stripe.js has not loaded yet. Please try again in a moment.');
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/admin/test-checkout/result`,
      },
      redirect: 'if_required'
    });

    setIsProcessing(false);

    if (error) {
      console.error('Stripe confirmPayment error:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      toast({
        title: 'Payment Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } else if (paymentIntent) {
      switch (paymentIntent.status) {
        case 'succeeded':
          setPaymentStatus('Payment Succeeded!');
          toast({
            title: 'Payment Succeeded!',
            description: 'Your test payment was successful.',
          });
          router.push(`/admin/test-checkout/result?payment_intent=${paymentIntent.id}&payment_intent_client_secret=${paymentIntent.client_secret}&redirect_status=succeeded`);
          break;
        case 'processing':
          setPaymentStatus('Payment processing. We will update you when payment is complete.');
          toast({
            title: 'Payment Processing',
            description: 'Your payment is being processed.',
          });
          break;
        case 'requires_payment_method':
          setErrorMessage('Payment failed. Please try another payment method.');
          toast({
            title: 'Payment Failed',
            description: 'Payment failed. Please try another payment method.',
            variant: 'destructive',
          });
          break;
        default:
          setErrorMessage('Something went wrong with the payment.');
          toast({
            title: 'Payment Error',
            description: `An unknown payment error occurred. Status: ${paymentIntent.status}`,
            variant: 'destructive',
          });
          break;
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      <Button type="submit" disabled={!stripe || isProcessing || amountInDollars <= 0} className="w-full bg-primary hover:bg-primary/90">
        {isProcessing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        {isProcessing ? 'Processing...' : `Pay $${amountInDollars > 0 ? amountInDollars.toFixed(2) : '0.00'} (Test)`}
      </Button>
      {errorMessage && (
        <div className="text-destructive text-sm text-center p-2 bg-destructive/10 rounded-md">
          {errorMessage}
        </div>
      )}
      {paymentStatus && (
         <div className="text-green-600 text-sm text-center p-2 bg-green-500/10 rounded-md">
          {paymentStatus}
        </div>
      )}
    </form>
  );
}

export default function TestCheckoutPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingSecret, setIsLoadingSecret] = useState(false);
  const [errorSecret, setErrorSecret] = useState<string | null>(null);
  // const [allCourses, setAllCourses] = useState<Course[]>([]); // REMOVED, courses no longer have prices
  // const [isLoadingCourses, setIsLoadingCourses] = useState(true); // REMOVED
  // const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined); // REMOVED
  const { toast } = useToast();

  const [testAmountInput, setTestAmountInput] = useState('1.00'); // Default to $1.00
  const finalTotalAmount = parseFloat(testAmountInput) || 0;

  // REMOVED: useEffect to fetch courses
  // REMOVED: selectedCourse useMemo
  // REMOVED: subtotalInCents useMemo
  // REMOVED: useEffect for discount and finalTotalAmount based on course price

  const fetchClientSecret = useCallback(async (cents: number) => {
    if (cents <= 0) {
        setErrorSecret('Amount must be positive. Cannot initialize payment for $0.00 or less.');
        setClientSecret(null);
        setIsLoadingSecret(false);
        return;
    }
     // createTestPaymentIntent has its own minimum check (e.g. 50 cents)

    setIsLoadingSecret(true);
    setErrorSecret(null);
    setClientSecret(null);
    try {
      const result = await createTestPaymentIntent(cents);
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        setErrorSecret(result.error || 'Failed to fetch payment details.');
        toast({
          title: 'Error Initializing Payment',
          description: result.error || 'Could not retrieve payment details.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setErrorSecret(err.message || 'An unexpected error occurred while fetching payment details.');
      toast({
        title: 'Initialization Error',
        description: err.message || 'Could not initialize the payment form.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSecret(false);
    }
  }, [toast]);

  useEffect(() => {
    const finalAmountInCentsValue = Math.round(finalTotalAmount * 100);
    if (finalAmountInCentsValue > 0) {
        fetchClientSecret(finalAmountInCentsValue);
    } else {
        setErrorSecret('Please enter a valid amount greater than $0.00.');
        setClientSecret(null);
        setIsLoadingSecret(false);
    }
  }, [finalTotalAmount, fetchClientSecret]);


  const options: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance: { theme: 'stripe' } } : undefined;

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20 flex justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Stripe Test Checkout</CardTitle>
          <CardDescription>Enter an amount and test the Stripe Payment Element.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* REMOVED: Course selection UI */}
           <div className="space-y-4 mb-6 border-b pb-4">
            <h3 className="text-md font-semibold text-primary">Test Payment Amount</h3>
            <Label htmlFor="test-amount" className="flex items-center gap-1 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Amount (USD)
            </Label>
            <Input
                id="test-amount"
                type="number"
                placeholder="e.g., 1.00"
                value={testAmountInput}
                onChange={(e) => setTestAmountInput(e.target.value)}
                min="0.50" // Stripe minimum
                step="0.01"
                className="h-9"
            />
            {finalTotalAmount > 0 && (
                <div className="flex justify-between text-lg font-bold text-primary mt-2">
                    <span>Total:</span>
                    <span>${finalTotalAmount.toFixed(2)}</span>
                </div>
            )}
          </div>


          {isLoadingSecret && (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Initializing Payment Form...</p>
            </div>
          )}
          {errorSecret && !isLoadingSecret && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-destructive bg-destructive/10 p-4 rounded-md">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Could not load payment form:</p>
              <p className="text-sm">{errorSecret}</p>
            </div>
          )}
          {!isLoadingSecret && clientSecret && options && finalTotalAmount > 0 && (
            <Elements stripe={stripePromise} options={options} key={clientSecret}>
              <CheckoutForm amountInDollars={finalTotalAmount} />
            </Elements>
          )}
           {!isLoadingSecret && !clientSecret && !errorSecret && (finalTotalAmount <= 0) && (
             <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                Please enter a test amount (min $0.50).
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
    
