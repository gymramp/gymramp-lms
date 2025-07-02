'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Layers, BookOpen, Handshake, CreditCard, ShieldCheck } from 'lucide-react';
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
});
type PartnerSignupFormValues = z.infer<typeof partnerSignupFormSchema>;

function PartnerCheckoutForm({ partner, programs }: { partner: Partner, programs: Program[] }) {
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  const form = useForm<PartnerSignupFormValues>({
    resolver: zodResolver(partnerSignupFormSchema),
    defaultValues: {
      customerName: '', companyName: '', adminEmail: '',
      selectedProgramId: programs.length === 1 ? programs[0].id : '',
    },
  });

  const selectedProgramId = form.watch('selectedProgramId');
  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const totalAmount = selectedProgram ? parseFloat(selectedProgram.price.replace(/[$,/mo]/gi, '')) : 0;

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
        finalTotalAmount: totalAmount,
        partnerId: partner.id,
        revenueSharePartners: [revenueSharePartner],
      });

      if (result.success && result.tempPassword) {
        toast({
          title: "Account Created!",
          description: "Your account is ready. You will receive a welcome email with your temporary password shortly.",
          duration: 10000,
        });
        // Optionally redirect to a success page or login
        // For now, we can just reset the form and show a message.
        form.reset();
        // Maybe show the password here or just say check email.
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
        <Handshake className="h-12 w-12 mx-auto text-primary mb-4" />
        <CardTitle className="text-2xl font-bold">Sign Up with {partner.name}</CardTitle>
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
                    {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.title} - {p.price}</SelectItem>)}
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />

            {selectedProgram && (
              <Alert>
                <Layers className="h-4 w-4" />
                <AlertTitle>Program Total</AlertTitle>
                <AlertDescription className="font-bold text-lg">${totalAmount.toFixed(2)} (One-time payment)</AlertDescription>
              </Alert>
            )}

            {elements && (
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
              {isProcessing ? 'Processing Payment...' : `Sign Up & Pay $${totalAmount.toFixed(2)}`}
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
        
        // Use the price of the first available program to initialize PaymentIntent
        const initialAmount = parseFloat(programsData[0].price.replace(/[$,/mo]/gi, ''));
        if (isNaN(initialAmount) || initialAmount <= 0) {
            // Find first program with valid price
            const firstPricedProgram = programsData.find(p => parseFloat(p.price.replace(/[$,/mo]/gi, '')) > 0);
            if(firstPricedProgram){
                const firstPrice = parseFloat(firstPricedProgram.price.replace(/[$,/mo]/gi, ''));
                 const piResult = await createPaymentIntent(Math.round(firstPrice * 100));
                 if (piResult.clientSecret) setClientSecret(piResult.clientSecret);
                 else throw new Error(piResult.error || "Failed to initialize payment.");
            } else {
                 throw new Error("No programs with a valid price found.");
            }
        } else {
             const piResult = await createPaymentIntent(Math.round(initialAmount * 100));
             if (piResult.clientSecret) setClientSecret(piResult.clientSecret);
             else throw new Error(piResult.error || "Failed to initialize payment.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [partnerId]);

  if (isLoading) {
    return <div className="container mx-auto text-center py-20"><Loader2 className="h-12 w-12 animate-spin mx-auto" /></div>;
  }
  if (error) {
    return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>;
  }
  if (!partner) return null;

  const stripeElementsOptions: StripeElementsOptions = { clientSecret: clientSecret || '', appearance: { theme: 'stripe' } };

  return (
    <div className="container mx-auto py-12">
      <Elements stripe={stripePromise} options={stripeElementsOptions} key={clientSecret}>
        <PartnerCheckoutForm partner={partner} programs={programs} />
      </Elements>
    </div>
  );
}
