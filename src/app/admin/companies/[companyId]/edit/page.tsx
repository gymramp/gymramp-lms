// src/app/admin/companies/[companyId]/edit/page.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Company, CompanyFormData, User } from '@/types/user';
import type { Program, Course } from '@/types/course';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import { getAllPrograms, getProgramById, getAllCourses } from '@/lib/firestore-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, Upload, ImageIcon as ImageIconLucide, Trash2, Users, CalendarDays, Briefcase, Package, Save, Layers, BookOpen, Info } from 'lucide-react'; // Removed Palette
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';

// Removed white-labeling fields from schema
const companyFormSchema = z.object({
  name: z.string().min(2, "Brand name must be at least 2 characters."),
  shortDescription: z.string().max(150, { message: "Description can't exceed 150 characters." }).optional().or(z.literal('')).nullable(),
  logoUrl: z.string().url({ message: "Invalid URL for logo." }).optional().or(z.literal('')).nullable(),
  maxUsers: z.coerce.number({ invalid_type_error: "Must be a number" }).int().positive().min(1, "Min 1 user").optional().nullable(),
  isTrial: z.boolean().default(false),
  trialEndsAt: z.date().nullable().optional(),
  canManageCourses: z.boolean().default(false),
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
      shortDescription: '',
      logoUrl: '',
      maxUsers: null,
      isTrial: false,
      trialEndsAt: null,
      canManageCourses: false,
    },
  });

  const isTrialValue = form.watch('isTrial');
  const logoUrlValue = form.watch('logoUrl');

  const fetchCompanyData = useCallback(async (user: User | null) => {
    if (!companyId || !user) {
      setIsLoading(false);
      setIsLoadingProgramData(false);
      setIsLoadingParentBrand(false);
      return;
    }
    console.log('[EditCompany] Fetching data for brand ID:', companyId);
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
      if (companyData.trialEndsAt && typeof companyData.trialEndsAt === 'string') {
        trialDate = new Date(companyData.trialEndsAt);
      }

      form.reset({
        name: companyData.name || '',
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        maxUsers: companyData.maxUsers ?? null,
        isTrial: companyData.isTrial || false,
        trialEndsAt: trialDate,
        canManageCourses: companyData.canManageCourses || false,
      });

      if (companyData.parentBrandId) {
        setIsLoadingParentBrand(true);
        const parent = await getCompanyById(companyData.parentBrandId);
        setParentBrandName(parent?.name || 'Unknown Parent');
        setIsLoadingParentBrand(false);
      } else {
        setParentBrandName(null);
        setIsLoadingParentBrand(false);
      }

      if (companyData.assignedProgramIds && companyData.assignedProgramIds.length > 0) {
        const [fetchedAllLibCoursesData, programsDetailsPromises] = await Promise.all([
          getAllCourses(),
          Promise.all(companyData.assignedProgramIds.map(id => getProgramById(id)))
        ]);
        setAllLibraryCourses(fetchedAllLibCoursesData);
        const details = programsDetailsPromises.filter(Boolean) as Program[];
        setAssignedProgramsDetails(details);
        console.log('[EditCompany] Fetched brand.assignedProgramIds:', companyData.assignedProgramIds);
        console.log('[EditCompany] Fetched program details:', details);
      } else {
        setAssignedProgramsDetails([]);
        setAllLibraryCourses([]);
        console.log('[EditCompany] No assigned programs found for brand:', companyId);
      }

    } catch (error: any) {
      console.error("[EditCompany] Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load brand data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingProgramData(false);
    }
  }, [companyId, form, router, toast]);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const details = await getUserByEmail(firebaseUser.email);
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
    if (!companyId || !company || !currentUser) return;
    setIsSaving(true);

    const currentLogoUrl = form.getValues('logoUrl');

    try {
      const metadataToUpdate: Partial<CompanyFormData> = {
        name: data.name,
        shortDescription: data.shortDescription?.trim() === '' ? null : (data.shortDescription || null),
        logoUrl: currentLogoUrl?.trim() === '' ? null : currentLogoUrl,
        maxUsers: data.maxUsers ?? null,
        isTrial: data.isTrial,
        trialEndsAt: data.isTrial && data.trialEndsAt ? Timestamp.fromDate(new Date(data.trialEndsAt as string)) : null,
        canManageCourses: data.canManageCourses,
        // Removed white-labeling fields
        whiteLabelEnabled: company.whiteLabelEnabled, // Preserve existing value
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        accentColor: company.accentColor,
        brandBackgroundColor: company.brandBackgroundColor,
        brandForegroundColor: company.brandForegroundColor,
        subdomainSlug: company.subdomainSlug,
        customDomain: company.customDomain,
      };

      const updatedCompany = await updateCompany(companyId, metadataToUpdate);
      if (updatedCompany) {
        setCompany(updatedCompany);
        await fetchCompanyData(currentUser); // Re-fetch all data
        toast({ title: "Brand Updated", description: `"${updatedCompany.name}" updated successfully.` });
      } else {
        throw new Error("Failed to update brand details.");
      }
    } catch (error: any) {
      console.error("[EditCompany] onSubmit error:", error);
      toast({ title: "Error Updating Brand", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || isLoading || !currentUser) {
    return (
      <div className="container mx-auto">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-10 w-1/2 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"> <Skeleton className="h-96" /> <Skeleton className="h-64" /> <Skeleton className="h-64" /> </div>
          <div className="lg:col-span-1 space-y-6"> <Skeleton className="h-80" /> <Skeleton className="h-48" /> <Skeleton className="h-48" /> </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return <div className="container mx-auto text-center">Brand not found.</div>;
  }

  const userCanEditBasicInfo = currentUser?.role === 'Super Admin' || (currentUser?.companyId === company.id && (currentUser?.role === 'Admin' || currentUser?.role === 'Owner')) || (company.parentBrandId === currentUser?.companyId && (currentUser?.role === 'Admin' || currentUser?.role === 'Owner'));
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  return (
    <div className="container mx-auto">
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
              <Card>
                <CardHeader><CardTitle>Core Brand Information</CardTitle><CardDescription>Basic identification and descriptive details for the brand.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Brand Name</FormLabel><FormControl><Input placeholder="Brand Name" {...field} value={field.value ?? ''} disabled={!userCanEditBasicInfo} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="shortDescription" render={({ field }) => (<FormItem><FormLabel>Short Description (Optional)</FormLabel><FormControl><Textarea rows={3} placeholder="A brief description (max 150 chars)" {...field} value={field.value ?? ''} disabled={!userCanEditBasicInfo} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Brand Logo</CardTitle><CardDescription>Upload or manage the brand's logo.</CardDescription></CardHeader>
                <CardContent>
                  <FormItem>
                    <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                      {logoUrlValue && !isLogoUploading ? ( <div className="relative w-32 h-32 mx-auto mb-2"> <Image src={logoUrlValue} alt="Brand logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="company logo" onError={() => { form.setValue('logoUrl', ''); toast({ title: "Image Load Error", description:"Could not load logo preview.", variant: "destructive" }); }} /> <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '')} disabled={!userCanEditBasicInfo || isLogoUploading}><Trash2 className="h-4 w-4" /></Button> </div>
                      ) : isLogoUploading ? (
                        <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p className="text-sm text-muted-foreground mb-1">Uploading...</p><Progress value={logoUploadProgress} className="w-full max-w-xs h-2" />{logoUploadError && <p className="text-xs text-destructive mt-2">{logoUploadError}</p>}</div>
                      ) : (
                        <Label htmlFor="brand-logo-upload" className={cn("cursor-pointer block", !userCanEditBasicInfo && "cursor-not-allowed opacity-50")}><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload logo</p><Input id="brand-logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={!userCanEditBasicInfo || isLogoUploading} /></Label>
                      )}
                    </div>
                    <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem className="hidden"><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem>)} />
                  </FormItem>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>White-Label Settings (Placeholder)</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">White-labeling configuration (colors, domain/subdomain) will be managed here. This section is currently a placeholder.</p>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User & Trial Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="maxUsers" render={({ field }) => (<FormItem><FormLabel>Max Users</FormLabel><FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value === null || field.value === undefined ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={!userCanEditBasicInfo} /></FormControl><FormMessage /></FormItem>)} />
                  {isMounted && (
                    <FormField
                      control={form.control}
                      name="isTrial"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5"><FormLabel>Is Trial Brand?</FormLabel></div>
                          <FormControl>
                            <div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} disabled={!isSuperAdmin} /></div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {isMounted && isTrialValue && (
                    <FormField
                      control={form.control}
                      name="trialEndsAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Trial End Date</FormLabel>
                          <FormControl>
                            <div><DatePickerWithPresets date={field.value} setDate={field.onChange} disabled={!isSuperAdmin} /></div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {!isSuperAdmin && <p className="text-xs text-muted-foreground italic">Trial settings can only be managed by a Super Admin.</p>}
                </CardContent>
              </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Course Management Ability</CardTitle></CardHeader>
                    <CardContent>
                    {isMounted && (
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
                                  <div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} disabled={!isSuperAdmin} /></div>
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    )}
                    {!isSuperAdmin && <p className="text-xs text-muted-foreground italic mt-2">Course management ability can only be set by a Super Admin.</p>}
                    </CardContent>
                </Card>

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
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving || isLogoUploading || !userCanEditBasicInfo}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
