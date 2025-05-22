
import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import type { Company, Location, CompanyFormData, LocationFormData, User } from '@/types/user';
import { getUsersWithoutCompany, deleteUser as softDeleteUser } from './user-data';

const COMPANIES_COLLECTION = 'companies';
const LOCATIONS_COLLECTION = 'locations';
const DEFAULT_COMPANY_NAME = "Gymramp";

// --- Retry Logic Helper ---
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = MAX_RETRIES, baseDelay = BASE_DELAY_MS): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            if (attempt === maxRetries) {
                console.error(`Max retries (${maxRetries}) reached. Operation failed: ${error.message}`);
                throw error;
            }
            if (error.name === 'AbortError' || (error.code === 'unavailable' && error.message?.includes('IndexedDB'))) {
                 console.warn(`Firestore IndexedDB operation failed (attempt ${attempt}/${maxRetries}), likely due to tab conflict or browser issue. Not retrying immediately.`);
                 throw new Error(`Firestore persistence error: ${error.message}. Please close other tabs or check browser settings.`);
             }

            const delay = Math.min(Math.pow(2, attempt) * baseDelay, 10000);
            console.warn(`Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}

// --- Brand Functions (formerly Company Functions) ---

export async function createDefaultCompany(): Promise<Company | null> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME), where("isDeleted", "==", false));

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return { id: docSnap.id, ...docSnap.data() } as Company;
        } else {
            const qAll = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME));
            const allSnapshot = await getDocs(qAll);
            if (!allSnapshot.empty && allSnapshot.docs[0].data().isDeleted === true) {
                console.log(`Default brand "${DEFAULT_COMPANY_NAME}" exists but is soft-deleted. Will not re-create unless explicitly undeleted.`);
                return null;
            }

            console.log(`Default brand "${DEFAULT_COMPANY_NAME}" not found or soft-deleted, creating it.`);
            const newCompanyData: Omit<Company, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> = { // Use Omit for stricter type
                name: DEFAULT_COMPANY_NAME,
                subdomainSlug: null,
                customDomain: null,
                maxUsers: null,
                assignedCourseIds: [],
                isTrial: false,
                trialEndsAt: null,
                saleAmount: null,
                revenueSharePartners: null,
                whiteLabelEnabled: false,
                primaryColor: null,
                secondaryColor: null,
                accentColor: null,
                brandBackgroundColor: null,
                brandForegroundColor: null,
                canManageCourses: false,
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                logoUrl: null,
                shortDescription: null,
            };
            const docRef = await addDoc(companiesRef, { ...newCompanyData, isDeleted: false, deletedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            const newDocSnap = await getDoc(docRef);
            if (newDocSnap.exists()) {
                console.log(`Default brand "${DEFAULT_COMPANY_NAME}" created with ID: ${docRef.id}`);
                return { id: docRef.id, ...newDocSnap.data() } as Company;
            } else {
                 console.error("Failed to fetch newly created default brand.");
                 return null;
            }
        }
    });
}


export async function getAllCompanies(): Promise<Company[]> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const companies: Company[] = [];
        querySnapshot.forEach((doc) => {
            companies.push({ id: doc.id, ...doc.data() } as Company);
        });
        return companies;
    });
}

export async function getCompanyById(companyId: string): Promise<Company | null> {
     if (!companyId) {
         console.warn("getCompanyById called with empty ID.");
         return null;
     }
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const docSnap = await getDoc(companyRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Company;
        } else {
            return null;
        }
    });
}

export async function getCompanyBySubdomainSlug(slug: string): Promise<Company | null> {
    if (!slug) {
        console.warn("getCompanyBySubdomainSlug called with empty slug.");
        return null;
    }
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("subdomainSlug", "==", slug), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Company;
            }
        }
        return null;
    });
}

export async function getCompanyByCustomDomain(domain: string): Promise<Company | null> {
    if (!domain) {
        console.warn("getCompanyByCustomDomain called with empty domain.");
        return null;
    }
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("customDomain", "==", domain), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Company;
            }
        }
        return null;
    });
}


export async function addCompany(companyData: CompanyFormData): Promise<Company | null> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const docData: Omit<Company, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> & { isDeleted: boolean; deletedAt: null | Timestamp; createdAt: Timestamp; updatedAt: Timestamp } = {
            name: companyData.name,
            subdomainSlug: companyData.subdomainSlug?.trim().toLowerCase() || null,
            customDomain: companyData.customDomain?.trim().toLowerCase() || null,
            shortDescription: companyData.shortDescription?.trim() || null,
            logoUrl: companyData.logoUrl?.trim() || null,
            maxUsers: companyData.maxUsers ?? null,
            assignedCourseIds: companyData.assignedCourseIds || [],
            isTrial: companyData.isTrial || false,
            trialEndsAt: companyData.trialEndsAt instanceof Date ? Timestamp.fromDate(companyData.trialEndsAt) : companyData.trialEndsAt, // Already a Timestamp or null
            saleAmount: companyData.saleAmount ?? null,
            revenueSharePartners: companyData.revenueSharePartners || null,
            whiteLabelEnabled: companyData.whiteLabelEnabled || false,
            primaryColor: companyData.primaryColor?.trim() || null,
            secondaryColor: companyData.secondaryColor?.trim() || null,
            accentColor: companyData.accentColor?.trim() || null,
            brandBackgroundColor: companyData.brandBackgroundColor?.trim() || null,
            brandForegroundColor: companyData.brandForegroundColor?.trim() || null,
            canManageCourses: companyData.canManageCourses || false,
            stripeCustomerId: companyData.stripeCustomerId || null,
            stripeSubscriptionId: companyData.stripeSubscriptionId || null,
            isDeleted: false, // Default value for new companies
            deletedAt: null,  // Default value for new companies
            createdAt: serverTimestamp() as Timestamp, // Placeholder, will be set by Firestore
            updatedAt: serverTimestamp() as Timestamp, // Placeholder, will be set by Firestore
         };
        const docRef = await addDoc(companiesRef, docData);
        const newDocSnap = await getDoc(docRef);
         if (newDocSnap.exists()) {
             return { id: docRef.id, ...newDocSnap.data() } as Company;
         } else {
             console.error("Failed to fetch newly created brand doc.");
             return null;
         }
    });
}

export async function updateCompany(companyId: string, companyData: Partial<CompanyFormData>): Promise<Company | null> {
     if (!companyId) {
         console.warn("updateCompany called with empty ID.");
         return null;
     }
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const dataToUpdate: Partial<Company> = { updatedAt: serverTimestamp() as Timestamp };

        // Explicitly check and add each field from CompanyFormData
        if (companyData.name !== undefined) dataToUpdate.name = companyData.name;
        if (companyData.subdomainSlug !== undefined) dataToUpdate.subdomainSlug = companyData.subdomainSlug?.trim().toLowerCase() || null;
        if (companyData.customDomain !== undefined) dataToUpdate.customDomain = companyData.customDomain?.trim().toLowerCase() || null;
        if (companyData.shortDescription !== undefined) dataToUpdate.shortDescription = companyData.shortDescription?.trim() || null;
        if (companyData.logoUrl !== undefined) dataToUpdate.logoUrl = companyData.logoUrl?.trim() || null;
        if (companyData.maxUsers !== undefined) dataToUpdate.maxUsers = companyData.maxUsers ?? null;
        if (companyData.assignedCourseIds !== undefined) dataToUpdate.assignedCourseIds = companyData.assignedCourseIds;
        if (companyData.isTrial !== undefined) dataToUpdate.isTrial = companyData.isTrial;
        if (companyData.trialEndsAt !== undefined) {
            dataToUpdate.trialEndsAt = companyData.trialEndsAt instanceof Date
                ? Timestamp.fromDate(companyData.trialEndsAt)
                : companyData.trialEndsAt; // Handles null or existing Timestamp
        }
        if (companyData.saleAmount !== undefined) dataToUpdate.saleAmount = companyData.saleAmount ?? null;
        if (companyData.revenueSharePartners !== undefined) dataToUpdate.revenueSharePartners = companyData.revenueSharePartners || null;
        if (companyData.whiteLabelEnabled !== undefined) dataToUpdate.whiteLabelEnabled = companyData.whiteLabelEnabled;
        if (companyData.primaryColor !== undefined) dataToUpdate.primaryColor = companyData.primaryColor?.trim() || null;
        if (companyData.secondaryColor !== undefined) dataToUpdate.secondaryColor = companyData.secondaryColor?.trim() || null;
        if (companyData.accentColor !== undefined) dataToUpdate.accentColor = companyData.accentColor?.trim() || null;
        if (companyData.brandBackgroundColor !== undefined) dataToUpdate.brandBackgroundColor = companyData.brandBackgroundColor?.trim() || null;
        if (companyData.brandForegroundColor !== undefined) dataToUpdate.brandForegroundColor = companyData.brandForegroundColor?.trim() || null;
        if (companyData.canManageCourses !== undefined) dataToUpdate.canManageCourses = companyData.canManageCourses;
        if (companyData.stripeCustomerId !== undefined) dataToUpdate.stripeCustomerId = companyData.stripeCustomerId || null;
        if (companyData.stripeSubscriptionId !== undefined) dataToUpdate.stripeSubscriptionId = companyData.stripeSubscriptionId || null;

        // Simplified check: if there's more than just 'updatedAt', then update.
        if (Object.keys(dataToUpdate).length > 1) {
            await updateDoc(companyRef, dataToUpdate);
        } else {
            console.warn("updateCompany called with no actual data changes for company:", companyId);
        }
        
        const updatedDocSnap = await getDoc(companyRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: companyId, ...updatedDocSnap.data() } as Company;
         } else {
              console.error("Failed to fetch updated brand doc or brand is soft-deleted.");
             return null;
         }
    });
}

export async function deleteCompany(companyId: string): Promise<boolean> {
     if (!companyId) {
         console.warn("deleteCompany (soft delete) called with empty ID.");
         return false;
     }
    return retryOperation(async () => {
        const batch = writeBatch(db);

        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        batch.update(companyRef, { isDeleted: true, deletedAt: serverTimestamp() });

        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const locationsQuery = query(locationsRef, where("companyId", "==", companyId), where("isDeleted", "==", false));
        const locationsSnapshot = await getDocs(locationsQuery);
        locationsSnapshot.forEach((locationDoc) => {
            batch.update(locationDoc.ref, { isDeleted: true, deletedAt: serverTimestamp() });
        });

        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where("companyId", "==", companyId), where("isDeleted", "==", false));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach((userDoc) => {
             batch.update(userDoc.ref, { isDeleted: true, deletedAt: serverTimestamp(), isActive: false });
        });

        await batch.commit();
        return true;
    }, 3);
}


export async function assignCourseToCompany(companyId: string, courseId: string): Promise<boolean> {
    if (!companyId || !courseId) return false;
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const companySnap = await getDoc(companyRef);
        if (!companySnap.exists() || companySnap.data().isDeleted === true) return false;

        const currentAssignments = companySnap.data().assignedCourseIds || [];
        if (!currentAssignments.includes(courseId)) {
            await updateDoc(companyRef, {
                assignedCourseIds: [...currentAssignments, courseId]
            });
        }
        return true;
    });
}

export async function unassignCourseFromCompany(companyId: string, courseId: string): Promise<boolean> {
     if (!companyId || !courseId) return false;
     return retryOperation(async () => {
         const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
         const companySnap = await getDoc(companyRef);
         if (!companySnap.exists() || companySnap.data().isDeleted === true) return false;

         const currentAssignments = companySnap.data().assignedCourseIds || [];
         if (currentAssignments.includes(courseId)) {
             await updateDoc(companyRef, {
                 assignedCourseIds: currentAssignments.filter((id: string) => id !== courseId)
             });
         }
         return true;
     });
 }

export const updateCompanyCourseAssignments = async (companyId: string, courseIds: string[]): Promise<boolean> => {
    if (!companyId) return false;
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const companySnap = await getDoc(companyRef);
        if (!companySnap.exists() || companySnap.data().isDeleted === true) return false;

        await updateDoc(companyRef, {
            assignedCourseIds: courseIds
        });
        return true;
    });
};


// --- Location Functions ---

export async function getLocationsByCompanyId(companyId: string): Promise<Location[]> {
     if (!companyId) {
         console.warn("getLocationsByCompanyId called with empty brand ID.");
         return [];
     }
    return retryOperation(async () => {
        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const q = query(locationsRef, where("companyId", "==", companyId), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const locations: Location[] = [];
        querySnapshot.forEach((doc) => {
            locations.push({ id: doc.id, ...doc.data() } as Location);
        });
        return locations;
    });
}


export async function getAllLocations(): Promise<Location[]> {
    return retryOperation(async () => {
        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const q = query(locationsRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const locations: Location[] = [];
        querySnapshot.forEach((doc) => {
            locations.push({ id: doc.id, ...doc.data() } as Location);
        });
        return locations;
    });
}


export async function addLocation(locationData: LocationFormData): Promise<Location | null> {
    if (!locationData.companyId) {
        console.error("Cannot add location without a companyId.");
        return null;
    }
    return retryOperation(async () => {
        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const dataToSave: Omit<Location, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> & { isDeleted: boolean; deletedAt: null | Timestamp; createdAt: Timestamp; updatedAt: Timestamp } = {
            name: locationData.name,
            companyId: locationData.companyId,
            createdBy: locationData.createdBy || null,
            isDeleted: false, // Default value
            deletedAt: null,  // Default value
            createdAt: serverTimestamp() as Timestamp, // Placeholder
            updatedAt: serverTimestamp() as Timestamp, // Placeholder
        };
        const docRef = await addDoc(locationsRef, dataToSave);
        const newDocSnap = await getDoc(docRef);
         if (newDocSnap.exists()) {
             return { id: docRef.id, ...newDocSnap.data() } as Location;
         } else {
             console.error("Failed to fetch newly created location doc.");
             return null;
         }
    });
}

export async function updateLocation(locationId: string, locationData: Partial<LocationFormData>): Promise<Location | null> {
     if (!locationId) {
         console.warn("updateLocation called with empty ID.");
         return null;
     }
    return retryOperation(async () => {
        const locationRef = doc(db, LOCATIONS_COLLECTION, locationId);
        const dataToUpdate: Partial<Pick<Location, 'name'>> = {}; 
        if (locationData.name) {
            dataToUpdate.name = locationData.name;
        }
         if (Object.keys(dataToUpdate).length === 0) {
            console.warn("updateLocation called with no valid data to update.");
            const currentDocSnap = await getDoc(locationRef);
            if (currentDocSnap.exists() && currentDocSnap.data().isDeleted !== true) {
                 return { id: locationId, ...currentDocSnap.data() } as Location;
            }
            return null;
        }

        await updateDoc(locationRef, {...dataToUpdate, updatedAt: serverTimestamp()}); 
        const updatedDocSnap = await getDoc(locationRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: locationId, ...updatedDocSnap.data() } as Location;
         } else {
              console.error("Failed to fetch updated location doc or location is soft-deleted.");
             return null;
         }
    });
}

export async function deleteLocation(locationId: string): Promise<boolean> {
     if (!locationId) {
         console.warn("deleteLocation (soft delete) called with empty ID.");
         return false;
     }
    return retryOperation(async () => {
        const batch = writeBatch(db);

        const locationRef = doc(db, LOCATIONS_COLLECTION, locationId);
        batch.update(locationRef, { isDeleted: true, deletedAt: serverTimestamp() });

        const usersRef = collection(db, 'users');
        const usersQuery = query(
            usersRef,
            where("assignedLocationIds", "array-contains", locationId),
            where("isDeleted", "==", false)
        );
        const usersSnapshot = await getDocs(usersQuery);

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data() as User;
            const updatedLocations = (userData.assignedLocationIds || []).filter((id: string) => id !== locationId);
            batch.update(userDoc.ref, { assignedLocationIds: updatedLocations });
        });

        await batch.commit();
        return true;
    }, 3);
}

export async function createDefaultLocation(companyId: string): Promise<Location | null> {
    if (!companyId) {
        console.warn("createDefaultLocation called with empty companyId.");
        return null;
    }

    return retryOperation(async () => {
        const company = await getCompanyById(companyId);
        if (!company) {
            console.warn(`Brand ${companyId} not found or is soft-deleted. Cannot create default location.`);
            return null;
        }

        const existingLocations = await getLocationsByCompanyId(companyId);
        if (existingLocations.length > 0) {
            return existingLocations[0];
        }

        console.log(`Brand ${companyId} has no active locations. Creating "Main Location".`);
        const defaultLocationData: LocationFormData = {
            name: "Main Location",
            companyId: companyId,
            createdBy: null,
        };
        const newLocation = await addLocation(defaultLocationData);
        if (newLocation) {
            console.log(`Default "Main Location" created for brand ${companyId} with ID: ${newLocation.id}`);
            return newLocation;
        } else {
            console.error(`Failed to create default location for brand ${companyId}.`);
            return null;
        }
    });
}

export async function getSalesTotalLastNDays(days: number): Promise<number> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const dateNDaysAgo = new Date();
        dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);
        const timestampNDaysAgo = Timestamp.fromDate(dateNDaysAgo);

        const q = query(
            companiesRef,
            where("isDeleted", "==", false),
            where("isTrial", "==", false),
            where("createdAt", ">=", timestampNDaysAgo)
        );

        const querySnapshot = await getDocs(q);
        let totalSales = 0;
        querySnapshot.forEach((docSnap) => {
            const companyData = docSnap.data() as Company;
            if (typeof companyData.saleAmount === 'number') {
                totalSales += companyData.saleAmount;
            }
        });
        console.log(`[getSalesTotalLastNDays] Total sales for last ${days} days: ${totalSales}`);
        return totalSales;
    });
}

    