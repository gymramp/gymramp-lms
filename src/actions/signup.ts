
'use server';

import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
// Import the SERVER-SIDE Firebase Admin SDK
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin'; // Import server-side admin app

// Keep client auth for user creation
import { getAuth as getClientAuth, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CompanyFormData } from '@/types/user';
import { addCompany, createDefaultLocation } from '@/lib/company-data';
import { addUser } from '@/lib/user-data';
import { sendNewUserWelcomeEmail } from '@/lib/email';
import * as z from 'zod';

const signupFormSchema = z.object({
  customerName: z.string().min(2),
  companyName: z.string().min(2),
  adminEmail: z.string().email(),
  password: z.string().min(8),
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

interface SignupResult {
  success: boolean;
  companyId?: string;
  adminUserId?: string;
  error?: string;
  customToken?: string; // Add customToken to the return type
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// This function remains for client-side user creation
const getFirebaseAuthInstance = (appName: string): Auth => {
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return getClientAuth(existingApp);
  }
  const localApp = initializeApp(firebaseConfig, appName);
  return getClientAuth(localApp);
};

const cleanupFirebaseApp = async (appName: string): Promise<void> => {
    try {
        const appInstance: FirebaseApp | undefined = getApps().find(app => app.name === appName);
        if (appInstance) {
            await deleteApp(appInstance);
            console.log(`[Server Action] Firebase app instance "${appName}" deleted.`);
        }
    } catch (error) {
        console.error(`[Server Action] Error deleting Firebase app instance "${appName}":`, error);
    }
};

export async function processPublicSignup(data: SignupFormValues, partnerId?: string): Promise<SignupResult> {
  console.log("[processPublicSignup] Starting for brand:", data.companyName);
  if (partnerId) {
    console.log("[processPublicSignup] Associated with Partner ID:", partnerId);
  }

  const localAuthAppName = `signupAuthApp-${Date.now()}`;
  let localAuthInstance: Auth | undefined;
  let newCompanyId: string | undefined;

  try {
    const validatedData = signupFormSchema.safeParse(data);
    if (!validatedData.success) {
      throw new Error("Invalid signup data provided.");
    }
    const { customerName, companyName, adminEmail, password } = validatedData.data;

    const newCompanyData: CompanyFormData = {
        name: companyName,
        isTrial: false, // Public signups are not trials
        trialEndsAt: null,
        assignedProgramIds: [], // No programs assigned by default on public signup
        maxUsers: 5, // Default limit for public signups
        saleAmount: 0, // No sale associated with public signup
        revenueSharePartners: null, // No rev share by default
        whiteLabelEnabled: false,
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
        brandBackgroundColor: null,
        brandForegroundColor: null,
        logoUrl: null,
        shortDescription: null,
        subdomainSlug: null,
        customDomain: null,
        canManageCourses: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        parentBrandId: null,
        createdByUserId: null, // No parent user for public signups
        partnerId: partnerId || null, // Store the partner ID
    };

    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the brand in the database.");
    }
    newCompanyId = newCompany.id;
    console.log(`[processPublicSignup] Brand "${newCompany.name}" created with ID: ${newCompany.id}.`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, adminEmail, password);
        authUserUid = userCredential.user.uid;
        console.log(`[processPublicSignup] Admin user CREATED IN FIREBASE AUTH with UID: ${authUserUid} for email ${adminEmail}.`);
    } catch (authError: any) {
        console.error("[processPublicSignup] Failed to create admin user in Firebase Auth:", authError);
        if (newCompanyId) {
            console.warn(`[processPublicSignup] Auth creation failed. Attempting to soft-delete brand ${newCompanyId}`);
            await deleteDoc(doc(db, 'companies', newCompanyId));
        }
        if (authError.code === 'auth/email-already-in-use') {
             throw new Error("This email address is already registered. Please log in instead.");
        }
        throw new Error(`Failed to create user in authentication service.`);
    }

    const newAdminUserData = {
        name: customerName,
        email: adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
        requiresPasswordChange: false, // User set their own password
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      console.warn(`[processPublicSignup] Firestore user creation failed for Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      if (newCompanyId) {
            console.warn(`[processPublicSignup] Firestore user creation failed. Attempting to soft-delete brand ${newCompanyId}`);
            await deleteDoc(doc(db, 'companies', newCompanyId));
      }
      // This is a critical failure, we should try to clean up the Auth user as well
      const adminAuth = getAdminAuth(adminApp);
      await adminAuth.deleteUser(authUserUid).catch(e => console.error("Failed to delete auth user on cleanup:", e));
      throw new Error("Failed to create the admin user account in Firestore.");
    }

    console.log(`[processPublicSignup] Admin user "${newAdminUser.name}" created in Firestore with ID: ${newAdminUser.id}`);

    try {
        await sendNewUserWelcomeEmail(newAdminUser.email, newAdminUser.name, password);
        console.log(`[processPublicSignup] Welcome email sent to ${newAdminUser.email}`);
    } catch (emailError) {
        console.error(`[processPublicSignup] Failed to send welcome email to ${newAdminUser.email}:`, emailError);
    }

    // Generate custom token for auto-login
    const adminAuth = getAdminAuth(adminApp);
    const customToken = await adminAuth.createCustomToken(authUserUid);
    console.log(`[processPublicSignup] Custom token generated for UID: ${authUserUid}`);

    await cleanupFirebaseApp(localAuthAppName);
    // Return custom token
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id, customToken };

  } catch (error: any) {
    console.error("[processPublicSignup] Error during public signup:", error);
    await cleanupFirebaseApp(localAuthAppName);
    if (newCompanyId && !error.message?.includes('already registered')) {
        try {
            console.warn(`[processPublicSignup] Cleaning up brand ${newCompanyId} due to error: ${error.message}`);
            await deleteDoc(doc(db, 'companies', newCompanyId));
            console.log(`[processPublicSignup] Brand ${newCompanyId} deleted on cleanup.`);
        } catch (cleanupError) {
            console.error(`[processPublicSignup] Error during brand cleanup for ${newCompanyId}:`, cleanupError);
        }
    }
    return { success: false, error: error.message || "An unexpected error occurred during signup." };
  }
}
