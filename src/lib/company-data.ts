
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
    Timestamp // Import Timestamp
} from 'firebase/firestore';
import type { Company, Location, CompanyFormData, LocationFormData, User } from '@/types/user';
import { getUsersWithoutCompany, deleteUser as softDeleteUser } from './user-data'; // Import softDeleteUser

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
                throw error; // Re-throw the last error
            }
            if (error.name === 'AbortError' || (error.code === 'unavailable' && error.message?.includes('IndexedDB'))) {
                 console.warn(`Firestore IndexedDB operation failed (attempt ${attempt}/${maxRetries}), likely due to tab conflict or browser issue. Not retrying immediately.`);
                 throw new Error(`Firestore persistence error: ${error.message}. Please close other tabs or check browser settings.`);
             }

            const delay = Math.min(Math.pow(2, attempt) * baseDelay, 10000); // Exponential backoff, max 10 seconds
            console.warn(`Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}

// --- Company Functions ---

/**
 * Creates the default "Gymramp" company if it doesn't exist or is soft-deleted.
 * @returns {Promise<Company | null>} The default company document or null if creation failed.
 */
export async function createDefaultCompany(): Promise<Company | null> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        // Query for non-soft-deleted default company
        const q = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME), where("isDeleted", "==", false));

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return { id: docSnap.id, ...docSnap.data() } as Company;
        } else {
            // Check if a soft-deleted default company exists to avoid re-creating if already soft-deleted
            const qAll = query(companiesRef, where("name", "==", DEFAULT_COMPANY_NAME));
            const allSnapshot = await getDocs(qAll);
            if (!allSnapshot.empty && allSnapshot.docs[0].data().isDeleted === true) {
                console.log(`Default company "${DEFAULT_COMPANY_NAME}" exists but is soft-deleted. Will not re-create unless explicitly undeleted.`);
                return null; // Or handle undelete logic if needed
            }

            console.log(`Default company "${DEFAULT_COMPANY_NAME}" not found or soft-deleted, creating it.`);
            const newCompanyData: CompanyFormData = {
                name: DEFAULT_COMPANY_NAME,
                maxUsers: null,
                assignedCourseIds: [],
                isTrial: false, // Default company is not a trial
                trialEndsAt: null,
                // Revenue share fields default to null
                revSharePartnerName: null,
                revSharePartnerCompany: null,
                revSharePartnerPercentage: null,
            };
            const docRef = await addDoc(companiesRef, { ...newCompanyData, isDeleted: false, deletedAt: null });
            const newDocSnap = await getDoc(docRef);
            if (newDocSnap.exists()) {
                console.log(`Default company "${DEFAULT_COMPANY_NAME}" created with ID: ${docRef.id}`);
                return { id: docRef.id, ...newDocSnap.data() } as Company;
            } else {
                 console.error("Failed to fetch newly created default company.");
                 return null;
            }
        }
    });
}


/**
 * Fetches all non-soft-deleted companies from the Firestore database.
 * Note: For companies created before the soft-delete feature, manually add 'isDeleted: false' in Firestore for them to be included.
 * @returns {Promise<Company[]>} A promise that resolves to an array of companies.
 */
export async function getAllCompanies(): Promise<Company[]> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const q = query(companiesRef, where("isDeleted", "==", false)); // Filter out soft-deleted
        const querySnapshot = await getDocs(q);
        const companies: Company[] = [];
        querySnapshot.forEach((doc) => {
            companies.push({ id: doc.id, ...doc.data() } as Company);
        });
        return companies;
    });
}

/**
 * Fetches a single non-soft-deleted company by its ID.
 * Handles companies created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} companyId - The ID of the company to fetch.
 * @returns {Promise<Company | null>} A promise that resolves to the company or null if not found or soft-deleted.
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
     if (!companyId) {
         console.warn("getCompanyById called with empty ID.");
         return null;
     }
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const docSnap = await getDoc(companyRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Company;
        } else {
            return null;
        }
    });
}

/**
 * Adds a new company to the Firestore database. Initializes with isDeleted: false and deletedAt: null.
 * @param {CompanyFormData} companyData - The data for the new company.
 * @returns {Promise<Company | null>} A promise that resolves to the newly created company or null on failure.
 */
export async function addCompany(companyData: CompanyFormData): Promise<Company | null> {
    return retryOperation(async () => {
        const companiesRef = collection(db, COMPANIES_COLLECTION);
        const docData = {
            ...companyData,
            shortDescription: companyData.shortDescription?.trim() || null,
            logoUrl: companyData.logoUrl?.trim() || null,
            maxUsers: companyData.maxUsers ?? null,
            assignedCourseIds: companyData.assignedCourseIds || [],
            isTrial: companyData.isTrial || false, // Default to false if not provided
            trialEndsAt: companyData.trialEndsAt instanceof Date ? Timestamp.fromDate(companyData.trialEndsAt) : companyData.trialEndsAt, // Convert Date to Timestamp
            // Revenue Share Fields
            revSharePartnerName: companyData.revSharePartnerName?.trim() || null,
            revSharePartnerCompany: companyData.revSharePartnerCompany?.trim() || null,
            revSharePartnerPercentage: companyData.revSharePartnerPercentage ?? null,
            isDeleted: false,
            deletedAt: null,
         };
        const docRef = await addDoc(companiesRef, docData);
        const newDocSnap = await getDoc(docRef);
         if (newDocSnap.exists()) {
             return { id: docRef.id, ...newDocSnap.data() } as Company;
         } else {
             console.error("Failed to fetch newly created company doc.");
             return null;
         }
    });
}

/**
 * Updates an existing company in Firestore.
 * @param {string} companyId - The ID of the company to update.
 * @param {Partial<CompanyFormData>} companyData - The partial data to update.
 * @returns {Promise<Company | null>} A promise that resolves to the updated company or null on failure.
 */
export async function updateCompany(companyId: string, companyData: Partial<CompanyFormData>): Promise<Company | null> {
     if (!companyId) {
         console.warn("updateCompany called with empty ID.");
         return null;
     }
    return retryOperation(async () => {
        const companyRef = doc(db, COMPANIES_COLLECTION, companyId);
        const dataToUpdate: Partial<Company> = {}; // Use Partial<Company> for stronger typing

        // Explicitly map fields to handle potential undefined values and type conversions
        if (companyData.name !== undefined) dataToUpdate.name = companyData.name;
        dataToUpdate.shortDescription = companyData.shortDescription?.trim() || null;
        dataToUpdate.logoUrl = companyData.logoUrl?.trim() || null;
        dataToUpdate.maxUsers = companyData.maxUsers ?? null;
        if (companyData.assignedCourseIds !== undefined) dataToUpdate.assignedCourseIds = companyData.assignedCourseIds;
        if (companyData.isTrial !== undefined) dataToUpdate.isTrial = companyData.isTrial;

        // Handle trialEndsAt: convert Date to Timestamp, allow null
        if (companyData.trialEndsAt === null) {
            dataToUpdate.trialEndsAt = null;
        } else if (companyData.trialEndsAt instanceof Date) {
            dataToUpdate.trialEndsAt = Timestamp.fromDate(companyData.trialEndsAt);
        } else if (companyData.trialEndsAt instanceof Timestamp) {
            dataToUpdate.trialEndsAt = companyData.trialEndsAt;
        }
        // If trialEndsAt is undefined in companyData, it won't be included in dataToUpdate, preserving existing value.

        // Revenue Share Fields
        if (companyData.revSharePartnerName !== undefined) dataToUpdate.revSharePartnerName = companyData.revSharePartnerName?.trim() || null;
        if (companyData.revSharePartnerCompany !== undefined) dataToUpdate.revSharePartnerCompany = companyData.revSharePartnerCompany?.trim() || null;
        if (companyData.revSharePartnerPercentage !== undefined) dataToUpdate.revSharePartnerPercentage = companyData.revSharePartnerPercentage ?? null;


        if (Object.keys(dataToUpdate).length === 0) {
            console.warn("updateCompany called with no valid data to update.");
            return getCompanyById(companyId); // Return current state if no changes
        }

        await updateDoc(companyRef, dataToUpdate);
        const updatedDocSnap = await getDoc(companyRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: companyId, ...updatedDocSnap.data() } as Company;
         } else {
              console.error("Failed to fetch updated company doc or company is soft-deleted.");
             return null;
         }
    });
}

/**
 * Soft deletes a company and its associated locations and users from Firestore.
 * @param {string} companyId - The ID of the company to soft delete.
 * @returns {Promise<boolean>} A promise that resolves to true if soft deletion was successful, false otherwise.
 */
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


/**
 * Assigns a course to a specific non-soft-deleted company.
 * @param {string} companyId - The ID of the company.
 * @param {string} courseId - The ID of the course to assign.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
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

/**
 * Unassigns a course from a specific non-soft-deleted company.
 * @param {string} companyId - The ID of the company.
 * @param {string} courseId - The ID of the course to unassign.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
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

 /**
 * Updates the list of assigned courses for a non-soft-deleted company.
 * @param companyId The ID of the company to update.
 * @param courseIds An array of course IDs that should be assigned.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
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

/**
 * Fetches all non-soft-deleted locations associated with a specific company ID.
 * Note: For locations created before soft-delete, manually add 'isDeleted: false' for inclusion.
 * @param {string} companyId - The ID of the company.
 * @returns {Promise<Location[]>} A promise that resolves to an array of locations.
 */
export async function getLocationsByCompanyId(companyId: string): Promise<Location[]> {
     if (!companyId) {
         console.warn("getLocationsByCompanyId called with empty company ID.");
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


/**
 * Fetches all non-soft-deleted locations from the Firestore database.
 * Note: For locations created before soft-delete, manually add 'isDeleted: false' for inclusion.
 * @returns {Promise<Location[]>} A promise that resolves to an array of all locations.
 */
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


/**
 * Adds a new location to the Firestore database. Initializes with isDeleted: false and deletedAt: null.
 * @param {LocationFormData} locationData - The data for the new location. Must include companyId.
 * @returns {Promise<Location | null>} A promise that resolves to the newly created location or null on failure.
 */
export async function addLocation(locationData: LocationFormData): Promise<Location | null> {
    if (!locationData.companyId) {
        console.error("Cannot add location without a companyId.");
        return null;
    }
    return retryOperation(async () => {
        const locationsRef = collection(db, LOCATIONS_COLLECTION);
        const dataToSave = {
            ...locationData,
            createdBy: locationData.createdBy || null,
            isDeleted: false, // Initialize as not deleted
            deletedAt: null,   // Initialize as null
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

/**
 * Updates an existing location in Firestore.
 * @param {string} locationId - The ID of the location to update.
 * @param {Partial<LocationFormData>} locationData - The partial data to update (can include name).
 * @returns {Promise<Location | null>} A promise that resolves to the updated location or null on failure.
 */
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

        await updateDoc(locationRef, dataToUpdate);
        const updatedDocSnap = await getDoc(locationRef);
         if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
             return { id: locationId, ...updatedDocSnap.data() } as Location;
         } else {
              console.error("Failed to fetch updated location doc or location is soft-deleted.");
             return null;
         }
    });
}

/**
 * Soft deletes a location from Firestore and removes its assignment from non-soft-deleted users.
 * @param {string} locationId - The ID of the location to soft delete.
 * @returns {Promise<boolean>} A promise that resolves to true if soft deletion was successful, false otherwise.
 */
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

/**
 * Creates a default "Main Location" for a given non-soft-deleted company if no non-soft-deleted locations exist.
 * @param {string} companyId - The ID of the company to check/add location for.
 * @returns {Promise<Location | null>} The default location or null if creation failed or not needed.
 */
export async function createDefaultLocation(companyId: string): Promise<Location | null> {
    if (!companyId) {
        console.warn("createDefaultLocation called with empty companyId.");
        return null;
    }

    return retryOperation(async () => {
        const company = await getCompanyById(companyId);
        if (!company) {
            console.warn(`Company ${companyId} not found or is soft-deleted. Cannot create default location.`);
            return null;
        }

        const existingLocations = await getLocationsByCompanyId(companyId);
        if (existingLocations.length > 0) {
            return existingLocations[0];
        }

        console.log(`Company ${companyId} has no active locations. Creating "Main Location".`);
        const defaultLocationData: LocationFormData = {
            name: "Main Location",
            companyId: companyId,
            createdBy: null,
        };
        const newLocation = await addLocation(defaultLocationData);
        if (newLocation) {
            console.log(`Default "Main Location" created for company ${companyId} with ID: ${newLocation.id}`);
            return newLocation;
        } else {
            console.error(`Failed to create default location for company ${companyId}.`);
            return null;
        }
    });
}
