
'use server';

import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
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
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const getFirebaseAuthInstance = (appName: string): Auth => {
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return getAuth(existingApp);
  }
  const localApp = initializeApp(firebaseConfig, appName);
  return getAuth(localApp);
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

export async function processPublicSignup(data: SignupFormValues): Promise<SignupResult> {
  console.log("[processPublicSignup] Starting for brand:", data.companyName);

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
        isTrial: false, // Default to not a trial
        trialEndsAt: null,
        assignedProgramIds: [],
        maxUsers: 5, // Default max users
        saleAmount: 0,
        revenueSharePartners: null,
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
        createdByUserId: null, 
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
        // Use the password from the form, not a temp one
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
      const authUserToDelete = getAuth(getApps().find(app => app.name === localAuthAppName) || undefined)?.currentUser;
      if (authUserToDelete && authUserToDelete.uid === authUserUid) {
          await authUserToDelete.delete().catch(e => console.error("Failed to delete auth user on cleanup:", e));
      }
      throw new Error("Failed to create the admin user account in Firestore.");
    }

    console.log(`[processPublicSignup] Admin user "${newAdminUser.name}" created in Firestore with ID: ${newAdminUser.id}`);

    // Welcome email can be sent without a password, as they just set it.
    try {
        await sendNewUserWelcomeEmail(newAdminUser.email, newAdminUser.name, "your chosen password");
        console.log(`[processPublicSignup] Welcome email sent to ${newAdminUser.email}`);
    } catch (emailError) {
        console.error(`[processPublicSignup] Failed to send welcome email to ${newAdminUser.email}:`, emailError);
    }

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any) {
    console.error("[processPublicSignup] Error during public signup:", error);
    await cleanupFirebaseApp(localAuthAppName);
    // Cleanup brand if it was created before the error
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
