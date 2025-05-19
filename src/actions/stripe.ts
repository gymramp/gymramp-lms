
'use server';

import { stripe } from '@/lib/stripe';
// getCourseById is no longer needed here as we don't sell individual courses this way
// import { getCourseById } from '@/lib/firestore-data';
// import type { Course } from '@/types/course';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

/**
 * Creates a Stripe Checkout Session.
 * THIS FUNCTION IS LIKELY OBSOLETE as sales are now Program-based.
 * If individual item sales are needed via Stripe Checkout (not Payment Element), this needs rework.
 * @param itemId - The ID of the item being purchased (e.g., a program ID).
 * @param itemType - 'program' or 'course' (if courses were to be sold individually again).
 * @returns An object with the sessionId or an error message.
 */
export async function createCheckoutSession(
  itemId: string, 
  itemType: 'program' /* | 'course' */ // Course selling via this method is deprecated
): Promise<
  | { sessionId: string; error?: undefined }
  | { sessionId?: undefined; error: string }
> {
  // TODO: This function is deprecated as checkout now uses Payment Intents for Program sales.
  // If Stripe Checkout Sessions are needed for direct Program sales in the future, this
  // function needs to be completely rewritten to fetch Program details and its price.
  console.warn("[Server Action createCheckoutSession] This function is deprecated and likely non-functional for current Program-based sales model.");
  return { error: 'This checkout method (Stripe Checkout Session) is deprecated. Please use the Program-based checkout flow.' };

  /*
  // Old logic for course-based checkout session:
  if (!itemId) {
    return { error: 'Item ID is required.' };
  }

  try {
    // This logic would need to fetch Program details and price instead of Course
    // const item = await getProgramById(itemId); // Example if selling programs
    // if (!item || !item.price) { 
    //   return { error: 'Item not found or no price defined.' };
    // }
    // const priceString = item.price.replace(/[$,]/g, '');
    // const priceAmount = parseFloat(priceString);
    // if (isNaN(priceAmount) || priceAmount <= 0) {
    //   return { error: 'Invalid item price.' };
    // }
    // const amountInCents = Math.round(priceAmount * 100);

    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: [
    //     {
    //       price_data: {
    //         currency: 'usd',
    //         product_data: {
    //           name: item.title,
    //           description: item.description,
    //         },
    //         unit_amount: amountInCents,
    //       },
    //       quantity: 1,
    //     },
    //   ],
    //   mode: 'payment', // or 'subscription' if selling subscriptions
    //   success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${appUrl}/checkout/cancel`,
    //   metadata: {
    //     itemId: item.id,
    //     itemType: itemType
    //   },
    // });

    // if (!session.id) {
    //     throw new Error('Failed to create Stripe session ID.');
    // }

    // console.log(`[Server Action] Created Stripe Checkout Session: ${session.id} for ${itemType}: ${itemId}`);
    // return { sessionId: session.id };

  } catch (error: unknown) {
    console.error('Error creating Stripe Checkout Session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred creating Checkout session.';
    return { error: errorMessage };
  }
  */
}


export async function createPaymentIntent(amountInCents: number): Promise<
  | { clientSecret: string; error?: undefined }
  | { clientSecret?: undefined; error: string }
> {
  if (amountInCents < 0) { // Allow $0 or positive amounts
    return { error: 'Amount cannot be negative.' };
  }
  if (amountInCents === 0) {
    console.log("[Server Action] createPaymentIntent called with $0. No PaymentIntent created, returning placeholder.");
    return { clientSecret: 'pi_0_free_checkout' }; // Placeholder for $0 amounts
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
  const testAmount = amountInCents && Number.isInteger(amountInCents) && amountInCents > 0 ? amountInCents : 100; // Default to $1.00 if no valid amount

  if (testAmount < 50) { // Stripe minimum
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
