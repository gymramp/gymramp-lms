
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
import { processCheckout } from '@/actions/checkout';
import { createPaymentIntent } from '@/actions/stripe';
import type { CheckoutFormData, RevenueSharePartner } from '@/types/user';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label"; 
import { getProgramById } from '@/lib/firestore-data';
import type { Program } from '@/types/course';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface OrderDetails {
  customerName: string;
  companyName: string;
  adminEmail: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  revenueSharePartners?: RevenueSharePartner[];
  selectedProgramId: string;
  maxUsers?: number | null;
  finalTotalAmountCents: number;
  subtotalAmount: number;
  appliedDiscountPercent: number;
  appliedDiscountAmount: number;
}

function PaymentFormElements({ orderDetails, programTitle, onCheckoutComplete }: { orderDetails: OrderDetails, programTitle?: string, onCheckoutComplete: (password: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  const handlePaymentSubmit = async () => {
    setPaymentErrorMessage(null);
    setIsProcessingPayment(true);

    let paymentIntentId: string | null = null;

    if (orderDetails.finalTotalAmountCents > 0) {
      if (!stripe || !elements) {
        setPaymentErrorMessage('Stripe.js has not loaded yet. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/admin/checkout/success`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        console.error('Stripe confirmPayment error:', submitError);
        setPaymentErrorMessage(submitError.message || 'An unexpected error occurred during payment.');
        toast({ title: 'Payment Failed', description: submitError.message, variant: 'destructive' });
        setIsProcessingPayment(false);
        return;
      }

      if (paymentIntent) {
        if (paymentIntent.status === 'succeeded') {
          paymentIntentId = paymentIntent.id;
          toast({ title: 'Payment Succeeded!', description: `Payment of $${(orderDetails.finalTotalAmountCents / 100).toFixed(2)} was successful.` });
        } else {
          setPaymentErrorMessage(`Payment status: ${paymentIntent.status}. Please try again or contact support.`);
          toast({ title: 'Payment Issue', description: `Payment status: ${paymentIntent.status}`, variant: 'destructive' });
          setIsProcessingPayment(false);
          return;
        }
      } else {
        setPaymentErrorMessage('Payment intent not confirmed. Please try again.');
        setIsProcessingPayment(false);
        return;
      }
    } else {
      toast({ title: "No Payment Required", description: "Order total is $0.00." });
      paymentIntentId = 'pi_0_free_checkout';
    }

    try {
      const checkoutData: CheckoutFormData = {
        customerName: orderDetails.customerName,
        companyName: orderDetails.companyName,
        adminEmail: orderDetails.adminEmail,
        streetAddress: orderDetails.streetAddress,
        city: orderDetails.city,
        state: orderDetails.state,
        zipCode: orderDetails.zipCode,
        country: orderDetails.country,
        revenueSharePartners: orderDetails.revenueSharePartners,
        selectedProgramId: orderDetails.selectedProgramId,
        maxUsers: orderDetails.maxUsers,
        paymentIntentId: paymentIntentId,
        subtotalAmount: orderDetails.subtotalAmount,
        appliedDiscountPercent: orderDetails.appliedDiscountPercent,
        appliedDiscountAmount: orderDetails.appliedDiscountAmount,
        finalTotalAmount: orderDetails.finalTotalAmountCents / 100,
      };

      const result = await processCheckout(checkoutData);

      if (result.success && result.tempPassword) {
        toast({ title: "Checkout Complete!", description: `Brand "${orderDetails.companyName}" and admin user created.` });
        onCheckoutComplete(result.tempPassword); 
        router.push(`/admin/companies/${result.companyId}/edit`);
      } else {
        throw new Error(result.error || "Checkout failed after payment/finalization.");
      }
    } catch (processError: any) {
      setPaymentErrorMessage(`Order processing failed: ${processError.message}. Payment was successful but account setup failed. Please contact support.`);
      toast({ title: "Order Processing Error", description: `Setup failed: ${processError.message}`, variant: "destructive", duration: 10000 });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handlePaymentSubmit(); }} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Step 2: Payment & Account Finalization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Order Summary:</h3>
            <p className="text-sm">Brand: {orderDetails.companyName}</p>
            <p className="text-sm">Admin Email: {orderDetails.adminEmail}</p>
            {programTitle && <p className="text-sm flex items-center gap-1"><Layers className="h-4 w-4 text-muted-foreground" /> Program: {programTitle}</p>}
            <p className="text-lg font-bold mt-2">Total Due: ${(orderDetails.finalTotalAmountCents / 100).toFixed(2)}</p>
          </div>
          <hr/>
          <Alert variant="default" className="border-blue-300 bg-blue-50 dark:bg-blue-900/30">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Admin Password</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                  A temporary password for the new admin user will be auto-generated.
                  The user will be prompted to change this password upon their first login.
                  You will see the temporary password on this page after successful checkout.
              </AlertDescription>
          </Alert>

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
            {isProcessingPayment ? 'Processing...' : `Pay ${(orderDetails.finalTotalAmountCents / 100).toFixed(2)} & Create Account`}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [programTitle, setProgramTitle] = useState<string | undefined>(undefined);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null); 
  const { toast } = useToast();

  useEffect(() => {
    const loadOrderDetails = async () => {
      setIsLoading(true);
      setError(null);
      setGeneratedPassword(null);
      try {
        const customerName = searchParams.get('customerName');
        const companyName = searchParams.get('companyName');
        const adminEmail = searchParams.get('adminEmail');
        const selectedProgramId = searchParams.get('selectedProgramId');
        const finalTotalAmountCentsString = searchParams.get('finalTotalAmountCents');
        const revSharePartnersString = searchParams.get('revenueSharePartners');

        if (!customerName || !companyName || !adminEmail || !selectedProgramId || !finalTotalAmountCentsString) {
          throw new Error("Required checkout information is missing from URL.");
        }

        let parsedRevSharePartners: RevenueSharePartner[] | undefined = undefined;
        if (revSharePartnersString) {
            try {
                parsedRevSharePartners = JSON.parse(revSharePartnersString);
            } catch (parseError) {
                console.error("Error parsing revenue share partners from URL:", parseError);
            }
        }

        const parsedDetails: OrderDetails = {
          customerName,
          companyName,
          adminEmail,
          streetAddress: searchParams.get('streetAddress') || undefined,
          city: searchParams.get('city') || undefined,
          state: searchParams.get('state') || undefined,
          zipCode: searchParams.get('zipCode') || undefined,
          country: searchParams.get('country') || undefined,
          revenueSharePartners: parsedRevSharePartners,
          selectedProgramId,
          maxUsers: searchParams.has('maxUsers') ? parseInt(searchParams.get('maxUsers')!) : null,
          finalTotalAmountCents: parseInt(finalTotalAmountCentsString),
          subtotalAmount: parseFloat(searchParams.get('subtotalAmount') || '0'),
          appliedDiscountPercent: parseFloat(searchParams.get('appliedDiscountPercent') || '0'),
          appliedDiscountAmount: parseFloat(searchParams.get('appliedDiscountAmount') || '0'),
        };
        setOrderDetails(parsedDetails);

        const program = await getProgramById(selectedProgramId);
        setProgramTitle(program?.title);

        if (parsedDetails.finalTotalAmountCents > 0) {
          const paymentIntentResult = await createPaymentIntent(parsedDetails.finalTotalAmountCents);
          if (paymentIntentResult.clientSecret) {
            setClientSecret(paymentIntentResult.clientSecret);
          } else {
            throw new Error(paymentIntentResult.error || "Failed to initialize payment.");
          }
        } else {
          setClientSecret('pi_0_free_checkout'); 
        }
      } catch (e: any) {
        console.error("Error loading payment page:", e);
        setError(e.message || "Failed to load payment details.");
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadOrderDetails();
  }, [searchParams, router, toast]);

  const handleCheckoutCompletion = (password: string) => {
    setGeneratedPassword(password);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading payment details...</p>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="container mx-auto text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Payment Page</AlertTitle>
          <AlertDescription>{error || "Order details are missing."}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/admin/checkout')} variant="link" className="mt-4">
          Go back to checkout setup
        </Button>
      </div>
    );
  }

  const stripeElementsOptions: StripeElementsOptions | undefined =
    orderDetails.finalTotalAmountCents > 0 && clientSecret && clientSecret !== 'pi_0_free_checkout'
      ? { clientSecret, appearance: { theme: 'stripe' } }
      : undefined;

  return (
    <div className="container mx-auto flex flex-col items-center gap-6">
      {generatedPassword && (
        <Alert variant="success" className="max-w-md w-full border-green-300 bg-green-50 dark:bg-green-900/30">
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-300">Account Created Successfully!</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            The new admin user's temporary password is: <strong className="font-bold">{generatedPassword}</strong><br/>
            They will be required to change this on their first login.
          </AlertDescription>
        </Alert>
      )}
      <div className="w-full max-w-md">
        {stripeElementsOptions && orderDetails.finalTotalAmountCents > 0 ? (
          <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
            <PaymentFormElements orderDetails={orderDetails} programTitle={programTitle} onCheckoutComplete={handleCheckoutCompletion} />
          </Elements>
        ) : orderDetails.finalTotalAmountCents <= 0 ? (
          <PaymentFormElements orderDetails={orderDetails} programTitle={programTitle} onCheckoutComplete={handleCheckoutCompletion} />
        ) : (
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Initialization Error</AlertTitle>
            <AlertDescription>Could not initialize payment form for a non-zero amount. Please try again or contact support.</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

export default function AdminCheckoutPaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PaymentPageContent />
    </Suspense>
  );
}

    