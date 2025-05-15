
'use server';

import { stripe } from '@/lib/stripe';
import { getCourseById } from '@/lib/firestore-data';
import type { Course } from '@/types/course';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Fallback URL

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

  try {
    // 1. Fetch course details to get the price
    const course = await getCourseById(courseId);
    if (!course || !course.price) {
      return { error: 'Course not found or price is missing.' };
    }

    // 2. Validate and parse the price (assuming format like "$199.99" or "199.99")
    const priceString = course.price.replace(/[$,]/g, ''); // Remove $ and commas
    const priceAmount = parseFloat(priceString);
    if (isNaN(priceAmount) || priceAmount <= 0) {
      return { error: 'Invalid course price.' };
    }
    const amountInCents = Math.round(priceAmount * 100); // Convert to cents

    // 3. Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd', // Or your desired currency
            product_data: {
              name: course.title,
              description: course.description, // Optional description
              // You can add more product data like images here if needed
              // images: [course.imageUrl],
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, // Redirect URL on success
      cancel_url: `${appUrl}/checkout/cancel`, // Redirect URL on cancellation
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


/**
 * Creates a Stripe PaymentIntent for a given amount.
 * @param amountInCents - The amount to charge in cents.
 * @returns An object with the clientSecret or an error message.
 */
export async function createPaymentIntent(amountInCents: number): Promise<
  | { clientSecret: string; error?: undefined }
  | { clientSecret?: undefined; error: string }
> {
  if (amountInCents <= 0) {
    return { error: 'Amount must be positive.' };
  }
  // Ensure amount is an integer
  if (!Number.isInteger(amountInCents)) {
    return { error: 'Amount must be an integer in cents.'}
  }
   // Stripe has minimum charge amounts (e.g., $0.50 USD)
  if (amountInCents < 50) {
      return { error: 'Amount must be at least $0.50 (or equivalent in cents).' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd', // Or your desired currency
      automatic_payment_methods: { enabled: true }, // Recommended by Stripe
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

/**
 * Creates a test Stripe PaymentIntent for a specified amount, or a default small amount.
 * This is for testing the payment form integration.
 * @param amountInCents - Optional. The amount to charge in cents. Defaults to 100 ($1.00).
 * @returns An object with the clientSecret or an error message.
 */
export async function createTestPaymentIntent(amountInCents?: number): Promise<
  | { clientSecret: string; error?: undefined }
  | { clientSecret?: undefined; error: string }
> {
  const testAmount = amountInCents && Number.isInteger(amountInCents) && amountInCents > 0 ? amountInCents : 100; // Default to $1.00 if invalid or not provided

  if (testAmount < 50) { // Stripe has minimum charge amounts (e.g., $0.50 USD)
    return { error: 'Amount must be at least $0.50 (or equivalent in cents).' };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: testAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Test Payment for Stripe Integration ($${(testAmount / 100).toFixed(2)})`,
      // Ensure you have a way to identify these as test payments if needed, e.g., metadata
      // metadata: { test_payment: true } 
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

