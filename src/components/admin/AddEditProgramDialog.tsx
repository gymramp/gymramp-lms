
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Program, ProgramFormData } from '@/types/course';
import { useToast } from '@/hooks/use-toast';
import { createProgram, updateProgram } from '@/lib/firestore-data';
import { Loader2, DollarSign, Star } from 'lucide-react';

const programFormSchema = z.object({
  title: z.string().min(3, { message: 'Program title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  isStandardSubscription: z.boolean().default(false),
  standardSubscriptionPrice: z.string().optional().or(z.literal('')),
  stripeStandardPriceId: z.string().optional().or(z.literal('')),
  price: z.string().optional().or(z.literal('')),
  firstSubscriptionPrice: z.string().optional().or(z.literal('')),
  stripeFirstPriceId: z.string().optional().or(z.literal('')),
  secondSubscriptionPrice: z.string().optional().or(z.literal('')),
  stripeSecondPriceId: z.string().optional().or(z.literal('')),
}).refine(data => {
  if (data.isStandardSubscription) {
    return /^\$?\d+(\.\d{1,2})?(\/(mo|month))?$/i.test(data.standardSubscriptionPrice || '');
  }
  return true;
}, {
  message: 'Valid price format required (e.g., $29/mo or 29.99).',
  path: ['standardSubscriptionPrice'],
}).refine(data => {
  if (!data.isStandardSubscription) {
    return /^\$?\d+(\.\d{1,2})?$/.test(data.price || '');
  }
  return true;
}, {
  message: 'Valid one-time price required (e.g., $199 or 199.99).',
  path: ['price'],
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

interface AddEditProgramDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Program | null;
  onSave: (program: Program) => void;
}

export function AddEditProgramDialog({ isOpen, setIsOpen, initialData, onSave }: AddEditProgramDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      title: '',
      description: '',
      isStandardSubscription: false,
      standardSubscriptionPrice: '',
      stripeStandardPriceId: '',
      price: '',
      firstSubscriptionPrice: '',
      stripeFirstPriceId: '',
      secondSubscriptionPrice: '',
      stripeSecondPriceId: '',
    },
  });
  
  const isStandardSub = form.watch('isStandardSubscription');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          title: initialData.title || '',
          description: initialData.description || '',
          isStandardSubscription: initialData.isStandardSubscription ?? false,
          standardSubscriptionPrice: initialData.standardSubscriptionPrice || '',
          stripeStandardPriceId: initialData.stripeStandardPriceId || '',
          price: initialData.price || '',
          firstSubscriptionPrice: initialData.firstSubscriptionPrice || '',
          stripeFirstPriceId: initialData.stripeFirstPriceId || '',
          secondSubscriptionPrice: initialData.secondSubscriptionPrice || '',
          stripeSecondPriceId: initialData.stripeSecondPriceId || '',
        });
      } else {
        form.reset({
            title: '', description: '', isStandardSubscription: false,
            standardSubscriptionPrice: '', stripeStandardPriceId: '',
            price: '', firstSubscriptionPrice: '', stripeFirstPriceId: '',
            secondSubscriptionPrice: '', stripeSecondPriceId: ''
        });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: ProgramFormValues) => {
    setIsSaving(true);
    try {
      let savedProgram: Program | null = null;
      const programData: ProgramFormData = {
        title: data.title,
        description: data.description,
        isStandardSubscription: data.isStandardSubscription,
        standardSubscriptionPrice: data.isStandardSubscription ? (data.standardSubscriptionPrice || null) : null,
        stripeStandardPriceId: data.isStandardSubscription ? (data.stripeStandardPriceId || null) : null,
        price: !data.isStandardSubscription ? (data.price || null) : null,
        firstSubscriptionPrice: !data.isStandardSubscription ? (data.firstSubscriptionPrice || null) : null,
        stripeFirstPriceId: !data.isStandardSubscription ? (data.stripeFirstPriceId || null) : null,
        secondSubscriptionPrice: !data.isStandardSubscription ? (data.secondSubscriptionPrice || null) : null,
        stripeSecondPriceId: !data.isStandardSubscription ? (data.stripeSecondPriceId || null) : null,
      };

      if (isEditing && initialData) {
        savedProgram = await updateProgram(initialData.id, programData);
      } else {
        savedProgram = await createProgram(programData);
      }

      if (savedProgram) {
        toast({ title: isEditing ? 'Program Updated' : 'Program Added', description: `"${savedProgram.title}" has been successfully saved.` });
        onSave(savedProgram);
        handleClose();
      } else {
        throw new Error('Failed to save program.');
      }
    } catch (error: any) {
      toast({ title: 'Error Saving Program', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Program' : 'Add Program'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this program.' : 'Enter the details for the new program.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem> <FormLabel>Program Title</FormLabel> <FormControl> <Input placeholder="e.g., Sales Mastery Program" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl> <Textarea rows={3} placeholder="A brief overview of the program..." {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField
              control={form.control}
              name="isStandardSubscription"
              render={({ field }) => (
                <FormItem className="space-y-3 rounded-lg border p-4">
                  <FormLabel>Pricing Model</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => field.onChange(value === 'true')}
                      value={String(field.value)}
                      className="flex flex-col sm:flex-row gap-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0 flex-1">
                        <FormControl><RadioGroupItem value="false" id="model-onetime" /></FormControl>
                        <FormLabel htmlFor="model-onetime" className="font-normal flex items-center gap-1"><DollarSign className="h-4 w-4"/>One-Time + Tiered Sub</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 flex-1">
                        <FormControl><RadioGroupItem value="true" id="model-standard" /></FormControl>
                        <FormLabel htmlFor="model-standard" className="font-normal flex items-center gap-1"><Star className="h-4 w-4"/>Standard Subscription</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {isStandardSub ? (
              <div className="space-y-4 p-4 border rounded-md border-primary/20">
                 <FormField control={form.control} name="standardSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>Standard Subscription Price</FormLabel><FormControl><Input placeholder="e.g., $49/mo or 49.99" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="stripeStandardPriceId" render={({ field }) => ( <FormItem><FormLabel>Stripe Price ID</FormLabel><FormControl><Input placeholder="e.g., price_1L2X..." {...field} value={field.value ?? ''}/></FormControl><p className="text-xs text-muted-foreground">Optional. From your Stripe Dashboard.</p><FormMessage /></FormItem> )}/>
              </div>
            ) : (
              <div className="space-y-4 p-4 border rounded-md">
                <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>One-time Base Price</FormLabel><FormControl><Input placeholder="e.g., $499 or 499.99" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="firstSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>First Subscription Price (Months 4-12, Optional)</FormLabel><FormControl><Input placeholder="e.g., $29/mo or 29.99" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="stripeFirstPriceId" render={({ field }) => ( <FormItem><FormLabel>Stripe Price ID (First Tier)</FormLabel><FormControl><Input placeholder="e.g., price_1L2X..." {...field} value={field.value ?? ''}/></FormControl><p className="text-xs text-muted-foreground">Optional. From your Stripe Dashboard.</p><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="secondSubscriptionPrice" render={({ field }) => ( <FormItem><FormLabel>Second Subscription Price (Month 13+ onwards, Optional)</FormLabel><FormControl><Input placeholder="e.g., $19/mo or 19.99" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="stripeSecondPriceId" render={({ field }) => ( <FormItem><FormLabel>Stripe Price ID (Second Tier)</FormLabel><FormControl><Input placeholder="e.g., price_1L2Y..." {...field} value={field.value ?? ''}/></FormControl><p className="text-xs text-muted-foreground">Optional. From your Stripe Dashboard.</p><FormMessage /></FormItem> )}/>
              </div>
            )}
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Program'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
