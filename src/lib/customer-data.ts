
// src/lib/customer-data.ts
import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    where, // Added where for querying by brandId
    limit, // Added limit for querying by brandId
    deleteDoc // Import deleteDoc
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
        console.log(`Customer purchase record added with ID: ${docRef.id} for brand ${data.brandName}`);
        // For consistency and to ensure we return a full CustomerPurchaseRecord type,
        // it's good practice to fetch the document or construct it carefully.
        // For now, we construct it, assuming serverTimestamp will resolve correctly on read.
        return { ...docData, id: docRef.id, purchaseDate: docData.purchaseDate } as CustomerPurchaseRecord;
    });
}

export async function getAllCustomerPurchaseRecords(): Promise<CustomerPurchaseRecord[]> {
    return retryOperation(async () => {
        const purchasesRef = collection(db, CUSTOMER_PURCHASES_COLLECTION);
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

export async function getCustomerPurchaseRecordByBrandId(brandId: string): Promise<CustomerPurchaseRecord | null> {
    if (!brandId) {
        console.warn("getCustomerPurchaseRecordByBrandId called with empty brandId.");
        return null;
    }
    return retryOperation(async () => {
        const purchasesRef = collection(db, CUSTOMER_PURCHASES_COLLECTION);
        const q = query(
            purchasesRef,
            where("brandId", "==", brandId),
            orderBy("purchaseDate", "desc"), // Get the latest purchase record if multiple exist
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as CustomerPurchaseRecord;
            }
        }
        console.log(`No customer purchase record found for brand ID: ${brandId}`);
        return null;
    });
}

export async function deleteCustomerPurchaseRecord(recordId: string): Promise<boolean> {
    if (!recordId) {
        console.warn("deleteCustomerPurchaseRecord called with empty recordId.");
        return false;
    }
    return retryOperation(async () => {
        const recordRef = doc(db, CUSTOMER_PURCHASES_COLLECTION, recordId);
        await deleteDoc(recordRef);
        console.log(`Customer purchase record with ID: ${recordId} deleted successfully.`);
        return true;
    }, 3);
}
