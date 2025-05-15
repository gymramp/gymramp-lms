
import Stripe from 'stripe';

// Ensure the Stripe secret key is provided
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('The STRIPE_SECRET_KEY environment variable is not set.');
}

// Initialize Stripe with the API key and specify the API version
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20', // Use the latest API version
});
