
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image'; // Import Image
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
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Progress } from '@/components/ui/progress'; // Import Progress
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Company, CompanyFormData } from '@/types/user';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage'; // Import uploadImage and paths
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Loader2, Upload, ImageIcon, Trash2, Users, Globe, Link as LinkIcon } from 'lucide-react'; // Added Globe, LinkIcon

// Zod schema for form validation
const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Brand name must be at least 2 characters.' }),
  subdomainSlug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens, and cannot start/end with a hyphen.' })
    .min(3, { message: 'Subdomain slug must be at least 3 characters.'})
    .max(63, { message: 'Subdomain slug cannot exceed 63 characters.'})
    .optional()
    .or(z.literal(''))
    .nullable(),
  customDomain: z.string()
     .regex(/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,6})+$/, { message: 'Please enter a valid domain name (e.g., example.com).' })
     .optional()
     .or(z.literal(''))
     .nullable(),
  shortDescription: z.string().max(150, { message: 'Description must be 150 characters or less.' }).optional().or(z.literal('')), // Optional, max length
  logoUrl: z.string().url({ message: 'Invalid URL format.' }).optional().or(z.literal('')), // Track uploaded logo URL
  maxUsers: z.coerce // Use coerce for number input
    .number({ invalid_type_error: "Must be a number" })
    .int({ message: "Must be a whole number" })
    .positive({ message: "Must be a positive number" })
    .min(1, { message: "Minimum 1 user" })
    .optional() // Make optional
    .nullable(), // Allow null (for unlimited)
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

interface AddEditCompanyDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Company | null; // Company or null for adding
  onSave: (companyData: CompanyFormData) => void; // Updated callback type
}

// This dialog is now only used for ADDING brands
export function AddEditCompanyDialog({ isOpen, setIsOpen, onSave, initialData }: AddEditCompanyDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      subdomainSlug: null,
      customDomain: null,
      shortDescription: '',
      logoUrl: '',
      maxUsers: null, // Default to null (unlimited)
    },
  });

   const logoUrlValue = form.watch('logoUrl');

  // Effect to reset form when dialog opens
  useEffect(() => {
    form.reset({ name: '', subdomainSlug: null, customDomain: null, shortDescription: '', logoUrl: '', maxUsers: null }); // Always reset for adding
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
  }, [form, isOpen]); // Add isOpen dependency


   // Handle file selection and upload for Logo
   const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;

       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);

       try {
           const uniqueFileName = `${Date.now()}-${file.name}`; // Use timestamp for adding
           const storagePath = `${STORAGE_PATHS.COMPANY_LOGOS}/${uniqueFileName}`;

           const downloadURL = await uploadImage(file, storagePath, setUploadProgress);

           form.setValue('logoUrl', downloadURL, { shouldValidate: true });
           toast({
             title: "Logo Uploaded",
             description: "Brand logo successfully uploaded.",
           });

       } catch (error: any) {
           setUploadError(error.message || "Failed to upload logo.");
           toast({
             title: "Upload Failed",
             description: error.message || "Could not upload the brand logo.",
             variant: "destructive",
           });
       } finally {
           setIsUploading(false);
       }
   };


  const onSubmit = (data: CompanyFormValues) => {
     if (isUploading) {
        toast({
            title: "Upload in Progress",
            description: "Please wait for the logo upload to complete.",
            variant: "destructive",
        });
        return;
    }

    // Prepare data, ensuring null for optional fields if empty
    const formData: CompanyFormData = {
      name: data.name,
      subdomainSlug: data.subdomainSlug?.trim().toLowerCase() || null,
      customDomain: data.customDomain?.trim().toLowerCase() || null,
      shortDescription: data.shortDescription?.trim() === '' ? null : data.shortDescription,
      logoUrl: data.logoUrl?.trim() === '' ? null : data.logoUrl,
      maxUsers: data.maxUsers ?? null, // Include maxUsers, use null if undefined/null
      // Default values for other fields not in this form (handled by server action or Firestore default)
      assignedCourseIds: [],
      isTrial: false,
      trialEndsAt: null,
      saleAmount: null,
      revenueSharePartners: null,
      whiteLabelEnabled: false, // Assuming default is false when adding a new brand
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
    };
    onSave(formData); // Pass the validated form data to the parent
    // Parent component handles API call, toast, and closing
  };

  // Handle closing the dialog
  const handleClose = () => {
    form.reset(); // Reset form state on close
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Brand</DialogTitle>
          <DialogDescription>
            Enter the details for the new brand.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            {/* Brand Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Global Fitness Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subdomain Slug */}
            <FormField
              control={form.control}
              name="subdomainSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Globe className="h-4 w-4" /> Subdomain Slug (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., global-fitness (for global-fitness.yourdomain.com)"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value.toLowerCase())}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Used for branded login URL. Only lowercase letters, numbers, and hyphens.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Custom Domain */}
            <FormField
              control={form.control}
              name="customDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" /> Custom Domain (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., learn.partner.com"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value.toLowerCase())}
                    />
                  </FormControl>
                   <p className="text-xs text-muted-foreground">
                    Requires DNS configuration to point to this application.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Short Description */}
            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="A brief description of the brand (max 150 characters)" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Users Field */}
            <FormField
              control={form.control}
              name="maxUsers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Users className="h-4 w-4" /> Maximum Users Allowed
                  </FormLabel>
                  <FormControl>
                     <Input
                        type="number"
                        min="1"
                        placeholder="Leave blank for unlimited"
                        {...field}
                        value={field.value ?? ''} // Handle null/undefined for controlled input
                        onChange={e => {
                            const value = e.target.value;
                            // Convert empty string to null, otherwise parse as number
                            field.onChange(value === '' ? null : Number(value));
                        }}
                     />
                  </FormControl>
                  <FormMessage />
                   <p className="text-xs text-muted-foreground">
                    Set the maximum number of user accounts for this brand. Leave blank for no limit.
                   </p>
                </FormItem>
              )}
            />

            {/* Logo Upload */}
             <FormItem className="space-y-2">
                 <FormLabel className="text-base font-semibold">Brand Logo (Optional)</FormLabel>
                 <FormControl>
                   <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                     {logoUrlValue && !isUploading ? (
                       <div className="relative w-32 h-32 mx-auto mb-2"> {/* Fixed size preview */}
                         <Image
                           src={logoUrlValue}
                           alt="Brand logo preview"
                           fill
                           style={{ objectFit: 'contain' }} // Use contain to show full logo
                           className="rounded-md"
                           onError={() => {
                             form.setValue('logoUrl', ''); // Clear if URL is broken
                             toast({ title: "Image Load Error", variant: "destructive" });
                           }}
                         />
                         <Button
                           type="button"
                           variant="destructive"
                           size="icon"
                           className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                           onClick={() => form.setValue('logoUrl', '')}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     ) : isUploading ? (
                        <div className="flex flex-col items-center justify-center h-full py-8">
                             <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                             <p className="text-sm text-muted-foreground mb-1">Uploading...</p>
                             <Progress value={uploadProgress} className="w-full max-w-xs h-2" />
                             {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                        </div>
                     ) : (
                       <Label htmlFor="logo-upload" className="cursor-pointer block">
                         <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                         <p className="text-sm text-muted-foreground">Click to upload logo</p>
                          <Input
                             id="logo-upload"
                             type="file"
                             accept="image/*"
                             className="hidden"
                             onChange={handleLogoFileChange}
                             disabled={isUploading}
                         />
                       </Label>
                     )}
                   </div>
                 </FormControl>
                  <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem className="hidden">
                           <FormLabel className="text-xs text-muted-foreground pt-1 block">Logo URL (auto-filled after upload)</FormLabel>
                           <FormControl>
                             <Input
                               type="url"
                               placeholder="Upload an image or paste URL"
                               {...field}
                               value={field.value ?? ''}
                               className="text-sm"
                               readOnly
                               disabled
                             />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                      )}
                    />
               </FormItem>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isUploading}>
                 {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Add Brand
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
