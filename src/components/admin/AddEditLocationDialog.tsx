
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
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Location, LocationFormData } from '@/types/user';
import { getCompanyById } from '@/lib/company-data';
import { Skeleton } from '@/components/ui/skeleton';

// Zod schema for form validation (name only for this dialog context)
const locationFormSchema = z.object({
  name: z.string().min(2, { message: 'Location name must be at least 2 characters.' }),
  // Removed companyId from schema as it's handled by the parent page
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

interface AddEditLocationDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Location | null; // Location or null for adding
  onSave: (locationData: { name: string }) => void; // Callback only needs name
}

export function AddEditLocationDialog({ isOpen, setIsOpen, onSave, initialData }: AddEditLocationDialogProps) {
  const isEditing = !!initialData;
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoadingCompanyName, setIsLoadingCompanyName] = useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: '',
      // companyId removed
    },
  });

  // Effect to populate form when initialData changes (for editing)
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          name: initialData.name,
          // companyId removed
        });
        // Fetch company name if editing
        if (initialData.companyId) {
          setIsLoadingCompanyName(true);
          getCompanyById(initialData.companyId)
            .then(company => {
              setCompanyName(company?.name || 'Company Not Found');
            })
            .catch(err => {
              console.error("Error fetching company name:", err);
              setCompanyName('Error Loading Company');
            })
            .finally(() => setIsLoadingCompanyName(false));
        } else {
          setCompanyName('N/A');
        }
      } else {
        // When adding, reset name only
        form.reset({ name: '' });
        setCompanyName(null);
      }
    } else {
      setCompanyName(null);
      setIsLoadingCompanyName(false);
    }
  }, [initialData, form, isOpen]);

  const onSubmit = (data: LocationFormValues) => {
    // Pass only the name back to the parent
    onSave({ name: data.name });
    // Parent component (AdminCompanyLocationsPage) handles the actual API call with companyId
  };

  const handleClose = () => {
    form.reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Location' : 'Add New Location'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the name of this location.' : 'Enter the name for the new location.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Location Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Downtown Branch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Display (Read-only when editing) */}
            {isEditing && initialData && (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  {isLoadingCompanyName ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input value={companyName || 'N/A'} readOnly disabled className="opacity-70" />
                  )}
                </FormControl>
                <p className="text-xs text-muted-foreground">Company cannot be changed after creation.</p>
              </FormItem>
            )}
            {/* If adding, the company context comes from the parent page */}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {isEditing ? 'Save Changes' : 'Add Location'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
