
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
import type { Program, ProgramFormData } from '@/types/course';
import { useToast } from '@/hooks/use-toast';
import { createProgram, updateProgram } from '@/lib/firestore-data';
import { Loader2 } from 'lucide-react';

const programFormSchema = z.object({
  title: z.string().min(3, { message: 'Program title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  price: z.string().regex(/^\$?\d+(\.\d{1,2})?$/, { message: 'Please enter a valid price (e.g., $199 or 199.99).' }),
  firstSubscriptionPrice: z.string().regex(/^\$?\d+(\.\d{1,2})?(\/(mo|month))?$/i, { message: 'Valid format: $29/mo or 29.99' }).optional().or(z.literal('')),
  stripeFirstPriceId: z.string().optional().or(z.literal('')),
  secondSubscriptionPrice: z.string().regex(/^\$?\d+(\.\d{1,2})?(\/(mo|month))?$/i, { message: 'Valid format: $19/mo or 19.99' }).optional().or(z.literal('')),
  stripeSecondPriceId: z.string().optional().or(z.literal('')),
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
      price: '',
      firstSubscriptionPrice: '',
      stripeFirstPriceId: '',
      secondSubscriptionPrice: '',
      stripeSecondPriceId: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          title: initialData.title || '',
          description: initialData.description || '',
          price: initialData.price || '',
          firstSubscriptionPrice: initialData.firstSubscriptionPrice || '',
          stripeFirstPriceId: initialData.stripeFirstPriceId || '',
          secondSubscriptionPrice: initialData.secondSubscriptionPrice || '',
          stripeSecondPriceId: initialData.stripeSecondPriceId || '',
        });
      } else {
        form.reset({ 
            title: '', 
            description: '', 
            price: '', 
            firstSubscriptionPrice: '', 
            stripeFirstPriceId: '',
            secondSubscriptionPrice: '',
            stripeSecondPriceId: '',
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
        price: data.price,
        firstSubscriptionPrice: data.firstSubscriptionPrice || null,
        stripeFirstPriceId: data.stripeFirstPriceId || null,
        secondSubscriptionPrice: data.secondSubscriptionPrice || null,
        stripeSecondPriceId: data.stripeSecondPriceId || null,
      };

      if (isEditing && initialData) {
        savedProgram = await updateProgram(initialData.id, programData);
      } else {
        savedProgram = await createProgram(programData);
      }

      if (savedProgram) {
        toast({
          title: isEditing ? 'Program Updated' : 'Program Added',
          description: `"${savedProgram.title}" has been successfully saved.`,
        });
        onSave(savedProgram);
        handleClose();
      } else {
        throw new Error('Failed to save program.');
      }
    } catch (error: any) {
      toast({
        title: 'Error Saving Program',
        description: error.message || 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

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
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sales Mastery Program" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="A brief overview of the program..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>One-time Base Price</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., $499 or 499.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstSubscriptionPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Subscription Price (Months 4-12, Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., $29/mo or 29.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stripeFirstPriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stripe Price ID (First Subscription Tier)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., price_1L2X..." {...field} value={field.value ?? ''}/>
                  </FormControl>
                   <p className="text-xs text-muted-foreground">Optional. From your Stripe Dashboard.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secondSubscriptionPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Second Subscription Price (Month 13+ onwards, Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., $19/mo or 19.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stripeSecondPriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stripe Price ID (Second Subscription Tier)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., price_1L2Y..." {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Optional. From your Stripe Dashboard.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
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
