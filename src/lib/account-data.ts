
import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
} from 'firebase/firestore';
import type { Company } from '@/types/user';
import { getUserCountByCompanyId } from './user-data'; // Import user count function

const COMPANIES_COLLECTION = 'companies';

/**
 * Fetches all companies that are parent accounts (do not have a parentBrandId).
 * Also fetches the count of their child brands and total users across all child brands and the parent.
 * @returns {Promise<Company[]>} A promise that resolves to an array of parent companies with aggregated counts.
 */
export async function getParentAccounts(): Promise<Company[]> {
    try {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(
            companiesRef,
            where("parentBrandId", "==", null),
            where("isDeleted", "==", false)
        );

        const querySnapshot = await getDocs(q);
        const accountsWithCountsPromises = querySnapshot.docs.map(async (doc) => {
            const companyData = { id: doc.id, ...doc.data() } as Company;
            
            // Query for child brands
            const childBrandsQuery = query(
                companiesRef,
                where("parentBrandId", "==", doc.id),
                where("isDeleted", "==", false)
            );
            const childBrandsSnapshot = await getDocs(childBrandsQuery);
            const childBrandCount = childBrandsSnapshot.size;
            const childBrandIds = childBrandsSnapshot.docs.map(d => d.id);

            // Calculate total users
            const allBrandIdsForUserCount = [doc.id, ...childBrandIds];
            let totalUserCount = 0;
            for (const brandId of allBrandIdsForUserCount) {
                const userCount = await getUserCountByCompanyId(brandId);
                totalUserCount += userCount;
            }

            return {
                ...companyData,
                childBrandCount: childBrandCount + 1, // Add 1 to include the parent brand itself
                userCount: totalUserCount, // Set the aggregated user count
            };
        });

        const accounts = await Promise.all(accountsWithCountsPromises);

        console.log(`Fetched ${accounts.length} parent accounts with their child and user counts.`);
        return accounts;
    } catch (error) {
        console.error("Error fetching parent accounts: ", error);
        throw error; // Re-throw the error to be handled by the calling function
    }
}
