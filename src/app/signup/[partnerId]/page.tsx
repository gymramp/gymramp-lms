
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Layers, BookOpen, Handshake, CreditCard, ShieldCheck, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllPrograms, getCourseById, getAllCourses } from '@/lib/firestore-data';
import { processCheckout } from '@/actions/checkout';
import { createPaymentIntent } from '@/actions/stripe';
import type { Partner } from '@/types/partner';
import { getPartnerById } from '@/lib/partner-data';
import type { Program, Course } from '@/types/course';
import type { RevenueSharePartner } from '@/types/user';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import Image from 'next/image';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const partnerSignupFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Your name is required.' }),
  companyName: z.string().min(2, { message: 'Your brand/company name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  selectedProgramId: z.string().min(1, "Please select a Program to purchase."),
  couponCode: z.string().optional(),
});
type PartnerSignupFormValues = z.infer<typeof partnerSignupFormSchema>;

function PartnerCheckoutForm({ partner, programs, clientSecret }: { partner: Partner, programs: Program[], clientSecret: string | null }) {
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  const form = useForm<PartnerSignupFormValues>({
    resolver: zodResolver(partnerSignupFormSchema),
    defaultValues: {
      customerName: '', companyName: '', adminEmail: '',
      selectedProgramId: programs.length === 1 ? programs[0].id : '',
      couponCode: '',
    },
  });

  const selectedProgramId = form.watch('selectedProgramId');
  const couponCodeInput = form.watch('couponCode');
  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const basePrice = selectedProgram ? parseFloat(selectedProgram.price.replace(/[$,/mo]/gi, '')) : 0;

  useEffect(() => {
    let newFinalTotal = basePrice;
    let newDiscountAmount = 0;
    if (partner.couponCode && couponCodeInput?.toLowerCase() === partner.couponCode.toLowerCase() && partner.discountPercentage) {
      newDiscountAmount = (basePrice * partner.discountPercentage) / 100;
      newFinalTotal = basePrice - newDiscountAmount;
      setAppliedCoupon(partner.couponCode);
    } else {
      setAppliedCoupon(null);
    }
    setFinalTotal(newFinalTotal);
    setDiscountAmount(newDiscountAmount);
  }, [basePrice, couponCodeInput, partner]);


  const handleSignupSubmit = async (data: PartnerSignupFormValues) => {
    setIsProcessing(true);
    setPaymentErrorMessage(null);
    if (!stripe || !elements) {
      setPaymentErrorMessage("Payment gateway is not ready. Please wait a moment.");
      setIsProcessing(false);
      return;
    }

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setPaymentErrorMessage(submitError.message || "An unexpected error occurred during payment.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      toast({ title: "Payment Successful!", description: "Finalizing your account setup..." });
      
      const revenueSharePartner: RevenueSharePartner = {
        name: partner.name,
        companyName: partner.companyName,
        percentage: partner.percentage,
        shareBasis: 'coursePrice' // Assuming partner share is always on the initial price
      };

      const result = await processCheckout({
        ...data,
        paymentIntentId: paymentIntent.id,
        subtotalAmount: basePrice,
        appliedDiscountPercent: appliedCoupon ? partner.discountPercentage : 0,
        appliedDiscountAmount: discountAmount,
        finalTotalAmount: finalTotal,
        partnerId: partner.id,
        revenueSharePartners: [revenueSharePartner],
      });

      if (result.success && result.tempPassword) {
        toast({
          title: "Account Created!",
          description: "Your account is ready. You will receive a welcome email with your temporary password shortly.",
          duration: 10000,
        });
        form.reset();
      } else {
        setPaymentErrorMessage(`Account setup failed after payment: ${result.error}. Please contact support.`);
      }
    } else {
      setPaymentErrorMessage(`Payment status: ${paymentIntent?.status}. Please try again.`);
    }

    setIsProcessing(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader className="text-center">
        {partner.logoUrl ? (
            <div className="relative h-20 w-full mb-4">
                <Image
                    src={partner.logoUrl}
                    alt={`${partner.name} Logo`}
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                />
            </div>
        ) : (
            <Handshake className="h-12 w-12 mx-auto text-primary mb-4" />
        )}
        <CardTitle className="text-2xl font-bold">Sign Up to access GYMRAMP in association with {partner.name}</CardTitle>
        <CardDescription>Select a program and create your account to get started.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSignupSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem><FormLabel>Your Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Jane Smith" /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Your Company/Brand Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Jane's Gym" /></FormControl><FormMessage /></FormItem> )} />
            </div>
            <FormField control={form.control} name="adminEmail" render={({ field }) => ( <FormItem><FormLabel>Your Email (for login)</FormLabel><FormControl><Input {...field} type="email" placeholder="you@example.com" /></FormControl><FormMessage /></FormItem> )} />
            
            <FormField control={form.control} name="selectedProgramId" render={({ field }) => (
              <FormItem><FormLabel>Select Program</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Choose a Program..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.title} - ${parseFloat(p.price.replace(/[$,/mo]/gi, '')).toFixed(2)}</SelectItem>)}
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />

             {partner.couponCode && (
              <FormField control={form.control} name="couponCode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Tag className="h-4 w-4"/>Coupon Code (Optional)</FormLabel>
                  <FormControl><Input {...field} placeholder="Enter partner coupon code" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedProgram && (
              <Alert>
                <Layers className="h-4 w-4" />
                <AlertTitle>Order Summary</AlertTitle>
                <div className="space-y-1 mt-2 text-sm">
                  <div className="flex justify-between"><span>Base Price:</span> <span>${basePrice.toFixed(2)}</span></div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({partner.discountPercentage}%):</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2"><span>Total:</span> <span>${finalTotal.toFixed(2)}</span></div>
                </div>
              </Alert>
            )}

            {clientSecret && elements && (
                <div>
                    <Label className="text-base font-semibold">Payment Details</Label>
                    <PaymentElement id="payment-element" options={{ layout: "tabs" }} className="mt-2" />
                </div>
            )}
            {paymentErrorMessage && <p className="text-sm font-medium text-destructive">{paymentErrorMessage}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isProcessing || !stripe || !elements}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Processing Payment...' : `Sign Up & Pay $${finalTotal.toFixed(2)}`}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function PartnerSignupPage() {
  const params = useParams();
  const partnerId = params.partnerId as string;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createAndSetPaymentIntent = useCallback(async (programsData: Program[]) => {
    const firstPricedProgram = programsData.find(p => parseFloat(p.price.replace(/[$,/mo]/gi, '')) > 0);
    if (!firstPricedProgram) {
        throw new Error("No programs with a valid price found.");
    }
    const amountInCents = Math.round(parseFloat(firstPricedProgram.price.replace(/[$,/mo]/gi, '')) * 100);
    const piResult = await createPaymentIntent(amountInCents);
    if (piResult.clientSecret) {
        setClientSecret(piResult.clientSecret);
    } else {
        throw new Error(piResult.error || "Failed to initialize payment.");
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        if (!partnerId) throw new Error("Partner ID is missing.");
        
        const [partnerData, programsData] = await Promise.all([
          getPartnerById(partnerId),
          getAllPrograms()
        ]);

        if (!partnerData) throw new Error("This partner link is not valid.");
        if (programsData.length === 0) throw new Error("No programs are available for purchase at this time.");

        setPartner(partnerData);
        setPrograms(programsData);
        
        await createAndSetPaymentIntent(programsData);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [partnerId, createAndSetPaymentIntent]);

  if (isLoading) {
    return <div className="container mx-auto text-center py-20"><Loader2 className="h-12 w-12 animate-spin mx-auto" /></div>;
  }
  if (error) {
    return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;
  }
  if (!partner || !clientSecret) {
      return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertTitle>Initialization Error</AlertTitle><AlertDescription>Could not initialize the checkout page. Please try again later.</AlertDescription></Alert></div>;
  }

  const stripeElementsOptions: StripeElementsOptions = { clientSecret, appearance: { theme: 'stripe' } };

  return (
    <div className="container mx-auto py-12">
      <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
        <PartnerCheckoutForm partner={partner} programs={programs} clientSecret={clientSecret}/>
      </Elements>
    </div>
  );
}
