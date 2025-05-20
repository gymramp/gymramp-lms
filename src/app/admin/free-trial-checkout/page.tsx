
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Checkbox } from "@/components/ui/checkbox"; // No longer selecting individual courses
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Users, Gift, BookOpen, Layers } from 'lucide-react'; // Added Layers
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllPrograms, getCourseById } from '@/lib/firestore-data'; // Fetch programs
import { processFreeTrialCheckout } from '@/actions/checkout'; // Corrected import
import type { Program, Course } from '@/types/course'; // Import Program
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select

const freeTrialCheckoutFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  companyName: z.string().min(2, { message: 'Brand name is required.' }),
  streetAddress: z.string().min(5, { message: 'Street address is required.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  state: z.string().min(2, { message: 'State is required.' }),
  zipCode: z.string().min(5, { message: 'Zip code is required.' }),
  country: z.string().min(2, { message: 'Country is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  selectedProgramId: z.string().min(1, { message: 'Please select a Program for the trial.' }), // Changed to selectedProgramId
  trialDurationDays: z.coerce.number().int().min(1, { message: "Trial duration must be at least 1 day."}).default(7),
});
type FreeTrialCheckoutFormValues = z.infer<typeof freeTrialCheckoutFormSchema>;

interface FreeTrialFormContentProps {
  allPrograms: Program[]; // Changed from allCourses
  formRef: React.RefObject<HTMLFormElement>;
  maxUsers: number | null;
  setMaxUsers: React.Dispatch<React.SetStateAction<number | null>>;
  selectedProgramId: string | null; // Added selectedProgramId state
  setSelectedProgramId: React.Dispatch<React.SetStateAction<string | null>>; // Added setter
  coursesInSelectedProgram: Course[];
}

function FreeTrialFormContent({
  allPrograms,
  formRef,
  maxUsers,
  setMaxUsers,
  selectedProgramId,
  setSelectedProgramId,
  coursesInSelectedProgram,
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
      selectedProgramId: selectedProgramId || '',
      trialDurationDays: 7,
    },
  });
  
  useEffect(() => {
    if (selectedProgramId) {
      form.setValue('selectedProgramId', selectedProgramId, { shouldValidate: true });
    } else if (allPrograms.length === 1) { // Auto-select if only one program
        setSelectedProgramId(allPrograms[0].id);
        form.setValue('selectedProgramId', allPrograms[0].id, { shouldValidate: true });
    }
  }, [selectedProgramId, allPrograms, form, setSelectedProgramId]);


  const onSubmit = async (data: FreeTrialCheckoutFormValues) => {
    setIsProcessing(true);
    try {
      const checkoutData = {
        ...data,
        maxUsers,
        isTrial: true,
        // selectedCourseIds will be derived in the server action based on selectedProgramId
      };

      const result = await processFreeTrialCheckout(checkoutData as any); // Cast to any due to selectedCourseIds mismatch

      if (result.success) {
        toast({ title: "Free Trial Started!", description: "Brand and admin created for the trial." });
        form.reset({ // Reset with new defaults if needed
             customerName: '', companyName: '', streetAddress: '', city: '', state: '', zipCode: '', country: '', adminEmail: '',
             selectedProgramId: allPrograms.length === 1 ? allPrograms[0].id : '', trialDurationDays: 7,
        });
        setMaxUsers(5);
        setSelectedProgramId(allPrograms.length === 1 ? allPrograms[0].id : null);
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
                <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
              )} />
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem> <FormLabel>Brand Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
              )} />
              <FormField control={form.control} name="adminEmail" render={({ field }) => (
                <FormItem> <FormLabel>Admin Email</FormLabel> <FormControl><Input type="email" {...field} /></FormControl> <FormMessage /> </FormItem>
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
                <FormItem> <FormLabel>Street Address</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem> <FormLabel>City</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem> <FormLabel>State / Province</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
                )} />
                <FormField control={form.control} name="zipCode" render={({ field }) => (
                  <FormItem> <FormLabel>Zip / Postal Code</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem> <FormLabel>Country</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem>
              )} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Select Program for Trial</CardTitle>
            <CardDescription>The Brand will gain access to all courses within the selected Program for the trial period.</CardDescription>
            </CardHeader>
          <CardContent>
             <FormField control={form.control} name="selectedProgramId" render={({ field }) => (
              <FormItem>
                <FormLabel>Select Program</FormLabel>
                <Select onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProgramId(value); // Update parent state
                }} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a Program for the trial..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {allPrograms.length === 0 ? (
                            <SelectItem value="none" disabled>No programs available.</SelectItem>
                        ) : (
                            allPrograms.map(program => (
                                <SelectItem key={program.id} value={program.id}>
                                    {program.title} (Base Price: {program.price} - Included in Trial)
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
                 <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {selectedProgramId && coursesInSelectedProgram.length > 0 && (
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Courses Included in Trial Program</CardTitle>
                    <CardDescription>The Brand will have trial access to these courses from the "{allPrograms.find(p=>p.id===selectedProgramId)?.title}" program.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                        <div className="space-y-2">
                            {coursesInSelectedProgram.map(course => (
                                <div key={course.id} className="flex items-center space-x-3 p-2 bg-muted/30 rounded-md">
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    <span className="flex-1">{course.title} <Badge variant="outline" className="ml-2">{course.level}</Badge></span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                 </CardContent>
            </Card>
        )}


        <Card>
          <CardHeader><CardTitle>Trial Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This will set up a new brand with a free trial for the selected Program and duration.
              No payment is required at this time.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isProcessing || !form.getValues('selectedProgramId')}
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
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(5);
  const [coursesInSelectedProgram, setCoursesInSelectedProgram] = useState<Course[]>([]);
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
        setIsLoadingData(true);
        try {
          const [programsData, coursesData] = await Promise.all([
             getAllPrograms(),
             getAllCourses()
          ]);
          setAllPrograms(programsData);
          setAllCourses(coursesData);
           if (programsData.length === 1 && !selectedProgramId) {
             setSelectedProgramId(programsData[0].id);
          }
        } catch(error) {
            console.error("Error fetching programs/courses:", error);
            toast({ title: "Error", description: "Could not load programs or courses.", variant: "destructive" });
            setAllPrograms([]);
            setAllCourses([]);
        } finally {
          setIsLoadingData(false);
        }
      })();
    }
  }, [currentUser, isCheckingAuth, toast, selectedProgramId]);

  useEffect(() => {
    if (selectedProgramId && allPrograms.length > 0 && allCourses.length > 0) {
      const program = allPrograms.find(p => p.id === selectedProgramId);
      if (program && program.courseIds) {
        const courses = program.courseIds.map(id => allCourses.find(c => c.id === id)).filter(Boolean) as Course[];
        setCoursesInSelectedProgram(courses);
      } else {
        setCoursesInSelectedProgram([]);
      }
    } else {
      setCoursesInSelectedProgram([]);
    }
  }, [selectedProgramId, allPrograms, allCourses]);

  if (isCheckingAuth || !currentUser) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading programs & courses…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer - Free Trial Checkout</h1>
      <FreeTrialFormContent
        allPrograms={allPrograms}
        formRef={formRef}
        maxUsers={maxUsers}
        setMaxUsers={setMaxUsers}
        selectedProgramId={selectedProgramId}
        setSelectedProgramId={setSelectedProgramId}
        coursesInSelectedProgram={coursesInSelectedProgram}
      />
    </div>
  );
}

    