
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
import { Loader2, CreditCard, User as UserIconLucide, ShieldCheck, AlertCircle, Layers } from 'lucide-react'; // Added Layers
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { processCheckout } from '@/app/actions/checkout'; // Corrected import
import { createPaymentIntent } from '@/actions/stripe';
import type { CheckoutFormData, RevenueSharePartner } from '@/types/user'; // Import RevenueSharePartner
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getProgramById } from '@/lib/firestore-data'; // To fetch program title
import type { Program } from '@/types/course';

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
  revenueSharePartners?: RevenueSharePartner[]; // Updated
  selectedProgramId: string; // Changed from selectedCourseIds
  maxUsers?: number | null;
  finalTotalAmountCents: number;
  subtotalAmount: number;
  appliedDiscountPercent: number;
  appliedDiscountAmount: number;
}

function PaymentFormElements({ orderDetails, programTitle }: { orderDetails: OrderDetails, programTitle?: string }) {
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
          return_url: `${window.location.origin}/admin/checkout/success`, // Keep or adjust as needed
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
      paymentIntentId = 'pi_0_free_checkout'; // Placeholder for $0 checkouts
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
        password: formData.adminPassword,
        paymentIntentId: paymentIntentId,
        subtotalAmount: orderDetails.subtotalAmount,
        appliedDiscountPercent: orderDetails.appliedDiscountPercent,
        appliedDiscountAmount: orderDetails.appliedDiscountAmount,
        finalTotalAmount: orderDetails.finalTotalAmountCents / 100,
      };

      const result = await processCheckout(checkoutData);

      if (result.success) {
        toast({ title: "Checkout Complete!", description: `Brand "${orderDetails.companyName}" and admin user created.` });
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
              <p className="text-sm">Brand: {orderDetails.companyName}</p>
              <p className="text-sm">Admin Email: {orderDetails.adminEmail}</p>
              {programTitle && <p className="text-sm flex items-center gap-1"><Layers className="h-4 w-4 text-muted-foreground" /> Program: {programTitle}</p>}
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
  const [programTitle, setProgramTitle] = useState<string | undefined>(undefined);
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
                // Decide if this is a critical error or if you can proceed without it
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

        // Fetch program title
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
           // Handle $0 amount - no payment intent needed, or use a placeholder
          setClientSecret('pi_0_free_checkout'); // Use the placeholder for $0 checkouts
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

  const stripeElementsOptions: StripeElementsOptions | undefined =
    orderDetails.finalTotalAmountCents > 0 && clientSecret && clientSecret !== 'pi_0_free_checkout'
      ? { clientSecret, appearance: { theme: 'stripe' } }
      : undefined;

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20 flex justify-center">
      {/* Conditionally render Elements only if a payment is required and clientSecret is valid */}
      {orderDetails.finalTotalAmountCents > 0 && clientSecret && clientSecret !== 'pi_0_free_checkout' && stripeElementsOptions ? (
        <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
          <PaymentFormElements orderDetails={orderDetails} programTitle={programTitle} />
        </Elements>
      ) : orderDetails.finalTotalAmountCents <= 0 ? ( // If amount is $0, render form without Elements
        <PaymentFormElements orderDetails={orderDetails} programTitle={programTitle} />
      ) : ( // If there's an issue with clientSecret for a positive amount
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Initialization Error</AlertTitle>
          <AlertDescription>Could not initialize payment form for a non-zero amount. Please try again or contact support.</AlertDescription>
        </Alert>
      )}
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
