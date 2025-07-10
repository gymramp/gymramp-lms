
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, CreditCard, Layers, User, Building } from 'lucide-react';
import type { Program } from '@/types/course';
import { getAllPrograms } from '@/lib/firestore-data';
import Image from 'next/image';

const signupFormSchema = z.object({
  customerName: z.string().min(2, { message: "Your full name is required." }),
  companyName: z.string().min(2, { message: "Your company or brand name is required." }),
  adminEmail: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  selectedProgramId: z.string().min(1, "Please select a program to purchase."),
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export default function SignupPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      customerName: '',
      companyName: '',
      adminEmail: '',
      password: '',
      selectedProgramId: '',
    },
  });

  const selectedProgramId = form.watch('selectedProgramId');
  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const totalAmount = selectedProgram ? parseFloat(selectedProgram.price.replace(/[$,/mo]/gi, '')) : 0;

  useEffect(() => {
    async function fetchPrograms() {
      setIsLoadingPrograms(true);
      try {
        const programsData = await getAllPrograms();
        setPrograms(programsData);
        if (programsData.length === 1) {
            form.setValue('selectedProgramId', programsData[0].id);
        }
      } catch (error) {
        toast({ title: "Error", description: "Could not load available programs.", variant: "destructive" });
      } finally {
        setIsLoadingPrograms(false);
      }
    }
    fetchPrograms();
  }, [toast, form]);

  const onSubmit = (data: SignupFormValues) => {
    setIsSubmitting(true);
    // For now, we'll just log the data. The next step will be to pass this to a checkout/payment page.
    console.log("Signup form submitted:", { ...data, totalAmount });
    toast({
      title: "Form Submitted!",
      description: "Next step: Onboarding wizard and payment processing.",
    });
    // Placeholder for redirection to next step
    // router.push(`/onboarding?data=${encodeURIComponent(JSON.stringify(data))}`);
    
    // Simulate end of process for now
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2000);
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
            <Image
                src="/images/newlogo.png"
                alt="Gymramp Logo"
                width={150}
                height={45}
                className="mx-auto mb-4"
                priority
            />
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <CardDescription>Join Gymramp and empower your team today.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" /> Your Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4" /> Company/Brand Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Downtown Fitness" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Email Address (for login)</FormLabel>
                    <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Create a Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Must be at least 8 characters"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="selectedProgramId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4" /> Select Your Program</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingPrograms}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingPrograms ? "Loading programs..." : "Choose a program..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.title} ({program.price})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedProgram && (
                <div className="text-center p-3 bg-secondary rounded-md">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold text-primary">${totalAmount.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingPrograms}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Processing...' : 'Proceed to Onboarding'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
