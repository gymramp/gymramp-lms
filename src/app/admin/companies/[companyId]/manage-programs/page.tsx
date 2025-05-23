
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Company, User } from '@/types/user';
import type { Program } from '@/types/course';
import { getCompanyById, updateCompany } from '@/lib/company-data';
import { getAllPrograms } from '@/lib/firestore-data';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, Layers, PackagePlus, Save, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const manageProgramsFormSchema = z.object({
  assignedProgramIds: z.array(z.string()).optional(),
});

type ManageProgramsFormValues = z.infer<typeof manageProgramsFormSchema>;

export default function ManageBrandProgramsPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.companyId as string;

  const [brand, setBrand] = useState<Company | null>(null);
  const [allLibraryPrograms, setAllLibraryPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const form = useForm<ManageProgramsFormValues>({
    resolver: zodResolver(manageProgramsFormSchema),
    defaultValues: {
      assignedProgramIds: [],
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to manage brand programs.", variant: "destructive" });
          router.push('/admin/companies');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchBrandAndPrograms = useCallback(async () => {
    if (!brandId || !currentUser || currentUser.role !== 'Super Admin') {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      const [brandData, programsData] = await Promise.all([
        getCompanyById(brandId),
        getAllPrograms(),
      ]);

      if (!brandData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      setBrand(brandData);
      setAllLibraryPrograms(programsData);
      form.reset({
        assignedProgramIds: brandData.assignedProgramIds || [],
      });
    } catch (error) {
      console.error("Failed to fetch brand or programs:", error);
      toast({ title: "Error", description: "Could not load brand or program data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [brandId, router, toast, form, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchBrandAndPrograms();
    }
  }, [fetchBrandAndPrograms, currentUser]);

  const onSubmit = async (data: ManageProgramsFormValues) => {
    if (!brandId) return;
    setIsSaving(true);
    try {
      const updatedCompany = await updateCompany(brandId, { assignedProgramIds: data.assignedProgramIds || [] });
      if (updatedCompany) {
        toast({ title: "Programs Updated", description: `Program assignments for "${brand?.name}" updated successfully.` });
        setBrand(updatedCompany); // Update local brand state
        form.reset({ assignedProgramIds: updatedCompany.assignedProgramIds || [] }); // Re-sync form
      } else {
        throw new Error("Failed to update brand program assignments.");
      }
    } catch (error: any) {
      toast({ title: "Error Updating Programs", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20 space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-1/2" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          <CardContent><Skeleton className="h-10 w-1/4 ml-auto" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!brand) {
    return <div className="container mx-auto py-12 text-center">Brand not found.</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push(`/admin/companies/${brandId}/edit`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit Brand: {brand.name}
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2 flex items-center gap-2">
        <Layers className="h-7 w-7" /> Manage Assigned Programs for: {brand.name}
      </h1>
      <p className="text-muted-foreground mb-8">Select the programs this brand should have access to.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Programs in Library</CardTitle>
              <CardDescription>Check the programs to assign to this brand.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="assignedProgramIds"
                render={() => (
                  <FormItem>
                    {allLibraryPrograms.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No programs available in the library.</p>
                    ) : (
                      <ScrollArea className="h-96 w-full rounded-md border p-4">
                        <div className="space-y-2">
                          {allLibraryPrograms.map((program) => (
                            <FormField
                              key={program.id}
                              control={form.control}
                              name="assignedProgramIds"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-md">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(program.id)}
                                      onCheckedChange={(checked) => {
                                        const currentIds = field.value || [];
                                        const newIds = checked
                                          ? [...currentIds, program.id]
                                          : currentIds.filter((value) => value !== program.id);
                                        field.onChange(newIds);
                                      }}
                                      id={`program-${program.id}`}
                                    />
                                  </FormControl>
                                  <FormLabel htmlFor={`program-${program.id}`} className="font-normal flex flex-col cursor-pointer flex-1">
                                    <span className="flex items-center gap-2">
                                      <PackagePlus className="h-4 w-4 text-muted-foreground" />
                                      {program.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground pl-6">{program.description}</span>
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Program Assignments
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

