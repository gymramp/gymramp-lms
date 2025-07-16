
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Handshake, User, Building, Eye, EyeOff, Layers, ShoppingCart, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { Partner } from '@/types/partner';
import type { Program } from '@/types/course';
import { getPartnerById } from '@/lib/partner-data';
import { getProgramsByIds } from '@/lib/firestore-data';
import { processPublicSignup } from '@/actions/signup';
import Image from 'next/image';
import Link from 'next/link';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { createPaymentIntent } from '@/actions/stripe';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const partnerSignupFormSchema = z.object({
  customerName: z.string().min(2, { message: "Your name is required." }),
  companyName: z.string().min(2, { message: 'Your company/brand name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  selectedProgramId: z.string().min(1, { message: "Please select a program." }),
});

type PartnerSignupFormValues = z.infer<typeof partnerSignupFormSchema>;

function PartnerSignupForm({ partner, programs, onSuccessfulSignup }: { partner: Partner, programs: Program[], onSuccessfulSignup: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>(programs.length === 1 ? programs[0].id : undefined);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const form = useForm<PartnerSignupFormValues>({
    resolver: zodResolver(partnerSignupFormSchema),
    defaultValues: { customerName: '', companyName: '', adminEmail: '', password: '', selectedProgramId: selectedProgramId || '' },
  });

  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const amountInDollars = selectedProgram?.price ? parseFloat(selectedProgram.price.replace(/[$,]/g, '')) : 0;
  const amountInCents = Math.round(amountInDollars * 100);
  
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (programs.length === 1) {
      form.setValue('selectedProgramId', programs[0].id);
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, form]);
  
  useEffect(() => {
    if (amountInCents > 0) {
      createPaymentIntent(amountInCents).then(res => {
        if (res.clientSecret) {
          setClientSecret(res.clientSecret);
        } else {
          setPaymentError(res.error || "Failed to initialize payment.");
        }
      });
    } else {
        setClientSecret(null); // No payment needed if $0
    }
  }, [amountInCents]);


  const onSubmit = async (data: PartnerSignupFormValues) => {
    setIsSubmitting(true);
    setPaymentError(null);

    let paymentIntentId: string | null = null;

    if (amountInCents > 0) {
        if (!stripe || !elements || !clientSecret) {
            setPaymentError("Payment form is not ready. Please wait a moment and try again.");
            setIsSubmitting(false);
            return;
        }

        const { error: submitError, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/onboarding` },
            redirect: 'if_required',
        });

        if (submitError) {
            setPaymentError(submitError.message || "An unexpected payment error occurred.");
            setIsSubmitting(false);
            return;
        }
        if (paymentIntent?.status !== 'succeeded') {
             setPaymentError(`Payment was not successful. Status: ${paymentIntent?.status}.`);
             setIsSubmitting(false);
             return;
        }
        paymentIntentId = paymentIntent.id;
    }


    try {
      const result = await processPublicSignup({ ...data, paymentIntentId }, partner.id);
      if (result.success && result.customToken) {
        toast({ title: "Account Created!", description: "Welcome! You will be automatically logged in.", duration: 7000 });
        await signInWithCustomToken(auth, result.customToken);
        onSuccessfulSignup(); // Call callback to trigger navigation in parent
      } else {
        toast({ title: "Signup Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "An Error Occurred", description: err.message || "Something went wrong during signup.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem><FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" /> Your Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4" /> Company/Brand Name</FormLabel><FormControl><Input placeholder="e.g., Downtown Fitness" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="adminEmail" render={({ field }) => ( <FormItem><FormLabel>Your Email Address (for login)</FormLabel><FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Create a Password</FormLabel>
                <div className="relative">
                  <FormControl><Input type={showPassword ? 'text' : 'password'} placeholder="Must be at least 8 characters" {...field} /></FormControl>
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2" onClick={() => setShowPassword(p => !p)}><span className="sr-only">{showPassword ? 'Hide' : 'Show'}</span>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                </div><FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="selectedProgramId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4" /> Select Program</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); setSelectedProgramId(value); }} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Choose a program..." /></SelectTrigger></FormControl>
                        <SelectContent>
                            {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.title} - {p.price}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}/>

            {selectedProgram && amountInCents > 0 && (
                <Card className="bg-muted/50 p-4">
                    <CardHeader className="p-0 pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4"/>Payment Details</CardTitle></CardHeader>
                    <CardContent className="p-0">
                       {clientSecret ? <PaymentElement /> : <div className="text-center p-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
                       {paymentError && <p className="text-sm text-destructive mt-2">{paymentError}</p>}
                    </CardContent>
                </Card>
            )}

          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-4">
            <Button type="submit" className="w-full" disabled={isSubmitting || (amountInCents > 0 && !clientSecret)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Processing...' : `Sign Up & Pay $${amountInDollars.toFixed(2)}`}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Already have an account? <Link href="/" className="underline hover:text-primary">Log in here</Link>.</p>
          </CardFooter>
        </form>
      </Form>
  );
}


export default function PartnerSignupPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPartnerData() {
      if (!partnerId) { setError("Partner link is invalid or missing an ID."); setIsLoading(false); return; }
      try {
        const partnerData = await getPartnerById(partnerId);
        if (!partnerData) { setError("This partner link is not valid."); setIsLoading(false); return; }
        setPartner(partnerData);
        if (partnerData.availableProgramIds && partnerData.availableProgramIds.length > 0) {
            const programsData = await getProgramsByIds(partnerData.availableProgramIds);
            setPrograms(programsData);
        } else {
             setError("This partner has no programs available for purchase.");
        }
      } catch (e: any) {
        setError("Could not retrieve partner information.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPartnerData();
  }, [partnerId]);
  
  const handleSuccessfulSignup = () => {
    router.push('/onboarding');
  }

  if (isLoading) {
    return <div className="container mx-auto text-center py-20"><Loader2 className="h-12 w-12 animate-spin mx-auto" /></div>;
  }

  if (error || !partner) {
    return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error || "Partner not found."}</AlertDescription></Alert></div>;
  }
  
  const amountInCents = programs.length > 0 && programs[0].price ? Math.round(parseFloat(programs[0].price.replace(/[$,]/g, '')) * 100) : 0;
  const options: StripeElementsOptions = {
      mode: 'payment',
      amount: amountInCents,
      currency: 'usd',
      appearance: { theme: 'stripe' },
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <div className="w-full max-w-lg">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
             {partner.logoUrl ? (
                <div className="relative h-16 w-full mb-4">
                    <Image src={partner.logoUrl} alt={`${partner.name} Logo`} fill style={{ objectFit: 'contain' }} priority />
                </div>
            ) : (
                <Handshake className="h-12 w-12 mx-auto text-primary mb-4" />
            )}
            <CardTitle className="text-2xl font-bold">Sign Up via {partner.name}</CardTitle>
            <CardDescription>Create your account and select a program to get started.</CardDescription>
          </CardHeader>
          <Elements stripe={stripePromise} options={options}>
            <PartnerSignupForm partner={partner} programs={programs} onSuccessfulSignup={handleSuccessfulSignup}/>
          </Elements>
        </Card>
      </div>
    </div>
  );
}

