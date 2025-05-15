
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CreditCard, User as UserIconLucide, ShieldCheck, AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { processCheckout } from '@/actions/checkout';
import { createPaymentIntent } from '@/actions/stripe';
import type { CheckoutFormData } from '@/types/user';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // Added this line

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const paymentFormSchema = z.object({
  adminPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface OrderDetails {
  customerName: string;
  companyName: string;
  adminEmail: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  revSharePartnerName?: string;
  revSharePartnerCompany?: string;
  revSharePartnerPercentage?: number | null;
  selectedCourseIds: string[];
  maxUsers?: number | null;
  finalTotalAmountCents: number;
  subtotalAmount: number;
  appliedDiscountPercent: number;
  appliedDiscountAmount: number;
}

function PaymentFormElements({ orderDetails }: { orderDetails: OrderDetails }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { adminPassword: '' },
  });

  const handlePaymentSubmit = async (formData: PaymentFormValues) => {
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
          // return_url is not strictly needed here if we handle result on this page
          return_url: `${window.location.origin}/admin/checkout/success`, // Or a specific success page
        },
        redirect: 'if_required', // Handle result on this page
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
        // This case should ideally not be reached if redirect: 'if_required' and no error
        setPaymentErrorMessage('Payment intent not confirmed. Please try again.');
        setIsProcessingPayment(false);
        return;
      }
    } else {
      // Amount is $0, skip Stripe payment
      toast({ title: "No Payment Required", description: "Order total is $0.00." });
    }

    // Proceed to create company and user
    try {
      const checkoutData: CheckoutFormData = {
        ...orderDetails,
        password: formData.adminPassword,
        paymentIntentId: paymentIntentId,
        // Ensure amounts are passed correctly if needed by processCheckout
        subtotalAmount: orderDetails.subtotalAmount,
        appliedDiscountPercent: orderDetails.appliedDiscountPercent,
        appliedDiscountAmount: orderDetails.appliedDiscountAmount,
        finalTotalAmount: orderDetails.finalTotalAmountCents / 100,
      };

      const result = await processCheckout(checkoutData);

      if (result.success) {
        toast({ title: "Checkout Complete!", description: `Company "${orderDetails.companyName}" and admin user created.` });
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
    <Form {...paymentForm}>
      <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Step 2: Payment & Admin Password</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">Order Summary:</h3>
              <p className="text-sm">Company: {orderDetails.companyName}</p>
              <p className="text-sm">Admin Email: {orderDetails.adminEmail}</p>
              <p className="text-sm">Courses: {orderDetails.selectedCourseIds.length}</p>
              <p className="text-lg font-bold mt-2">Total Due: ${(orderDetails.finalTotalAmountCents / 100).toFixed(2)}</p>
            </div>
            <hr/>
            <FormField
              control={paymentForm.control}
              name="adminPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> New Admin Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} placeholder="Enter a secure password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
    </Form>
  );
}

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadOrderDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const customerName = searchParams.get('customerName');
        const companyName = searchParams.get('companyName');
        const adminEmail = searchParams.get('adminEmail');
        const selectedCourseIdsString = searchParams.get('selectedCourseIds');
        const finalTotalAmountCentsString = searchParams.get('finalTotalAmountCents');

        if (!customerName || !companyName || !adminEmail || !selectedCourseIdsString || !finalTotalAmountCentsString) {
          throw new Error("Required checkout information is missing from URL.");
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
          revSharePartnerName: searchParams.get('revSharePartnerName') || undefined,
          revSharePartnerCompany: searchParams.get('revSharePartnerCompany') || undefined,
          revSharePartnerPercentage: searchParams.has('revSharePartnerPercentage') ? parseFloat(searchParams.get('revSharePartnerPercentage')!) : null,
          selectedCourseIds: selectedCourseIdsString.split(','),
          maxUsers: searchParams.has('maxUsers') ? parseInt(searchParams.get('maxUsers')!) : null,
          finalTotalAmountCents: parseInt(finalTotalAmountCentsString),
          subtotalAmount: parseFloat(searchParams.get('subtotalAmount') || '0'),
          appliedDiscountPercent: parseFloat(searchParams.get('appliedDiscountPercent') || '0'),
          appliedDiscountAmount: parseFloat(searchParams.get('appliedDiscountAmount') || '0'),
        };
        setOrderDetails(parsedDetails);

        if (parsedDetails.finalTotalAmountCents > 0) {
          const paymentIntentResult = await createPaymentIntent(parsedDetails.finalTotalAmountCents);
          if (paymentIntentResult.clientSecret) {
            setClientSecret(paymentIntentResult.clientSecret);
          } else {
            throw new Error(paymentIntentResult.error || "Failed to initialize payment.");
          }
        } else {
          // Amount is $0, no client secret needed
          setClientSecret(null);
        }
      } catch (e: any) {
        console.error("Error loading payment page:", e);
        setError(e.message || "Failed to load payment details.");
        toast({ title: "Error", description: e.message, variant: "destructive" });
        // Optionally redirect back or show error prominently
        // router.push('/admin/checkout'); 
      } finally {
        setIsLoading(false);
      }
    };
    loadOrderDetails();
  }, [searchParams, router, toast]);

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
      <div className="container mx-auto py-12 text-center">
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

  // Options for Stripe Elements, initialized when clientSecret is available or not needed
  const stripeElementsOptions: StripeElementsOptions | undefined = 
    orderDetails.finalTotalAmountCents > 0 && clientSecret 
      ? { clientSecret, appearance: { theme: 'stripe' } } 
      : undefined;

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20 flex justify-center">
      {orderDetails.finalTotalAmountCents > 0 && clientSecret && stripeElementsOptions ? (
        <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
          <PaymentFormElements orderDetails={orderDetails} />
        </Elements>
      ) : orderDetails.finalTotalAmountCents <= 0 ? (
        // Render form for $0 amount (no Stripe PaymentElement needed)
        <PaymentFormElements orderDetails={orderDetails} />
      ) : (
        // Case where amount > 0 but clientSecret failed (should be caught by error state ideally)
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Initialization Error</AlertTitle>
          <AlertDescription>Could not initialize payment form. Please try again or contact support.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}


export default function AdminCheckoutPaymentPage() {
  // Using Suspense to ensure useSearchParams is used correctly
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PaymentPageContent />
    </Suspense>
  );
}

    