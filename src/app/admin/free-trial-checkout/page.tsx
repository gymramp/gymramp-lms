
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Users, Gift, BookOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllCourses } from '@/lib/firestore-data';
import { processFreeTrialCheckout } from '@/actions/checkout';
import type { Course } from '@/types/course';
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';

const freeTrialCheckoutFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  companyName: z.string().min(2, { message: 'Brand name is required.' }),
  streetAddress: z.string().min(5, { message: 'Street address is required.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  state: z.string().min(2, { message: 'State is required.' }),
  zipCode: z.string().min(5, { message: 'Zip code is required.' }),
  country: z.string().min(2, { message: 'Country is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  selectedCourseIds: z.array(z.string()).min(1, { message: 'Please select at least one course.' }),
  trialDurationDays: z.coerce.number().int().min(1, { message: "Trial duration must be at least 1 day."}).default(7),
});
type FreeTrialCheckoutFormValues = z.infer<typeof freeTrialCheckoutFormSchema>;

interface FreeTrialFormContentProps {
  allCourses: Course[];
  formRef: React.RefObject<HTMLFormElement>;
  maxUsers: number | null;
  setMaxUsers: React.Dispatch<React.SetStateAction<number | null>>;
  selectedCourseIds: string[];
  onSelectedCourseIdsChange: (ids: string[]) => void;
}

function FreeTrialFormContent({
  allCourses,
  formRef,
  maxUsers,
  setMaxUsers,
  selectedCourseIds,
  onSelectedCourseIdsChange,
}: FreeTrialFormContentProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<FreeTrialCheckoutFormValues>({
    resolver: zodResolver(freeTrialCheckoutFormSchema),
    defaultValues: {
      customerName: '',
      companyName: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      adminEmail: '',
      selectedCourseIds: selectedCourseIds,
      trialDurationDays: 7,
    },
  });

  useEffect(() => {
    const currentFormIds = JSON.stringify(form.getValues('selectedCourseIds') || []);
    const propIds = JSON.stringify(selectedCourseIds || []);
    if (currentFormIds !== propIds) {
      form.setValue('selectedCourseIds', selectedCourseIds, { shouldValidate: true });
    }
  }, [selectedCourseIds, form]);

  const handleCheckboxChange = useCallback(
    (checked: boolean | string, id: string) => {
      const currentSelectedIds = form.getValues('selectedCourseIds') || [];
      let nextSelectedIds: string[];
      if (checked) {
        nextSelectedIds = [...currentSelectedIds, id];
      } else {
        nextSelectedIds = currentSelectedIds.filter((x) => x !== id);
      }
      form.setValue('selectedCourseIds', nextSelectedIds, { shouldValidate: true });
      onSelectedCourseIdsChange(nextSelectedIds);
    },
    [form, onSelectedCourseIdsChange]
  );

  const onSubmit = async (data: FreeTrialCheckoutFormValues) => {
    setIsProcessing(true);
    try {
      const checkoutData = {
        ...data,
        maxUsers,
        isTrial: true,
      };

      const result = await processFreeTrialCheckout(checkoutData);

      if (result.success) {
        toast({ title: "Free Trial Started!", description: "Brand and admin created for the trial." });
        form.reset();
        setMaxUsers(5);
        onSelectedCourseIdsChange([]);
      } else {
        toast({ title: "Trial Setup Error", description: result.error || "An unknown error occurred", variant: "destructive", duration: 10000 });
      }
    } catch (err: any) {
      console.error("[FreeTrialFormContent] Checkout Error:", err);
      toast({ title: "Checkout Error", description: err.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Form {...form}>
      <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Customer & Brand Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="adminEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> Max Users Allowed (Trial)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Default: 5"
                    value={maxUsers === null || maxUsers === undefined ? '' : String(maxUsers)}
                    onChange={e => {
                      const value = e.target.value;
                       setMaxUsers(value === '' ? null : Number(value));
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Leave blank for unlimited during trial. Default is 5.</p>
              </FormItem>
              <FormField control={form.control} name="trialDurationDays" render={({ field }) => (
                 <FormItem>
                    <FormLabel>Trial Duration (Days)</FormLabel>
                    <FormControl>
                        <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Set how many days the trial period will last. Default: 7 days.</p>
                 </FormItem>
              )} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Brand Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="streetAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zipCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip / Postal Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Select Courses for Trial</CardTitle></CardHeader>
          <CardContent>
             <FormField control={form.control} name="selectedCourseIds" render={({ field }) => (
              <FormItem>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                  <div className="space-y-2">{
                    allCourses.length === 0 ? (
                      <p className="text-muted-foreground italic">No courses available.</p>
                    ) : allCourses.map(course => (
                      <FormItem key={course.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(course.id)}
                            onCheckedChange={checked => handleCheckboxChange(checked, course.id)}
                            id={`course-${course.id}`}
                          />
                        </FormControl>
                        <FormLabel htmlFor={`course-${course.id}`} className="flex justify-between w-full cursor-pointer">
                          <span>{course.title} <Badge variant="outline" className="ml-2">{course.level}</Badge></span>
                          <span className="text-sm font-semibold text-primary">
                            <span className="line-through text-muted-foreground mr-1">{course.price}</span>
                             (Included in Trial)
                          </span>
                        </FormLabel>
                      </FormItem>
                    ))
                  }</div>
                </ScrollArea>
                 <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trial Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This will set up a new brand with a free trial for the selected courses and duration.
              No payment is required at this time.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isProcessing || (form.getValues('selectedCourseIds') || []).length === 0}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Setting Up Trial...' : `Start Free Trial`}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

export default function FreeTrialCheckoutPage() {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [maxUsers, setMaxUsers] = useState<number | null>(5);
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const details = await getUserByEmail(user.email!);
          if (details?.role === 'Super Admin') {
            setCurrentUser(details);
          } else {
            toast({ title: "Access Denied", description: "Only Super Admins can access this page.", variant: "destructive" });
            router.push('/');
          }
        } catch (error) {
            console.error("Auth check error:", error);
            toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
            router.push('/');
        }
      } else {
        toast({ title: "Authentication Required", description: "Please log in as a Super Admin.", variant: "destructive" });
        router.push('/');
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router, toast]);

  useEffect(() => {
    if (currentUser && !isCheckingAuth) {
      (async () => {
        setIsLoadingCourses(true);
        try {
          const courses = await getAllCourses();
          setAllCourses(courses);
        } catch(error) {
            console.error("Error fetching courses:", error);
            toast({ title: "Error", description: "Could not load courses.", variant: "destructive" });
            setAllCourses([]);
        } finally {
          setIsLoadingCourses(false);
        }
      })();
    }
  }, [currentUser, isCheckingAuth, toast]);

  if (isCheckingAuth || !currentUser) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  if (isLoadingCourses) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading courses…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer - Free Trial Checkout</h1>
      <FreeTrialFormContent
        allCourses={allCourses}
        formRef={formRef}
        maxUsers={maxUsers}
        setMaxUsers={setMaxUsers}
        selectedCourseIds={selectedCourseIds}
        onSelectedCourseIdsChange={setSelectedCourseIds}
      />
    </div>
  );
}
