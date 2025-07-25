
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Handshake, User, Building, Eye, EyeOff, Layers, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { Partner } from '@/types/partner';
import type { Program } from '@/types/course';
import { getPartnerById } from '@/lib/partner-data';
import { getProgramsByIds } from '@/lib/firestore-data';
import Image from 'next/image';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const partnerSignupFormSchema = z.object({
  customerName: z.string().min(2, { message: "Your name is required." }),
  companyName: z.string().min(2, { message: 'Your company/brand name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  selectedProgramId: z.string().min(1, { message: "Please select a program." }),
});

type PartnerSignupFormValues = z.infer<typeof partnerSignupFormSchema>;

function PartnerSignupForm({ partner, programs }: { partner: Partner, programs: Program[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PartnerSignupFormValues>({
    resolver: zodResolver(partnerSignupFormSchema),
    defaultValues: {
      customerName: '',
      companyName: '',
      adminEmail: '',
      password: '',
      selectedProgramId: programs.length === 1 ? programs[0].id : '',
    },
  });

  const onSubmit = (data: PartnerSignupFormValues) => {
    setIsSubmitting(true);
    toast({ title: "Information Saved", description: "Proceeding to payment..." });

    const selectedProgram = programs.find(p => p.id === data.selectedProgramId);
    const priceString = selectedProgram?.price?.replace(/[$,/mo]/gi, '') || '0';
    const amountCents = Math.round(parseFloat(priceString) * 100);

    const queryParams = new URLSearchParams({
      ...data,
      partnerId: partner.id,
      finalTotalAmountCents: String(amountCents),
    });

    router.push(`/signup/${partner.id}/payment?${queryParams.toString()}`);
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
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl><SelectTrigger><SelectValue placeholder="Choose a program..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.price})</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Already have an account? <Link href="/" className="underline hover:text-primary">Log in here</Link>.</p>
        </CardFooter>
      </form>
    </Form>
  );
}

export default function PartnerSignupPage() {
  const params = useParams();
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

  if (isLoading) {
    return <div className="container mx-auto text-center py-20"><Loader2 className="h-12 w-12 animate-spin mx-auto" /></div>;
  }

  if (error || !partner) {
    return <div className="container mx-auto text-center py-20"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error || "Partner not found."}</AlertDescription></Alert></div>;
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center">
            <Image
                src="/images/newlogo.png"
                alt="Gymramp Logo"
                width={150}
                height={45}
                priority
            />
        </div>
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
          <PartnerSignupForm partner={partner} programs={programs} />
        </Card>
      </div>
    </div>
  );
}
