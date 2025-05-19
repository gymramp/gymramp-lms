
'use server';

import type { CheckoutFormData } from '@/types/user';
import { addCompany, createDefaultLocation } from '@/lib/company-data';
import { addUser } from '@/lib/user-data';
import { addCustomerPurchaseRecord } from '@/lib/customer-data';
import { getCourseById } from '@/lib/firestore-data';
import { db } from '@/lib/firebase';

import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import type { CustomerPurchaseRecordFormData } from '@/types/customer';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

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


export async function processCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; customerPurchaseId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processCheckout (Paid) for brand:", data.companyName);
  if (data.paymentIntentId) {
    console.log("[Server Action] Payment Intent ID received:", data.paymentIntentId);
  } else {
    console.warn("[Server Action] No Payment Intent ID received. Assuming pre-verified payment or simulation.");
  }

  // TODO: The 'finalTotalAmount' in 'data' is currently based on old Course pricing.
  // This server action needs to be updated once Program-based pricing is implemented
  // in the checkout flow. The 'saleAmount' saved to the Brand will be incorrect until then.

  const localAuthAppName = `checkoutAuthApp-${Date.now()}`;
  let localAuthInstance;

  try {
    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: data.selectedCourseIds || [], // Courses are still assigned, pricing is separate
        maxUsers: data.maxUsers ?? null,
        isTrial: false,
        trialEndsAt: null,
        saleAmount: data.finalTotalAmount ?? 0, // This amount is currently incorrect due to pricing model change
        revenueSharePartners: data.revenueSharePartners || null,
        whiteLabelEnabled: false,
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
        shortDescription: null,
        createdAt: Timestamp.now(), // Explicitly set createdAt
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the brand in the database.");
    }
    console.log(`[Server Action] Brand "${newCompany.name}" (Paid) created with ID: ${newCompany.id}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = data.password || "password";
    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} (Paid) using local auth instance`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create admin user in Firebase Auth (Paid):", authError);
        throw new Error(`AuthCreationError: ${authError.code || 'UnknownCode'} - ${authError.message || 'Failed to create user in authentication service.'}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the admin user account in Firestore (Paid).");
    }
    console.log(`[Server Action] Admin user "${newAdminUser.name}" (Paid) created in Firestore with ID: ${newAdminUser.id}`);

    const selectedCourseTitles = [];
    if (data.selectedCourseIds && data.selectedCourseIds.length > 0) {
        for (const courseId of data.selectedCourseIds) {
            const course = await getCourseById(courseId);
            if (course) {
                selectedCourseTitles.push(course.title);
            } else {
                selectedCourseTitles.push(`Unknown Course (ID: ${courseId})`);
            }
        }
    }

    const customerPurchaseData: CustomerPurchaseRecordFormData = {
        brandId: newCompany.id,
        brandName: newCompany.name,
        adminUserId: newAdminUser.id,
        adminUserEmail: newAdminUser.email,
        totalAmountPaid: data.finalTotalAmount ?? 0, // This amount is currently incorrect
        paymentIntentId: data.paymentIntentId || null,
        selectedCourseIds: data.selectedCourseIds || [],
        selectedCourseTitles: selectedCourseTitles,
        revenueSharePartners: data.revenueSharePartners || null,
        maxUsersConfigured: data.maxUsers ?? null,
    };
    const customerPurchaseRecord = await addCustomerPurchaseRecord(customerPurchaseData);
    if (!customerPurchaseRecord) {
        console.error("[Server Action] CRITICAL: Failed to create customer purchase record after successful brand and user creation. Manual record needed for:", newCompany.id);
    } else {
        console.log(`[Server Action] Customer purchase record created with ID: ${customerPurchaseRecord.id}`);
    }

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id, customerPurchaseId: customerPurchaseRecord?.id };

  } catch (error: any) {
    console.error("[Server Action] Error during paid checkout processing:", error);
    await cleanupFirebaseApp(localAuthAppName);
    return { success: false, error: error.message || "An unexpected error occurred during paid checkout." };
  }
}


export async function processFreeTrialCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processFreeTrialCheckout for brand:", data.companyName);

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
        saleAmount: 0,
        revenueSharePartners: null,
        whiteLabelEnabled: false,
        primaryColor: null,
        secondaryColor: null,
        logoUrl: null,
        shortDescription: null,
        createdAt: Timestamp.now(), // Explicitly set createdAt
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the trial brand in the database.");
    }
    console.log(`[Server Action] Trial Brand "${newCompany.name}" created with ID: ${newCompany.id}, ends: ${trialEndsDate.toLocaleDateString()}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = "password";
    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Trial Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} using local auth instance`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create trial admin user in Firebase Auth:", authError);
        throw new Error(`AuthCreationError: ${authError.code || 'UnknownCode'} - ${authError.message || 'Failed to create user in authentication service.'}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for trial Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the trial admin user account in Firestore.");
    }
    console.log(`[Server Action] Trial Admin user "${newAdminUser.name}" created in Firestore`);

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any)
{
    console.error("[Server Action] Error during free trial checkout processing:", error);
    await cleanupFirebaseApp(localAuthAppName);
    return { success: false, error: error.message || "An unexpected error occurred during free trial checkout." };
  }
}
