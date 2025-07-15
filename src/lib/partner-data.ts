
import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import type { Partner, PartnerFormData } from '@/types/partner';

const PARTNERS_COLLECTION = 'partners';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            if (attempt === maxRetries) {
                console.error(`Max retries (${maxRetries}) for partner-data op. Failed: ${error.message}`);
                throw error;
            }
            const delay = Math.pow(2, attempt) * BASE_DELAY_MS;
            console.warn(`Partner-data op failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}


export async function getAllPartners(): Promise<Partner[]> {
    return retryOperation(async () => {
        const partnersRef = collection(db, PARTNERS_COLLECTION);
        const q = query(partnersRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const partners: Partner[] = [];
        querySnapshot.forEach((doc) => {
            partners.push({ id: doc.id, ...doc.data() } as Partner);
        });
        return partners;
    });
}

export async function getPartnerById(partnerId: string): Promise<Partner | null> {
    if (!partnerId) return null;
    return retryOperation(async () => {
        const partnerRef = doc(db, PARTNERS_COLLECTION, partnerId);
        const docSnap = await getDoc(partnerRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Partner;
        }
        return null;
    });
}

export async function addPartner(partnerData: PartnerFormData): Promise<Partner | null> {
    return retryOperation(async () => {
        const partnersRef = collection(db, PARTNERS_COLLECTION);
        const newPartnerDoc = {
            ...partnerData,
            availableProgramIds: partnerData.availableProgramIds || [],
            logoUrl: partnerData.logoUrl || null,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(partnersRef, newPartnerDoc);
        const newDocSnap = await getDoc(docRef);
        return newDocSnap.exists() ? { id: newDocSnap.id, ...newDocSnap.data() } as Partner : null;
    });
}

export async function updatePartner(partnerId: string, partnerData: Partial<PartnerFormData>): Promise<Partner | null> {
    return retryOperation(async () => {
        const partnerRef = doc(db, PARTNERS_COLLECTION, partnerId);
        const dataToUpdate: Partial<PartnerFormData & {updatedAt: Timestamp}> = { ...partnerData, updatedAt: serverTimestamp() as Timestamp };
        await updateDoc(partnerRef, dataToUpdate);
        return getPartnerById(partnerId);
    });
}

export async function deletePartner(partnerId: string): Promise<boolean> {
    return retryOperation(async () => {
        const partnerRef = doc(db, PARTNERS_COLLECTION, partnerId);
        await updateDoc(partnerRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    });
}
