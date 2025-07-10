
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { addCompany, getAllCompanies } from '@/lib/company-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Info, ArrowLeft, Building, Upload, ImageIcon, Trash2, Globe, Link as LinkIcon, Users, GitBranch } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const companyFormSchema = z.object({
  name: z.string().min(2, { message: 'Brand name must be at least 2 characters.' }),
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
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function AddNewCompanyPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [parentBrands, setParentBrands] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { name: '', parentBrandId: null, subdomainSlug: null, customDomain: null, shortDescription: null, logoUrl: null, maxUsers: null },
  });
  
  const logoUrlValue = form.watch('logoUrl');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (!userDetails || !['Super Admin', 'Admin', 'Owner'].includes(userDetails.role)) {
          toast({ title: "Access Denied", description: "You don't have permission to create new brands.", variant: "destructive" });
          router.push('/dashboard');
          setIsLoading(false);
          return;
        }

        if (userDetails.role === 'Super Admin') {
          try {
            const allCompanies = await getAllCompanies(userDetails);
            // Filter for parent brands (those without a parentBrandId)
            const parents = allCompanies.filter(c => !c.parentBrandId);
            setParentBrands(parents);
          } catch (error) {
             toast({ title: "Error", description: "Could not load parent brands.", variant: "destructive" });
          }
        }
        setIsLoading(false);

      } else {
        router.push('/');
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, toast]);
  
  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;

       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);

       try {
           const uniqueFileName = `${Date.now()}-${file.name}`;
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
    startTransition(async () => {
      if (!currentUser) { toast({ title: "Error", description: "Current user not found.", variant: "destructive" }); return; }
      if (isUploading) { toast({ title: "Upload in Progress", description: "Please wait for the logo upload to complete.", variant: "destructive" }); return; }
      
      const formData: CompanyFormData = {
        name: data.name,
        subdomainSlug: data.subdomainSlug?.trim().toLowerCase() || null,
        customDomain: data.customDomain?.trim().toLowerCase() || null,
        shortDescription: data.shortDescription || null,
        logoUrl: data.logoUrl || null,
        maxUsers: data.maxUsers ?? null,
        assignedProgramIds: [], isTrial: false, trialEndsAt: null, saleAmount: null, revenueSharePartners: null,
        whiteLabelEnabled: false, primaryColor: null, secondaryColor: null, accentColor: null,
        brandBackgroundColor: null, brandForegroundColor: null, canManageCourses: false,
        stripeCustomerId: null, stripeSubscriptionId: null, parentBrandId: null, createdByUserId: null,
      };

      let parentBrandIdForChild: string | null = null;
      if (currentUser.role === 'Super Admin') {
        parentBrandIdForChild = data.parentBrandId || null;
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
        parentBrandIdForChild = currentUser.companyId;
      }
      
      const newCompany = await addCompany(formData, currentUser.id, parentBrandIdForChild);
      
      if (newCompany) {
        toast({ title: "Brand Created", description: `Successfully created the brand "${newCompany.name}".` });
        router.push(`/admin/companies/${newCompany.id}/edit`);
      } else {
        toast({ title: 'Brand Creation Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    });
  };

  if (isLoading || !currentUser) {
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
      <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
      </Button>

      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Building className="h-6 w-6"/> Add New Brand</CardTitle>
          <CardDescription>Fill out the form below to create a new customer brand. This will create a Parent Brand if you are a Super Admin, or a Child Brand if you are an Admin/Owner.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Brand Name</FormLabel> <FormControl><Input placeholder="e.g., Global Fitness Inc." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                
                {currentUser.role === 'Super Admin' && (
                  <FormField
                    control={form.control}
                    name="parentBrandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><GitBranch className="h-4 w-4" /> Parent Brand (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a parent brand to create a child brand..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                             <SelectItem value="">None (Create as Parent Brand)</SelectItem>
                            {parentBrands.map(brand => (
                              <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Assigning a parent brand makes this a "Child Brand". Leave blank to create a "Parent Brand".</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField control={form.control} name="shortDescription" render={({ field }) => ( <FormItem> <FormLabel>Short Description (Optional)</FormLabel> <FormControl><Textarea rows={3} placeholder="A brief description of the brand (max 150 characters)" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="subdomainSlug" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Globe className="h-4 w-4" /> Subdomain (Optional)</FormLabel> <FormControl><Input placeholder="e.g., global-fitness" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /></FormControl> <FormDescription className="text-xs">Lowercase letters, numbers, hyphens.</FormDescription> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="customDomain" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><LinkIcon className="h-4 w-4" /> Custom Domain (Optional)</FormLabel> <FormControl><Input placeholder="e.g., learn.partner.com" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value.toLowerCase())} /></FormControl> <FormDescription className="text-xs">Requires DNS configuration.</FormDescription> <FormMessage /> </FormItem> )} />
                </div>
                
                <FormField control={form.control} name="maxUsers" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" /> Max Users</FormLabel> <FormControl><Input type="number" min="1" placeholder="Leave blank for unlimited" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl> <FormMessage /> </FormItem> )} />

                <FormItem>
                    <FormLabel>Brand Logo (Optional)</FormLabel>
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
                {isPending ? 'Creating Brand...' : 'Create Brand'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
