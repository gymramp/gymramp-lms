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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Partner, PartnerFormData } from '@/types/partner';
import { useToast } from '@/hooks/use-toast';
import { addPartner, updatePartner } from '@/lib/partner-data';
import { Loader2 } from 'lucide-react';

const partnerFormSchema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  companyName: z.string().optional().or(z.literal('')),
  percentage: z.coerce
    .number({ invalid_type_error: "Percentage must be a number." })
    .min(0.01, "Percentage must be greater than 0.")
    .max(100, "Percentage cannot exceed 100."),
});

type PartnerFormValues = z.infer<typeof partnerFormSchema>;

interface AddEditPartnerDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Partner | null;
  onSave: (partner: Partner) => void;
}

export function AddEditPartnerDialog({ isOpen, setIsOpen, initialData, onSave }: AddEditPartnerDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', email: '', companyName: '', percentage: 0 },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          name: initialData.name || '',
          email: initialData.email || '',
          companyName: initialData.companyName || '',
          percentage: initialData.percentage || 0,
        });
      } else {
        form.reset({ name: '', email: '', companyName: '', percentage: 0 });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: PartnerFormValues) => {
    setIsSaving(true);
    try {
      let savedPartner: Partner | null = null;
      const partnerData: PartnerFormData = {
        name: data.name,
        email: data.email,
        companyName: data.companyName || null,
        percentage: data.percentage,
      };

      if (isEditing && initialData) {
        savedPartner = await updatePartner(initialData.id, partnerData);
      } else {
        savedPartner = await addPartner(partnerData);
      }

      if (savedPartner) {
        toast({ title: isEditing ? 'Partner Updated' : 'Partner Added', description: `"${savedPartner.name}" has been successfully saved.` });
        onSave(savedPartner);
        handleClose();
      } else {
        throw new Error('Failed to save partner.');
      }
    } catch (error: any) {
      toast({ title: 'Error Saving Partner', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Partner' : 'Add New Partner'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for this partner.' : 'Enter the details for the new partner.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Partner Name</FormLabel> <FormControl><Input placeholder="John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Contact Email</FormLabel> <FormControl><Input type="email" placeholder="partner@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Company Name (Optional)</FormLabel> <FormControl><Input placeholder="Partner Co." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="percentage" render={({ field }) => ( <FormItem> <FormLabel>Revenue Share Percentage (%)</FormLabel> <FormControl><Input type="number" min="0.01" max="100" step="0.01" placeholder="e.g., 10" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Partner'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
