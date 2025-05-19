
// src/lib/customer-data.ts
import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    serverTimestamp,
    query,
    orderBy
} from 'firebase/firestore';
import type { CustomerPurchaseRecord, CustomerPurchaseRecordFormData } from '@/types/customer';

const CUSTOMER_PURCHASES_COLLECTION = 'customerPurchases';

// --- Retry Logic Helper (Consider making this a shared utility if not already) ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = MAX_RETRIES, baseDelay = BASE_DELAY_MS): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            if (attempt === maxRetries) {
                console.error(`Max retries (${maxRetries}) reached for customer-data operation. Failed: ${error.message}`);
                throw error;
            }
            const delay = Math.min(Math.pow(2, attempt) * baseDelay, 10000);
            console.warn(`Customer-data operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}

export async function addCustomerPurchaseRecord(data: CustomerPurchaseRecordFormData): Promise<CustomerPurchaseRecord | null> {
    return retryOperation(async () => {
        const purchaseRecordRef = collection(db, CUSTOMER_PURCHASES_COLLECTION);
        const docData = {
            ...data,
            purchaseDate: serverTimestamp(),
        };
        const docRef = await addDoc(purchaseRecordRef, docData);
        // No need to fetch the doc again, as we have all data + serverTimestamp handles date
        console.log(`Customer purchase record added with ID: ${docRef.id} for brand ${data.brandName}`);
        return { ...docData, id: docRef.id, purchaseDate: docData.purchaseDate } as CustomerPurchaseRecord; // purchaseDate is already a serverTimestamp placeholder
    });
}

export async function getAllCustomerPurchaseRecords(): Promise<CustomerPurchaseRecord[]> {
    return retryOperation(async () => {
        const purchasesRef = collection(db, CUSTOMER_PURCHASES_COLLECTION);
        // Order by purchaseDate descending to show most recent first
        const q = query(purchasesRef, orderBy("purchaseDate", "desc"));
        const querySnapshot = await getDocs(q);
        const records: CustomerPurchaseRecord[] = [];
        querySnapshot.forEach((doc) => {
            records.push({ id: doc.id, ...doc.data() } as CustomerPurchaseRecord);
        });
        console.log(`Fetched ${records.length} customer purchase records.`);
        return records;
    });
}

// Future functions like getCustomerPurchaseRecordById or update can be added here.
