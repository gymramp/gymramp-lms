
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import type { Company, CompanyFormData, User } from '@/types/user';
import { Loader2, Upload, ImageIcon as ImageIconLucide, Trash2, ArrowLeft, Users, CalendarDays, Gift, Globe, Palette, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Timestamp } from 'firebase/firestore';

// Simplified Zod schema for core and trial information only
const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Brand name must be at least 2 characters.' }),
  subdomainSlug: z.string()
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens. Leave blank if none.' })
    .max(63, { message: 'Subdomain slug cannot exceed 63 characters.' })
    .optional()
    .nullable(),
  customDomain: z.string().regex(/^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}|)$/, { message: 'Invalid custom domain format (e.g., learn.yourgym.com). Leave blank if none.' })
    .optional()
    .nullable(),
  shortDescription: z.string().max(150, { message: 'Description must be 150 characters or less.' }).optional().nullable(),
  logoUrl: z.string().url({ message: 'Invalid URL format.' }).optional().nullable(),
  maxUsers: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int({ message: "Must be a whole number" })
    .positive({ message: "Must be a positive number" })
    .min(1, { message: "Minimum 1 user" })
    .optional()
    .nullable(),
  isTrial: z.boolean().optional().default(false),
  trialEndsAt: z.date().nullable().optional(),
  // White-label and program fields are removed from the schema for now
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      subdomainSlug: '',
      customDomain: '',
      shortDescription: '',
      logoUrl: '',
      maxUsers: null,
      isTrial: false,
      trialEndsAt: null,
    },
  });

  const isTrialValue = form.watch('isTrial');

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (userDetails?.role !== 'Super Admin') {
            toast({ title: "Access Denied", description: "You do not have permission to edit brands.", variant: "destructive" });
            router.push('/admin/companies');
          }
        } catch (error) {
          toast({ title: "Authentication Error", description: "Failed to verify user.", variant: "destructive" });
          router.push('/login');
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchCompanyData = useCallback(async () => {
    if (!companyId || !currentUser || currentUser.role !== 'Super Admin') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      setCompany(companyData);

      form.reset({
        name: companyData.name || '',
        subdomainSlug: companyData.subdomainSlug || '',
        customDomain: companyData.customDomain || '',
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        maxUsers: companyData.maxUsers ?? null,
        isTrial: companyData.isTrial || false,
        trialEndsAt: companyData.trialEndsAt instanceof Timestamp
          ? companyData.trialEndsAt.toDate()
          : companyData.trialEndsAt instanceof Date
            ? companyData.trialEndsAt
            : null,
      });
    } catch (error) {
      console.error("Failed to fetch brand data:", error);
      toast({ title: "Error", description: "Could not load brand data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, router, toast, form, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin' && companyId && isMounted) {
      fetchCompanyData();
    }
  }, [fetchCompanyData, currentUser, companyId, isMounted]);


  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;
    setIsUploadingLogo(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const uniqueFileName = `${companyId}-logo-${Date.now()}-${file.name}`;
      const storagePath = `${STORAGE_PATHS.COMPANY_LOGOS}/${uniqueFileName}`;
      const downloadURL = await uploadImage(file, storagePath, setUploadProgress);
      form.setValue('logoUrl', downloadURL, { shouldValidate: true, shouldDirty: true });
      toast({ title: "Logo Uploaded", description: "Brand logo successfully uploaded." });
    } catch (error: any) {
      setUploadError(error.message || "Failed to upload logo.");
      toast({ title: "Upload Failed", description: error.message || "Could not upload the brand logo.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const onSubmit = async (data: CompanyFormValues) => {
    if (!companyId) return;
    if (isUploadingLogo) {
      toast({ title: "Upload in Progress", description: "Please wait for the logo upload to complete.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const metadataToUpdate: Partial<CompanyFormData> = {
        name: data.name,
        subdomainSlug: data.subdomainSlug?.trim() ? data.subdomainSlug.trim().toLowerCase() : null,
        customDomain: data.customDomain?.trim() ? data.customDomain.trim().toLowerCase() : null,
        shortDescription: data.shortDescription?.trim() ? data.shortDescription.trim() : null,
        logoUrl: data.logoUrl?.trim() ? data.logoUrl.trim() : null,
        maxUsers: data.maxUsers ?? null,
        isTrial: data.isTrial,
        trialEndsAt: data.trialEndsAt ? Timestamp.fromDate(data.trialEndsAt) : null,
        // whiteLabelEnabled and color fields are not part of this simplified form's data
      };

      const updatedCompanyResult = await updateCompany(companyId, metadataToUpdate);
      if (!updatedCompanyResult) {
        throw new Error("Failed to update brand metadata.");
      }
      setCompany(updatedCompanyResult); // Update local state with potentially stripped data
      toast({ title: "Brand Updated", description: `"${data.name}" updated successfully.` });
    } catch (error: any) {
      console.error("Failed to update brand:", error);
      toast({ title: "Error", description: error.message || "Could not update brand.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted || isLoading || !currentUser || currentUser.role !== 'Super Admin') {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-10 w-1/2 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="md:col-span-1 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return <div className="container mx-auto py-12 text-center">Brand not found.</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">Edit Brand Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Information</CardTitle>
                <CardDescription>Update the name, description, logo, domain, and user limit for {company.name}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem> <FormLabel>Brand Name</FormLabel> <FormControl> <Input placeholder="e.g., Global Fitness Inc." {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="subdomainSlug" render={({ field }) => (<FormItem> <FormLabel className="flex items-center gap-1"> <Globe className="h-4 w-4" /> Subdomain Slug (Optional) </FormLabel> <FormControl> <Input placeholder="e.g., global-fitness" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /> </FormControl> <FormDescription> Used for branded login URL (e.g., global-fitness.yourdomain.com). Only lowercase letters, numbers, and hyphens. </FormDescription> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="customDomain" render={({ field }) => (<FormItem> <FormLabel className="flex items-center gap-1"> <Globe className="h-4 w-4" /> Custom Domain (Optional) </FormLabel> <FormControl> <Input placeholder="e.g., learn.theirgym.com" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /> </FormControl> <FormDescription> Requires DNS CNAME setup by the brand to point to your app. </FormDescription> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="shortDescription" render={({ field }) => (<FormItem> <FormLabel>Short Description (Optional)</FormLabel> <FormControl> <Textarea rows={3} placeholder="A brief description of the brand (max 150 characters)" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="maxUsers" render={({ field }) => (<FormItem> <FormLabel className="flex items-center gap-1"> <Users className="h-4 w-4" /> Maximum Users Allowed </FormLabel> <FormControl> <Input type="number" min="1" placeholder="Leave blank for unlimited" value={field.value === null || field.value === undefined ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /> </FormControl> <FormDescription> Set the maximum number of user accounts for this brand. Leave blank for no limit. </FormDescription> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="logoUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Brand Logo (Optional)</FormLabel>
                    <FormControl>
                      <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                        {(field.value && !isUploadingLogo) ? (
                          <div className="relative w-32 h-32 mx-auto mb-2">
                            <Image src={field.value} alt="Brand logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="logo business" onError={() => form.setValue('logoUrl', '', { shouldDirty: true })} />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '', {shouldDirty: true})} aria-label="Remove Logo"> <Trash2 className="h-4 w-4" /> </Button>
                          </div>
                        ) : isUploadingLogo ? (
                          <div className="flex flex-col items-center justify-center h-full py-8"> <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /> <p className="text-sm text-muted-foreground mb-1">Uploading...</p> <Progress value={uploadProgress} className="w-full max-w-xs h-2" /> {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>} </div>
                        ) : (
                          <Label htmlFor="logo-upload-edit-page" className="cursor-pointer block"> <ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /> <p className="text-sm text-muted-foreground">Click to upload logo</p> <Input id="logo-upload-edit-page" type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoFileChange} disabled={isUploadingLogo} /> </Label>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              </CardContent>
            </Card>

            {/* White-Label Settings Placeholder Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5"/> White-Label Settings</CardTitle>
                <CardDescription>Customize the appearance of the platform for this brand.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">White-label settings (colors, etc.) will be managed here in a future update.</p>
                {/* Placeholder for FormField for whiteLabelEnabled if needed for future logic */}
                {/* <FormField control={form.control} name="whiteLabelEnabled" render={({ field }) => (...)} /> */}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1 space-y-6">
            <Card className={company?.isTrial ? "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700" : ""}>
              <CardHeader>
                <CardTitle className={company?.isTrial ? "text-blue-700 dark:text-blue-300 flex items-center gap-2" : "flex items-center gap-2"}>
                  {company?.isTrial && <Gift className="h-5 w-5" />} Trial Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="isTrial" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mb-4">
                    <FormLabel className="text-sm">Active Trial</FormLabel>
                    <FormControl> <Checkbox checked={field.value || false} onCheckedChange={field.onChange} /> </FormControl>
                  </FormItem>
                )} />
                {isMounted && isTrialValue && (
                  <FormField control={form.control} name="trialEndsAt" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-1 text-sm"> <CalendarDays className="h-4 w-4" /> Trial End Date </FormLabel>
                        <FormControl>
                            <div> {/* Added div wrapper */}
                                <DatePickerWithPresets
                                    date={field.value}
                                    setDate={(date) => field.onChange(date || null)}
                                />
                            </div>
                        </FormControl>
                      <FormDescription> Adjust to extend or shorten the trial. Clear to remove end date. </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                {isMounted && !isTrialValue && ( <p className="text-sm text-muted-foreground italic">This brand is not currently on a trial.</p> )}
              </CardContent>
            </Card>

            {/* Program Access Placeholder Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Program Access</CardTitle>
                <CardDescription>Details of the program assigned to this brand.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">Assigned program information will be displayed here once data fetching logic is restored.</p>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting || isUploadingLogo}>
              {isSubmitting || isUploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
    