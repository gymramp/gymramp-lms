
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import type { User, Company } from '@/types/user';
import type { Partner, PartnerFormData } from '@/types/partner';
import type { Program } from '@/types/course';
import { getUserByEmail } from '@/lib/user-data';
import { addPartner } from '@/lib/partner-data';
import { getAllPrograms } from '@/lib/firestore-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Handshake, Upload, ImageIcon as ImageIconLucide, Trash2, Percent, Layers, BookCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const partnerFormSchema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  companyName: z.string().optional().or(z.literal('')),
  percentage: z.coerce
    .number({ invalid_type_error: "Percentage must be a number." })
    .min(0.01, "Percentage must be greater than 0.")
    .max(100, "Percentage cannot exceed 100."),
  logoUrl: z.string().url().optional().or(z.literal('')),
  availableProgramIds: z.array(z.string()).min(1, "At least one program must be selected."),
});

type PartnerFormValues = z.infer<typeof partnerFormSchema>;

export default function NewPartnerPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', email: '', companyName: '', percentage: 0, logoUrl: '', availableProgramIds: [] },
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
        } else {
          try {
            const fetchedPrograms = await getAllPrograms();
            setPrograms(fetchedPrograms);
          } catch (err) {
            toast({ title: "Error", description: "Could not load available programs.", variant: "destructive" });
          }
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
      const partnerFormData: PartnerFormData = {
        name: data.name,
        email: data.email,
        companyName: data.companyName || null,
        percentage: data.percentage,
        logoUrl: data.logoUrl || null,
        availableProgramIds: data.availableProgramIds,
      };
      const newPartner = await addPartner(partnerFormData);
      if (newPartner) {
        toast({ title: "Partner Created", description: `Partner "${newPartner.name}" has been successfully created.` });
        router.push(`/admin/partners/${newPartner.id}/edit`);
      } else {
        toast({ title: "Creation Failed", variant: "destructive" });
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
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><Handshake className="h-6 w-6"/> Add New Partner</CardTitle>
              <CardDescription>Fill out the form below to create a new partner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Partner Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" placeholder="partner@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>Company Name (Optional)</FormLabel><FormControl><Input placeholder="Partner Co." {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="percentage" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1"><Percent className="h-4 w-4"/>Revenue Share (%)</FormLabel><FormControl><Input type="number" min="0.01" max="100" step="0.01" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem> )} />
              
              <FormItem>
                <Label>Partner Logo (Optional)</Label>
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

              <FormField control={form.control} name="availableProgramIds" render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base font-semibold flex items-center gap-1"><Layers className="h-4 w-4"/>Available Programs</FormLabel>
                    <FormDescription>Select the programs this partner's customers can purchase.</FormDescription>
                  </div>
                  {programs.length > 0 ? (
                    <ScrollArea className="h-60 w-full rounded-md border p-4">
                      {programs.map((program) => (
                        <FormField key={program.id} control={form.control} name="availableProgramIds" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(program.id)}
                                onCheckedChange={(checked) => {
                                  const currentIds = field.value || [];
                                  const newIds = checked ? [...currentIds, program.id] : currentIds.filter((id) => id !== program.id);
                                  field.onChange(newIds);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                              <BookCheck className="h-4 w-4 text-muted-foreground" />{program.title}
                            </FormLabel>
                          </FormItem>
                        )} />
                      ))}
                    </ScrollArea>
                  ) : <p className="text-sm text-muted-foreground italic">No programs available to assign.</p>}
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending || isUploading}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Partner
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
