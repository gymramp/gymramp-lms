
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CreditCard, ShieldCheck, AlertCircle, Layers, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPaymentIntent } from '@/actions/stripe';
import { processPublicSignup } from '@/actions/signup';
import type { Program } from '@/types/course';
import { getProgramById } from '@/lib/firestore-data';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Label } from '@/components/ui/label';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface OrderDetails {
  customerName: string;
  companyName: string;
  adminEmail: string;
  password?: string;
  selectedProgramId: string;
  partnerId: string;
  finalTotalAmountCents: number;
}

function PaymentFormElements({ orderDetails, program }: { orderDetails: OrderDetails, program: Program | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  const handlePaymentSubmit = async () => {
    setPaymentErrorMessage(null);
    setIsProcessingPayment(true);

    if (orderDetails.finalTotalAmountCents > 0) {
      if (!stripe || !elements) {
        setPaymentErrorMessage('Stripe.js has not loaded yet. Please try again.');
        setIsProcessingPayment(false);
        return;
      }
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/onboarding` },
        redirect: 'if_required',
      });

      if (submitError) {
        setPaymentErrorMessage(submitError.message || 'An unexpected error occurred.');
        setIsProcessingPayment(false);
        return;
      }

      if (paymentIntent?.status !== 'succeeded') {
        setPaymentErrorMessage(`Payment status: ${paymentIntent?.status || 'unknown'}. Please try again.`);
        setIsProcessingPayment(false);
        return;
      }
    }

    try {
      const result = await processPublicSignup({
        customerName: orderDetails.customerName,
        companyName: orderDetails.companyName,
        adminEmail: orderDetails.adminEmail,
        password: orderDetails.password || '',
        selectedProgramId: orderDetails.selectedProgramId,
        paymentIntentId: 'pi_placeholder', // This flow doesn't use the ID from Stripe directly yet
        finalTotalAmount: orderDetails.finalTotalAmountCents / 100,
      }, orderDetails.partnerId);

      if (result.success && result.customToken) {
        await signInWithCustomToken(auth, result.customToken);
        toast({ title: "Signup Successful!", description: "Welcome! Your account is ready." });
        router.push('/onboarding');
      } else {
        throw new Error(result.error || "Account creation failed after payment.");
      }
    } catch (processError: any) {
      setPaymentErrorMessage(`Order processing failed: ${processError.message}. Payment may have succeeded, but account setup failed. Please contact support.`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handlePaymentSubmit(); }} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Final Step: Payment</CardTitle>
          <CardDescription>Securely complete your purchase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Order Summary:</h3>
            <p className="text-sm">Brand: {orderDetails.companyName}</p>
            {program && <p className="text-sm flex items-center gap-1"><Layers className="h-4 w-4 text-muted-foreground" /> Program: {program.title}</p>}
            <p className="text-lg font-bold mt-2">Total Due: ${(orderDetails.finalTotalAmountCents / 100).toFixed(2)}</p>
          </div>
          <hr />
          {orderDetails.finalTotalAmountCents > 0 && (
            <>
              <Label>Payment Details</Label>
              <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
            </>
          )}
          {paymentErrorMessage && <p className="text-xs text-destructive mt-2 text-center">{paymentErrorMessage}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isProcessingPayment}>
            {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            {isProcessingPayment ? 'Processing...' : `Pay ${(orderDetails.finalTotalAmountCents / 100).toFixed(2)} & Complete Signup`}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function PartnerSignupPaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadOrderDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = Object.fromEntries(searchParams.entries());
        if (!params.customerName || !params.companyName || !params.adminEmail || !params.password || !params.selectedProgramId || !params.partnerId || !params.finalTotalAmountCents) {
          throw new Error("Required information is missing. Please start the signup process again.");
        }

        const parsedDetails: OrderDetails = {
          ...params,
          finalTotalAmountCents: parseInt(params.finalTotalAmountCents, 10),
        };
        setOrderDetails(parsedDetails);

        const fetchedProgram = await getProgramById(parsedDetails.selectedProgramId);
        if (!fetchedProgram) throw new Error("Selected program not found.");
        setProgram(fetchedProgram);

        if (parsedDetails.finalTotalAmountCents > 0) {
          const paymentIntentResult = await createPaymentIntent(parsedDetails.finalTotalAmountCents);
          if (paymentIntentResult.clientSecret) {
            setClientSecret(paymentIntentResult.clientSecret);
          } else {
            throw new Error(paymentIntentResult.error || "Failed to initialize payment.");
          }
        } else {
          setClientSecret('pi_0_free_checkout'); // Placeholder for $0
        }
      } catch (e: any) {
        setError(e.message || "Failed to load payment details.");
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadOrderDetails();
  }, [searchParams, router, toast]);

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground">Loading payment details...</p></div>;
  }

  if (error || !orderDetails) {
    return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error Loading Payment Page</AlertTitle><AlertDescription>{error || "Order details are missing."}</AlertDescription></Alert></div>;
  }

  const stripeElementsOptions: StripeElementsOptions | undefined =
    orderDetails.finalTotalAmountCents > 0 && clientSecret && clientSecret !== 'pi_0_free_checkout'
      ? { clientSecret, appearance: { theme: 'stripe' } }
      : undefined;

  return (
    <div className="container mx-auto flex flex-col items-center gap-6 py-12">
      <div className="w-full max-w-md">
        {stripeElementsOptions && orderDetails.finalTotalAmountCents > 0 ? (
          <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
            <PaymentFormElements orderDetails={orderDetails} program={program} />
          </Elements>
        ) : orderDetails.finalTotalAmountCents <= 0 ? (
          <PaymentFormElements orderDetails={orderDetails} program={program} />
        ) : (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Payment Error</AlertTitle><AlertDescription>Could not initialize payment form. Please try again.</AlertDescription></Alert>
        )}
      </div>
    </div>
  );
}

export default function PartnerSignupPaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PartnerSignupPaymentPageContent />
    </Suspense>
  );
}
