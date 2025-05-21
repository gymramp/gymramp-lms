
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import { getAllCourses, getProgramById } from '@/lib/firestore-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data'; // Import new function
import type { Company, CompanyFormData, User } from '@/types/user';
import type { Course, Program } from '@/types/course';
import { Loader2, Upload, ImageIcon, Trash2, BookCheck, ArrowLeft, Users, CalendarDays, Gift, Globe, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Brand name must be at least 2 characters.' }),
  subdomainSlug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens, and cannot start/end with a hyphen.' })
    .min(3, { message: 'Subdomain slug must be at least 3 characters.'})
    .max(63, { message: 'Subdomain slug cannot exceed 63 characters.'})
    .optional()
    .or(z.literal(''))
    .nullable(),
  shortDescription: z.string().max(150, { message: 'Description must be 150 characters or less.' }).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: 'Invalid URL format.' }).optional().or(z.literal('')),
  customDomain: z.string().regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/, { message: 'Invalid custom domain format (e.g., learn.yourgym.com).'}).optional().or(z.literal('')).nullable(),
  maxUsers: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int({ message: "Must be a whole number" })
    .positive({ message: "Must be a positive number" })
    .min(1, { message: "Minimum 1 user" })
    .optional()
    .nullable(),
  isTrial: z.boolean().optional(),
  trialEndsAt: z.date().nullable().optional(),
  whiteLabelEnabled: z.boolean().optional(),
  primaryColor: z.string().optional().or(z.literal('')).nullable(),
  secondaryColor: z.string().optional().or(z.literal('')).nullable(),
  accentColor: z.string().optional().or(z.literal('')).nullable(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [assignedProgram, setAssignedProgram] = useState<Program | null>(null);
  const [coursesInProgram, setCoursesInProgram] = useState<Course[]>([]);
  // const [allLibraryCourses, setAllLibraryCourses] = useState<Course[]>([]); // No longer needed here
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const { toast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      subdomainSlug: '', // Changed from null to empty string
      shortDescription: '',
      logoUrl: '',
      customDomain: '', // Changed from null to empty string
      maxUsers: null,
      isTrial: false,
      trialEndsAt: null,
      whiteLabelEnabled: false,
      primaryColor: '',
      secondaryColor: '',
      accentColor: '',
    },
  });

   const logoUrlValue = form.watch('logoUrl');
   const isTrialValue = form.watch('isTrial');
   const whiteLabelEnabledValue = form.watch('whiteLabelEnabled');


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to edit brands.", variant: "destructive" });
          router.push('/admin/companies');
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchCompanyAndRelatedData = useCallback(async () => {
    if (!companyId || !currentUser || currentUser.role !== 'Super Admin') return;
    setIsLoading(true);
    setAssignedProgram(null);
    setCoursesInProgram([]);
    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      setCompany(companyData);
      form.reset({
        name: companyData.name,
        subdomainSlug: companyData.subdomainSlug || '', // Ensure empty string if null/undefined
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        customDomain: companyData.customDomain || '', // Ensure empty string if null/undefined
        maxUsers: companyData.maxUsers ?? null,
        isTrial: companyData.isTrial || false,
        trialEndsAt: companyData.trialEndsAt instanceof Timestamp ? companyData.trialEndsAt.toDate() : null,
        whiteLabelEnabled: companyData.whiteLabelEnabled || false,
        primaryColor: companyData.primaryColor || '',
        secondaryColor: companyData.secondaryColor || '',
        accentColor: companyData.accentColor || '',
      });

      const purchaseRecord = await getCustomerPurchaseRecordByBrandId(companyId);
      if (purchaseRecord && purchaseRecord.selectedProgramId) {
        const programData = await getProgramById(purchaseRecord.selectedProgramId);
        setAssignedProgram(programData);
        if (programData && programData.courseIds) {
          const fetchedLibraryCourses = await getAllCourses(); // Fetch all courses to map IDs
          const courses = programData.courseIds
            .map(id => fetchedLibraryCourses.find(c => c.id === id))
            .filter(Boolean) as Course[];
          setCoursesInProgram(courses);
        }
      }

    } catch (error) {
      console.error("Failed to fetch brand/related data:", error);
      toast({ title: "Error", description: "Could not load brand or related program data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, router, toast, form, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchCompanyAndRelatedData();
    }
  }, [fetchCompanyAndRelatedData, currentUser]);


  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file || !companyId) return;
       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);
       try {
           const uniqueFileName = `${companyId}-logo-${Date.now()}-${file.name}`;
           const storagePath = `${STORAGE_PATHS.COMPANY_LOGOS}/${uniqueFileName}`;
           const downloadURL = await uploadImage(file, storagePath, setUploadProgress);
           form.setValue('logoUrl', downloadURL, { shouldValidate: true });
           toast({ title: "Logo Uploaded", description: "Brand logo successfully uploaded." });
       } catch (error: any) {
           setUploadError(error.message || "Failed to upload logo.");
           toast({ title: "Upload Failed", description: error.message || "Could not upload the brand logo.", variant: "destructive" });
       } finally {
           setIsUploading(false);
       }
   };

   const onSubmit = async (data: CompanyFormValues) => {
     if (!companyId) return;
     if (isUploading) {
        toast({ title: "Upload in Progress", description: "Please wait for the logo upload to complete.", variant: "destructive" });
        return;
     }
     setIsLoading(true);
     try {
        const metadataToUpdate: Partial<CompanyFormData> = {
            name: data.name,
            subdomainSlug: data.subdomainSlug?.trim() ? data.subdomainSlug.trim().toLowerCase() : null,
            shortDescription: data.shortDescription?.trim() || null,
            logoUrl: data.logoUrl?.trim() || null,
            customDomain: data.customDomain?.trim() ? data.customDomain.trim().toLowerCase() : null,
            maxUsers: data.maxUsers ?? null,
            trialEndsAt: data.trialEndsAt ? Timestamp.fromDate(data.trialEndsAt) : null,
            isTrial: data.isTrial,
            whiteLabelEnabled: data.whiteLabelEnabled,
            primaryColor: data.whiteLabelEnabled ? (data.primaryColor?.trim() || null) : null,
            secondaryColor: data.whiteLabelEnabled ? (data.secondaryColor?.trim() || null) : null,
            accentColor: data.whiteLabelEnabled ? (data.accentColor?.trim() || null) : null,
        };

        const updatedCompanyMeta = await updateCompany(companyId, metadataToUpdate);
        if (!updatedCompanyMeta) {
            throw new Error("Failed to update brand metadata.");
        }
        toast({ title: "Brand Updated", description: `"${data.name}" updated successfully.` });
        fetchCompanyAndRelatedData();

     } catch (error: any)         {
         console.error("Failed to update brand:", error);
         toast({ title: "Error", description: error.message || "Could not update brand.", variant: "destructive" });
     } finally {
         setIsLoading(false);
     }
   };


  if (!currentUser || currentUser.role !== 'Super Admin') {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="mt-2 text-muted-foreground">Verifying access or loading data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
         </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">Edit Brand Settings</h1>

        {isLoading && !company ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="md:col-span-2 space-y-6">
                     <Skeleton className="h-10 w-1/3" /> <Skeleton className="h-12 w-full" />
                     <Skeleton className="h-24 w-full" /> <Skeleton className="h-40 w-full" />
                     <Skeleton className="h-10 w-1/4" />
                 </div>
                 <div className="md:col-span-1 space-y-6">
                     <Skeleton className="h-10 w-2/3" /> <Skeleton className="h-64 w-full" />
                     <Skeleton className="h-10 w-1/2" />
                 </div>
            </div>
        ) : !company ? (
            <div className="text-center text-muted-foreground py-16">Brand not found or access denied.</div>
        ) : (
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Brand Information</CardTitle>
                        <CardDescription>Update the name, description, logo, and user limit for {company.name}.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Brand Name</FormLabel> <FormControl> <Input placeholder="e.g., Global Fitness Inc." {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="subdomainSlug" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"> <Globe className="h-4 w-4" /> Subdomain Slug (Optional) </FormLabel> <FormControl> <Input placeholder="e.g., global-fitness (for global-fitness.yourdomain.com)" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /> </FormControl> <p className="text-xs text-muted-foreground"> Used for branded login URL. Only lowercase letters, numbers, and hyphens. </p> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="customDomain" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"> <Globe className="h-4 w-4" /> Custom Domain (Optional) </FormLabel> <FormControl> <Input placeholder="e.g., learn.yourgym.com" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /> </FormControl> <p className="text-xs text-muted-foreground"> Requires DNS CNAME setup by the brand to point to your app. </p> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="shortDescription" render={({ field }) => ( <FormItem> <FormLabel>Short Description (Optional)</FormLabel> <FormControl> <Textarea rows={3} placeholder="A brief description of the brand (max 150 characters)" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="maxUsers" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"> <Users className="h-4 w-4" /> Maximum Users Allowed </FormLabel> <FormControl> <Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /> </FormControl> <FormMessage /> <p className="text-xs text-muted-foreground"> Set the maximum number of user accounts for this brand. Leave blank for no limit. </p> </FormItem> )} />
                         <FormItem className="space-y-2">
                             <FormLabel className="text-base font-semibold">Brand Logo (Optional)</FormLabel>
                             <FormControl>
                               <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                                 {logoUrlValue && !isUploading ? ( <div className="relative w-32 h-32 mx-auto mb-2"> <Image src={logoUrlValue} alt="Brand logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" onError={() => form.setValue('logoUrl', '')} /> <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '')} aria-label="Remove Logo" > <Trash2 className="h-4 w-4" /> </Button> </div> ) : isUploading ? ( <div className="flex flex-col items-center justify-center h-full py-8"> <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /> <p className="text-sm text-muted-foreground mb-1">Uploading...</p> <Progress value={uploadProgress} className="w-full max-w-xs h-2" /> {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>} </div> ) : ( <Label htmlFor="logo-upload" className="cursor-pointer block"> <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" /> <p className="text-sm text-muted-foreground">Click to upload logo</p> <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isUploading} /> </Label> )}
                               </div>
                             </FormControl>
                             <FormField control={form.control} name="logoUrl" render={({ field }) => ( <FormItem className="hidden"> <FormControl> <Input type="url" {...field} value={field.value ?? ''} readOnly /> </FormControl> <FormMessage /> </FormItem> )} />
                           </FormItem>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader> <CardTitle>White-Label Settings</CardTitle> <CardDescription>Customize the appearance of the platform for this brand.</CardDescription> </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="whiteLabelEnabled" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"> <div className="space-y-0.5"> <FormLabel className="text-base">Enable White-Labeling</FormLabel> <FormDescription> Allow this brand to use custom colors. Logo is set above. </FormDescription> </div> <FormControl> <Checkbox checked={field.value} onCheckedChange={field.onChange} /> </FormControl> </FormItem> )} />
                        {whiteLabelEnabledValue && ( <> <FormField control={form.control} name="primaryColor" render={({ field }) => ( <FormItem> <FormLabel>Primary Color (Hex)</FormLabel> <FormControl><Input type="text" placeholder="#3498db" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={form.control} name="secondaryColor" render={({ field }) => ( <FormItem> <FormLabel>Secondary Color (Hex)</FormLabel> <FormControl><Input type="text" placeholder="#ecf0f1" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} /> <FormField control={form.control} name="accentColor" render={({ field }) => ( <FormItem> <FormLabel>Accent Color (Hex)</FormLabel> <FormControl><Input type="text" placeholder="#2ecc71" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} /> </> )}
                    </CardContent>
                </Card>
             </div>

              <div className="md:col-span-1 space-y-6">
                 {company.isTrial && ( // Show trial info if isTrial is true on the fetched company data
                 <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                    <CardHeader> <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2"> <Gift className="h-5 w-5" /> Trial Information </CardTitle> </CardHeader>
                    <CardContent>
                        <FormField control={form.control} name="isTrial" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mb-4">
                            <FormLabel className="text-sm">Active Trial</FormLabel>
                            <FormControl> <Checkbox checked={field.value} onCheckedChange={field.onChange} /> </FormControl>
                        </FormItem>
                        )} />
                        {isTrialValue && ( // Only show date picker if isTrial from form is true
                            <FormField
                                control={form.control}
                                name="trialEndsAt"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="flex items-center gap-1 text-sm">
                                            <CalendarDays className="h-4 w-4" /> Trial End Date
                                        </FormLabel>
                                        <FormControl>
                                          <div>
                                            <DatePickerWithPresets
                                                date={field.value} // field.value will be Date | null
                                                setDate={(date) => field.onChange(date || null)}
                                            />
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                        <p className="text-xs text-muted-foreground">
                                            Adjust to extend or shorten the trial. Clear to remove end date.
                                        </p>
                                    </FormItem>
                                )}
                            />
                        )}
                  </CardContent>
                </Card>
                )}
                 
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Program Access</CardTitle>
                        <CardDescription>Details of the program assigned to this brand during checkout.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : assignedProgram ? (
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Assigned Program</Label>
                                    <p className="font-semibold text-primary">{assignedProgram.title}</p>
                                    <p className="text-sm text-muted-foreground">{assignedProgram.description}</p>
                                </div>
                                {coursesInProgram.length > 0 && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Courses Included in Program:</Label>
                                        <ScrollArea className="h-40 w-full rounded-md border p-3 mt-1">
                                            <ul className="space-y-1.5">
                                                {coursesInProgram.map(course => (
                                                    <li key={course.id} className="text-sm flex items-center gap-2">
                                                        <BookCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <span>{course.title} <Badge variant="outline" className="ml-1 text-xs">{course.level}</Badge></span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No program assigned to this brand via checkout, or brand was created manually.</p>
                        )}
                    </CardContent>
                 </Card>
                  <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading || isUploading}>
                    {isLoading || isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
              </div>
            </form>
           </Form>
        )}
    </div>
  );
}
