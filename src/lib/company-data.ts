
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
    Timestamp,
    or,
    getCountFromServer
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
                console.error(`[company-data retry] Max retries (${maxRetries}) reached. Operation failed: ${error.message}`);
                throw error;
            }
            if (error.name === 'AbortError' || (error.code === 'unavailable' && error.message?.includes('IndexedDB'))) {
                 console.warn(`[company-data retry] Firestore IndexedDB operation failed (attempt ${attempt}/${maxRetries}), likely due to tab conflict or browser issue. Not retrying immediately.`);
                 throw new Error(`Firestore persistence error: ${error.message}. Please close other tabs or check browser settings.`);
             }

            const delay = Math.min(Math.pow(2, attempt) * baseDelay, 10000);
            console.warn(`[company-data retry] Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}

// --- Brand Functions (formerly Company Functions) ---

export async function createDefaultCompany(): Promise<Company | null> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME), where("isDeleted", "==", false), where("parentBrandId", "==", null)); 

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return { id: docSnap.id, ...serializeCompanyDocumentData(docSnap.data()) } as Company;
        } else {
            const qAll = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME), where("parentBrandId", "==", null));
            const allSnapshot = await getDocs(qAll);
            if (!allSnapshot.empty && allSnapshot.docs[0].data().isDeleted === true) {
                console.log(`Default brand "${DEFAULT_COMPANY_NAME}" exists but is soft-deleted. Will not re-create unless explicitly undeleted.`);
                return null;
            }

            console.log(`Default brand "${DEFAULT_COMPANY_NAME}" not found or soft-deleted, creating it.`);
            const newCompanyData: Omit<Company, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> = {
                name: DEFAULT_COMPANY_NAME,
                subdomainSlug: null,
                customDomain: null,
                logoUrl: null,
                shortDescription: null,
                maxUsers: null,
                assignedProgramIds: [], // Initialize as empty
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
                parentBrandId: null,
                createdByUserId: null,
            };
            const docRef = await addDoc(companiesRef, { ...newCompanyData, isDeleted: false, deletedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            const newDocSnap = await getDoc(docRef);
            if (newDocSnap.exists()) {
                console.log(`Default brand "${DEFAULT_COMPANY_NAME}" created with ID: ${docRef.id}`);
                return { id: docRef.id, ...serializeCompanyDocumentData(newDocSnap.data()) } as Company;
            } else {
                 console.error("Failed to fetch newly created default brand.");
                 return null;
            }
        }
    });
}

export async function getAllCompanies(currentUser?: User | null): Promise<Company[]> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const companiesList: Company[] = [];

        if (currentUser?.role === 'Super Admin') {
            const q = query(companiesRef, where("isDeleted", "==", false));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                companiesList.push({ id: doc.id, ...serializeCompanyDocumentData(doc.data()) } as Company);
            });
        } else if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId) {
            // Fetch the user's primary brand
            const primaryBrandDocRef = doc(companiesRef, currentUser.companyId);
            const primaryBrandDocSnap = await getDoc(primaryBrandDocRef);
            if (primaryBrandDocSnap.exists() && primaryBrandDocSnap.data().isDeleted === false) {
                companiesList.push({ id: primaryBrandDocSnap.id, ...serializeCompanyDocumentData(primaryBrandDocSnap.data()) } as Company);
            }

            // Fetch child brands
            const childBrandsQuery = query(
                companiesRef,
                where("isDeleted", "==", false),
                where("parentBrandId", "==", currentUser.companyId)
            );
            const childBrandsSnapshot = await getDocs(childBrandsQuery);
            childBrandsSnapshot.forEach((doc) => {
                companiesList.push({ id: doc.id, ...serializeCompanyDocumentData(doc.data()) } as Company);
            });
        }
        // Managers and Staff typically don't fetch lists of all companies in this context
        return companiesList;
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
            return { id: docSnap.id, ...serializeCompanyDocumentData(docSnap.data()) } as Company;
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
                return { id: docSnap.id, ...serializeCompanyDocumentData(docSnap.data()) } as Company;
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
                return { id: docSnap.id, ...serializeCompanyDocumentData(docSnap.data()) } as Company;
            }
        }
        return null;
    });
}

export async function addCompany(
    companyData: CompanyFormData,
    creatingUserId?: string | null,
    parentBrandIdForChild?: string | null
): Promise<Company | null> {
    console.log("[company-data addCompany] Received companyData.assignedProgramIds:", companyData.assignedProgramIds);
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        // Ensure all CompanyFormData fields are mapped correctly
        const docData: Omit<Company, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> & { isDeleted: boolean; deletedAt: null | Timestamp; createdAt: Timestamp; updatedAt: Timestamp } = {
            name: companyData.name,
            subdomainSlug: companyData.subdomainSlug?.trim().toLowerCase() || null,
            customDomain: companyData.customDomain?.trim().toLowerCase() || null,
            shortDescription: companyData.shortDescription?.trim() || null,
            logoUrl: companyData.logoUrl?.trim() || null,
            maxUsers: companyData.maxUsers ?? null,
            assignedProgramIds: companyData.assignedProgramIds || [],
            isTrial: companyData.isTrial || false,
            trialEndsAt: companyData.trialEndsAt ? Timestamp.fromDate(new Date(companyData.trialEndsAt)) : null,
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
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            parentBrandId: parentBrandIdForChild || null,
            createdByUserId: creatingUserId || null,
         };
        console.log("[company-data addCompany] docData.assignedProgramIds being written:", docData.assignedProgramIds);
        const docRef = await addDoc(companiesRef, docData);
        const newDocSnap = await getDoc(docRef);
         if (newDocSnap.exists()) {
             return { id: docRef.id, ...serializeCompanyDocumentData(newDocSnap.data()) } as Company;
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
     console.log(`[company-data updateCompany] Updating brand ${companyId} with assignedProgramIds:`, companyData.assignedProgramIds);
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const dataToUpdate: Partial<Company> = { updatedAt: serverTimestamp() as Timestamp };

        if (companyData.name !== undefined) dataToUpdate.name = companyData.name;
        if (companyData.subdomainSlug !== undefined) dataToUpdate.subdomainSlug = companyData.subdomainSlug?.trim().toLowerCase() || null;
        if (companyData.customDomain !== undefined) dataToUpdate.customDomain = companyData.customDomain?.trim().toLowerCase() || null;
        if (companyData.shortDescription !== undefined) dataToUpdate.shortDescription = companyData.shortDescription?.trim() || null;
        if (companyData.logoUrl !== undefined) dataToUpdate.logoUrl = companyData.logoUrl?.trim() || null;
        if (companyData.maxUsers !== undefined) dataToUpdate.maxUsers = companyData.maxUsers ?? null;
        
        if (companyData.assignedProgramIds !== undefined) { // Critical: ensure this is handled
            dataToUpdate.assignedProgramIds = companyData.assignedProgramIds;
        }

        if (companyData.isTrial !== undefined) dataToUpdate.isTrial = companyData.isTrial;
        if (companyData.trialEndsAt !== undefined) {
            dataToUpdate.trialEndsAt = companyData.trialEndsAt ? Timestamp.fromDate(new Date(companyData.trialEndsAt)) : null;
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
        // parentBrandId and createdByUserId are typically not updated after creation via this general update.

        if (Object.keys(dataToUpdate).length > 1) { // Ensure there's more than just updatedAt
            console.log(`[company-data updateCompany] Data being written for brand ${companyId}:`, dataToUpdate);
            await updateDoc(companyRef, dataToUpdate);
        } else {
            console.warn("updateCompany called with no actual data changes (besides updatedAt) for brand:", companyId);
        }

        const updatedDocSnap = await getDoc(companyRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: companyId, ...serializeCompanyDocumentData(updatedDocSnap.data()) } as Company;
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
        console.log(`Brand ${companyId} and its direct locations/users soft-deleted.`);
        return true;
    }, 3);
}

export const updateCompanyCourseAssignments = async (companyId: string, courseIds: string[]): Promise<boolean> => {
    console.warn("updateCompanyCourseAssignments is deprecated. Use updateCompany with assignedProgramIds instead.");
    return false; // Deprecate this function as programs are now the primary way to assign courses to brands.
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
            locations.push({ id: doc.id, ...serializeLocationDocumentData(doc.data()) } as Location);
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
            locations.push({ id: doc.id, ...serializeLocationDocumentData(doc.data()) } as Location);
        });
        return locations;
    });
}


export async function addLocation(locationData: LocationFormData): Promise<Location | null> {
    if (!locationData.companyId) {
        console.error("Cannot add location without a brandId (companyId).");
        return null;
    }
    return retryOperation(async () => {
        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const dataToSave: Omit<Location, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'> & { isDeleted: boolean; deletedAt: null | Timestamp; createdAt: Timestamp; updatedAt: Timestamp } = {
            name: locationData.name,
            companyId: locationData.companyId,
            createdBy: locationData.createdBy || null,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };
        const docRef = await addDoc(locationsRef, dataToSave);
        const newDocSnap = await getDoc(docRef);
         if (newDocSnap.exists()) {
             return { id: docRef.id, ...serializeLocationDocumentData(newDocSnap.data()) } as Location;
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
        const dataToUpdate: Partial<Pick<Location, 'name'>> & {updatedAt?: Timestamp} = {updatedAt: serverTimestamp() as Timestamp};
        if (locationData.name) {
            dataToUpdate.name = locationData.name;
        }
         if (Object.keys(dataToUpdate).length <= 1) {
            console.warn("updateLocation called with no valid data to update (besides updatedAt).");
            const currentDocSnap = await getDoc(locationRef);
            if (currentDocSnap.exists() && currentDocSnap.data().isDeleted !== true) {
                 return { id: locationId, ...serializeLocationDocumentData(currentDocSnap.data()) } as Location;
            }
            return null;
        }

        await updateDoc(locationRef, dataToUpdate);
        const updatedDocSnap = await getDoc(locationRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: locationId, ...serializeLocationDocumentData(updatedDocSnap.data()) } as Location;
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
            batch.update(userDoc.ref, { assignedLocationIds: updatedLocations, updatedAt: serverTimestamp() });
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

// Helper function to serialize Company document data
function serializeCompanyDocumentData(data: any): any {
    if (!data) return null;
    const serialized = { ...data };
    if (data.createdAt instanceof Timestamp) serialized.createdAt = data.createdAt.toDate().toISOString();
    if (data.updatedAt instanceof Timestamp) serialized.updatedAt = data.updatedAt.toDate().toISOString();
    if (data.deletedAt instanceof Timestamp) serialized.deletedAt = data.deletedAt.toDate().toISOString();
    if (data.trialEndsAt instanceof Timestamp) serialized.trialEndsAt = data.trialEndsAt.toDate().toISOString();
    return serialized;
}

// Helper function to serialize Location document data
function serializeLocationDocumentData(data: any): any {
    if (!data) return null;
    const serialized = { ...data };
    if (data.createdAt instanceof Timestamp) serialized.createdAt = data.createdAt.toDate().toISOString();
    if (data.updatedAt instanceof Timestamp) serialized.updatedAt = data.updatedAt.toDate().toISOString();
    if (data.deletedAt instanceof Timestamp) serialized.deletedAt = data.deletedAt.toDate().toISOString();
    return serialized;
}

    