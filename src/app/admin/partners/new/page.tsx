
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { User, UserFormData } from '@/types/user';
import type { PartnerFormData } from '@/types/partner';
import { getUserByEmail, addUser } from '@/lib/user-data';
import { addPartner } from '@/lib/partner-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Handshake, Percent, Upload, ImageIcon as ImageIconLucide, Trash2 } from 'lucide-react';
import { generateRandomPassword } from '@/lib/utils';
import { sendNewUserWelcomeEmail } from '@/lib/email';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info } from 'lucide-react';

const partnerFormSchema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  companyName: z.string().optional().or(z.literal('')),
  percentage: z.coerce
    .number({ invalid_type_error: "Percentage must be a number." })
    .min(0.01, "Percentage must be greater than 0.")
    .max(100, "Percentage cannot exceed 100."),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

type PartnerFormValues = z.infer<typeof partnerFormSchema>;

export default function NewPartnerPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', email: '', companyName: '', percentage: 0, logoUrl: '' },
  });

  const logoUrlValue = form.watch('logoUrl');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (!userDetails || userDetails.role !== 'Super Admin') {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/admin/dashboard');
        }
      } else {
        router.push('/');
      }
      setIsLoading(false);
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
      const uniqueFileName = `${Date.now()}-partnerlogo-${file.name}`;
      const storagePath = `${STORAGE_PATHS.PARTNER_LOGOS}/${uniqueFileName}`;
      const downloadURL = await uploadImage(file, storagePath, setUploadProgress);
      form.setValue('logoUrl', downloadURL, { shouldValidate: true });
      toast({ title: "Logo Uploaded" });
    } catch (error: any) {
      setUploadError(error.message || "Failed to upload logo.");
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (data: PartnerFormValues) => {
    startTransition(async () => {
        // Step 1: Create the Partner document
        const partnerFormData: PartnerFormData = {
          ...data,
          companyName: data.companyName || null,
          logoUrl: data.logoUrl || null,
          availableProgramIds: [],
        };

        const newPartner = await addPartner(partnerFormData);
        if (!newPartner) {
            toast({ title: "Partner Creation Failed", description: "Could not create the partner document.", variant: "destructive" });
            return;
        }

        // Step 2: Create a corresponding User document for the Partner
        try {
            const tempPassword = generateRandomPassword();
            const newPartnerUserData: Omit<UserFormData, 'password'> = {
                name: data.name,
                email: data.email,
                role: 'Partner',
                companyId: null, // Partners are not tied to a company
                assignedLocationIds: [],
                profileImageUrl: data.logoUrl || null,
                isActive: true,
            };
            
            // This Server Action creates the user in both Auth and Firestore
            const result = await createUserAndSendWelcomeEmail(newPartnerUserData);
            
            if (result.success && result.user) {
                 toast({ title: "Partner & User Created", description: `Partner "${newPartner.name}" created. Welcome email sent.`, duration: 7000 });
                 router.push(`/admin/partners/${newPartner.id}/edit`);
            } else {
                 // Attempt to roll back partner creation if user creation fails
                 // await deletePartner(newPartner.id); // Consider if a rollback function is needed
                 toast({ title: "User Creation Failed", description: result.error || 'The partner was created, but their login account failed. Please create the user manually with the "Partner" role.', variant: "destructive", duration: 10000 });
            }
        } catch (userCreationError: any) {
             toast({ title: "User Creation Error", description: userCreationError.message || "Could not create the user account for the partner.", variant: "destructive" });
        }
    });
  };

  if (isLoading) {
    return <div className="container mx-auto"><Skeleton className="h-screen w-full" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/admin/partners')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Partners
      </Button>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><Handshake className="h-6 w-6"/> Add New Partner</CardTitle>
              <CardDescription>Fill out the form below to create a new partner. This will also create a 'Partner' user account so they can log in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Partner Login</AlertTitle>
                  <AlertDescription>
                    Creating a partner will automatically generate a corresponding user account with a temporary password, which will be sent to their email address.
                  </AlertDescription>
                </Alert>
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Partner Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Contact & Login Email</FormLabel><FormControl><Input type="email" placeholder="partner@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name (Optional)</FormLabel><FormControl><Input placeholder="Partner Co." {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="percentage" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1"><Percent className="h-4 w-4"/>Revenue Share (%)</FormLabel><FormControl><Input type="number" min="0.01" max="100" step="0.01" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormItem>
                <FormLabel>Partner Logo (Optional)</FormLabel>
                <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                  {logoUrlValue && !isUploading ? (
                    <div className="relative w-32 h-32 mx-auto mb-2">
                      <Image src={logoUrlValue} alt="Logo preview" fill style={{ objectFit: 'contain' }} className="rounded-md" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => form.setValue('logoUrl', '')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : isUploading ? (
                    <div className="py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /><Progress value={uploadProgress} className="w-full h-2" />{uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}</div>
                  ) : (
                    <Label htmlFor="logo-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload logo</p><Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} disabled={isUploading} /></Label>
                  )}
                </div>
              </FormItem>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending || isUploading}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Partner & User Account
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
