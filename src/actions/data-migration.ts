
'use server';

import { createDefaultCompany, assignMissingCompanyToUsers, createDefaultLocation, assignMissingLocationToUsers } from '@/lib/company-data';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface MigrationResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Server action to find all users without a companyId and assign them
 * to the default "Gymramp" company. It will create the default company if it doesn't exist.
 */
export async function runUserBrandMigration(): Promise<MigrationResult> {
  console.log('[Data Migration Action] Starting user brand migration...');
  try {
    // 1. Get or create the default company
    const defaultCompany = await createDefaultCompany();
    if (!defaultCompany || !defaultCompany.id) {
      throw new Error("Could not find or create the default 'Gymramp' brand.");
    }
    console.log(`[Data Migration Action] Default brand ID: ${defaultCompany.id}`);

    // 2. Assign the default company to users missing one
    const updatedCount = await assignMissingCompanyToUsers(defaultCompany.id);
    
    // 3. Get or create a default location for the default company
    const defaultLocation = await createDefaultLocation(defaultCompany.id);
    if (!defaultLocation || !defaultLocation.id) {
        console.warn(`[Data Migration Action] Could not find or create a default location for the default brand. Skipping location assignment.`);
    } else {
        console.log(`[Data Migration Action] Default location ID: ${defaultLocation.id}. Assigning to users in default brand who need it.`);
        // 4. Assign the default location to any user in the default company that doesn't have one
        await assignMissingLocationToUsers(defaultCompany.id, defaultLocation.id);
    }
    
    
    console.log(`[Data Migration Action] Migration complete. ${updatedCount} users were updated.`);
    return { success: true, count: updatedCount };

  } catch (error: any) {
    console.error("[Data Migration Action] An error occurred:", error);
    return { success: false, count: 0, error: error.message || "An unexpected error occurred during migration." };
  }
}

/**
 * A utility function to count all users, just for testing/verification.
 */
export async function countAllUsers(): Promise<{count: number}> {
    const querySnapshot = await getDocs(collection(db, "users"));
    return { count: querySnapshot.size };
}
