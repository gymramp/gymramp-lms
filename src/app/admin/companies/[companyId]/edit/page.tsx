
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
import { getCompanyById, updateCompany, getAllCompanies } from '@/lib/company-data';
import { getAllPrograms, getProgramById, getAllCourses, getCourseById } from '@/lib/firestore-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, Upload, ImageIcon as ImageIconLucide, Trash2, Users, CalendarDays, Briefcase, Package, Save, Layers, BookOpen, Info, GitBranch, Settings, Building, User as UserIcon } from 'lucide-react';
import { getUserByEmail, getUsersByCompanyId } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  
  // States for the new lists
  const [childBrands, setChildBrands] = useState<Company[]>([]);
  const [associatedUsers, setAssociatedUsers] = useState<User[]>([]);
  const [isLoadingRelatedData, setIsLoadingRelatedData] = useState(true);

  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const [assignedProgramsDetails, setAssignedProgramsDetails] = useState<Program[]>([]);
  const [allLibraryCourses, setAllLibraryCourses] = useState<Course[]>([]);
  const [isLoadingProgramData, setIsLoadingProgramData] = useState(true);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '', shortDescription: '', logoUrl: '', maxUsers: null, isTrial: false, trialEndsAt: null, canManageCourses: false,
    },
  });

  const isTrialValue = form.watch('isTrial');
  const logoUrlValue = form.watch('logoUrl');

  const fetchCompanyData = useCallback(async (user: User | null) => {
    if (!companyId || !user) {
      setIsLoading(false);
      setIsLoadingProgramData(false);
      setIsLoadingRelatedData(false);
      return;
    }
    console.log('[EditCompany] Fetching data for brand ID:', companyId);
    setIsLoading(true);
    setIsLoadingProgramData(true);
    setIsLoadingRelatedData(true);

    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      
      const authorized = user.role === 'Super Admin' || (user.companyId && (companyData.id === user.companyId || companyData.parentBrandId === user.companyId));
      if (!authorized) {
        toast({ title: "Access Denied", description: "You cannot edit this brand.", variant: "destructive" });
        router.push(user.role === 'Super Admin' ? '/admin/companies' : '/dashboard');
        return;
      }

      setCompany(companyData);
      form.reset({
        name: companyData.name || '',
        shortDescription: companyData.shortDescription || '',
        logoUrl: companyData.logoUrl || '',
        maxUsers: companyData.maxUsers ?? null,
        isTrial: companyData.isTrial || false,
        trialEndsAt: companyData.trialEndsAt ? new Date(companyData.trialEndsAt as string) : null,
        canManageCourses: companyData.canManageCourses || false,
      });

      // Fetch related data only if it's a parent account
      if (!companyData.parentBrandId) {
        const allCompanies = await getAllCompanies(user);
        const children = allCompanies.filter(c => c.parentBrandId === companyId);
        setChildBrands(children);

        const users = await getUsersByCompanyId(companyId);
        setAssociatedUsers(users);
      } else {
         setChildBrands([]);
         setAssociatedUsers([]);
      }
      setIsLoadingRelatedData(false);


      if (companyData.assignedProgramIds && companyData.assignedProgramIds.length > 0) {
        const [fetchedAllLibCoursesData, programsDetailsPromises] = await Promise.all([
          getAllCourses(),
          Promise.all(companyData.assignedProgramIds.map(id => getProgramById(id)))
        ]);
        setAllLibraryCourses(fetchedAllLibCoursesData);
        setAssignedProgramsDetails(programsDetailsPromises.filter(Boolean) as Program[]);
      } else {
        setAssignedProgramsDetails([]);
        setAllLibraryCourses([]);
      }

    } catch (error: any) {
      console.error("[EditCompany] Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
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
      toast({ title: "Logo Uploaded", description: "Logo uploaded successfully." });
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
    try {
      const metadataToUpdate: Partial<CompanyFormData> = {
        name: data.name,
        shortDescription: data.shortDescription?.trim() === '' ? null : (data.shortDescription || null),
        logoUrl: data.logoUrl?.trim() === '' ? null : data.logoUrl,
        maxUsers: data.maxUsers ?? null,
        isTrial: data.isTrial,
        trialEndsAt: data.isTrial && data.trialEndsAt ? Timestamp.fromDate(new Date(data.trialEndsAt as string)) : null,
        canManageCourses: data.canManageCourses,
        whiteLabelEnabled: company.whiteLabelEnabled,
        primaryColor: company.primaryColor, secondaryColor: company.secondaryColor, accentColor: company.accentColor,
        brandBackgroundColor: company.brandBackgroundColor, brandForegroundColor: company.brandForegroundColor,
        subdomainSlug: company.subdomainSlug, customDomain: company.customDomain,
      };
      const updatedCompany = await updateCompany(companyId, metadataToUpdate);
      if (updatedCompany) {
        setCompany(updatedCompany);
        fetchCompanyData(currentUser);
        toast({ title: "Details Updated", description: `"${updatedCompany.name}" updated successfully.` });
      } else { throw new Error("Failed to update details."); }
    } catch (error: any) {
      console.error("[EditCompany] onSubmit error:", error);
      toast({ title: "Error Updating", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || isLoading || !currentUser) {
    return (
      <div className="container mx-auto">
        <Skeleton className="h-8 w-1/4 mb-6" /> <Skeleton className="h-10 w-1/2 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"> <Skeleton className="h-96" /> <Skeleton className="h-64" /> <Skeleton className="h-64" /> </div>
          <div className="lg:col-span-1 space-y-6"> <Skeleton className="h-80" /> <Skeleton className="h-48" /> <Skeleton className="h-48" /> </div>
        </div>
      </div>
    );
  }

  if (!company) return <div className="container mx-auto text-center">Brand not found.</div>;
  
  const userCanEdit = currentUser?.role === 'Super Admin' || (currentUser?.companyId === company.id || currentUser?.companyId === company.parentBrandId);
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const isParentAccount = !company.parentBrandId;

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push(isParentAccount ? '/admin/accounts' : '/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to {isParentAccount ? 'Accounts' : 'Brands'}
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2"> {isParentAccount ? 'Account Details' : 'Brand Details'}: {company.name} </h1>
      <p className="text-muted-foreground mb-8"> Manage settings for this {isParentAccount ? 'account' : 'brand'}. </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Core Information</CardTitle><CardDescription>Basic identification and descriptive details.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Brand Name" {...field} value={field.value ?? ''} disabled={!userCanEdit} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="shortDescription" render={({ field }) => (<FormItem><FormLabel>Short Description (Optional)</FormLabel><FormControl><Textarea rows={3} placeholder="A brief description (max 150 chars)" {...field} value={field.value ?? ''} disabled={!userCanEdit} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle>Logo</CardTitle><CardDescription>Upload or manage the logo.</CardDescription></CardHeader>
                <CardContent><FormItem><div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                    {logoUrlValue && !isLogoUploading ? ( <div className="relative w-32 h-32 mx-auto mb-2"> <Image src={logoUrlValue} alt="Logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="company logo" onError={() => { form.setValue('logoUrl', ''); toast({ title: "Image Load Error", description:"Could not load logo preview.", variant: "destructive" }); }} /> <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('logoUrl', '')} disabled={!userCanEdit || isLogoUploading}><Trash2 className="h-4 w-4" /></Button> </div> )
                    : isLogoUploading ? ( <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p className="text-sm text-muted-foreground mb-1">Uploading...</p><Progress value={logoUploadProgress} className="w-full max-w-xs h-2" />{logoUploadError && <p className="text-xs text-destructive mt-2">{logoUploadError}</p>}</div> )
                    : ( <Label htmlFor="brand-logo-upload" className={cn("cursor-pointer block", !userCanEdit && "cursor-not-allowed opacity-50")}><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload logo</p><Input id="brand-logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={!userCanEdit || isLogoUploading} /></Label> )}
                    </div><FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem className="hidden"><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem>)} /></FormItem>
                </CardContent>
              </Card>

              {isParentAccount && (
                 <>
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5"/> Child Brands</CardTitle></CardHeader>
                      <CardContent>
                          {isLoadingRelatedData ? <Skeleton className="h-24 w-full" /> : childBrands.length > 0 ? (
                              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
                                {childBrands.map(cb => (<TableRow key={cb.id}><TableCell>{cb.name}</TableCell><TableCell><Badge variant={cb.isTrial ? 'default' : 'secondary'}>{cb.isTrial ? 'Trial' : 'Active'}</Badge></TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link href={`/admin/companies/${cb.id}/edit`}>View Details</Link></Button></TableCell></TableRow>))}
                              </TableBody></Table>
                          ) : <p className="text-sm text-muted-foreground">This account has no child brands.</p>}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5"/> Users in this Account</CardTitle></CardHeader>
                      <CardContent>
                          {isLoadingRelatedData ? <Skeleton className="h-24 w-full" /> : associatedUsers.length > 0 ? (
                               <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
                                {associatedUsers.map(au => (<TableRow key={au.id}><TableCell>{au.name}</TableCell><TableCell>{au.email}</TableCell><TableCell><Badge variant="outline">{au.role}</Badge></TableCell><TableCell className="text-right"><Button asChild variant="outline" size="sm"><Link href={`/admin/users/${au.id}/edit`}>Edit User</Link></Button></TableCell></TableRow>))}
                              </TableBody></Table>
                          ) : <p className="text-sm text-muted-foreground">No users are directly assigned to this parent account.</p>}
                      </CardContent>
                    </Card>
                 </>
              )}

              <Card>
                <CardHeader><CardTitle>White-Label Settings (Placeholder)</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">White-labeling configuration (colors, domain/subdomain) will be managed here.</p></CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              {company.parentBrandId && (
                <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                  <CardHeader> <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300"><GitBranch className="h-5 w-5" />Parent Account</CardTitle> </CardHeader>
                  <CardContent> <p className="text-sm text-blue-700 dark:text-blue-400"> This is a Child Brand of:
                       <Skeleton className="h-5 w-3/4 mt-1" /> {/* Placeholder for parent name */}
                  </p> </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Account Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="maxUsers" render={({ field }) => (<FormItem><FormLabel>Max Users</FormLabel><FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={!userCanEdit} /></FormControl><FormMessage /></FormItem>)} />
                  {isMounted && ( <FormField control={form.control} name="isTrial" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"> <div className="space-y-0.5"><FormLabel>Is Trial?</FormLabel></div> <FormControl><div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} disabled={!isSuperAdmin} /></div></FormControl> </FormItem> )} /> )}
                  {isMounted && isTrialValue && ( <FormField control={form.control} name="trialEndsAt" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Trial End Date</FormLabel> <FormControl><div><DatePickerWithPresets date={field.value} setDate={field.onChange} disabled={!isSuperAdmin} /></div></FormControl> <FormMessage /> </FormItem> )} /> )}
                  {!isSuperAdmin && <p className="text-xs text-muted-foreground italic">Trial settings can only be managed by a Super Admin.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Course Management Ability</CardTitle></CardHeader>
                <CardContent> {isMounted && ( <FormField control={form.control} name="canManageCourses" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"> <div className="space-y-0.5"> <FormLabel className="text-base">Enable Course Management</FormLabel> <FormDescription>Allow this account's Admins to create and manage their own courses.</FormDescription> </div> <FormControl><div><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} disabled={!isSuperAdmin} /></div></FormControl> </FormItem> )} /> )}
                    {!isSuperAdmin && <p className="text-xs text-muted-foreground italic mt-2">Course management ability can only be set by a Super Admin.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Assigned Programs</CardTitle></CardHeader>
                <CardContent>
                  {isLoadingProgramData ? ( <div className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-20 w-full" /></div> )
                  : assignedProgramsDetails.length > 0 ? ( <div className="space-y-4"> {assignedProgramsDetails.map(program => ( <div key={program.id} className="border-b pb-3 last:border-b-0 last:pb-0"> <h4 className="font-semibold text-foreground">{program.title}</h4> <p className="text-sm text-muted-foreground">{program.description}</p> <p className="text-sm text-muted-foreground mt-1">Base Price: <Badge variant="outline">{program.price}</Badge></p> {((program.courseIds?.length || 0) > 0) && allLibraryCourses.length > 0 && ( <div> <h5 className="text-xs font-medium text-muted-foreground mt-2 mb-1">Courses Included:</h5> <ScrollArea className="h-32 w-full rounded-md border p-2 bg-muted/20"> <ul className="space-y-1"> {program.courseIds.map(courseId => allLibraryCourses.find(c => c.id === courseId)).filter(Boolean).map(course => ( <li key={course!.id} className="text-xs text-foreground p-1 rounded-sm flex items-center gap-1.5"> <BookOpen className="h-3 w-3 flex-shrink-0" /> {course!.title} <Badge variant="ghost" className="ml-auto text-xs">{course!.level}</Badge> </li> ))} </ul> </ScrollArea> </div> )} </div> ))} {currentUser?.role === 'Super Admin' && ( <Button variant="outline" size="sm" className="mt-4 w-full" asChild> <Link href={`/admin/companies/${companyId}/manage-programs`}>Manage Assigned Programs</Link> </Button> )} </div> )
                  : ( <> <p className="text-sm text-muted-foreground italic">No programs currently assigned to this brand.</p> {currentUser?.role === 'Super Admin' && ( <Button variant="outline" size="sm" className="mt-4 w-full" asChild> <Link href={`/admin/companies/${companyId}/manage-programs`}>Assign Programs</Link> </Button> )} </> )}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t">
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving || isLogoUploading || !userCanEdit}>
              {isSaving ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </span>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
