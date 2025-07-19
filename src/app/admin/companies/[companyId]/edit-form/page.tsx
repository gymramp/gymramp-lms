
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { User, Company, CompanyFormData } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById, updateCompany, getAllCompanies } from '@/lib/company-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Info, ArrowLeft, Building, Upload, ImageIcon, Trash2, Globe, Link as LinkIcon, Users, GitBranch, Briefcase, Gift, Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Timestamp } from 'firebase/firestore';

const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Account name must be at least 2 characters.' }),
  parentBrandId: z.string().optional().nullable(),
  subdomainSlug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens, and cannot start/end with a hyphen.' })
    .min(3, { message: 'Subdomain slug must be at least 3 characters.'})
    .max(63, { message: 'Subdomain slug cannot exceed 63 characters.'})
    .optional().or(z.literal('')).nullable(),
  customDomain: z.string()
     .regex(/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,6})+$/, { message: 'Please enter a valid domain name (e.g., example.com).' })
     .optional().or(z.literal('')).nullable(),
  shortDescription: z.string().max(150, { message: 'Description must be 150 characters or less.' }).optional().or(z.literal('')).nullable(),
  logoUrl: z.string().url({ message: 'Invalid URL format.' }).optional().or(z.literal('')).nullable(),
  maxUsers: z.coerce.number().int().positive().min(1).optional().nullable(),
  isTrial: z.boolean().default(false),
  trialEndsAt: z.date().nullable().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function EditCompanyFormPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [parentBrands, setParentBrands] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const { toast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { name: '', parentBrandId: null, subdomainSlug: null, customDomain: null, shortDescription: null, logoUrl: null, maxUsers: null, isTrial: false, trialEndsAt: null },
  });
  
  const logoUrlValue = form.watch('logoUrl');
  const isTrialValue = form.watch('isTrial');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (!userDetails || !['Super Admin', 'Admin', 'Owner'].includes(userDetails.role)) {
          toast({ title: "Access Denied", description: "You don't have permission.", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchInitialData = useCallback(async (user: User) => {
    setIsLoading(true);
    try {
        const companyData = await getCompanyById(companyId);
        if (!companyData || (user.role !== 'Super Admin' && user.companyId !== companyData.id && user.companyId !== companyData.parentBrandId)) {
             toast({ title: "Error", description: "Account not found or access denied.", variant: "destructive" });
             router.push('/admin/accounts');
             return;
        }
        setCompanyToEdit(companyData);
        
        let trialDate: Date | null = null;
        if(companyData.trialEndsAt) {
            trialDate = companyData.trialEndsAt instanceof Date ? companyData.trialEndsAt : new Date(companyData.trialEndsAt as string);
        }

        form.reset({
            name: companyData.name,
            parentBrandId: companyData.parentBrandId,
            subdomainSlug: companyData.subdomainSlug,
            customDomain: companyData.customDomain,
            shortDescription: companyData.shortDescription,
            logoUrl: companyData.logoUrl,
            maxUsers: companyData.maxUsers,
            isTrial: companyData.isTrial,
            trialEndsAt: trialDate,
        });

        if (user.role === 'Super Admin') {
            const allCompanies = await getAllCompanies(user);
            // Can't be a parent to itself or one of its children
            const possibleParents = allCompanies.filter(c => c.id !== companyId && c.parentBrandId !== companyId);
            setParentBrands(possibleParents);
        }
    } catch (error) {
        toast({ title: "Error", description: "Could not load account data.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [companyId, form, router, toast]);

  useEffect(() => {
      if (currentUser) {
          fetchInitialData(currentUser);
      }
  }, [currentUser, fetchInitialData]);

  
  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;

       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);

       try {
           const uniqueFileName = `${companyId}-logo-${file.name}`;
           const storagePath = `${STORAGE_PATHS.COMPANY_LOGOS}/${uniqueFileName}`;
           const downloadURL = await uploadImage(file, storagePath, setUploadProgress);
           form.setValue('logoUrl', downloadURL, { shouldValidate: true });
           toast({ title: "Logo Uploaded", description: "Logo successfully uploaded." });
       } catch (error: any) {
           setUploadError(error.message || "Failed to upload logo.");
           toast({ title: "Upload Failed", description: error.message || "Could not upload the logo.", variant: "destructive" });
       } finally {
           setIsUploading(false);
       }
   };

  const onSubmit = async (data: CompanyFormValues) => {
    startTransition(async () => {
      if (!currentUser || !companyId) { toast({ title: "Error", variant: "destructive" }); return; }
      
      const formData: Partial<CompanyFormData> = {
        name: data.name,
        subdomainSlug: data.subdomainSlug?.trim().toLowerCase() || null,
        customDomain: data.customDomain?.trim().toLowerCase() || null,
        shortDescription: data.shortDescription || null,
        logoUrl: data.logoUrl || null,
        maxUsers: data.maxUsers ?? null,
        parentBrandId: data.parentBrandId || null,
        isTrial: data.isTrial,
        trialEndsAt: data.isTrial ? (data.trialEndsAt ? Timestamp.fromDate(data.trialEndsAt) : null) : null,
      };
      
      const updatedCompany = await updateCompany(companyId, formData);
      
      if (updatedCompany) {
        toast({ title: `Account Updated`, description: `Successfully updated "${updatedCompany.name}".` });
        router.push(`/admin/companies/${updatedCompany.id}/edit`);
      } else {
        toast({ title: 'Update Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    });
  };

  if (isLoading || !currentUser || !companyToEdit) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-1/3" />
        <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push(`/admin/companies/${companyId}/edit`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Account Details
      </Button>

      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Building className="h-6 w-6"/> Edit Account: {companyToEdit.name}</CardTitle>
          <CardDescription>Update the information for this account.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Account Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                
                {currentUser.role === 'Super Admin' && (
                  <FormField
                    control={form.control}
                    name="parentBrandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><GitBranch className="h-4 w-4" /> Parent Account</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                          value={field.value || "none"}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a parent..." /></SelectTrigger></FormControl>
                          <SelectContent>
                             <SelectItem value="none">None (This is a Parent Account)</SelectItem>
                            {parentBrands.map(brand => (
                              <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Changing this will move the brand under a different parent.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Gift className="h-5 w-5"/> Trial Management</CardTitle>
                        <CardDescription>Extend a trial period or convert the account to paid.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="isTrial"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Trial Active</FormLabel>
                                    <FormDescription className="text-xs">
                                    {field.value ? "This account is currently in a trial period." : "This is a paid account."}
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-readonly
                                    />
                                </FormControl>
                                </FormItem>
                            )}
                        />
                        {isTrialValue && (
                             <FormField
                                control={form.control}
                                name="trialEndsAt"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-1"><CalendarIcon className="h-4 w-4"/> Trial End Date</FormLabel>
                                    <DatePickerWithPresets date={field.value} setDate={field.onChange} />
                                    <FormDescription className="text-xs">Set a new end date to extend the trial.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                    </CardContent>
                </Card>

                <FormField control={form.control} name="shortDescription" render={({ field }) => ( <FormItem> <FormLabel>Short Description</FormLabel> <FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="subdomainSlug" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Globe className="h-4 w-4" /> Subdomain</FormLabel> <FormControl><Input {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /></FormControl> <FormDescription className="text-xs">Lowercase, numbers, hyphens.</FormDescription> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="customDomain" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><LinkIcon className="h-4 w-4" /> Custom Domain</FormLabel> <FormControl><Input {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /></FormControl> <FormDescription className="text-xs">Requires DNS configuration.</FormDescription> <FormMessage /> </FormItem> )} />
                </div>
                
                <FormField control={form.control} name="maxUsers" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" /> Max Users</FormLabel> <FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl> <FormMessage /> </FormItem> )} />

                <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                        {logoUrlValue && !isUploading ? (
                            <div className="relative w-32 h-32 mx-auto mb-2"><Image src={logoUrlValue} alt="Logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" onError={() => form.setValue('logoUrl', null)} /><Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => form.setValue('logoUrl', null)}><Trash2 className="h-4 w-4" /></Button></div>
                        ) : isUploading ? (
                            <div className="py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /><Progress value={uploadProgress} className="w-full h-2" />{uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}</div>
                        ) : (
                            <Label htmlFor="logo-upload" className="cursor-pointer block"><ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload logo</p><Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isUploading} /></Label>
                        )}
                    </div>
                </FormItem>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending || isUploading}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <span>{isPending ? 'Saving...' : 'Save Changes'}</span>
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
