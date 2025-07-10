
import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
} from 'firebase/firestore';
import type { Company } from '@/types/user';

const COMPANIES_COLLECTION = 'companies';

/**
 * Fetches all companies that are parent accounts (do not have a parentBrandId).
 * Also fetches the count of their child brands.
 * @returns {Promise<Company[]>} A promise that resolves to an array of parent companies with child counts.
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
            
            // Query for child brands count
            const childBrandsQuery = query(
                companiesRef,
                where("parentBrandId", "==", doc.id),
                where("isDeleted", "==", false)
            );
            const childBrandsSnapshot = await getCountFromServer(childBrandsQuery);
            const childBrandCount = childBrandsSnapshot.data().count;

            return {
                ...companyData,
                childBrandCount: childBrandCount + 1, // Add 1 to include the parent brand itself
            };
        });

        const accounts = await Promise.all(accountsWithCountsPromises);

        console.log(`Fetched ${accounts.length} parent accounts with their child counts.`);
        return accounts;
    } catch (error) {
        console.error("Error fetching parent accounts: ", error);
        throw error; // Re-throw the error to be handled by the calling function
    }
}
