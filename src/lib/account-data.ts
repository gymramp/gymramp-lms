
import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
} from 'firebase/firestore';
import type { Company } from '@/types/user';

const COMPANIES_COLLECTION = 'companies';

/**
 * Fetches all companies that are parent accounts (do not have a parentBrandId).
 * @returns {Promise<Company[]>} A promise that resolves to an array of parent companies.
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
        const accounts: Company[] = [];
        querySnapshot.forEach((doc) => {
            accounts.push({ id: doc.id, ...doc.data() } as Company);
        });

        console.log(`Fetched ${accounts.length} parent accounts.`);
        return accounts;
    } catch (error) {
        console.error("Error fetching parent accounts: ", error);
        throw error; // Re-throw the error to be handled by the calling function
    }
}
