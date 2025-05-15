
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CreditCard, Tag, Users, ShoppingCart, DollarSign, Percent, Briefcase, User as UserIconLucide, AlertTriangle, AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { getAllCourses } from '@/lib/firestore-data';
import { processCheckout } from '@/app/actions/checkout'; // Corrected import path
import { createTestPaymentIntent } from '@/actions/stripe'; // For the test payment
import type { Course } from '@/types/course';
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const checkoutFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name is required.' }),
  companyName: z.string().min(2, { message: 'Company name is required.' }),
  adminEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  revSharePartnerName: z.string().optional(),
  revSharePartnerCompany: z.string().optional(),
  revSharePartnerPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
});
type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;


interface CheckoutFormContentProps {
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
  // Stripe related props are not passed directly, hooks are used
}

function CheckoutFormContent({
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
}: CheckoutFormContentProps) {
  const stripe = useStripe(); // Hook for Stripe.js
  const elements = useElements(); // Hook for Stripe Elements
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false); // For main form
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null); // For main form
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); // For Stripe payment
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null); // For Stripe payment


  const mainCheckoutForm = useForm<CheckoutFormValues>({ // Renamed form to avoid conflict
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customerName: '',
      companyName: '',
      adminEmail: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      password: '',
      revSharePartnerName: '',
      revSharePartnerCompany: '',
      revSharePartnerPercentage: null,
    },
  });


  const handleCourseCheckboxChange = (checked: boolean | string, courseId: string) => {
    const currentSelectedIds = selectedCourseIds || [];
    let nextSelectedIds: string[];
    if (checked) {
      nextSelectedIds = [...currentSelectedIds, courseId];
    } else {
      nextSelectedIds = currentSelectedIds.filter((id) => id !== courseId);
    }
    onSelectedCourseIdsChange(nextSelectedIds);
  };


  const onMainSubmit = async (formData: CheckoutFormValues) => {
    setFormErrorMessage(null);

    if (selectedCourseIds.length === 0) {
        toast({ title: "No Courses Selected", description: "Please select at least one course.", variant: "destructive" });
        return;
    }
    
    setIsProcessingCheckout(true);

    try {
      const checkoutData = {
        ...formData,
        selectedCourseIds,
        maxUsers,
        subtotalAmount,
        appliedDiscountPercent: parseFloat(discountPercentInput) || 0,
        appliedDiscountAmount,
        finalTotalAmount,
      };

      const result = await processCheckout(checkoutData);

      setIsProcessingCheckout(false);
      if (result.success) {
        toast({ title: "Checkout Complete!", description: `Company "${formData.companyName}" and admin user created.` });
        mainCheckoutForm.reset();
        onSelectedCourseIdsChange([]);
        setMaxUsers(5);
        onDiscountPercentInputChange('');
        router.push(`/admin/companies/${result.companyId}/edit`);
      } else {
        throw new Error(result.error || "Checkout failed after submission.");
      }
    } catch (processError: any) {
      setIsProcessingCheckout(false);
      setFormErrorMessage(`Order processing failed: ${processError.message}. Please contact support.`);
      toast({ title: "Order Processing Error", description: `Order setup failed: ${processError.message}`, variant: "destructive", duration: 10000 });
    }
  };

  const handleTestPaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentErrorMessage(null);

    if (!stripe || !elements) {
      setPaymentErrorMessage('Stripe.js has not loaded yet. Please try again.');
      return;
    }

    setIsProcessingPayment(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/admin/checkout/success`, // Or a specific test result page
      },
      // redirect: 'if_required' // Use if_required to handle result client-side, or always to redirect
    });

    setIsProcessingPayment(false);

    if (error) {
      console.error('Stripe confirmPayment error:', error);
      setPaymentErrorMessage(error.message || 'An unexpected error occurred during payment.');
      toast({
        title: 'Payment Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } else if (paymentIntent) {
      switch (paymentIntent.status) {
        case 'succeeded':
          toast({
            title: 'Test Payment Succeeded!',
            description: 'Your $1.00 test payment was successful.',
          });
          // router.push(`/admin/checkout/success?payment_intent=${paymentIntent.id}`); // Optional redirect
          break;
        case 'processing':
           toast({
            title: 'Payment Processing',
            description: 'Your test payment is being processed.',
          });
          break;
        default:
          setPaymentErrorMessage(`Payment status: ${paymentIntent.status}. Please try again.`);
          toast({
            title: 'Payment Error',
            description: `Test payment error. Status: ${paymentIntent.status}`,
            variant: 'destructive',
          });
          break;
      }
    }
  };


  return (
    <Form {...mainCheckoutForm}>
      <form id="main-checkout-form" onSubmit={mainCheckoutForm.handleSubmit(onMainSubmit)} className="space-y-8">
        {/* Customer & Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Customer & Company</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={mainCheckoutForm.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={mainCheckoutForm.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Company Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={mainCheckoutForm.control} name="adminEmail" render={({ field }) => ( <FormItem> <FormLabel>Admin Email</FormLabel> <FormControl><Input type="email" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={mainCheckoutForm.control} name="password" render={({ field }) => ( <FormItem> <FormLabel>Admin Password</FormLabel> <FormControl><Input type="password" {...field} placeholder="Default: 'password'" /></FormControl> <FormMessage /> </FormItem> )} />
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
              <FormField control={mainCheckoutForm.control} name="streetAddress" render={({ field }) => ( <FormItem> <FormLabel>Street Address</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={mainCheckoutForm.control} name="city" render={({ field }) => ( <FormItem> <FormLabel>City</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={mainCheckoutForm.control} name="state" render={({ field }) => ( <FormItem> <FormLabel>State / Province</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={mainCheckoutForm.control} name="zipCode" render={({ field }) => ( <FormItem> <FormLabel>Zip / Postal Code</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
              </div>
              <FormField control={mainCheckoutForm.control} name="country" render={({ field }) => ( <FormItem> <FormLabel>Country</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
            <FormField control={mainCheckoutForm.control} name="revSharePartnerName" render={({ field }) => ( <FormItem> <FormLabel>Partner Name</FormLabel> <FormControl><Input {...field} placeholder="e.g., John Smith" /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={mainCheckoutForm.control} name="revSharePartnerCompany" render={({ field }) => ( <FormItem> <FormLabel>Partner Company</FormLabel> <FormControl><Input {...field} placeholder="e.g., Partner Co." /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={mainCheckoutForm.control} name="revSharePartnerPercentage" render={({ field }) => ( <FormItem> <FormLabel>Share Percentage (%)</FormLabel> <FormControl><Input type="number" min="0" max="100" {...field} placeholder="e.g., 10" value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl> <FormMessage /> </FormItem> )} />
          </CardContent>
        </Card>

        {/* Course Selection */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Select Courses</CardTitle></CardHeader>
          <CardContent>
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
            {mainCheckoutForm.formState.errors.selectedCourseIds && <p className="text-sm font-medium text-destructive mt-2">{mainCheckoutForm.formState.errors.selectedCourseIds.message}</p>}
          </CardContent>
        </Card>

        {/* Main Form Summary & Submit Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Price Summary (for main form context) */}
          <Card className="lg:col-span-1">
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
        
          {/* Stripe Payment Form Section */}
          {stripe && elements && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Test Payment</CardTitle>
                <CardDescription>Make a test payment of $1.00.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTestPaymentSubmit} id="stripe-payment-form" className="space-y-4">
                  <PaymentElement id="payment-element" options={{layout: "tabs"}} />
                  <Button type="submit" className="w-full" disabled={!stripe || isProcessingPayment}>
                    {isProcessingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isProcessingPayment ? 'Processing...' : 'Pay $1.00 (Test)'}
                  </Button>
                  {paymentErrorMessage && <p className="text-xs text-destructive mt-2">{paymentErrorMessage}</p>}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Main Form Submit Button Card */}
          <div className={stripe && elements ? "lg:col-span-1 flex items-end" : "lg:col-span-2 flex items-end"}> {/* Adjust span based on stripe form visibility */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Finalize Account Creation</CardTitle>
                <CardDescription>Review the details and create the new company account.</CardDescription>
              </CardHeader>
              <CardContent>
                {formErrorMessage && (<p className="text-xs text-destructive text-center mb-2">{formErrorMessage}</p>)}
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  form="main-checkout-form" // Ensure this matches the main form's ID
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isProcessingCheckout || selectedCourseIds.length === 0 }
                >
                  {isProcessingCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserIconLucide className="mr-2 h-4 w-4" />}
                  {isProcessingCheckout ? 'Processing...' : `Create Account & Assign Courses`}
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

  // Stripe PaymentIntent states
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingClientSecret, setIsLoadingClientSecret] = useState(false);
  const [paymentIntentError, setPaymentIntentError] = useState<string | null>(null);

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

  // Fetch PaymentIntent clientSecret for the $1.00 test payment
  useEffect(() => {
    const fetchClientSecret = async () => {
      setIsLoadingClientSecret(true);
      setPaymentIntentError(null);
      try {
        const result = await createTestPaymentIntent(100); // 100 cents for $1.00
        if (result.clientSecret) {
          setClientSecret(result.clientSecret);
        } else {
          setPaymentIntentError(result.error || 'Failed to initialize test payment.');
          toast({ title: "Payment Init Error", description: result.error || 'Could not initialize test payment.', variant: "destructive" });
        }
      } catch (err: any) {
        setPaymentIntentError(err.message || 'An unexpected error occurred.');
        toast({ title: "Payment Init Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoadingClientSecret(false);
      }
    };

    if (currentUser && !isCheckingAuth) { // Only fetch if user is authorized
      fetchClientSecret();
    }
  }, [currentUser, isCheckingAuth, toast]);


  if (isCheckingAuth || !currentUser) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Verifying access…</p> </div> );
  }
  if (isLoadingCourses) {
    return ( <div className="container mx-auto py-12 text-center"> <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> <p className="mt-4 text-muted-foreground">Loading courses…</p> </div> );
  }

  const stripeElementsOptions: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance: {theme: 'stripe'} } : undefined;

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">New Customer Checkout</h1>
      {isLoadingClientSecret && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /> <p>Loading payment form...</p></div>}
      {paymentIntentError && !clientSecret && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /> <AlertTitle>Payment Error</AlertTitle> <AlertDescription>{paymentIntentError}</AlertDescription></Alert>}
      
      {stripeElementsOptions && clientSecret ? (
        <Elements stripe={stripePromise} options={stripeElementsOptions}>
          <CheckoutFormContent
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
        </Elements>
      ) : !isLoadingClientSecret && !paymentIntentError ? (
        // Render the form content without Stripe if clientSecret couldn't be fetched but no explicit error (e.g. still loading courses)
        // Or provide a more specific message
        <CheckoutFormContent
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
      ) : null /* Covers case where there's an error and we don't want to show the form, or still loading other things */}
    </div>
  );
}
    
