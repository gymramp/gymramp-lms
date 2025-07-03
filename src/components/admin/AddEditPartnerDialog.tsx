
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
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
import { Loader2, Upload, ImageIcon as ImageIconLucide, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';

const partnerFormSchema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  companyName: z.string().optional().or(z.literal('')),
  percentage: z.coerce
    .number({ invalid_type_error: "Percentage must be a number." })
    .min(0.01, "Percentage must be greater than 0.")
    .max(100, "Percentage cannot exceed 100."),
  logoUrl: z.string().url().optional().or(z.literal('')),
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', email: '', companyName: '', percentage: 0, logoUrl: '' },
  });
  
  const logoUrlValue = form.watch('logoUrl');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          name: initialData.name || '',
          email: initialData.email || '',
          companyName: initialData.companyName || '',
          percentage: initialData.percentage || 0,
          logoUrl: initialData.logoUrl || '',
        });
      } else {
        form.reset({ name: '', email: '', companyName: '', percentage: 0, logoUrl: '' });
      }
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError(null);
    }
  }, [initialData, form, isOpen]);

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
        const uniqueFileName = `${isEditing ? initialData?.id : Date.now()}-partnerlogo-${file.name}`;
        const storagePath = `${STORAGE_PATHS.PARTNER_LOGOS}/${uniqueFileName}`;
        const downloadURL = await uploadImage(file, storagePath, setUploadProgress);
        form.setValue('logoUrl', downloadURL, { shouldValidate: true });
        toast({ title: "Logo Uploaded" });
    } catch (error: any) {
        setUploadError(error.message || "Failed to upload logo.");
        toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsUploading(false);
    }
  };

  const onSubmit = async (data: PartnerFormValues) => {
    setIsSaving(true);
    try {
      let savedPartner: Partner | null = null;
      const partnerData: PartnerFormData = {
        name: data.name,
        email: data.email,
        companyName: data.companyName || null,
        percentage: data.percentage,
        logoUrl: data.logoUrl || null,
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

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Partner' : 'Add New Partner'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update details.' : 'Enter details.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Partner Name</FormLabel> <FormControl><Input placeholder="John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Contact Email</FormLabel> <FormControl><Input type="email" placeholder="partner@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Company Name (Optional)</FormLabel> <FormControl><Input placeholder="Partner Co." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="percentage" render={({ field }) => ( <FormItem> <FormLabel>Revenue Share Percentage (%)</FormLabel> <FormControl><Input type="number" min="0.01" max="100" step="0.01" placeholder="e.g., 10" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormItem>
              <Label>Partner Logo (Optional)</Label>
              <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                {logoUrlValue && !isUploading ? (
                  <div className="relative w-32 h-32 mx-auto mb-2">
                    <Image src={logoUrlValue} alt="Logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => form.setValue('logoUrl', '')}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ) : isUploading ? (
                  <div className="py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /><Progress value={uploadProgress} className="w-full h-2" />{uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}</div>
                ) : (
                  <Label htmlFor="logo-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload logo</p><Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isUploading} /></Label>
                )}
              </div>
            </FormItem>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving || isUploading}>
                {(isSaving || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Partner'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
