
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag, Users, ShoppingCart, Percent, Briefcase, User as UserIconLucide, ArrowRight, PlusCircle, Trash2, RadioTower, Radio, DollarSign } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllCourses } from '@/lib/firestore-data';
import type { Course } from '@/types/course';
import type { User, RevenueSharePartner } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  selectedCourseIds: z.array(z.string()).min(1, "Please select at least one course."),
  // TODO: This form needs redesign to select Programs instead of Courses for pricing.
  // The discount and total calculation logic below is based on Course prices and will be incorrect.
  // This will be further impacted by the new multi-tiered Program subscription model.
});
type CheckoutSetupFormValues = z.infer<typeof checkoutSetupFormSchema>;

interface CheckoutSetupFormContentProps {
  allCourses: Course[];
  selectedCourseIds: string[];
  onSelectedCourseIdsChange: (ids: string[]) => void;
  maxUsers: number | null;
  setMaxUsers: React.Dispatch<React.SetStateAction<number | null>>;
}

function CheckoutSetupFormContent({
  allCourses,
  selectedCourseIds,
  onSelectedCourseIdsChange,
  maxUsers,
  setMaxUsers,
}: CheckoutSetupFormContentProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // TODO: This entire pricing logic (subtotal, discount, finalTotal) is based on old Course prices
  // and needs complete overhaul to support Program selection and their new multi-tiered pricing (base, first sub, second sub).
  // For now, it will pass $0 to the payment step.
  const subtotalAmount = 0; 
  const discountPercentInput = ''; 
  const appliedDiscountAmount = 0; 
  const finalTotalAmount = 0; 
  const onDiscountPercentInputChange = (value: string) => {}; 

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
      selectedCourseIds: [],
    },
  });

  const { fields: revShareFields, append: appendRevShare, remove: removeRevShare } = useFieldArray({
    control: setupForm.control,
    name: "revenueSharePartners"
  });

  useEffect(() => {
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
    // TODO: Recalculate finalTotalAmountCents based on Program pricing (base + first sub or ongoing sub).
    // This checkout flow needs a complete redesign for Program-based sales and subscription handling.
    // The payment step will receive $0 until this is updated.
    const finalTotalAmountCents = 0; 

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
      selectedCourseIds: formData.selectedCourseIds.join(','), 
      ...(maxUsers !== null && maxUsers !== undefined && { maxUsers: String(maxUsers) }),
      finalTotalAmountCents: String(finalTotalAmountCents), 
      subtotalAmount: String(subtotalAmount), 
      appliedDiscountPercent: String(parseFloat(discountPercentInput) || 0), 
      appliedDiscountAmount: String(appliedDiscountAmount), 
    });

    toast({ title: "Information Saved", description: "Proceeding to payment..." });
    router.push(`/admin/checkout/payment?${queryParams.toString()}`);
  };

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
                       {/* TODO: The labels "One-Time Program Price" and "Program Subscription Price" are now potentially misleading
                                   with multi-tiered subscriptions. This section needs to be clearer once the Program's 
                                   base, first sub, and second sub prices are selectable/visible for revenue share.
                                   For now, 'coursePrice' refers to the Program's one-time base price, and 
                                   'subscriptionPrice' would conceptually refer to *a* subscription price tier.
                       */}
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
          <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Assign Courses to Brand</CardTitle></CardHeader>
          <CardContent>
            {/* TODO: This section still assigns individual courses. It should ideally allow selection of Programs.
                        The pricing (and thus revenue share calculation) will depend on Program selection.
                        This section's utility is limited until Program selection is implemented for sales. */}
            <p className="text-sm text-muted-foreground mb-2 p-2 border border-dashed rounded-md">
              Note: Pricing and revenue share calculations are now based on Programs. This section assigns individual courses to the brand for access,
              but the actual sale amount will be determined by a Program (once Program selection is added to this checkout).
            </p>
            <FormField
              control={setupForm.control}
              name="selectedCourseIds"
              render={() => (
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
                          <FormLabel htmlFor={`course-${course.id}`} className="flex justify-between items-center w-full cursor-pointer">
                            <div className="flex flex-col">
                                <span>{course.title} <Badge variant="outline" className="ml-2">{course.level}</Badge></span>
                            </div>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Account Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* TODO: This summary is based on old course pricing logic and needs to be completely updated for Program pricing
                          and the new multi-tiered subscription model. It will show $0 for now. */}
              <p className="text-sm text-destructive p-2 border border-destructive/50 rounded-md">
                Note: The order summary below is a placeholder. Pricing is now based on Programs.
                This section needs to be updated to reflect Program selection and its associated pricing (one-time base, and potential first/second tier subscriptions).
                The actual amount charged on the next page will be $0 until Program selection and its pricing are integrated here.
              </p>
              <div className="flex justify-between text-sm"><span>Subtotal (One-time):</span> <span className="font-medium">${subtotalAmount.toFixed(2)}</span></div>
              <FormItem>
                <FormLabel htmlFor="discountPercent" className="text-sm">Discount (% on One-time Subtotal):</FormLabel>
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
                    disabled // Disabled until Program pricing is implemented
                  />
                </FormControl>
              </FormItem>
              {appliedDiscountAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount Applied:</span> <span className="font-medium">-${appliedDiscountAmount.toFixed(2)}</span></div>}
              <hr />
              <div className="flex justify-between text-lg font-bold text-primary"><span>Total Account Value (One-time):</span> <span>${finalTotalAmount.toFixed(2)}</span></div>
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


  if (isCheckingAuth || !currentUser) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Verifying access…</p> </div> );
  }
  if (isLoadingCourses) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Loading courses…</p> </div> );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer Checkout - Step 1: Setup</h1>
      {/* TODO: This page needs a complete redesign to allow selection of Programs and calculate pricing 
                  based on Program prices (one-time base, and the new multi-tiered subscription model). 
                  The current course selection and order summary are placeholders. */}
      <p className="text-lg text-destructive p-4 border border-destructive/50 rounded-md mb-6">
        <strong>Attention:</strong> This checkout form is under major reconstruction due to pricing model changes.
        It currently selects individual courses, but pricing (and revenue share) is now based on Programs with multi-tiered subscriptions.
        The order summary will show $0, and the payment step will reflect this.
        This page requires significant updates to enable Program selection and accurate pricing for one-time and subscription models.
      </p>
      <CheckoutSetupFormContent
        allCourses={allCourses}
        selectedCourseIds={selectedCourseIds}
        onSelectedCourseIdsChange={setSelectedCourseIds}
        maxUsers={maxUsers}
        setMaxUsers={setMaxUsers}
      />
    </div>
  );
}
    
