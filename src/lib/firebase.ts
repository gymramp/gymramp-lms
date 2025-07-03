
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth'; // Import GoogleAuthProvider
import { getStorage } from 'firebase/storage'; // Import getStorage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Ensure this is in your .env
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

// Initialize Auth
const auth = getAuth(app);
const googleAuthProvider = new GoogleAuthProvider(); // Create and export the provider

// Initialize Storage
const storage = getStorage(app); // Initialize storage

let persistenceEnabled = false; // Track if persistence has been enabled

async function enablePersistence(attempt: number = 1): Promise<void> {
  if (typeof window === 'undefined' || persistenceEnabled) {
    return;
  }

  try {
    await enableIndexedDbPersistence(db);
    persistenceEnabled = true;
    console.log("Firestore persistence enabled successfully.");
  } catch (err: any) {
    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);

    if (err.code === 'failed-precondition') {
        console.warn("Firestore persistence failed precondition: Multiple tabs open? Persistence can only be enabled in one tab at a time.");
        persistenceEnabled = true; // Mark as "attempted"
    } else if (err.code === 'unimplemented') {
         console.warn("Firestore persistence is unavailable in this environment (IndexedDB may not be supported or enabled).");
         persistenceEnabled = true; // Mark as "attempted"
    } else if (err.name === 'QuotaExceededError') {
         console.warn("Firestore persistence quota exceeded. Consider clearing browser data.");
         persistenceEnabled = true; // Mark as "attempted"
    } else {
        console.error(`Attempt ${attempt}: Failed to enable offline persistence:`, err);
    }

    if (attempt >= 5) {
      console.error("Max retries reached, persistence could not be enabled.");
      persistenceEnabled = true; // Mark as "attempted" after max retries
      return;
    }

    // Only retry if it's not a known non-recoverable error
    if (!persistenceEnabled) { // Check if already marked as attempted/failed
        console.log(`Retrying to enable persistence in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await enablePersistence(attempt + 1);
    }
  }
}

// Attempt to enable persistence on the client-side
if (typeof window !== 'undefined') {
  enablePersistence();
}

export { db, auth, storage, googleAuthProvider }; // Export storage and googleAuthProvider
