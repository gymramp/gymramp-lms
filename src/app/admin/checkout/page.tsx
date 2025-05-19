
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag, Users, ShoppingCart, Percent, Briefcase, User as UserIconLucide, ArrowRight, PlusCircle, Trash2, RadioTower, Radio, DollarSign, Layers, BookOpen } from 'lucide-react'; // Added Layers, BookOpen
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllPrograms, getCourseById } from '@/lib/firestore-data'; // Fetch programs
import type { Program, Course } from '@/types/course'; // Import Program type
import type { User, RevenueSharePartner } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from "@/components/ui/form"; // Added FormDescription
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select

const checkoutSetupFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  companyName: z.string().min(2, { message: 'Brand name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  revenueSharePartners: z.array(
    z.object({
      name: z.string().min(1, "Partner name is required."),
      companyName: z.string().optional(),
      percentage: z.coerce
        .number({ invalid_type_error: "Percentage must be a number." })
        .min(0.01, "Percentage must be greater than 0.")
        .max(100, "Percentage cannot exceed 100."),
      shareBasis: z.enum(['coursePrice', 'subscriptionPrice'], { required_error: "Please select a share basis." }),
    })
  ).optional(),
  selectedProgramId: z.string().min(1, "Please select a Program to purchase."),
});
type CheckoutSetupFormValues = z.infer<typeof checkoutSetupFormSchema>;

interface CheckoutSetupFormContentProps {
  allPrograms: Program[]; // Changed from allCourses to allPrograms
  maxUsers: number | null;
  setMaxUsers: React.Dispatch<React.SetStateAction<number | null>>;
  selectedProgramId: string | null; // Added selectedProgramId state
  setSelectedProgramId: React.Dispatch<React.SetStateAction<string | null>>; // Added setter
  coursesInSelectedProgram: Course[]; // State for courses in the selected program
}

function CheckoutSetupFormContent({
  allPrograms,
  maxUsers,
  setMaxUsers,
  selectedProgramId,
  setSelectedProgramId,
  coursesInSelectedProgram,
}: CheckoutSetupFormContentProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountPercentInput, setDiscountPercentInput] = useState('');

  const setupForm = useForm<CheckoutSetupFormValues>({
    resolver: zodResolver(checkoutSetupFormSchema),
    defaultValues: {
      customerName: '',
      companyName: '',
      adminEmail: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      revenueSharePartners: [],
      selectedProgramId: '',
    },
  });

  const { fields: revShareFields, append: appendRevShare, remove: removeRevShare } = useFieldArray({
    control: setupForm.control,
    name: "revenueSharePartners"
  });
  
  const selectedProgram = allPrograms.find(p => p.id === selectedProgramId);

  const subtotalAmount = selectedProgram ? parseFloat(selectedProgram.price.replace(/[$,/mo]/gi, '')) : 0;
  const discountAmount = (subtotalAmount * (parseFloat(discountPercentInput) || 0)) / 100;
  const finalTotalAmount = subtotalAmount - discountAmount;

  const onProceedToPayment = async (formData: CheckoutSetupFormValues) => {
    setIsProcessing(true);
    
    if (!selectedProgram) {
      toast({ title: "Error", description: "Please select a Program before proceeding.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const finalTotalAmountCents = Math.round(finalTotalAmount * 100);

    const revenueShareParams = formData.revenueSharePartners && formData.revenueSharePartners.length > 0
        ? { revenueSharePartners: JSON.stringify(formData.revenueSharePartners.map(p => ({ name: p.name, companyName: p.companyName || null, percentage: p.percentage, shareBasis: p.shareBasis }))) }
        : {};

    const queryParams = new URLSearchParams({
      customerName: formData.customerName,
      companyName: formData.companyName,
      adminEmail: formData.adminEmail,
      ...(formData.streetAddress && { streetAddress: formData.streetAddress }),
      ...(formData.city && { city: formData.city }),
      ...(formData.state && { state: formData.state }),
      ...(formData.zipCode && { zipCode: formData.zipCode }),
      ...(formData.country && { country: formData.country }),
      ...revenueShareParams,
      selectedProgramId: formData.selectedProgramId,
      ...(maxUsers !== null && maxUsers !== undefined && { maxUsers: String(maxUsers) }),
      finalTotalAmountCents: String(finalTotalAmountCents),
      subtotalAmount: String(subtotalAmount),
      appliedDiscountPercent: String(parseFloat(discountPercentInput) || 0),
      appliedDiscountAmount: String(discountAmount),
    });

    toast({ title: "Information Saved", description: "Proceeding to payment..." });
    router.push(`/admin/checkout/payment?${queryParams.toString()}`);
    setIsProcessing(false); // Reset processing state
  };

  useEffect(() => {
    // Pre-select program if only one exists, or if a value is passed in
    if (selectedProgramId) {
      setupForm.setValue('selectedProgramId', selectedProgramId, { shouldValidate: true });
    } else if (allPrograms.length === 1) {
        setSelectedProgramId(allPrograms[0].id);
        setupForm.setValue('selectedProgramId', allPrograms[0].id, { shouldValidate: true });
    }
  }, [selectedProgramId, allPrograms, setupForm, setSelectedProgramId]);


  return (
    <Form {...setupForm}>
      <form onSubmit={setupForm.handleSubmit(onProceedToPayment)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Customer & Brand</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={setupForm.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={setupForm.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Brand Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={setupForm.control} name="adminEmail" render={({ field }) => ( <FormItem> <FormLabel>Admin Email</FormLabel> <FormControl><Input type="email" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormItem>
                <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4" /> Max Users Allowed</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Default: 5 (leave blank for unlimited)"
                    value={maxUsers === null || maxUsers === undefined ? '' : String(maxUsers)}
                    onChange={e => {
                      const value = e.target.value;
                       setMaxUsers(value === '' ? null : Number(value));
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Leave blank or 0 for unlimited.</p>
              </FormItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Billing Address (Optional)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={setupForm.control} name="streetAddress" render={({ field }) => ( <FormItem> <FormLabel>Street Address</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={setupForm.control} name="city" render={({ field }) => ( <FormItem> <FormLabel>City</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={setupForm.control} name="state" render={({ field }) => ( <FormItem> <FormLabel>State / Province</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={setupForm.control} name="zipCode" render={({ field }) => ( <FormItem> <FormLabel>Zip / Postal Code</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </div>
              <FormField control={setupForm.control} name="country" render={({ field }) => ( <FormItem> <FormLabel>Country</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Revenue Share (Optional)</CardTitle>
              <CardDescription>If applicable, enter details for revenue share partners.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => appendRevShare({ name: '', companyName: '', percentage: 0, shareBasis: 'coursePrice' })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Partner
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {revShareFields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-6 items-start p-4 border rounded-md relative">
                <FormField
                  control={setupForm.control}
                  name={`revenueSharePartners.${index}.name`}
                  render={({ field: formField }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Partner Name</FormLabel>
                      <FormControl><Input {...formField} placeholder="e.g., John Smith" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={setupForm.control}
                  name={`revenueSharePartners.${index}.companyName`}
                  render={({ field: formField }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Partner Brand (Optional)</FormLabel>
                      <FormControl><Input {...formField} placeholder="e.g., Partner Co." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={setupForm.control}
                  name={`revenueSharePartners.${index}.percentage`}
                  render={({ field: formField }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Share Percentage (%)</FormLabel>
                      <FormControl><Input type="number" min="0.01" max="100" step="0.01" {...formField} placeholder="e.g., 10" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={setupForm.control}
                  name={`revenueSharePartners.${index}.shareBasis`}
                  render={({ field: formField }) => (
                    <FormItem className="md:col-span-4 pt-2">
                      <FormLabel className="text-sm font-medium">Share Basis</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={formField.onChange}
                          defaultValue={formField.value}
                          className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-1"
                        >
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="coursePrice" id={`shareBasis-${index}-course`} /></FormControl>
                            <FormLabel htmlFor={`shareBasis-${index}-course`} className="font-normal text-sm">Program Base Price (One-Time)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="subscriptionPrice" id={`shareBasis-${index}-sub`} /></FormControl>
                            <FormLabel htmlFor={`shareBasis-${index}-sub`} className="font-normal text-sm">Program Subscription (Monthly)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <ShadFormDescription className="text-xs">Determines if share is on the one-time program price or its recurring subscription price.</ShadFormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRevShare(index)}
                  className="absolute top-2 right-2 md:relative md:top-0 md:right-0 md:col-span-1 md:justify-self-end md:self-center text-destructive hover:bg-destructive/10"
                  aria-label="Remove partner"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {setupForm.formState.errors.revenueSharePartners && (
                 <p className="text-sm font-medium text-destructive">{setupForm.formState.errors.revenueSharePartners.message || (setupForm.formState.errors.revenueSharePartners.root && setupForm.formState.errors.revenueSharePartners.root.message)}</p>
            )}
            {Array.isArray(setupForm.formState.errors.revenueSharePartners) && setupForm.formState.errors.revenueSharePartners.map((error, index) => (
                error && (
                    <div key={index} className="text-sm font-medium text-destructive">
                        {error.name && <p>Partner {index+1} Name: {error.name.message}</p>}
                        {error.percentage && <p>Partner {index+1} Percentage: {error.percentage.message}</p>}
                        {error.shareBasis && <p>Partner {index+1} Share Basis: {error.shareBasis.message}</p>}
                    </div>
                )
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Select Program for Purchase</CardTitle>
            <CardDescription>Choose the Program this customer is purchasing. The Brand will gain access to all courses within this Program.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={setupForm.control}
              name="selectedProgramId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Program</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProgramId(value); // Update parent state for dynamic pricing
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a Program..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allPrograms.length === 0 ? (
                        <SelectItem value="none" disabled>No programs available.</SelectItem>
                      ) : (
                        allPrograms.map(program => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.title} ({program.price})
                            {program.firstSubscriptionPrice && ` / ${program.firstSubscriptionPrice} (Sub M4-12)`}
                            {program.secondSubscriptionPrice && ` / ${program.secondSubscriptionPrice} (Sub M13+)`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {selectedProgramId && coursesInSelectedProgram.length > 0 && (
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Courses Included in Program</CardTitle>
                    <CardDescription>The following courses will be assigned to the Brand upon purchase of "{selectedProgram?.title}".</CardDescription>
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


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Account Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedProgram ? (
                <>
                  <div className="flex justify-between text-sm"><span>Program Base Price (One-time):</span> <span className="font-medium">${subtotalAmount.toFixed(2)}</span></div>
                  <FormItem>
                    <FormLabel htmlFor="discountPercent" className="text-sm">Discount (% on Program Base Price):</FormLabel>
                    <FormControl>
                      <Input
                        id="discountPercent"
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercentInput}
                        onChange={(e) => setDiscountPercentInput(e.target.value)}
                        placeholder="e.g., 10"
                        className="h-9"
                      />
                    </FormControl>
                  </FormItem>
                  {discountAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount Applied:</span> <span className="font-medium">-${discountAmount.toFixed(2)}</span></div>}
                  <hr />
                  <div className="flex justify-between text-lg font-bold text-primary"><span>Total Account Value (One-time):</span> <span>${finalTotalAmount.toFixed(2)}</span></div>
                </>
              ) : (
                <p className="text-muted-foreground italic">Select a Program to see the order summary.</p>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-1 flex items-end">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Proceed to Payment</CardTitle>
                <CardDescription>Review details and continue to the payment step.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isProcessing || !selectedProgramId}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {isProcessing ? 'Processing...' : 'Proceed to Payment & Finalize'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}

export default function AdminCheckoutPage() {
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]); // Still need all courses for lookup
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(5);
  const [coursesInSelectedProgram, setCoursesInSelectedProgram] = useState<Course[]>([]);

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
          if (programsData.length === 1 && !selectedProgramId) { // Auto-select if only one program
             setSelectedProgramId(programsData[0].id);
          }
        } catch (error) {
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

  // Effect to update coursesInSelectedProgram when selectedProgramId or allCourses changes
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
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Verifying access…</p> </div> );
  }
  if (isLoadingData) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Loading programs & courses…</p> </div> );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer Checkout - Step 1: Setup</h1>
      <CheckoutSetupFormContent
        allPrograms={allPrograms}
        maxUsers={maxUsers}
        setMaxUsers={setMaxUsers}
        selectedProgramId={selectedProgramId}
        setSelectedProgramId={setSelectedProgramId}
        coursesInSelectedProgram={coursesInSelectedProgram}
      />
    </div>
  );
}
