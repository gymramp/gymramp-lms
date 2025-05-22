
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
    serverTimestamp,
    WriteBatch,
    writeBatch,
    Timestamp,
    arrayUnion,
    arrayRemove,
    deleteField,
    getCountFromServer
} from 'firebase/firestore';
import type { User, UserFormData, UserRole, UserCourseProgressData, Company } from '@/types/user';
import { auth } from './firebase';
import { createDefaultCompany, getCompanyById as getCompanyDataById, getCompanyBySubdomainSlug } from './company-data'; // Renamed import
import { getCourseById } from './firestore-data';
import { getBrandCourseById } from './brand-content-data'; // Import for brand courses
import type { Course, BrandCourse } from '@/types/course'; // Import BrandCourse type

const USERS_COLLECTION = 'users';

// --- Retry Logic Helper (Consider making this a shared utility) ---
const MAX_RETRIES = 3;
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

// --- User Functions ---

export async function getAllUsers(): Promise<User[]> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        return users;
    });
}

export async function getUserById(userId: string): Promise<User | null> {
    if (!userId) {
        console.warn("getUserById called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as User;
        } else {
            return null;
        }
    });
}

export async function getUserByEmail(email: string): Promise<User | null> {
    if (!email) {
        console.warn("[getUserByEmail] Called with empty email.");
        return null;
    }
    const lowercasedEmail = email.toLowerCase();
    console.log(`[getUserByEmail] Attempting to find user with lowercase email: '${lowercasedEmail}'`);

    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        // Updated query to include isDeleted check
        const q = query(usersRef, where("email", "==", lowercasedEmail), where("isDeleted", "==", false));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[getUserByEmail] Query for '${lowercasedEmail}' and isDeleted:false executed. Snapshot empty: ${querySnapshot.empty}. Docs count: ${querySnapshot.docs.length}`);

            if (querySnapshot.empty) {
                console.log(`[getUserByEmail] No user document found for email: '${lowercasedEmail}' with isDeleted:false in collection '${USERS_COLLECTION}'.`);
                return null;
            }

            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            console.log(`[getUserByEmail] Document found for '${lowercasedEmail}' with isDeleted:false. ID: ${docSnap.id}.`);

            if (docSnap.exists()) { // This check is somewhat redundant due to querySnapshot.empty check, but safe
                return { id: docSnap.id, ...userData } as User;
            } else {
                // This case should ideally not be reached if querySnapshot is not empty
                return null;
            }
        } catch (error) {
            console.error(`[getUserByEmail] Error during Firestore query for email '${lowercasedEmail}':`, error);
            throw error; // Re-throw to be caught by retryOperation if needed
        }
    });
}


export async function getUsersByCompanyId(companyId: string): Promise<User[]> {
    if (!companyId) {
        console.warn("getUsersByCompanyId called with empty brand ID.");
        return [];
    }
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("companyId", "==", companyId), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        return users;
    });
}

export async function getUserCountByCompanyId(companyId: string): Promise<number> {
    if (!companyId) {
        console.warn("getUserCountByCompanyId called with empty brand ID.");
        return 0;
    }
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(
            usersRef,
            where("companyId", "==", companyId),
            where("isActive", "==", true), // Only count active users
            where("isDeleted", "==", false)
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    });
}


export async function addUser(userData: Omit<UserFormData, 'password'> & { requiresPasswordChange?: boolean }): Promise<User | null> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const newUserDoc: Partial<User> = {
            name: userData.name,
            email: userData.email.toLowerCase(),
            role: userData.role,
            companyId: userData.companyId || '', // Default to empty string if null
            assignedLocationIds: userData.assignedLocationIds || [],
            isActive: true, // New users are active by default
            isDeleted: false, // New users are not deleted by default
            deletedAt: null,
            createdAt: serverTimestamp() as Timestamp,
            lastLogin: null, // No login yet
            assignedCourseIds: userData.assignedCourseIds || [],
            courseProgress: {}, // Initialize course progress
            profileImageUrl: userData.profileImageUrl || null,
            requiresPasswordChange: userData.requiresPasswordChange === true, // Set the flag
        };
        const docRef = await addDoc(usersRef, newUserDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as User;
        } else {
            console.error("Failed to fetch newly created user doc.");
            return null;
        }
    });
}

export async function updateUser(userId: string, userData: Partial<UserFormData & { requiresPasswordChange?: boolean }>): Promise<User | null> {
    if (!userId) {
        console.warn("updateUser called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        // Destructure to separate password if present, as it's not stored in Firestore User doc
        const { password, ...dataToUpdate } = userData;

        // Prepare a payload with only the fields that are actually being updated
        const updatePayload: Partial<User> = {};

        if (dataToUpdate.name !== undefined) updatePayload.name = dataToUpdate.name;
        if (dataToUpdate.email !== undefined) updatePayload.email = dataToUpdate.email.toLowerCase();
        if (dataToUpdate.role !== undefined) updatePayload.role = dataToUpdate.role;
        if (dataToUpdate.companyId !== undefined) updatePayload.companyId = dataToUpdate.companyId || ''; // Ensure empty string if null
        if (dataToUpdate.assignedLocationIds !== undefined) updatePayload.assignedLocationIds = dataToUpdate.assignedLocationIds;
        if (dataToUpdate.assignedCourseIds !== undefined) updatePayload.assignedCourseIds = dataToUpdate.assignedCourseIds;
        if (dataToUpdate.isActive !== undefined) updatePayload.isActive = dataToUpdate.isActive;
        if (dataToUpdate.profileImageUrl !== undefined) updatePayload.profileImageUrl = dataToUpdate.profileImageUrl === '' ? null : dataToUpdate.profileImageUrl;
        if (dataToUpdate.requiresPasswordChange !== undefined) updatePayload.requiresPasswordChange = dataToUpdate.requiresPasswordChange;


        // Check if anything is actually being updated beyond just 'updatedAt'
        if (Object.keys(updatePayload).length === 0 && dataToUpdate.requiresPasswordChange === undefined) {
            console.warn("updateUser called with no data to update for user:", userId);
            // Fetch and return the current document if no changes are made
            const currentUserDocSnap = await getDoc(userRef);
            if (currentUserDocSnap.exists() && currentUserDocSnap.data().isDeleted !== true) {
                return { id: userId, ...currentUserDocSnap.data() } as User;
            }
            return null;
        }
        
        updatePayload.updatedAt = serverTimestamp() as Timestamp; // Always update the timestamp


        await updateDoc(userRef, updatePayload);
        const updatedDocSnap = await getDoc(userRef);
        if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
            return { id: userId, ...updatedDocSnap.data() } as User;
        } else {
            console.error("Failed to fetch updated user doc or user is soft-deleted.");
            return null;
        }
    });
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<User | null> {
    return updateUser(userId, { role: newRole });
}

export async function toggleUserStatus(userId: string): Promise<User | null> {
    if (!userId) {
        console.warn("toggleUserStatus called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            const currentStatus = docSnap.data().isActive;
            await updateDoc(userRef, { isActive: !currentStatus, updatedAt: serverTimestamp() });
            const updatedUser = await getUserById(userId); // Fetch the updated user data
            return updatedUser;
        } else {
            console.error("User not found or is soft-deleted for status toggle.");
            return null;
        }
    });
}


export async function deleteUser(userId: string): Promise<boolean> { // Soft delete
    if (!userId) {
        console.warn("deleteUser (soft delete) called with empty ID.");
        return false;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            isActive: false, // Also deactivate on soft delete
            updatedAt: serverTimestamp(),
        });
        return true;
    }, 3); // Retry 3 times for delete operation
}

// Function to assign or unassign courses for a user
export const toggleUserCourseAssignments = async (userId: string, courseIds: string[], action: 'assign' | 'unassign'): Promise<User | null> => {
    if (!userId || !Array.isArray(courseIds) || courseIds.length === 0) {
        console.warn("toggleUserCourseAssignments called with invalid input.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
            console.error(`User ${userId} not found or is soft-deleted.`);
            return null;
        }

        const updateData: { [key: string]: any } = { updatedAt: serverTimestamp() };
        const currentProgress = userSnap.data()?.courseProgress || {};
        const currentAssignedIds = userSnap.data()?.assignedCourseIds || [];

        if (action === 'assign') {
            const coursesToAdd = courseIds.filter(id => !currentAssignedIds.includes(id));
            if (coursesToAdd.length > 0) {
                updateData.assignedCourseIds = arrayUnion(...coursesToAdd);

                // Initialize progress for newly assigned courses
                coursesToAdd.forEach(courseId => {
                    if (!currentProgress[courseId]) { // Only initialize if no progress exists
                        const progressFieldPath = `courseProgress.${courseId}`;
                        updateData[progressFieldPath] = {
                            completedItems: [],
                            status: "Not Started",
                            progress: 0,
                            lastUpdated: serverTimestamp() // Use serverTimestamp for initialization
                        };
                        console.log(`Initialized progress for user ${userId}, course ${courseId}`);
                    }
                });
            }
        } else { // unassign
            const coursesToRemove = courseIds.filter(id => currentAssignedIds.includes(id));
            if (coursesToRemove.length > 0) {
                updateData.assignedCourseIds = arrayRemove(...coursesToRemove);

                // Remove progress for unassigned courses
                coursesToRemove.forEach(courseId => {
                    const progressFieldPath = `courseProgress.${courseId}`;
                    updateData[progressFieldPath] = deleteField(); // Use deleteField to remove the map entry
                });
            }
        }

        // Only update if there are actual changes to assigned courses or progress
        if (Object.keys(updateData).length > 1) { // More than just updatedAt
            await updateDoc(userRef, updateData);
        }

        // Fetch and return the updated user document
        const updatedUserSnap = await getDoc(userRef);
        if (updatedUserSnap.exists()) {
            return { id: userId, ...updatedUserSnap.data() } as User;
        } else {
            console.error("Failed to fetch user after toggling course assignment.");
            return null;
        }
    });
};


// Get users who do not have a companyId or have an empty string companyId
export async function getUsersWithoutCompany(): Promise<User[]> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const users: User[] = [];
        const userIds = new Set<string>(); // To avoid duplicates if a user matches both queries (shouldn't happen with current logic)

        // Query for companyId == null
        const qNull = query(usersRef, where('companyId', '==', null), where("isDeleted", "==", false));
        const snapshotNull = await getDocs(qNull);
        snapshotNull.forEach((doc) => {
            if (!userIds.has(doc.id)) {
                users.push({ id: doc.id, ...doc.data() } as User);
                userIds.add(doc.id);
            }
        });

        // Query for companyId == ''
        const qEmpty = query(usersRef, where('companyId', '==', ''), where("isDeleted", "==", false));
        const snapshotEmpty = await getDocs(qEmpty);
        snapshotEmpty.forEach((doc) => {
             if (!userIds.has(doc.id)) { // Check again to avoid duplicates
                 users.push({ id: doc.id, ...doc.data() } as User);
                 userIds.add(doc.id);
             }
         });

        console.log(`Found ${users.length} users without a brand ID.`);
        return users;
    });
}

// Assign a default companyId to users who are missing one
export async function assignMissingCompanyToUsers(defaultCompanyId: string): Promise<number> {
    if (!defaultCompanyId) {
        console.error("Cannot assign missing brand: defaultCompanyId is required.");
        return 0;
    }
    return retryOperation(async () => {
        const usersToUpdate = await getUsersWithoutCompany();
        if (usersToUpdate.length === 0) {
            console.log("No users found missing a brand ID.");
            return 0;
        }

        const batch = writeBatch(db);
        usersToUpdate.forEach(user => {
            const userRef = doc(db, USERS_COLLECTION, user.id);
            console.log(`Assigning brand ${defaultCompanyId} to user ${user.email} (${user.id})`);
            // Ensure isDeleted is false when assigning, and update timestamp
            batch.update(userRef, { companyId: defaultCompanyId, isDeleted: false, updatedAt: serverTimestamp() });
        });

        await batch.commit();
        console.log(`Successfully assigned brand ID ${defaultCompanyId} to ${usersToUpdate.length} users.`);
        return usersToUpdate.length;
    }, 3); // Retry batch commit 3 times
}

// Assign a default location to users within a company who don't have any locations assigned
export async function assignMissingLocationToUsers(companyId: string, defaultLocationId: string): Promise<number> {
    if (!companyId || !defaultLocationId) {
        console.error("Cannot assign missing location: brand ID and defaultLocationId are required.");
        return 0;
    }

    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const companyUsersQuery = query(usersRef, where('companyId', '==', companyId), where("isDeleted", "==", false));
        const companyUsersSnapshot = await getDocs(companyUsersQuery);

        let updatedCount = 0;
        const batch = writeBatch(db);

        companyUsersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data() as User;
            // Check if assignedLocationIds is null, undefined, or an empty array
            if (!userData.assignedLocationIds || !Array.isArray(userData.assignedLocationIds) || userData.assignedLocationIds.length === 0) {
                console.log(`Assigning location ${defaultLocationId} to user ${userData.email} (${userDoc.id})`);
                const userRef = doc(db, USERS_COLLECTION, userDoc.id);
                batch.update(userRef, { assignedLocationIds: [defaultLocationId], updatedAt: serverTimestamp() });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            console.log(`Successfully assigned location ${defaultLocationId} to ${updatedCount} users in brand ${companyId}.`);
        } else {
            console.log(`No users found in brand ${companyId} needing location assignment.`);
        }

        return updatedCount;
    }, 3);
}

// Get user's progress for a specific course
export const getUserCourseProgress = async (userId: string, courseId: string): Promise<{ progress: number; status: "Not Started" | "Started" | "In Progress" | "Completed"; completedItems: string[]; lastUpdated?: Timestamp | Date | null }> => {
    console.log(`Fetching progress for user ${userId} and course ${courseId}`);
    const defaultProgress = { progress: 0, status: "Not Started" as const, completedItems: [], lastUpdated: null };

    try {
        const user = await getUserById(userId);

        // Important: Check if user is null (not found or soft-deleted)
        if (!user) {
            console.warn(`User ${userId} not found or is soft-deleted. Returning default progress.`);
            return defaultProgress;
        }

        // Try fetching as global course first
        let courseData: Course | BrandCourse | null = await getCourseById(courseId);
        if (!courseData) {
            // If not found as global, try as brand course
            courseData = await getBrandCourseById(courseId);
        }

        if (!courseData || !courseData.curriculum || courseData.curriculum.length === 0) {
            console.warn(`Course ${courseId} (global or brand) not found or has no curriculum. Cannot calculate progress accurately.`);
            // Return stored progress if any, otherwise default
            const storedProgress = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;
            return {
                progress: storedProgress?.progress ?? 0,
                status: storedProgress?.status ?? "Not Started",
                completedItems: storedProgress?.completedItems ?? [],
                lastUpdated: storedProgress?.lastUpdated ?? null
            };
        }

        const totalItems = courseData.curriculum.length;
        const progressData = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;
        const completedItems = progressData?.completedItems || [];
        const completedCount = completedItems.length;
        const calculatedProgress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        // Determine status based on progress
        let currentStatus = progressData?.status || "Not Started";
        if (completedCount === totalItems && totalItems > 0) {
            currentStatus = "Completed";
        } else if (completedCount > 0) {
            currentStatus = "In Progress"; // Or "Started" if it's the very first item completed
        } else if (progressData?.status === "Started" && completedCount === 0) {
            // Retain "Started" if explicitly marked as such but no items yet complete
            currentStatus = "Started";
        }


        console.log(`Calculated progress for ${userId} on ${courseId}: ${calculatedProgress}%, Status: ${currentStatus}`);
        return { progress: calculatedProgress, status: currentStatus, completedItems, lastUpdated: progressData?.lastUpdated ?? null };

    } catch (error) {
        console.error(`Error fetching progress for user ${userId}, course ${courseId}:`, error);
        return defaultProgress; // Return default on any error
    }
};

// Get user's overall progress across all assigned courses
export const getUserOverallProgress = async (userId: string): Promise<number> => {
    console.log(`Calculating overall progress for user ${userId}`);
    const user = await getUserById(userId);
    if (!user || !user.assignedCourseIds || user.assignedCourseIds.length === 0) {
        console.log(`User ${userId} has no assigned courses or is soft-deleted.`);
        return 0;
    }

    let totalCurriculumItems = 0;
    let totalCompletedItems = 0;

    for (const courseId of user.assignedCourseIds) {
        // Try fetching as global course first
        let courseData: Course | BrandCourse | null = await getCourseById(courseId);
        if (!courseData) {
            // If not found as global, try as brand course
            courseData = await getBrandCourseById(courseId);
        }

        if (courseData?.curriculum && courseData.curriculum.length > 0) {
            const courseTotal = courseData.curriculum.length;
            totalCurriculumItems += courseTotal;

            // Get specific progress for this course
            const courseProgressData = user.courseProgress?.[courseId];
            const completedCount = courseProgressData?.completedItems?.length || 0;
            totalCompletedItems += completedCount;
            const individualProgress = courseTotal > 0 ? Math.round((completedCount / courseTotal) * 100) : 0;
            console.log(`  - Course ${courseId}: ${completedCount}/${courseTotal} items completed (${individualProgress}%)`);
        } else {
            console.warn(`  - Course ${courseId} (global or brand) not found or has no curriculum items.`);
        }
    }

    if (totalCurriculumItems === 0) {
        console.log(`User ${userId} assigned courses have no curriculum items in total.`);
        return 0; // Avoid division by zero
    }

    const overallProgress = Math.round((totalCompletedItems / totalCurriculumItems) * 100);
    console.log(`Overall progress for user ${userId}: ${totalCompletedItems}/${totalCurriculumItems} items completed (${overallProgress}%)`);
    return overallProgress;
};


// Update user's progress for a specific item in a course
export const updateEmployeeProgress = async (userId: string, courseId: string, completedItemIndex: number): Promise<void> => {
    if (!userId || !courseId || completedItemIndex < 0) {
        console.error("Invalid input for updateEmployeeProgress");
        return;
    }

    console.log(`Updating progress for user ${userId}, course ${courseId}. Completed item index: ${completedItemIndex}`);

    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        
        // Try fetching as global course first
        let course: Course | BrandCourse | null = await getCourseById(courseId);
        if (!course) {
            // If not found as global, try as brand course
            course = await getBrandCourseById(courseId);
        }

        if (!course || !course.curriculum || completedItemIndex >= course.curriculum.length) {
            console.error(`Invalid course data or item index for progress update. Course: ${courseId}, Index: ${completedItemIndex}`);
            throw new Error("Invalid course data or item index.");
        }

        const completedItemId = course.curriculum[completedItemIndex]; // Get the actual item ID
        if (!completedItemId) { // Should not happen if index is valid, but good check
             console.error(`Could not find item ID at index ${completedItemIndex} for course ${courseId}`);
             throw new Error("Could not find item ID.");
        }
        const progressFieldPath = `courseProgress.${courseId}`;
        const totalItems = course.curriculum.length;

        // Fetch current user data to get existing progress
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
             console.error(`User ${userId} not found or is soft-deleted for progress update.`);
             throw new Error("User not found or is soft-deleted.");
        }
        const currentProgressData = userSnap.data()?.courseProgress?.[courseId] as UserCourseProgressData | undefined;

        // Add the newly completed item ID, ensuring no duplicates
        const updatedCompletedItems = Array.from(new Set([...(currentProgressData?.completedItems || []), completedItemId]));
        const completedCount = updatedCompletedItems.length;

        // Determine new status
        let newStatus: UserCourseProgressData['status'] = "In Progress";
        if (completedCount === totalItems && totalItems > 0) {
            newStatus = "Completed";
        } else if (completedCount === 0 && (!currentProgressData || currentProgressData.status === "Not Started")) {
            newStatus = "Not Started"; // Stay "Not Started" if 0 items and previously "Not Started"
        } else if (completedCount > 0 && (!currentProgressData || currentProgressData.status === "Not Started")) {
             newStatus = "Started"; // Change to "Started" if first item completed
        } else if (currentProgressData?.status) {
            newStatus = currentProgressData.status; // Maintain existing status if items are being completed further
             if (newStatus === "Started" && completedCount > 0 && completedCount < totalItems) {
                newStatus = "In Progress"; // Transition from Started to In Progress if more items are done but not all
            }
        }


        const newProgressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        await updateDoc(userRef, {
            [`${progressFieldPath}.completedItems`]: updatedCompletedItems,
            [`${progressFieldPath}.status`]: newStatus,
            [`${progressFieldPath}.progress`]: newProgressPercentage,
            [`${progressFieldPath}.lastUpdated`]: serverTimestamp(),
            updatedAt: serverTimestamp(), // Update user's main updatedAt as well
        });
        console.log(`Progress updated successfully for user ${userId}, course ${courseId}. New progress: ${newProgressPercentage}%, Status: ${newStatus}`);
    });
};


// Placeholder function to represent fetching company data by hostname/slug
// This is simplified and would need more robust logic for production
export async function getUserCompany(identifier: string | null): Promise<Company | null> {
  console.warn(
    "getUserCompany in user-data.ts is called. For RootLayout theming, this function relies on `identifier` (hostname/slug) passed correctly from a server context. It will attempt to find a brand by customDomain or subdomainSlug."
  );
  if (!identifier) {
    return null;
  }
  try {
    // First, try to find by custom domain
    let company = await getCompanyDataById(identifier); // Assuming getCompanyDataById can also check customDomain or a new function getCompanyByCustomDomain is used
    if (company && company.customDomain === identifier) {
      console.log(`[getUserCompany] Found brand by customDomain "${identifier}": ${company.name}`);
      return company;
    }

    // If not found by custom domain, try by subdomain slug
    // This requires parsing the identifier if it's a full hostname
    const slug = identifier.includes('.') ? identifier.split('.')[0] : identifier; // Basic slug extraction
    if (slug && slug !== 'www' && slug !== 'localhost' && !slug.startsWith('gymramp-lms')) {
        company = await getCompanyBySubdomainSlug(slug);
        if (company) {
        console.log(`[getUserCompany] Found brand by subdomainSlug "${slug}" (from host "${identifier}"): ${company.name}`);
        return company;
        }
    }
    
    console.log(`[getUserCompany] No brand found for identifier "${identifier}" as custom domain or subdomain slug.`);
    return null;
  } catch (error) {
    console.error(`[getUserCompany] Error fetching brand by identifier "${identifier}":`, error);
    return null;
  }
}
