
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag, Users, ShoppingCart, Percent, Briefcase, User as UserIconLucide, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllCourses } from '@/lib/firestore-data';
import type { Course } from '@/types/course';
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';

// Schema for Step 1
const checkoutSetupFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  companyName: z.string().min(2, { message: 'Company name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  revSharePartnerName: z.string().optional(),
  revSharePartnerCompany: z.string().optional(),
  revSharePartnerPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  selectedCourseIds: z.array(z.string()).min(1, "Please select at least one course."),
});
type CheckoutSetupFormValues = z.infer<typeof checkoutSetupFormSchema>;

interface CheckoutSetupFormContentProps {
  allCourses: Course[];
  selectedCourseIds: string[];
  onSelectedCourseIdsChange: (ids: string[]) => void;
  subtotalAmount: number;
  discountPercentInput: string;
  onDiscountPercentInputChange: (value: string) => void;
  appliedDiscountAmount: number;
  finalTotalAmount: number;
  maxUsers: number | null;
  setMaxUsers: React.Dispatch<React.SetStateAction<number | null>>;
}

function CheckoutSetupFormContent({
  allCourses,
  selectedCourseIds,
  onSelectedCourseIdsChange,
  subtotalAmount,
  discountPercentInput,
  onDiscountPercentInputChange,
  appliedDiscountAmount,
  finalTotalAmount,
  maxUsers,
  setMaxUsers,
}: CheckoutSetupFormContentProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

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
      revSharePartnerName: '',
      revSharePartnerCompany: '',
      revSharePartnerPercentage: null,
      selectedCourseIds: [],
    },
  });

  useEffect(() => {
    // Sync selectedCourseIds prop with form state
    const currentFormIds = JSON.stringify(setupForm.getValues('selectedCourseIds') || []);
    const propIds = JSON.stringify(selectedCourseIds || []);
    if (currentFormIds !== propIds) {
      setupForm.setValue('selectedCourseIds', selectedCourseIds, { shouldValidate: true });
    }
  }, [selectedCourseIds, setupForm]);


  const handleCourseCheckboxChange = (checked: boolean | string, courseId: string) => {
    const currentSelectedIds = selectedCourseIds || [];
    let nextSelectedIds: string[];
    if (checked) {
      nextSelectedIds = [...currentSelectedIds, courseId];
    } else {
      nextSelectedIds = currentSelectedIds.filter((id) => id !== courseId);
    }
    onSelectedCourseIdsChange(nextSelectedIds);
    setupForm.setValue('selectedCourseIds', nextSelectedIds, { shouldValidate: true });
  };

  const onProceedToPayment = async (formData: CheckoutSetupFormValues) => {
    setIsProcessing(true);

    const finalTotalAmountCents = Math.round(finalTotalAmount * 100);

    const queryParams = new URLSearchParams({
      customerName: formData.customerName,
      companyName: formData.companyName,
      adminEmail: formData.adminEmail,
      ...(formData.streetAddress && { streetAddress: formData.streetAddress }),
      ...(formData.city && { city: formData.city }),
      ...(formData.state && { state: formData.state }),
      ...(formData.zipCode && { zipCode: formData.zipCode }),
      ...(formData.country && { country: formData.country }),
      ...(formData.revSharePartnerName && { revSharePartnerName: formData.revSharePartnerName }),
      ...(formData.revSharePartnerCompany && { revSharePartnerCompany: formData.revSharePartnerCompany }),
      ...(formData.revSharePartnerPercentage !== null && formData.revSharePartnerPercentage !== undefined && { revSharePartnerPercentage: String(formData.revSharePartnerPercentage) }),
      selectedCourseIds: formData.selectedCourseIds.join(','),
      ...(maxUsers !== null && maxUsers !== undefined && { maxUsers: String(maxUsers) }),
      finalTotalAmountCents: String(finalTotalAmountCents),
      subtotalAmount: String(subtotalAmount),
      appliedDiscountPercent: String(parseFloat(discountPercentInput) || 0),
      appliedDiscountAmount: String(appliedDiscountAmount),
    });

    toast({ title: "Information Saved", description: "Proceeding to payment..." });
    router.push(`/admin/checkout/payment?${queryParams.toString()}`);
    //setIsProcessing(false); // Processing continues on the next page
  };

  return (
    <Form {...setupForm}>
      <form onSubmit={setupForm.handleSubmit(onProceedToPayment)} className="space-y-8">
        {/* Customer & Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Customer & Company</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={setupForm.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={setupForm.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Company Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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

          {/* Billing Address */}
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

        {/* Revenue Share Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Revenue Share (Optional)</CardTitle>
            <CardDescription>If applicable, enter details for the revenue share partner.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={setupForm.control} name="revSharePartnerName" render={({ field }) => ( <FormItem> <FormLabel>Partner Name</FormLabel> <FormControl><Input {...field} placeholder="e.g., John Smith" /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={setupForm.control} name="revSharePartnerCompany" render={({ field }) => ( <FormItem> <FormLabel>Partner Company</FormLabel> <FormControl><Input {...field} placeholder="e.g., Partner Co." /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={setupForm.control} name="revSharePartnerPercentage" render={({ field }) => ( <FormItem> <FormLabel>Share Percentage (%)</FormLabel> <FormControl><Input type="number" min="0" max="100" {...field} placeholder="e.g., 10" value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl> <FormMessage /> </FormItem> )} />
          </CardContent>
        </Card>

        {/* Course Selection */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Select Courses</CardTitle></CardHeader>
          <CardContent>
            <FormField
              control={setupForm.control}
              name="selectedCourseIds"
              render={() => ( // No field prop needed directly as Checkbox has its own binding
                <FormItem>
                  <ScrollArea className="h-48 w-full rounded-md border p-4">
                    <div className="space-y-2">
                      {allCourses.length === 0 ? (
                        <p className="text-muted-foreground italic">No courses available in the library.</p>
                      ) : allCourses.map(course => (
                        <FormItem key={course.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
                          <FormControl>
                            <Checkbox
                              checked={selectedCourseIds.includes(course.id)}
                              onCheckedChange={checked => handleCourseCheckboxChange(checked, course.id)}
                              id={`course-${course.id}`}
                            />
                          </FormControl>
                          <FormLabel htmlFor={`course-${course.id}`} className="flex justify-between w-full cursor-pointer">
                            <span>{course.title} <Badge variant="outline" className="ml-2">{course.level}</Badge></span>
                            <span className="text-sm font-semibold text-primary">{course.price}</span>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                  </ScrollArea>
                  <FormMessage /> {/* For selectedCourseIds error */}
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Summary & Proceed Button */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Account Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Subtotal:</span> <span className="font-medium">${subtotalAmount.toFixed(2)}</span></div>
              <FormItem>
                <FormLabel htmlFor="discountPercent" className="text-sm">Discount (%):</FormLabel>
                <FormControl>
                  <Input
                    id="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentInput}
                    onChange={(e) => onDiscountPercentInputChange(e.target.value)}
                    placeholder="e.g., 10"
                    className="h-9"
                  />
                </FormControl>
              </FormItem>
              {appliedDiscountAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount Applied:</span> <span className="font-medium">-${appliedDiscountAmount.toFixed(2)}</span></div>}
              <hr />
              <div className="flex justify-between text-lg font-bold text-primary"><span>Total Account Value:</span> <span>${finalTotalAmount.toFixed(2)}</span></div>
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
                  disabled={isProcessing || selectedCourseIds.length === 0}
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
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [subtotalAmount, setSubtotalAmount] = useState(0);
  const [discountPercentInput, setDiscountPercentInput] = useState('');
  const [appliedDiscountAmount, setAppliedDiscountAmount] = useState(0);
  const [finalTotalAmount, setFinalTotalAmount] = useState(0);
  const [maxUsers, setMaxUsers] = useState<number | null>(5);

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
          const coursesData = await getAllCourses();
          setAllCourses(coursesData);
        } catch (error) {
          console.error("Error fetching courses:", error);
          toast({ title: "Error", description: "Could not load courses.", variant: "destructive" });
          setAllCourses([]);
        } finally {
          setIsLoadingCourses(false);
        }
      })();
    }
  }, [currentUser, isCheckingAuth, toast]);

  useEffect(() => {
    let total = 0;
    selectedCourseIds.forEach((id) => {
      const course = allCourses.find((c) => c.id === id);
      if (course && course.price) {
        const priceNumber = parseFloat(course.price.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(priceNumber)) {
          total += priceNumber;
        }
      }
    });
    setSubtotalAmount(total);
  }, [selectedCourseIds, allCourses]);

  useEffect(() => {
    const discountPercent = parseFloat(discountPercentInput);
    let discountAmount = 0;
    if (!isNaN(discountPercent) && discountPercent > 0 && discountPercent <= 100) {
      discountAmount = (subtotalAmount * discountPercent) / 100;
    }
    setAppliedDiscountAmount(discountAmount);
    const finalAmount = subtotalAmount - discountAmount;
    setFinalTotalAmount(Math.max(0, finalAmount));
  }, [subtotalAmount, discountPercentInput]);

  if (isCheckingAuth || !currentUser) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Verifying access…</p> </div> );
  }
  if (isLoadingCourses) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Loading courses…</p> </div> );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer Checkout - Step 1: Setup</h1>
      <CheckoutSetupFormContent
        allCourses={allCourses}
        selectedCourseIds={selectedCourseIds}
        onSelectedCourseIdsChange={setSelectedCourseIds}
        subtotalAmount={subtotalAmount}
        discountPercentInput={discountPercentInput}
        onDiscountPercentInputChange={setDiscountPercentInput}
        appliedDiscountAmount={appliedDiscountAmount}
        finalTotalAmount={finalTotalAmount}
        maxUsers={maxUsers}
        setMaxUsers={setMaxUsers}
      />
    </div>
  );
}
