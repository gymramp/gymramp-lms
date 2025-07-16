
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import type { PartnerFormData } from '@/types/partner';
import { getUserByEmail } from '@/lib/user-data';
import { addPartner } from '@/lib/partner-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Handshake, Percent } from 'lucide-react';

// A simplified schema focusing on only the basic fields.
const basicPartnerFormSchema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  companyName: z.string().optional().or(z.literal('')),
  percentage: z.coerce
    .number({ invalid_type_error: "Percentage must be a number." })
    .min(0.01, "Percentage must be greater than 0.")
    .max(100, "Percentage cannot exceed 100."),
});

type BasicPartnerFormValues = z.infer<typeof basicPartnerFormSchema>;

export default function NewPartnerPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<BasicPartnerFormValues>({
    resolver: zodResolver(basicPartnerFormSchema),
    defaultValues: {
      name: '',
      email: '',
      companyName: '',
      percentage: 0,
    },
  });

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

  const onSubmit = (data: BasicPartnerFormValues) => {
    startTransition(async () => {
      // Construct the full PartnerFormData, setting non-included fields to reasonable defaults.
      const partnerFormData: PartnerFormData = {
        name: data.name,
        email: data.email,
        companyName: data.companyName || null,
        percentage: data.percentage,
        logoUrl: null, // Default to null
        availableProgramIds: [], // Default to an empty array
      };

      const newPartner = await addPartner(partnerFormData);
      if (newPartner) {
        toast({ title: "Partner Created", description: `Partner "${newPartner.name}" has been created. You can now edit them to add more details.` });
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
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><Handshake className="h-6 w-6"/> Add New Partner</CardTitle>
              <CardDescription>Fill out the form below to create a new partner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="partner@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Partner Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Percent className="h-4 w-4"/>
                      Revenue Share (%)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0.01" max="100" step="0.01" placeholder="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Partner
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
