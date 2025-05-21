
'use server';

import type { CheckoutFormData } from '@/types/user';
import { addCompany, updateCompany, createDefaultLocation } from '@/lib/company-data';
import { addUser } from '@/lib/user-data';
import { addCustomerPurchaseRecord } from '@/lib/customer-data';
import { getProgramById, getCourseById } from '@/lib/firestore-data';
import { stripe } from '@/lib/stripe';
import { initializeApp, deleteApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, Auth } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import type { CustomerPurchaseRecordFormData } from '@/types/customer';
import type { Program } from '@/types/course';
import { generateRandomPassword } from '@/lib/utils'; // Import password generator

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

export async function processCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; customerPurchaseId?: string; tempPassword?: string; error?: undefined }
| { success: boolean; error: string; tempPassword?: undefined }
> {
  console.log("[Server Action] Starting processCheckout (Paid) for brand:", data.companyName);
  if (data.paymentIntentId) {
    console.log("[Server Action] Payment Intent ID received:", data.paymentIntentId);
  } else {
    console.warn("[Server Action] No Payment Intent ID received. Assuming pre-verified payment or simulation.");
  }

  const localAuthAppName = `checkoutAuthApp-${Date.now()}`;
  let localAuthInstance: Auth | undefined;
  let newCompanyId: string | undefined;
  let newAdminUserId: string | undefined;
  const tempPassword = generateRandomPassword(); // Generate password

  try {
    const selectedProgram: Program | null = await getProgramById(data.selectedProgramId);
    if (!selectedProgram) {
        throw new Error(`Selected Program (ID: ${data.selectedProgramId}) not found.`);
    }
    const coursesToAssignToBrand = selectedProgram.courseIds || [];

    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: coursesToAssignToBrand,
        maxUsers: data.maxUsers ?? null,
        isTrial: false,
        trialEndsAt: null,
        saleAmount: data.finalTotalAmount ?? 0,
        revenueSharePartners: data.revenueSharePartners || null,
        whiteLabelEnabled: false,
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
        logoUrl: null,
        shortDescription: null,
        createdAt: Timestamp.now(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the brand in the database.");
    }
    newCompanyId = newCompany.id;
    console.log(`[Server Action] Brand "${newCompany.name}" (Paid Program) created with ID: ${newCompany.id}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    let authUserUid: string;
    try {
        localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
        const userCredential = await createUserWithEmailAndPassword(localAuthInstance, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} (Paid Program) using local auth instance`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create admin user in Firebase Auth (Paid Program):", authError);
        throw new Error(`AuthCreationError: ${authError.code || 'UnknownCode'} - ${authError.message || 'Failed to create user in authentication service.'}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
        requiresPasswordChange: true, // Mark for password change
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the admin user account in Firestore (Paid Program).");
    }
    newAdminUserId = newAdminUser.id;
    console.log(`[Server Action] Admin user "${newAdminUser.name}" (Paid Program) created in Firestore with ID: ${newAdminUser.id}`);

    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (data.paymentIntentId && data.paymentIntentId !== 'pi_0_free_checkout' && data.finalTotalAmount && data.finalTotalAmount > 0) {
        try {
            console.log(`[Server Action] Creating Stripe Customer for ${data.adminEmail}, Brand: ${newCompany.name}`);
            const customer = await stripe.customers.create({
                email: data.adminEmail,
                name: newCompany.name,
                metadata: {
                    brandId: newCompany.id,
                    adminUserId: newAdminUser.id,
                }
            });
            stripeCustomerId = customer.id;
            console.log(`[Server Action] Stripe Customer created with ID: ${stripeCustomerId}`);

            if (selectedProgram.stripeFirstPriceId && stripeCustomerId) {
                console.log(`[Server Action] Creating Stripe Subscription for Program "${selectedProgram.title}" (Price ID: ${selectedProgram.stripeFirstPriceId}) for Customer ${stripeCustomerId}`);
                const subscription = await stripe.subscriptions.create({
                    customer: stripeCustomerId,
                    items: [{ price: selectedProgram.stripeFirstPriceId }],
                    trial_period_days: 30,
                });
                stripeSubscriptionId = subscription.id;
                console.log(`[Server Action] Stripe Subscription created with ID: ${stripeSubscriptionId}`);
            } else {
                console.log(`[Server Action] No Stripe Price ID found for first subscription tier of Program "${selectedProgram.title}", or Stripe Customer not created. Skipping Stripe Subscription creation.`);
            }

            await updateCompany(newCompany.id, { stripeCustomerId, stripeSubscriptionId });
            console.log(`[Server Action] Brand ${newCompany.id} updated with Stripe Customer ID: ${stripeCustomerId} and Subscription ID: ${stripeSubscriptionId}`);

        } catch (stripeError: any) {
            console.error("[Server Action] Error creating Stripe Customer/Subscription or updating Brand:", stripeError);
        }
    }

    const programCourseTitles = [];
    if (coursesToAssignToBrand.length > 0) {
        for (const courseId of coursesToAssignToBrand) {
            const course = await getCourseById(courseId);
            if (course) {
                programCourseTitles.push(course.title);
            } else {
                programCourseTitles.push(`Unknown Course (ID: ${courseId})`);
            }
        }
    }

    const customerPurchaseData: CustomerPurchaseRecordFormData = {
        brandId: newCompany.id,
        brandName: newCompany.name,
        adminUserId: newAdminUser.id,
        adminUserEmail: newAdminUser.email,
        totalAmountPaid: data.finalTotalAmount ?? 0,
        paymentIntentId: data.paymentIntentId || null,
        selectedProgramId: data.selectedProgramId,
        selectedProgramTitle: selectedProgram.title,
        selectedCourseIds: coursesToAssignToBrand,
        selectedCourseTitles: programCourseTitles,
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
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id, customerPurchaseId: customerPurchaseRecord?.id, tempPassword };

  } catch (error: any) {
    console.error("[Server Action] Error during paid checkout processing (Program):", error);
    await cleanupFirebaseApp(localAuthAppName);
    return { success: false, error: error.message || "An unexpected error occurred during paid checkout." };
  }
}

export async function processFreeTrialCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; tempPassword?: string; error?: undefined }
| { success: boolean; error: string; tempPassword?: undefined }
> {
  console.log("[Server Action] Starting processFreeTrialCheckout for brand:", data.companyName);

  const localAuthAppName = `freeTrialAuthApp-${Date.now()}`;
  let localAuthInstance: Auth | undefined;
  const tempPassword = generateRandomPassword(); // Generate password

  try {
    const selectedProgram: Program | null = await getProgramById(data.selectedProgramId);
    if (!selectedProgram) {
        throw new Error(`Selected Program (ID: ${data.selectedProgramId}) not found for free trial.`);
    }
    const coursesToAssignToBrand = selectedProgram.courseIds || [];

    const trialDurationDays = data.trialDurationDays || 7;
    const trialEndsDate = new Date();
    trialEndsDate.setDate(trialEndsDate.getDate() + trialDurationDays);
    const trialEndsAtTimestamp = Timestamp.fromDate(trialEndsDate);

    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: coursesToAssignToBrand,
        maxUsers: data.maxUsers ?? null,
        isTrial: true,
        trialEndsAt: trialEndsAtTimestamp,
        saleAmount: 0,
        revenueSharePartners: null,
        whiteLabelEnabled: false,
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
        logoUrl: null,
        shortDescription: null,
        createdAt: Timestamp.now(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the trial brand in the database.");
    }
    console.log(`[Server Action] Trial Brand "${newCompany.name}" created with ID: ${newCompany.id}, ends: ${trialEndsDate.toLocaleDateString()}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

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
        requiresPasswordChange: true, // Mark for password change
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      console.warn(`[Server Action] Firestore user creation failed for trial Auth UID ${authUserUid}. Manual Auth user cleanup might be needed.`);
      throw new Error("Failed to create the trial admin user account in Firestore.");
    }
    console.log(`[Server Action] Trial Admin user "${newAdminUser.name}" created in Firestore`);

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id, tempPassword };

  } catch (error: any) {
    console.error("[Server Action] Error during free trial checkout processing:", error);
    await cleanupFirebaseApp(localAuthAppName);
    return { success: false, error: error.message || "An unexpected error occurred during free trial checkout." };
  }
}

    