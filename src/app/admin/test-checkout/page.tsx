
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Added Input for discount
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createTestPaymentIntent } from '@/actions/stripe';
import { getAllCourses } from '@/lib/firestore-data';
import type { Course } from '@/types/course';
import { Loader2, CreditCard, AlertTriangle, BookOpen, Percent } from 'lucide-react'; // Added Percent icon
import { useRouter } from 'next/navigation';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ amountInDollars }: { amountInDollars: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setPaymentStatus(null);

    if (!stripe || !elements) {
      setErrorMessage('Stripe.js has not loaded yet. Please try again in a moment.');
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/admin/test-checkout/result`,
      },
      redirect: 'if_required'
    });

    setIsProcessing(false);

    if (error) {
      console.error('Stripe confirmPayment error:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      toast({
        title: 'Payment Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } else if (paymentIntent) {
      switch (paymentIntent.status) {
        case 'succeeded':
          setPaymentStatus('Payment Succeeded!');
          toast({
            title: 'Payment Succeeded!',
            description: 'Your test payment was successful.',
          });
          router.push(`/admin/test-checkout/result?payment_intent=${paymentIntent.id}&payment_intent_client_secret=${paymentIntent.client_secret}&redirect_status=succeeded`);
          break;
        case 'processing':
          setPaymentStatus('Payment processing. We will update you when payment is complete.');
          toast({
            title: 'Payment Processing',
            description: 'Your payment is being processed.',
          });
          break;
        case 'requires_payment_method':
          setErrorMessage('Payment failed. Please try another payment method.');
          toast({
            title: 'Payment Failed',
            description: 'Payment failed. Please try another payment method.',
            variant: 'destructive',
          });
          break;
        default:
          setErrorMessage('Something went wrong with the payment.');
          toast({
            title: 'Payment Error',
            description: `An unknown payment error occurred. Status: ${paymentIntent.status}`,
            variant: 'destructive',
          });
          break;
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      <Button type="submit" disabled={!stripe || isProcessing || amountInDollars <= 0} className="w-full bg-primary hover:bg-primary/90">
        {isProcessing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        {isProcessing ? 'Processing...' : `Pay $${amountInDollars > 0 ? amountInDollars.toFixed(2) : '0.00'} (Test)`}
      </Button>
      {errorMessage && (
        <div className="text-destructive text-sm text-center p-2 bg-destructive/10 rounded-md">
          {errorMessage}
        </div>
      )}
      {paymentStatus && (
         <div className="text-green-600 text-sm text-center p-2 bg-green-500/10 rounded-md">
          {paymentStatus}
        </div>
      )}
    </form>
  );
}

export default function TestCheckoutPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingSecret, setIsLoadingSecret] = useState(false);
  const [errorSecret, setErrorSecret] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const [discountPercentInput, setDiscountPercentInput] = useState('');
  const [appliedDiscountAmount, setAppliedDiscountAmount] = useState(0);
  const [finalTotalAmount, setFinalTotalAmount] = useState(0); // This is in dollars

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const coursesData = await getAllCourses();
        setAllCourses(coursesData);
      } catch (err) {
        console.error("Error fetching courses:", err);
        toast({ title: "Error", description: "Could not load courses.", variant: "destructive" });
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [toast]);

  const selectedCourse = useMemo(() => {
    return allCourses.find(course => course.id === selectedCourseId);
  }, [allCourses, selectedCourseId]);

  const subtotalInCents = useMemo(() => {
    if (!selectedCourse || !selectedCourse.price) return 0;
    const priceString = selectedCourse.price.replace(/[$,]/g, '');
    const priceAmount = parseFloat(priceString);
    return isNaN(priceAmount) ? 0 : Math.round(priceAmount * 100);
  }, [selectedCourse]);

  const subtotalInDollars = subtotalInCents / 100;

  useEffect(() => {
    const discount = parseFloat(discountPercentInput);
    let discountAmountValue = 0;
    if (!isNaN(discount) && discount >= 0 && discount <= 100) { // Allow 0% discount
      discountAmountValue = (subtotalInDollars * discount) / 100;
    } else if (discountPercentInput !== '' && (isNaN(discount) || discount < 0 || discount > 100)) {
        // Optionally provide feedback for invalid discount input
        // toast({ title: "Invalid Discount", description: "Discount must be between 0 and 100.", variant: "destructive" });
    }
    setAppliedDiscountAmount(discountAmountValue);
    const finalAmountValue = Math.max(0, subtotalInDollars - discountAmountValue);
    setFinalTotalAmount(finalAmountValue);
  }, [subtotalInDollars, discountPercentInput]);


  const fetchClientSecret = useCallback(async (cents: number) => {
    if (cents === 0 && selectedCourseId) {
        setErrorSecret('Selected course has an invalid price or discount makes it free. Cannot initialize payment for $0.00.');
        setClientSecret(null);
        setIsLoadingSecret(false);
        return;
    }
    // createTestPaymentIntent has its own minimum check (e.g. 50 cents)
    // if (cents < 50 && cents > 0) {
    //     setErrorSecret('Amount must be at least $0.50.');
    //     setClientSecret(null);
    //     setIsLoadingSecret(false);
    //     return;
    // }
     if (cents <= 0 && !selectedCourseId) {
        setClientSecret(null);
        setErrorSecret(null);
        setIsLoadingSecret(false);
        return;
     }

    setIsLoadingSecret(true);
    setErrorSecret(null);
    setClientSecret(null); // Clear previous secret
    try {
      const result = await createTestPaymentIntent(cents);
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        setErrorSecret(result.error || 'Failed to fetch payment details.');
        toast({
          title: 'Error Initializing Payment',
          description: result.error || 'Could not retrieve payment details.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setErrorSecret(err.message || 'An unexpected error occurred while fetching payment details.');
      toast({
        title: 'Initialization Error',
        description: err.message || 'Could not initialize the payment form.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSecret(false);
    }
  }, [toast, selectedCourseId]);

  useEffect(() => {
    const finalAmountInCentsValue = Math.round(finalTotalAmount * 100);
    if (selectedCourseId) { // Only attempt fetch if a course is selected
        if (finalAmountInCentsValue > 0) {
            fetchClientSecret(finalAmountInCentsValue);
        } else {
            // If final amount is 0 or less due to discount, but a course is selected
            setErrorSecret('Final amount after discount is $0.00 or less. No payment needed.');
            setClientSecret(null); // Clear client secret as no payment is needed
            setIsLoadingSecret(false);
        }
    } else {
        setClientSecret(null);
        setErrorSecret(null);
        setIsLoadingSecret(false);
    }
  }, [finalTotalAmount, selectedCourseId, fetchClientSecret]);


  const options: StripeElementsOptions | undefined = clientSecret ? { clientSecret, appearance: { theme: 'stripe' } } : undefined;

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20 flex justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Stripe Test Checkout</CardTitle>
          <CardDescription>Select a course, apply an optional discount, and test the Stripe Payment Element.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <Label htmlFor="course-select" className="flex items-center gap-1 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Select Course
            </Label>
            {isLoadingCourses ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger id="course-select">
                  <SelectValue placeholder="Choose a course..." />
                </SelectTrigger>
                <SelectContent>
                  {allCourses.length > 0 ? (
                    allCourses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title} ({course.price})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No courses found.</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedCourse && (
            <div className="space-y-4 mb-6 border-t pt-4">
                <h3 className="text-md font-semibold text-primary">Order Summary</h3>
                <div className="flex justify-between text-sm">
                    <span>Subtotal (Course: {selectedCourse.title}):</span>
                    <span className="font-medium">${subtotalInDollars.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="discount-percent" className="flex items-center gap-1 text-sm font-medium">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        Discount Percentage
                    </Label>
                    <Input
                        id="discount-percent"
                        type="number"
                        placeholder="e.g., 10 for 10%"
                        value={discountPercentInput}
                        onChange={(e) => setDiscountPercentInput(e.target.value)}
                        min="0"
                        max="100"
                        className="h-9"
                    />
                </div>
                {appliedDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                        <span>Discount Applied:</span>
                        <span className="font-medium">-${appliedDiscountAmount.toFixed(2)}</span>
                    </div>
                )}
                <hr/>
                <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Total:</span>
                    <span>${finalTotalAmount.toFixed(2)}</span>
                </div>
            </div>
          )}


          {isLoadingSecret && selectedCourseId && (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Initializing Payment Form...</p>
            </div>
          )}
          {errorSecret && !isLoadingSecret && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-destructive bg-destructive/10 p-4 rounded-md">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Could not load payment form:</p>
              <p className="text-sm">{errorSecret}</p>
            </div>
          )}
          {/* Render Elements only if clientSecret is available and no error and finalTotal is > 0 */}
          {!isLoadingSecret && clientSecret && options && finalTotalAmount > 0 && (
            <Elements stripe={stripePromise} options={options}>
              <CheckoutForm amountInDollars={finalTotalAmount} />
            </Elements>
          )}
           {!isLoadingSecret && !clientSecret && !errorSecret && (!selectedCourseId || finalTotalAmount <= 0) && (
             <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                {selectedCourseId && finalTotalAmount <= 0 && subtotalInDollars > 0 ? "Final amount is $0.00 or less. No payment required." :
                 !selectedCourseId ? "Please select a course to load payment form." :
                 subtotalInDollars === 0 ? "Selected course has a price of $0.00. No payment required." :
                 "Please select a course or adjust discount."}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
    
