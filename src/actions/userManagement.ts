
// src/actions/userManagement.ts
'use server';

import { initializeApp, deleteApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, Auth } from 'firebase/auth';
import type { UserFormData, User } from '@/types/user';
import { addUser as addUserToFirestore } from '@/lib/user-data';
import { sendNewUserWelcomeEmail } from '@/lib/email';
import { generateRandomPassword } from '@/lib/utils';

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

interface CreateUserResult {
  success: boolean;
  user?: User;
  tempPassword?: string;
  error?: string;
}

export async function createUserAndSendWelcomeEmail(
  userData: Omit<UserFormData, 'password'>
): Promise<CreateUserResult> {
  const localAuthAppName = `addUserAuthApp-${Date.now()}`;
  let localAuthInstance: Auth | undefined;
  const tempPassword = generateRandomPassword();

  try {
    localAuthInstance = getFirebaseAuthInstance(localAuthAppName);
    await createUserWithEmailAndPassword(localAuthInstance, userData.email, tempPassword);
    console.log(`[Server Action] Auth user created for ${userData.email}`);

    const newUserFirestoreData = {
      ...userData,
      requiresPasswordChange: true,
    };
    const newUser = await addUserToFirestore(newUserFirestoreData);

    if (!newUser) {
      throw new Error('Failed to save user details to Firestore.');
    }

    try {
      await sendNewUserWelcomeEmail(newUser.email, newUser.name, tempPassword);
      console.log(`[Server Action] Welcome email sent to ${newUser.email}`);
    } catch (emailError) {
      console.error(`[Server Action] Failed to send welcome email to ${newUser.email}:`, emailError);
      // Non-fatal, proceed with returning user info
    }

    await cleanupFirebaseApp(localAuthAppName);
    return { success: true, user: newUser, tempPassword };

  } catch (error: any) {
    console.error('[Server Action createUser] Error:', error);
    await cleanupFirebaseApp(localAuthAppName);
    let errorMessage = 'Failed to create user.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email address is already in use.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'The password is too weak (should be ignored as we generate).';
    }
    return { success: false, error: errorMessage };
  }
}
