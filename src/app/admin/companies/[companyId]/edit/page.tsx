
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
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
import type { Company, CompanyFormData, User } from '@/types/user';
import type { Program, Course } from '@/types/course';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import { getAllPrograms, getProgramById, getAllCourses } from '@/lib/firestore-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, Upload, ImageIcon as ImageIconLucide, Trash2, Globe, Users, CalendarDays, Palette, Briefcase, Package, Save, Layers, BookOpen, Info, Settings as SettingsIcon } from 'lucide-react';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

const companyFormSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters."),
  subdomainSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase alphanumeric with hyphens, not at start/end.' }).min(3, "Slug must be at least 3 characters.").max(63, "Slug cannot exceed 63 characters.").optional().or(z.literal('')).nullable(),
  customDomain: z.string().optional().or(z.literal('')).nullable(),
  shortDescription: z.string().max(150, { message: "Description can't exceed 150 characters." }).optional().or(z.literal('')).nullable(),
  logoUrl: z.string().url({ message: "Invalid URL for logo." }).optional().or(z.literal('')).nullable(),
  maxUsers: z.coerce.number({ invalid_type_error: "Must be a number" }).int().positive().min(1, "Min 1 user").optional().nullable(),
  isTrial: z.boolean().default(false),
  trialEndsAt: z.date().nullable().optional(),
  canManageCourses: z.boolean().default(false),
  whiteLabelEnabled: z.boolean().default(false),
  primaryColor: z.string().regex(HEX_COLOR_REGEX, { message: "Invalid HEX color (e.g., #RRGGBB or #RGB)" }).optional().or(z.literal('')).nullable(),
  secondaryColor: z.string().regex(HEX_COLOR_REGEX, { message: "Invalid HEX color" }).optional().or(z.literal('')).nullable(),
  accentColor: z.string().regex(HEX_COLOR_REGEX, { message: "Invalid HEX color" }).optional().or(z.literal('')).nullable(),
  brandBackgroundColor: z.string().regex(HEX_COLOR_REGEX, { message: "Invalid HEX color" }).optional().or(z.literal('')).nullable(),
  brandForegroundColor: z.string().regex(HEX_COLOR_REGEX, { message: "Invalid HEX color" }).optional().or(z.literal('')).nullable(),
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [parentBrandName, setParentBrandName] = useState<string | null>(null);
  const [isLoadingParentBrand, setIsLoadingParentBrand] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const [assignedProgramsDetails, setAssignedProgramsDetails] = useState<Program[]>([]);
  const [allLibraryCourses, setAllLibraryCourses] = useState<Course[]>([]);
  const [isLoadingProgramData, setIsLoadingProgramData] = useState(true);

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

  const fetchCompanyData = useCallback(async (user: User | null) => {
    if (!companyId || !user) {
      setIsLoading(false);
      setIsLoadingProgramData(false);
      setIsLoadingParentBrand(false);
      return;
    }
    console.log('[EditBrand] Fetching data for brand ID:', companyId);
    setIsLoading(true);
    setIsLoadingProgramData(true);
    setIsLoadingParentBrand(true);

    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }

      let authorized = false;
      if (user.role === 'Super Admin') {
        authorized = true;
      } else if ((user.role === 'Admin' || user.role === 'Owner') && user.companyId) {
        if (companyData.id === user.companyId || companyData.parentBrandId === user.companyId) {
          authorized = true;
        }
      }

      if (!authorized) {
        toast({ title: "Access Denied", description: "You do not have permission to edit this brand.", variant: "destructive" });
        router.push(user.role === 'Super Admin' ? '/admin/companies' : '/dashboard');
        return;
      }

      setCompany(companyData);
      let trialDate: Date | null = null;
      if (companyData.trialEndsAt) {
        if (typeof companyData.trialEndsAt === 'string') { // Timestamps are serialized to ISO strings
          trialDate = new Date(companyData.trialEndsAt);
        } else if (companyData.trialEndsAt instanceof Date) { // Should not happen if serialized, but good check
          trialDate = companyData.trialEndsAt;
        }
      }
      
      form.reset({
        name: companyData.name || '',
        subdomainSlug: companyData.subdomainSlug || '',
        customDomain: companyData.customDomain || '',
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        maxUsers: companyData.maxUsers ?? null,
        isTrial: companyData.isTrial || false,
        trialEndsAt: trialDate,
        canManageCourses: companyData.canManageCourses || false,
        whiteLabelEnabled: companyData.whiteLabelEnabled || false,
        primaryColor: companyData.primaryColor || '',
        secondaryColor: companyData.secondaryColor || '',
        accentColor: companyData.accentColor || '',
        brandBackgroundColor: companyData.brandBackgroundColor || '',
        brandForegroundColor: companyData.brandForegroundColor || '',
      });

      if (companyData.parentBrandId) {
        const parent = await getCompanyById(companyData.parentBrandId);
        setParentBrandName(parent?.name || 'Unknown Parent');
      } else {
        setParentBrandName(null);
      }
      setIsLoadingParentBrand(false);
      
      console.log('[EditBrand] companyData.assignedProgramIds from Firestore:', companyData.assignedProgramIds);
      if (companyData.assignedProgramIds && companyData.assignedProgramIds.length > 0) {
        const fetchedAllLibCourses = await getAllCourses();
        setAllLibraryCourses(fetchedAllLibCourses);
        
        const programDetailsPromises = companyData.assignedProgramIds.map(id => getProgramById(id));
        const details = (await Promise.all(programDetailsPromises)).filter(Boolean) as Program[];
        setAssignedProgramsDetails(details);
        console.log('[EditBrand] Fetched assigned program details:', details);
      } else {
        setAssignedProgramsDetails([]);
        setAllLibraryCourses([]); // Ensure this is also reset
        console.log('[EditBrand] No assigned programs found for brand:', companyId);
      }

    } catch (error: any) {
      console.error("[EditBrand] Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load brand data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingProgramData(false);
    }
  }, [companyId, form, router, toast]);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const details = await getUserByEmail(user.email);
        setCurrentUser(details);
        if (details) {
          fetchCompanyData(details);
        } else {
          router.push('/');
        }
      } else {
        setCurrentUser(null);
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchCompanyData]);


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
      toast({ title: "Logo Uploaded", description: "Brand logo uploaded successfully." });
    } catch (error: any) {
      setLogoUploadError(error.message || "Upload failed.");
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLogoUploading(false);
    }
  };


  const onSubmit = async (data: CompanyFormValues) => {
    if (!companyId || !company) return;
    setIsSaving(true);

    const currentLogoUrl = form.getValues('logoUrl'); // Get latest value from form state

    try {
      const metadataToUpdate: Partial<CompanyFormData> = {
        name: data.name,
        subdomainSlug: data.subdomainSlug?.trim() === '' ? null : data.subdomainSlug?.toLowerCase() || null,
        customDomain: data.customDomain?.trim() === '' ? null : data.customDomain?.toLowerCase() || null,
        shortDescription: data.shortDescription?.trim() === '' ? null : data.shortDescription || null,
        logoUrl: currentLogoUrl?.trim() === '' ? null : currentLogoUrl,
        maxUsers: data.maxUsers ?? null,
        isTrial: data.isTrial,
        trialEndsAt: data.isTrial && data.trialEndsAt ? (data.trialEndsAt instanceof Date ? data.trialEndsAt : new Date(data.trialEndsAt as unknown as string)) : null,
        canManageCourses: data.canManageCourses,
        whiteLabelEnabled: data.whiteLabelEnabled,
        primaryColor: data.whiteLabelEnabled && data.primaryColor?.trim() !== '' ? data.primaryColor : null,
        secondaryColor: data.whiteLabelEnabled && data.secondaryColor?.trim() !== '' ? data.secondaryColor : null,
        accentColor: data.whiteLabelEnabled && data.accentColor?.trim() !== '' ? data.accentColor : null,
        brandBackgroundColor: data.whiteLabelEnabled && data.brandBackgroundColor?.trim() !== '' ? data.brandBackgroundColor : null,
        brandForegroundColor: data.whiteLabelEnabled && data.brandForegroundColor?.trim() !== '' ? data.brandForegroundColor : null,
      };

      const updatedCompany = await updateCompany(companyId, metadataToUpdate);
      if (updatedCompany) {
        setCompany(updatedCompany); // Update local company state
        if (currentUser) { // Re-fetch to ensure form is reset with the absolute latest data
            await fetchCompanyData(currentUser);
        }
        toast({ title: "Brand Updated", description: `"${updatedCompany.name}" updated successfully.` });
      } else {
        throw new Error("Failed to update brand details.");
      }
    } catch (error: any) {
      console.error("[EditBrand] onSubmit error:", error);
      toast({ title: "Error Updating Brand", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || isLoading || !currentUser) {
    return (
      <div className="container mx-auto py-12">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-10 w-1/2 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"> <Skeleton className="h-96" /> <Skeleton className="h-64" /> <Skeleton className="h-64" /> </div>
          <div className="lg:col-span-1 space-y-6"> <Skeleton className="h-80" /> <Skeleton className="h-48" /> <Skeleton className="h-48" /> </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return <div className="container mx-auto py-12 text-center">Brand not found or access denied.</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2"> Edit Brand: {company.name} </h1>
      <p className="text-muted-foreground mb-8"> Manage settings for this brand. </p>
      {company.parentBrandId && ( <Card className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700"> <CardContent className="p-4"> <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2"> <Briefcase className="h-4 w-4" /> This is a Child Brand. Parent Brand: {isLoadingParentBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <strong>{parentBrandName || 'Loading...'}</strong>} </p> </CardContent> </Card> )}

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
                      {logoUrlValue && !isLogoUploading ? ( <div className="relative w-32 h-32 mx-auto mb-2"> <Image src={logoUrlValue} alt="Brand logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="company logo" onError={() => { form.setValue('logoUrl', ''); toast({ title: "Image Load Error", description:"Could not load logo preview.", variant: "destructive" }); }} /> <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '')}><Trash2 className="h-4 w-4" /></Button> </div>
                      ) : isLogoUploading ? (
                        <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p className="text-sm text-muted-foreground mb-1">Uploading...</p><Progress value={logoUploadProgress} className="w-full max-w-xs h-2" />{logoUploadError && <p className="text-xs text-destructive mt-2">{logoUploadError}</p>}</div>
                      ) : (
                        <Label htmlFor="brand-logo-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload logo</p><Input id="brand-logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isLogoUploading} /></Label>
                      )}
                    </div>
                    <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem className="hidden"><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem>)} />
                  </FormItem>
                </CardContent>
              </Card>

              {/* White-Label Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> White-Label Settings</CardTitle>
                  <CardDescription>Customize the appearance for this brand. Requires "Enable White-Labeling" to be checked.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMounted && currentUser?.role === 'Super Admin' && (
                    <FormField
                      control={form.control}
                      name="whiteLabelEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable White-Labeling</FormLabel>
                            <FormDescription>Allow this brand to use custom colors and logo for a branded experience.</FormDescription>
                          </div>
                          <FormControl>
                            <div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {isMounted && whiteLabelEnabledValue && currentUser?.role === 'Super Admin' && (
                    <div className="space-y-3 pt-3 pl-2 border-l-2 border-primary/20 ml-1">
                      <FormField control={form.control} name="primaryColor" render={({ field }) => (<FormItem><FormLabel>Primary Color (HEX)</FormLabel><FormControl><div><Input placeholder="#RRGGBB" {...field} value={field.value ?? ''} /></div></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="secondaryColor" render={({ field }) => (<FormItem><FormLabel>Secondary Color (HEX)</FormLabel><FormControl><div><Input placeholder="#RRGGBB" {...field} value={field.value ?? ''} /></div></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="accentColor" render={({ field }) => (<FormItem><FormLabel>Accent Color (HEX)</FormLabel><FormControl><div><Input placeholder="#RRGGBB" {...field} value={field.value ?? ''} /></div></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="brandBackgroundColor" render={({ field }) => (<FormItem><FormLabel>Brand Background Color (HEX)</FormLabel><FormControl><div><Input placeholder="#RRGGBB" {...field} value={field.value ?? ''} /></div></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="brandForegroundColor" render={({ field }) => (<FormItem><FormLabel>Brand Foreground Color (HEX)</FormLabel><FormControl><div><Input placeholder="#RRGGBB" {...field} value={field.value ?? ''} /></div></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            <div className="lg:col-span-1 space-y-6">
              {/* User & Trial Settings Card */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User &amp; Trial Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="maxUsers" render={({ field }) => (<FormItem><FormLabel>Max Users</FormLabel><FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value === null || field.value === undefined ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  {isMounted && currentUser?.role === 'Super Admin' && (
                    <FormField
                      control={form.control}
                      name="isTrial"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5"><FormLabel>Is Trial Account?</FormLabel></div>
                          <FormControl>
                            <div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {isMounted && isTrialValue && currentUser?.role === 'Super Admin' && (
                    <FormField
                      control={form.control}
                      name="trialEndsAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Trial End Date</FormLabel>
                          <FormControl>
                            <div> {/* Added div wrapper */}
                                <DatePickerWithPresets date={field.value} setDate={field.onChange} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Course Management Ability Card */}
              {isMounted && currentUser?.role === 'Super Admin' && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Course Management Ability</CardTitle></CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="canManageCourses"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Course Management</FormLabel>
                            <FormDescription>Allow this brand's Admins/Owners to create and manage their own courses.</FormDescription>
                          </div>
                          <FormControl>
                            <div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Assigned Programs Card */}
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Assigned Programs</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingProgramData ? (
                    <div className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-20 w-full" /></div>
                  ) : assignedProgramsDetails.length > 0 ? (
                    <div className="space-y-4">
                      {assignedProgramsDetails.map(program => (
                        <div key={program.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <h4 className="font-semibold text-foreground">{program.title}</h4>
                          <p className="text-sm text-muted-foreground">{program.description}</p>
                          <p className="text-sm text-muted-foreground mt-1">Base Price: <Badge variant="outline">{program.price}</Badge></p>
                          {(program.courseIds?.length || 0) > 0 && allLibraryCourses.length > 0 && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground mt-2 mb-1">Courses Included:</h5>
                              <ScrollArea className="h-32 w-full rounded-md border p-2 bg-muted/20">
                                <ul className="space-y-1">
                                  {program.courseIds.map(courseId => allLibraryCourses.find(c => c.id === courseId)).filter(Boolean).map(course => (
                                    <li key={course!.id} className="text-xs text-foreground p-1 rounded-sm flex items-center gap-1.5">
                                      <BookOpen className="h-3 w-3 flex-shrink-0" /> {course!.title}
                                      <Badge variant="ghost" className="ml-auto text-xs">{course!.level}</Badge>
                                    </li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      ))}
                      {currentUser?.role === 'Super Admin' && (
                        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                          <Link href={`/admin/companies/${companyId}/manage-programs`}>Manage Assigned Programs</Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground italic">No programs currently assigned to this brand.</p>
                      {currentUser?.role === 'Super Admin' && (
                        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                          <Link href={`/admin/companies/${companyId}/manage-programs`}>Assign Programs</Link>
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t">
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving || isLogoUploading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
