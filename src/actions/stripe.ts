
'use server';

import { stripe } from '@/lib/stripe';
import { getCourseById } from '@/lib/firestore-data';
import type { Course } from '@/types/course';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

/**
 * Creates a Stripe Checkout Session for a specific course purchase.
 * @param courseId - The ID of the course being purchased.
 * @returns An object with the sessionId or an error message.
 */
export async function createCheckoutSession(courseId: string): Promise<
  | { sessionId: string; error?: undefined }
  | { sessionId?: undefined; error: string }
> {
  if (!courseId) {
    return { error: 'Course ID is required.' };
  }

  // TODO: This function needs to be updated if selling individual courses with their own pricing.
  // Currently, Course type no longer has 'price'. Pricing is on Programs.
  // This function will break if called.

  try {
    const course = await getCourseById(courseId);
    // if (!course || !course.price) { // Course no longer has price
    if (!course) {
      return { error: 'Course not found.' };
    }
    // Placeholder price logic - needs to be replaced if this function is still used
    const priceString = "0"; // course.price.replace(/[$,]/g, '');
    const priceAmount = parseFloat(priceString);
    if (isNaN(priceAmount) || priceAmount <= 0) {
      // return { error: 'Invalid course price.' };
      return { error: 'Pricing for individual courses is not configured. Please purchase through a Program.' };
    }
    const amountInCents = Math.round(priceAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      metadata: {
        courseId: course.id,
      },
    });

    if (!session.id) {
        throw new Error('Failed to create Stripe session ID.');
    }

    console.log(`[Server Action] Created Stripe Checkout Session: ${session.id} for course: ${courseId}`);
    return { sessionId: session.id };

  } catch (error: unknown) {
    console.error('Error creating Stripe Checkout Session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred creating Checkout session.';
    return { error: errorMessage };
  }
}


export async function createPaymentIntent(amountInCents: number): Promise<
  | { clientSecret: string; error?: undefined }
  | { clientSecret?: undefined; error: string }
> {
  if (amountInCents <= 0) {
    // Allow $0 for checkout completion if discounts make it free
    // return { error: 'Amount must be positive.' };
    console.log("[Server Action] createPaymentIntent called with $0 or less. No PaymentIntent created.");
    return { clientSecret: 'pi_0_free_checkout' }; // Return a placeholder for $0 amounts
  }
  if (!Number.isInteger(amountInCents)) {
    return { error: 'Amount must be an integer in cents.'}
  }
  if (amountInCents < 50) { // Stripe minimum is typically $0.50
      return { error: 'Amount must be at least $0.50 (or equivalent in cents) for a Stripe payment.' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    if (!paymentIntent.client_secret) {
        throw new Error('Failed to create PaymentIntent client secret.');
    }

    console.log(`[Server Action] Created PaymentIntent: ${paymentIntent.id} for amount: ${amountInCents}`);
    return { clientSecret: paymentIntent.client_secret };

  } catch (error: unknown) {
    console.error('Error creating Stripe PaymentIntent:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred creating PaymentIntent.';
    return { error: errorMessage };
  }
}

export async function createTestPaymentIntent(amountInCents?: number): Promise<
  | { clientSecret: string; error?: undefined }
  | { clientSecret?: undefined; error: string }
> {
  const testAmount = amountInCents && Number.isInteger(amountInCents) && amountInCents > 0 ? amountInCents : 100;

  if (testAmount < 50) {
    return { error: 'Amount must be at least $0.50 (or equivalent in cents).' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: testAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Test Payment for Stripe Integration ($${(testAmount / 100).toFixed(2)})`,
    });

    if (!paymentIntent.client_secret) {
        throw new Error('Failed to create test PaymentIntent client secret.');
    }

    console.log(`[Server Action] Created Test PaymentIntent: ${paymentIntent.id} for amount: ${testAmount}`);
    return { clientSecret: paymentIntent.client_secret };

  } catch (error: unknown) {
    console.error('Error creating Test Stripe PaymentIntent:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred creating Test PaymentIntent.';
    return { error: errorMessage };
  }
}
