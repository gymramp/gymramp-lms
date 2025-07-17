
'use server';

import { createDefaultCompany, getCompaniesForMigration, assignMissingLocationToUsers } from '@/lib/company-data';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { getUsersWithoutCompany } from '@/lib/user-data';
import type { User, Company } from '@/types/user';

interface MigrationResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Server action to fetch all users without a companyId.
 */
export async function getUnassignedUsers(): Promise<User[]> {
    try {
        const users = await getUsersWithoutCompany();
        return users;
    } catch (error: any) {
        console.error("[Data Migration Action] Error fetching unassigned users:", error);
        // In a real app, you might want to return an error object,
        // but for simplicity, we return an empty array on failure.
        return [];
    }
}

/**
 * Server action to fetch all companies for the migration target dropdown.
 */
export async function getTargetCompanies(): Promise<Company[]> {
    try {
        const companies = await getCompaniesForMigration();
        return companies;
    } catch (error: any) {
        console.error("[Data Migration Action] Error fetching target companies:", error);
        return [];
    }
}


/**
 * Server action to assign selected users to a specified company.
 * @param userIds - An array of user IDs to migrate.
 * @param targetCompanyId - The ID of the company to assign the users to.
 */
export async function runUserBrandMigration(userIds: string[], targetCompanyId: string): Promise<MigrationResult> {
  console.log(`[Data Migration Action] Starting migration for ${userIds.length} users to company ${targetCompanyId}`);
  if (!userIds || userIds.length === 0) {
    return { success: false, count: 0, error: "No users selected for migration." };
  }
  if (!targetCompanyId) {
    return { success: false, count: 0, error: "No target company selected." };
  }

  try {
    const batch = writeBatch(db);
    userIds.forEach(userId => {
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, { 
        companyId: targetCompanyId,
        updatedAt: serverTimestamp() 
      });
    });

    await batch.commit();

    // After assigning users to the company, let's also assign a default location.
    const defaultLocation = await createDefaultLocation(targetCompanyId);
    if (!defaultLocation || !defaultLocation.id) {
        console.warn(`[Data Migration Action] Could not find or create a default location for the target brand ${targetCompanyId}. Skipping location assignment.`);
    } else {
        console.log(`[Data Migration Action] Default location ID: ${defaultLocation.id}. Assigning to newly migrated users if they need it.`);
        // Re-check and assign location for the specific users who were just migrated
        for (const userId of userIds) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if(userSnap.exists()){
                const userData = userSnap.data() as User;
                if(!userData.assignedLocationIds || userData.assignedLocationIds.length === 0){
                    await updateDoc(userRef, { assignedLocationIds: [defaultLocation.id] });
                }
            }
        }
    }
    
    console.log(`[Data Migration Action] Migration complete. ${userIds.length} users were updated.`);
    return { success: true, count: userIds.length };

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
