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
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { getCompanyById, updateCompany, updateCompanyCourseAssignments } from '@/lib/company-data';
import { getAllCourses } from '@/lib/firestore-data';
import type { Company, CompanyFormData, User } from '@/types/user';
import type { Course } from '@/types/course';
import { Loader2, Upload, ImageIcon, Trash2, BookCheck, ArrowLeft, Users, CalendarDays, Gift } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Timestamp } from 'firebase/firestore';

const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Company name must be at least 2 characters.' }),
  shortDescription: z.string().max(150, { message: 'Description must be 150 characters or less.' }).optional().or(z.literal('')),
  logoUrl: z.string().url({ message: 'Invalid URL format.' }).optional().or(z.literal('')),
  maxUsers: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int({ message: "Must be a whole number" })
    .positive({ message: "Must be a positive number" })
    .min(1, { message: "Minimum 1 user" })
    .optional()
    .nullable(),
  assignedCourseIds: z.array(z.string()).optional(),
  isTrial: z.boolean().optional(), // Keep for display logic, but not directly edited as a checkbox here.
  trialEndsAt: z.date().nullable().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [allLibraryCourses, setAllLibraryCourses] = useState<Course[]>([]);
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
      shortDescription: '',
      logoUrl: '',
      maxUsers: null,
      assignedCourseIds: [],
      isTrial: false,
      trialEndsAt: null,
    },
  });

   const logoUrlValue = form.watch('logoUrl');
   const isTrialValue = form.watch('isTrial'); // Watch for conditional rendering

  // Auth check and initial data fetch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to edit companies.", variant: "destructive" });
          router.push('/admin/companies');
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchCompanyAndCourses = useCallback(async () => {
    if (!companyId || !currentUser || currentUser.role !== 'Super Admin') return;
    setIsLoading(true);
    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Company not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      setCompany(companyData);
      form.reset({
        name: companyData.name,
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        maxUsers: companyData.maxUsers ?? null,
        assignedCourseIds: companyData.assignedCourseIds || [],
        isTrial: companyData.isTrial || false,
        trialEndsAt: companyData.trialEndsAt instanceof Timestamp ? companyData.trialEndsAt.toDate() : null,
      });

      const courses = await getAllCourses();
      setAllLibraryCourses(courses);
    } catch (error) {
      console.error("Failed to fetch company/courses:", error);
      toast({ title: "Error", description: "Could not load company or course data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, router, toast, form, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchCompanyAndCourses();
    }
  }, [fetchCompanyAndCourses, currentUser]);


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
           toast({ title: "Logo Uploaded", description: "Company logo successfully uploaded." });
       } catch (error: any) {
           setUploadError(error.message || "Failed to upload logo.");
           toast({ title: "Upload Failed", description: error.message || "Could not upload the company logo.", variant: "destructive" });
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
     setIsLoading(true); // Use main loading state for submit operation
     try {
        const metadataToUpdate: Partial<CompanyFormData> = {
            name: data.name,
            shortDescription: data.shortDescription || null,
            logoUrl: data.logoUrl || null,
            maxUsers: data.maxUsers ?? null,
            // isTrial is not directly editable here, it's part of the company's inherent state
            // trialEndsAt can be updated
            trialEndsAt: data.trialEndsAt ? Timestamp.fromDate(data.trialEndsAt) : null,
        };

        const updatedCompanyMeta = await updateCompany(companyId, metadataToUpdate);
        if (!updatedCompanyMeta) {
            throw new Error("Failed to update company metadata.");
        }

        const assignmentsSuccess = await updateCompanyCourseAssignments(companyId, data.assignedCourseIds || []);
        if (!assignmentsSuccess) {
            throw new Error("Failed to update course assignments.");
        }

        toast({ title: "Company Updated", description: `"${data.name}" updated successfully.` });
        // Re-fetch data to reflect changes and ensure form is up-to-date
        fetchCompanyAndCourses();

     } catch (error: any) {
         console.error("Failed to update company:", error);
         toast({ title: "Error", description: error.message || "Could not update company.", variant: "destructive" });
     } finally {
         setIsLoading(false);
     }
   };


  if (!currentUser || currentUser.role !== 'Super Admin') {
    // This state will be hit if auth check fails or role is not Super Admin
    // The useEffect for auth already redirects, but this is a fallback.
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
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Companies
         </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">Edit Company Settings</h1>

        {isLoading && !company ? ( // Show skeleton only if initial data is loading
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
        ) : !company ? ( // If not loading and still no company, show not found
            <div className="text-center text-muted-foreground py-16">Company not found or access denied.</div>
        ) : (
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Company Information</CardTitle>
                        <CardDescription>Update the name, description, logo, and user limit for {company.name}.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Global Fitness Inc."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="shortDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Short Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea rows={3} placeholder="A brief description of the company (max 150 characters)" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                                  onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">
                                Set the maximum number of user accounts for this company. Leave blank for no limit.
                              </p>
                            </FormItem>
                          )}
                        />

                        {/* Trial End Date Picker - only shown if isTrial is true */}
                        {isTrialValue && (
                             <FormField
                                control={form.control}
                                name="trialEndsAt"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-1">
                                        <CalendarDays className="h-4 w-4" /> Trial End Date
                                    </FormLabel>
                                    <FormControl>
                                        <DatePickerWithPresets
                                            date={field.value}
                                            setDate={(date) => field.onChange(date || null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground">
                                        Current trial end date. Adjust to extend or shorten the trial.
                                    </p>
                                  </FormItem>
                                )}
                              />
                        )}

                        {/* Logo Upload Section */}
                         <FormItem className="space-y-2">
                             <FormLabel className="text-base font-semibold">Company Logo (Optional)</FormLabel>
                             <FormControl>
                               <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                                 {logoUrlValue && !isUploading ? (
                                   <div className="relative w-32 h-32 mx-auto mb-2">
                                     <Image
                                       src={logoUrlValue}
                                       alt="Company logo preview"
                                       fill
                                       style={{ objectFit: 'contain' }}
                                       className="rounded-md"
                                       onError={() => form.setValue('logoUrl', '')} // Clear if URL is broken
                                     />
                                     <Button
                                       type="button"
                                       variant="destructive"
                                       size="icon"
                                       className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                                       onClick={() => form.setValue('logoUrl', '')}
                                       aria-label="Remove Logo"
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
                              {/* Hidden FormField to bind logoUrl to RHF for validation */}
                             <FormField
                                control={form.control}
                                name="logoUrl"
                                render={({ field }) => (
                                   <FormItem className="hidden"> {/* Keep hidden, value is managed by upload logic */}
                                     <FormControl>
                                       <Input type="url" {...field} value={field.value ?? ''} readOnly />
                                     </FormControl>
                                     <FormMessage />
                                   </FormItem>
                                )}
                              />
                           </FormItem>
                    </CardContent>
                </Card>
             </div>
              <div className="md:col-span-1 space-y-6">
                  {/* Trial Information Display Card */}
                 {isTrialValue && ( // Show only if company.isTrial is true
                    <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                        <CardHeader>
                            <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                <Gift className="h-5 w-5" /> Trial Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                This company is currently on a trial.
                                {company?.trialEndsAt instanceof Timestamp && (
                                    ` Trial ends on: ${company.trialEndsAt.toDate().toLocaleDateString()}`
                                )}
                            </p>
                             {/* Checkbox to explicitly mark a company as NOT a trial */}
                             {/* This might be handled differently, e.g., converting to paid plan */}
                             <FormField
                                control={form.control}
                                name="isTrial"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4 rounded-md border p-3">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            // disabled // Might want to disable direct editing here if trial status change is a separate process
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                        Mark as Active Trial
                                        </FormLabel>
                                        <FormDescription>
                                        Check if this company is currently on a trial period. Uncheck to mark as not a trial.
                                        </FormDescription>
                                    </div>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                 )}

                 {/* Course Assignment Card */}
                 <Card>
                   <CardHeader>
                     <CardTitle>Assign Courses</CardTitle>
                     <CardDescription>Select the courses from the library that should be available to this company.</CardDescription>
                   </CardHeader>
                   <CardContent>
                     <FormField
                       control={form.control}
                       name="assignedCourseIds"
                       render={() => ( // No field prop needed for direct access to form methods
                         <FormItem>
                           {allLibraryCourses.length === 0 ? (
                             <p className="text-sm text-muted-foreground italic">No courses available in the library.</p>
                           ) : (
                             <ScrollArea className="h-72 w-full rounded-md border p-4">
                               <div className="space-y-2">
                                 {allLibraryCourses.map((course) => (
                                   <FormField
                                     key={course.id}
                                     control={form.control}
                                     name="assignedCourseIds"
                                     render={({ field: checkboxField }) => ( // Use a different name for the inner field
                                       <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-md">
                                         <FormControl>
                                           <Checkbox
                                             checked={checkboxField.value?.includes(course.id)}
                                             onCheckedChange={(checked) => {
                                               const currentIds = checkboxField.value || [];
                                               const newIds = checked
                                                 ? [...currentIds, course.id]
                                                 : currentIds.filter((value) => value !== course.id);
                                               checkboxField.onChange(newIds);
                                             }}
                                           />
                                         </FormControl>
                                         <FormLabel className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                                           <BookCheck className="h-4 w-4 text-muted-foreground" />
                                           {course.title}
                                           <span className="text-xs text-muted-foreground">({course.level})</span>
                                         </FormLabel>
                                       </FormItem>
                                     )}
                                   />
                                 ))}
                               </div>
                             </ScrollArea>
                           )}
                           <FormMessage /> {/* For assignedCourseIds validation errors */}
                         </FormItem>
                       )}
                     />
                   </CardContent>
                 </Card>
                  <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading || isUploading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
              </div>
            </form>
           </Form>
        )}
    </div>
  );
}