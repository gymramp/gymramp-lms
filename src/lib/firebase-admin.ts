
import * as admin from 'firebase-admin';

// This is a server-only file.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : undefined;

if (!admin.apps.length) {
  if (!serviceAccount) {
    console.warn("Firebase Admin SDK not initialized: Service Account JSON is missing. Some server actions like creating custom tokens will fail.");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
    }
  }
}

export const adminApp = admin.apps[0] || null;
