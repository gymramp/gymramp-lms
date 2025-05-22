
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Company, CompanyFormData } from '@/types/user';
import type { Program, Course } from '@/types/course';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import { getProgramById, getAllCourses } from '@/lib/firestore-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, Upload, ImageIcon as ImageIconLucide, Trash2, Globe, Users, CalendarDays, Settings as SettingsIcon, BookOpen, Layers, PackageCheck, Palette } from 'lucide-react';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { hexToHslString } from '@/lib/utils';

const companyFormSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters."),
  subdomainSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase alphanumeric with hyphens, not at start/end.' }).min(3, "Slug must be at least 3 characters.").max(63, "Slug cannot exceed 63 characters.").optional().or(z.literal('')).nullable(),
  customDomain: z.string().optional().or(z.literal('')).nullable(),
  shortDescription: z.string().max(150, { message: "Description can't exceed 150 characters." }).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: "Invalid URL for logo." }).optional().or(z.literal('')),
  maxUsers: z.coerce.number({ invalid_type_error: "Must be a number" }).int().positive().min(1, "Min 1 user").optional().nullable(),
  isTrial: z.boolean().default(false),
  trialEndsAt: z.date().nullable().optional(),
  canManageCourses: z.boolean().default(false),
  whiteLabelEnabled: z.boolean().default(false),
  primaryColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Invalid HEX color."}).optional().or(z.literal('')).nullable(),
  secondaryColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Invalid HEX color."}).optional().or(z.literal('')).nullable(),
  accentColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Invalid HEX color."}).optional().or(z.literal('')).nullable(),
  brandBackgroundColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Invalid HEX color."}).optional().or(z.literal('')).nullable(),
  brandForegroundColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Invalid HEX color."}).optional().or(z.literal('')).nullable(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // State for Program Access section
  const [assignedProgram, setAssignedProgram] = useState<Program | null>(null);
  const [coursesInProgram, setCoursesInProgram] = useState<Course[]>([]);
  const [isLoadingProgramData, setIsLoadingProgramData] = useState(false);


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
      canManageCourses: false,
      whiteLabelEnabled: false,
      primaryColor: '',
      secondaryColor: '',
      accentColor: '',
      brandBackgroundColor: '',
      brandForegroundColor: '',
    },
  });

  const isTrialValue = form.watch('isTrial');
  const logoUrlValue = form.watch('logoUrl');
  const whiteLabelEnabledValue = form.watch('whiteLabelEnabled');

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You don't have permission to edit brands.", variant: "destructive" });
          router.push('/admin/dashboard');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchCompanyAndRelatedData = useCallback(async () => {
    if (!companyId || !currentUser || currentUser.role !== 'Super Admin') {
      setIsLoading(false);
      setIsLoadingProgramData(false);
      return;
    }
    setIsLoading(true);
    setIsLoadingProgramData(true);
    try {
      const companyData = await getCompanyById(companyId);
      if (companyData) {
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
          canManageCourses: companyData.canManageCourses || false,
          whiteLabelEnabled: companyData.whiteLabelEnabled || false,
          primaryColor: companyData.primaryColor || '',
          secondaryColor: companyData.secondaryColor || '',
          accentColor: companyData.accentColor || '',
          brandBackgroundColor: companyData.brandBackgroundColor || '',
          brandForegroundColor: companyData.brandForegroundColor || '',
        });

        const purchaseRecord = await getCustomerPurchaseRecordByBrandId(companyId);
        if (purchaseRecord && purchaseRecord.selectedProgramId) {
          const program = await getProgramById(purchaseRecord.selectedProgramId);
          setAssignedProgram(program);
          if (program && program.courseIds && program.courseIds.length > 0) {
            const allCourses = await getAllCourses();
            const programCourses = allCourses.filter(course => program.courseIds.includes(course.id));
            setCoursesInProgram(programCourses);
          } else {
            setCoursesInProgram([]);
          }
        } else {
          setAssignedProgram(null);
          setCoursesInProgram([]);
        }

      } else {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
      }
    } catch (error) {
      console.error("Failed to fetch brand data:", error);
      toast({ title: "Error", description: "Could not load brand data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingProgramData(false);
    }
  }, [companyId, currentUser, form, router, toast]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin' && companyId) {
      fetchCompanyAndRelatedData();
    }
  }, [currentUser, companyId, fetchCompanyAndRelatedData]);

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    setIsLogoUploading(true);
    setLogoUploadProgress(0);
    setLogoUploadError(null);
    try {
      const uniqueFileName = `${companyId}-logo-${Date.now()}-${file.name}`;
      const storagePath = `${STORAGE_PATHS.COMPANY_LOGOS}/${uniqueFileName}`;
      const downloadURL = await uploadImage(file, storagePath, setLogoUploadProgress);
      form.setValue('logoUrl', downloadURL, { shouldValidate: true });
      toast({ title: "Logo Uploaded", description: "Brand logo successfully uploaded." });
    } catch (error: any) {
      setLogoUploadError(error.message || "Failed to upload logo.");
      toast({ title: "Upload Failed", description: error.message || "Could not upload the brand logo.", variant: "destructive" });
    } finally {
      setIsLogoUploading(false);
    }
  };

  const onSubmit = async (data: CompanyFormValues) => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      // Explicitly get the latest logoUrl from the form state
      const currentLogoUrl = form.getValues('logoUrl');

      const metadataToUpdate: Partial<CompanyFormData> = {
        name: data.name,
        subdomainSlug: data.subdomainSlug?.trim() === '' ? null : (data.subdomainSlug || '').toLowerCase(),
        customDomain: data.customDomain?.trim() === '' ? null : (data.customDomain || '').toLowerCase(),
        shortDescription: data.shortDescription?.trim() === '' ? null : data.shortDescription,
        logoUrl: currentLogoUrl?.trim() === '' ? null : currentLogoUrl,
        maxUsers: data.maxUsers ?? null,
        isTrial: data.isTrial,
        trialEndsAt: data.isTrial && data.trialEndsAt ? Timestamp.fromDate(data.trialEndsAt) : null,
        canManageCourses: data.canManageCourses,
        whiteLabelEnabled: data.whiteLabelEnabled,
        primaryColor: data.primaryColor?.trim() === '' ? null : data.primaryColor,
        secondaryColor: data.secondaryColor?.trim() === '' ? null : data.secondaryColor,
        accentColor: data.accentColor?.trim() === '' ? null : data.accentColor,
        brandBackgroundColor: data.brandBackgroundColor?.trim() === '' ? null : data.brandBackgroundColor,
        brandForegroundColor: data.brandForegroundColor?.trim() === '' ? null : data.brandForegroundColor,
      };

      const updatedCompany = await updateCompany(companyId, metadataToUpdate);
      if (updatedCompany) {
        setCompany(updatedCompany); // Update local state
        // Reset form with the new, authoritative data from Firestore
        form.reset({
          name: updatedCompany.name || '',
          subdomainSlug: updatedCompany.subdomainSlug || '',
          customDomain: updatedCompany.customDomain || '',
          shortDescription: updatedCompany.shortDescription || '',
          logoUrl: updatedCompany.logoUrl || '',
          maxUsers: updatedCompany.maxUsers ?? null,
          isTrial: updatedCompany.isTrial || false,
          trialEndsAt: updatedCompany.trialEndsAt instanceof Timestamp
            ? updatedCompany.trialEndsAt.toDate()
            : updatedCompany.trialEndsAt instanceof Date
            ? updatedCompany.trialEndsAt
            : null,
          canManageCourses: updatedCompany.canManageCourses || false,
          whiteLabelEnabled: updatedCompany.whiteLabelEnabled || false,
          primaryColor: updatedCompany.primaryColor || '',
          secondaryColor: updatedCompany.secondaryColor || '',
          accentColor: updatedCompany.accentColor || '',
          brandBackgroundColor: updatedCompany.brandBackgroundColor || '',
          brandForegroundColor: updatedCompany.brandForegroundColor || '',
        });
        toast({ title: "Brand Updated", description: `"${updatedCompany.name}" updated successfully.` });
      } else {
        throw new Error("Failed to update brand.");
      }
    } catch (error: any) {
      console.error("Error updating brand:", error);
      toast({ title: "Error Updating Brand", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || isLoading || !currentUser || currentUser.role !== 'Super Admin') {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-10 w-1/2 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"> <Skeleton className="h-96" /> <Skeleton className="h-64" /> </div>
          <div className="lg:col-span-1 space-y-6"> <Skeleton className="h-80" /> <Skeleton className="h-48" /> <Skeleton className="h-48" /> </div>
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
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2"> Edit Brand: {company.name} </h1>
      <p className="text-muted-foreground mb-8"> Manage settings for this brand. </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Core Brand Information Card */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Core Brand Information</CardTitle><CardDescription>Basic identification and descriptive details for the brand.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Brand Name</FormLabel><FormControl><Input placeholder="Brand Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="subdomainSlug" render={({ field }) => (<FormItem><FormLabel>Subdomain Slug (Optional)</FormLabel><FormControl><Input placeholder="e.g., brand-slug" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="customDomain" render={({ field }) => (<FormItem><FormLabel>Custom Domain (Optional)</FormLabel><FormControl><Input placeholder="e.g., learn.brand.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="shortDescription" render={({ field }) => (<FormItem><FormLabel>Short Description (Optional)</FormLabel><FormControl><Textarea rows={3} placeholder="A brief description (max 150 chars)" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              {/* Brand Logo Card */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ImageIconLucide className="h-5 w-5" /> Brand Logo</CardTitle><CardDescription>Upload or manage the brand's logo.</CardDescription></CardHeader>
                <CardContent>
                  <FormItem>
                    <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                      {logoUrlValue && !isLogoUploading ? (
                        <div className="relative w-32 h-32 mx-auto mb-2"> <Image src={logoUrlValue} alt="Brand logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" onError={() => { form.setValue('logoUrl', ''); toast({ title: "Image Load Error", variant: "destructive" }); }} /> <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '')}><Trash2 className="h-4 w-4" /></Button> </div>
                      ) : isLogoUploading ? (
                        <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p className="text-sm text-muted-foreground mb-1">Uploading...</p><Progress value={logoUploadProgress} className="w-full max-w-xs h-2" />{logoUploadError && <p className="text-xs text-destructive mt-2">{logoUploadError}</p>}</div>
                      ) : (
                        <Label htmlFor="brand-logo-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload logo</p><Input id="brand-logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isLogoUploading} /></Label>
                      )}
                    </div>
                    <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem className="hidden"><FormLabel>Logo URL</FormLabel><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem>)} />
                  </FormItem>
                </CardContent>
              </Card>

              {/* White-Label Settings - Placeholder */}
               <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> White-Label Settings</CardTitle>
                    <CardDescription>Customize the appearance for this brand.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground italic">White-label settings UI will be implemented here.</p>
                     {/*
                        When re-implementing, ensure the FormField for whiteLabelEnabled, primaryColor, etc.
                        are correctly structured and guarded by isMounted && whiteLabelEnabledValue
                        as in the previous full version.
                     */}
                 </CardContent>
               </Card>

            </div>

            <div className="lg:col-span-1 space-y-6">
              {/* User & Trial Settings Card */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User &amp; Trial Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="maxUsers" render={({ field }) => (<FormItem><FormLabel>Max Users</FormLabel><FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  {isMounted && (
                    <FormField control={form.control} name="isTrial" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Is Trial Account?</FormLabel></div><FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                  )}
                  {isMounted && isTrialValue && (
                    <FormField control={form.control} name="trialEndsAt" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Trial End Date</FormLabel>
                            <FormControl>
                                <div> {/* Ensure single child for FormControl */}
                                    <DatePickerWithPresets date={field.value} setDate={field.onChange} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                  )}
                </CardContent>
              </Card>

              {/* Course Management Ability Card */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5" /> Course Management Ability</CardTitle></CardHeader>
                <CardContent>
                  {isMounted && (
                    <FormField
                      control={form.control}
                      name="canManageCourses"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Course Management</FormLabel>
                          </div>
                          <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Program Access Card - Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Program Access</CardTitle>
                  <CardDescription>Details of the Program assigned to this brand during checkout.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">Program access details will be displayed here.</p>
                </CardContent>
              </Card>

            </div>
          </div>

          <div className="flex justify-end pt-6 border-t">
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving || isLogoUploading}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

    