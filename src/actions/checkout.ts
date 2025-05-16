
'use server';

import type { CheckoutFormData } from '@/types/user';
import { addCompany, createDefaultLocation } from '@/lib/company-data';
import { addUser } from '@/lib/user-data';
// import { auth } from '@/lib/firebase'; // Not needed for the original admin session
import { db } from '@/lib/firebase'; // For Firestore operations

// Import Firebase app and auth for local instance creation
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

// Define firebaseConfig directly here or import if made exportable from lib/firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Helper function to initialize Firebase app safely
const getFirebaseAuthInstance = (appName: string) => {
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return getAuth(existingApp);
  }
  const localApp = initializeApp(firebaseConfig, appName);
  return getAuth(localApp);
};

const cleanupFirebaseApp = async (appName: string) => {
    try {
        const appInstance = getApps().find(app => app.name === appName);
        if (appInstance) {
            await deleteApp(appInstance);
            console.log(`[Server Action] Firebase app instance "${appName}" deleted.`);
        }
    } catch (error) {
        console.error(`[Server Action] Error deleting Firebase app instance "${appName}":`, error);
    }
};


// --- Process Paid Checkout Function ---
export async function processCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processCheckout (Paid) for company:", data.companyName);
  if (data.paymentIntentId) {
    console.log("[Server Action] Payment Intent ID received:", data.paymentIntentId);
  } else {
    console.warn("[Server Action] No Payment Intent ID received. Assuming pre-verified payment or simulation.");
  }

  const localAuthAppName = `checkoutAuthApp-${Date.now()}`;
  let localAuthInstance;

  try {
    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: data.selectedCourseIds || [],
        maxUsers: data.maxUsers ?? null,
        isTrial: false,
        trialEndsAt: null,
        saleAmount: data.finalTotalAmount ?? null, // Store the sale amount
        revSharePartnerName: data.revSharePartnerName || null,
        revSharePartnerCompany: data.revSharePartnerCompany || null,
        revSharePartnerPercentage: data.revSharePartnerPercentage ?? null,
    };
    const newCompany = await addCompany(newCompanyData); // Uses global db
    if (!newCompany) {
      throw new Error("Failed to create the company in the database.");
    }
    console.log(`[Server Action] Company "${newCompany.name}" (Paid) created with ID: ${newCompany.id}`);

    const defaultLocation = await createDefaultLocation(newCompany.id); // Uses global db
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = data.password || "password"; // Use provided password or default
    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} (Paid) using local auth instance`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create admin user in Firebase Auth (Paid):", authError);
        // Do not expose full authError to client, log it and throw generic or specific safe message
        if (authError.message && authError.message.includes("Admin session error")) {
             throw new Error("Admin session error. Please log in again.");
        }
        throw new Error(`AuthCreationError: ${authError.code || 'UnknownCode'} - ${authError.message || 'Failed to create user in authentication service.'}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData); // Uses global db
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the admin user account in Firestore (Paid).");
    }
    console.log(`[Server Action] Admin user "${newAdminUser.name}" (Paid) created in Firestore`);

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any) {
    console.error("[Server Action] Error during paid checkout processing:", error);
    await cleanupFirebaseApp(localAuthAppName); // Ensure cleanup on error too
    return { success: false, error: error.message || "An unexpected error occurred during paid checkout." };
  }
}


// --- Process Free Trial Checkout Function ---
export async function processFreeTrialCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processFreeTrialCheckout for company:", data.companyName);

  const localAuthAppName = `freeTrialAuthApp-${Date.now()}`;
  let localAuthInstance;

  try {
    const trialDurationDays = data.trialDurationDays || 7;
    const trialEndsDate = new Date();
    trialEndsDate.setDate(trialEndsDate.getDate() + trialDurationDays);
    const trialEndsAtTimestamp = Timestamp.fromDate(trialEndsDate);

    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: data.selectedCourseIds || [],
        maxUsers: data.maxUsers ?? null,
        isTrial: true,
        trialEndsAt: trialEndsAtTimestamp,
        saleAmount: 0, // Free trials have no sale amount
        revSharePartnerName: null,
        revSharePartnerCompany: null,
        revSharePartnerPercentage: null,
    };
    const newCompany = await addCompany(newCompanyData); // Uses global db
    if (!newCompany) {
      throw new Error("Failed to create the trial company in the database.");
    }
    console.log(`[Server Action] Trial Company "${newCompany.name}" created with ID: ${newCompany.id}, ends: ${trialEndsDate.toLocaleDateString()}`);

    const defaultLocation = await createDefaultLocation(newCompany.id); // Uses global db
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = "password"; // Default password for trial admin
    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Trial Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} using local auth instance`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create trial admin user in Firebase Auth:", authError);
         if (authError.message && authError.message.includes("Admin session error")) {
             throw new Error("Admin session error. Please log in again.");
        }
        throw new Error(`AuthCreationError: ${authError.code || 'UnknownCode'} - ${authError.message || 'Failed to create user in authentication service.'}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData); // Uses global db
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for trial Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the trial admin user account in Firestore.");
    }
    console.log(`[Server Action] Trial Admin user "${newAdminUser.name}" created in Firestore`);

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any) {
    console.error("[Server Action] Error during free trial checkout processing:", error);
    await cleanupFirebaseApp(localAuthAppName); // Ensure cleanup on error too
    return { success: false, error: error.message || "An unexpected error occurred during free trial checkout." };
  }
}

