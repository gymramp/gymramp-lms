
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import type { Program, ProgramFormData } from '@/types/course';
import { createProgram, getProgramById, updateProgram } from '@/lib/firestore-data';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Layers, DollarSign, Star } from 'lucide-react';

const programFormSchema = z.object({
  title: z.string().min(3, { message: 'Program title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  isStandardSubscription: z.boolean().default(false),
  standardSubscriptionPrice: z.string().optional().nullable(),
  stripeStandardPriceId: z.string().optional().nullable(),
  price: z.string().optional().nullable(), // One-time price
  firstSubscriptionPrice: z.string().optional().nullable(),
  stripeFirstPriceId: z.string().optional().nullable(),
  secondSubscriptionPrice: z.string().optional().nullable(),
  stripeSecondPriceId: z.string().optional().nullable(),
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

export default function EditProgramPage({ params }: { params: { programId: string } }) {
  const router = useRouter();
  const programId = params.programId;
  const isCreating = programId === 'new';
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(!isCreating);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      title: '',
      description: '',
      isStandardSubscription: false,
    },
  });

  const pricingModel = form.watch('isStandardSubscription');

  const fetchProgramData = useCallback(async () => {
    if (isCreating) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getProgramById(programId);
      if (data) {
        form.reset({
          title: data.title || '',
          description: data.description || '',
          isStandardSubscription: data.isStandardSubscription ?? false,
          standardSubscriptionPrice: data.standardSubscriptionPrice || '',
          stripeStandardPriceId: data.stripeStandardPriceId || '',
          price: data.price || '',
          firstSubscriptionPrice: data.firstSubscriptionPrice || '',
          stripeFirstPriceId: data.stripeFirstPriceId || '',
          secondSubscriptionPrice: data.secondSubscriptionPrice || '',
          stripeSecondPriceId: data.stripeSecondPriceId || '',
        });
      } else {
        toast({ title: "Error", description: "Program not found.", variant: "destructive" });
        router.push('/admin/programs');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load program data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [programId, isCreating, form, router, toast]);

  useEffect(() => {
    fetchProgramData();
  }, [fetchProgramData]);

  const onSubmit = async (data: ProgramFormValues) => {
    setIsSaving(true);
    try {
      const formData: ProgramFormData = {
        title: data.title,
        description: data.description,
        isStandardSubscription: data.isStandardSubscription,
        standardSubscriptionPrice: data.isStandardSubscription ? data.standardSubscriptionPrice : null,
        stripeStandardPriceId: data.isStandardSubscription ? data.stripeStandardPriceId : null,
        price: !data.isStandardSubscription ? data.price : null,
        firstSubscriptionPrice: !data.isStandardSubscription ? data.firstSubscriptionPrice : null,
        stripeFirstPriceId: !data.isStandardSubscription ? data.stripeFirstPriceId : null,
        secondSubscriptionPrice: !data.isStandardSubscription ? data.secondSubscriptionPrice : null,
        stripeSecondPriceId: !data.isStandardSubscription ? data.stripeSecondPriceId : null,
      };

      let savedProgram: Program | null = null;
      if (isCreating) {
        savedProgram = await createProgram(formData);
      } else {
        savedProgram = await updateProgram(programId, formData);
      }

      if (savedProgram) {
        toast({ title: isCreating ? 'Program Created' : 'Program Updated', description: `"${savedProgram.title}" saved successfully.` });
        router.push('/admin/programs');
      } else {
        throw new Error('Failed to save program.');
      }
    } catch (error: any) {
      toast({ title: "Error Saving Program", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/admin/programs')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Programs
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><Layers className="h-6 w-6"/>{isCreating ? 'Create New Program' : 'Edit Program'}</CardTitle>
              <CardDescription>Define the program details and its pricing structure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Program Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem> )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pricing Model</CardTitle><CardDescription>Select how this program will be billed.</CardDescription></CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isStandardSubscription"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => field.onChange(value === 'true')}
                        value={String(field.value)}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <Label htmlFor="one-time-model" className="flex flex-col items-start cursor-pointer rounded-md border border-muted p-4 hover:border-accent has-[:checked]:border-primary">
                           <div className="flex items-center space-x-2">
                             <RadioGroupItem value="false" id="one-time-model" />
                             <span className="font-semibold text-base">One-Time + Tiered Subscription</span>
                           </div>
                           <p className="text-sm text-muted-foreground mt-2 pl-6">Customer pays a one-time fee for the program, with optional tiered monthly subscriptions for continued access.</p>
                        </Label>
                        <Label htmlFor="standard-sub-model" className="flex flex-col items-start cursor-pointer rounded-md border border-muted p-4 hover:border-accent has-[:checked]:border-primary">
                          <div className="flex items-center space-x-2">
                             <RadioGroupItem value="true" id="standard-sub-model" />
                             <span className="font-semibold text-base">Standard Monthly Subscription</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 pl-6">Customer pays a simple, flat monthly fee for access to the program.</p>
                        </Label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {pricingModel ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5"/> Standard Subscription Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="standardSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>Monthly Price</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="$29.99/mo" /></FormControl><FormDescription>e.g., $29.99/mo</FormDescription><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="stripeStandardPriceId" render={({ field }) => ( <FormItem><FormLabel>Stripe Price ID</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="price_..." /></FormControl><FormDescription>The recurring price ID from Stripe.</FormDescription><FormMessage /></FormItem> )} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5"/> One-Time + Tiered Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                    <FormLabel className="text-base font-semibold">One-Time Program Price</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                         <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Base Price</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="$1,200.00" /></FormControl><FormDescription>e.g., $1,200.00</FormDescription><FormMessage /></FormItem> )} />
                    </div>
                </div>
                 <div>
                    <FormLabel className="text-base font-semibold">Optional Tiered Subscriptions</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                        <FormField control={form.control} name="firstSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>Months 4-12 Price</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="$99/mo" /></FormControl><FormDescription>e.g., $99/mo</FormDescription><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="stripeFirstPriceId" render={({ field }) => ( <FormItem><FormLabel>M4-12 Stripe Price ID</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="price_..." /></FormControl><FormDescription>Recurring price ID from Stripe.</FormDescription><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secondSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>Months 13+ Price</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="$49/mo" /></FormControl><FormDescription>e.g., $49/mo</FormDescription><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="stripeSecondPriceId" render={({ field }) => ( <FormItem><FormLabel>M13+ Stripe Price ID</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="price_..." /></FormControl><FormDescription>Recurring price ID from Stripe.</FormDescription><FormMessage /></FormItem> )} />
                    </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? 'Create Program' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
