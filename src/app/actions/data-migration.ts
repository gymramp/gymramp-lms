'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, DocumentData } from 'firebase/firestore';
import type { User } from '@/types/user'; // For role check
import { getUserByEmail } from '@/lib/user-data'; // To verify current user's role
import { auth } from '@/lib/firebase'; // To get current Firebase user

const COLLECTIONS_TO_MIGRATE = ['users', 'companies', 'locations', 'courses', 'lessons', 'quizzes'];

interface MigrationResult {
  success: boolean;
  message: string;
  details?: Record<string, { total: number; updated: number; errors: number }>;
}

async function migrateCollection(collectionName: string, batch: FirebaseFirestore.WriteBatch): Promise<{ total: number; updated: number; errors: number }> {
  let total = 0;
  let updated = 0;
  let errors = 0;

  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    total = snapshot.size;

    snapshot.forEach((document) => {
      const data = document.data() as DocumentData;
      // Add isDeleted: false only if the field doesn't exist or is not already false
      // This prevents re-writing documents unnecessarily or overwriting an intentional true value
      if (data.isDeleted === undefined || data.isDeleted === null) {
        batch.update(document.ref, { isDeleted: false });
        updated++;
      } else if (data.isDeleted !== false && data.isDeleted !== true) {
        // If isDeleted exists but is not a boolean, set it to false
        batch.update(document.ref, { isDeleted: false });
        updated++;
      }
    });
  } catch (error) {
    console.error(`Error migrating collection ${collectionName}:`, error);
    errors++; // Count collection-level errors if any
  }
  return { total, updated, errors };
}

export async function runDataMigration(): Promise<MigrationResult> {
  // 1. Authenticate and Authorize Super Admin
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || !firebaseUser.email) {
    return { success: false, message: 'Authentication required. Please log in as a Super Admin.' };
  }

  const currentUserDetails = await getUserByEmail(firebaseUser.email);
  if (!currentUserDetails || currentUserDetails.role !== 'Super Admin') {
    return { success: false, message: 'Authorization failed. Only Super Admins can run this migration.' };
  }

  console.log(`[Data Migration] Started by Super Admin: ${currentUserDetails.email}`);

  const batch = writeBatch(db);
  const migrationDetails: Record<string, { total: number; updated: number; errors: number }> = {};
  let overallSuccess = true;

  for (const collectionName of COLLECTIONS_TO_MIGRATE) {
    console.log(`[Data Migration] Processing collection: ${collectionName}`);
    const result = await migrateCollection(collectionName, batch);
    migrationDetails[collectionName] = result;
    if (result.errors > 0) {
      overallSuccess = false;
    }
    console.log(`[Data Migration] Collection ${collectionName}: Total Docs: ${result.total}, Updated: ${result.updated}, Errors: ${result.errors}`);
  }

  try {
    await batch.commit();
    console.log('[Data Migration] Batch commit successful.');
    if (overallSuccess) {
      return {
        success: true,
        message: 'Data migration completed successfully. All relevant documents should now have isDeleted: false.',
        details: migrationDetails,
      };
    } else {
      return {
        success: false,
        message: 'Data migration completed with some errors during collection processing. Check server logs.',
        details: migrationDetails,
      };
    }
  } catch (error: any) {
    console.error('[Data Migration] Batch commit failed:', error);
    return {
      success: false,
      message: `Data migration failed during batch commit: ${error.message}`,
      details: migrationDetails,
    };
  }
}