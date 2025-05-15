
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
    Timestamp, // Import Timestamp
    arrayUnion, // Import arrayUnion
    arrayRemove, // Import arrayRemove
    deleteField, // Import deleteField
    getCountFromServer // Import getCountFromServer
} from 'firebase/firestore';
import type { User, UserFormData, UserRole, UserCourseProgressData, Company } from '@/types/user'; // Ensure UserRole and UserCourseProgressData is imported
import { auth } from './firebase'; // Import auth for deletion
import { createDefaultCompany, getCompanyById } from './company-data'; // For migration and checking company
import { getCourseById } from './firestore-data'; // To get course details for progress calculation

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

/**
 * Fetches all non-soft-deleted users from the Firestore database.
 * Note: For users created before the soft-delete feature, manually add 'isDeleted: false' in Firestore for them to be included.
 * @returns {Promise<User[]>} A promise that resolves to an array of users.
 */
export async function getAllUsers(): Promise<User[]> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("isDeleted", "==", false)); // Filter out soft-deleted users
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        return users;
    });
}

/**
 * Fetches a single non-soft-deleted user by their ID.
 * Handles users created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<User | null>} A promise that resolves to the user or null if not found or soft-deleted.
 */
export async function getUserById(userId: string): Promise<User | null> {
    if (!userId) {
        console.warn("getUserById called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as User;
        } else {
            return null;
        }
    });
}

/**
 * Fetches a single non-soft-deleted user by their email address (case-insensitive).
 * Handles users created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} email - The email of the user to fetch.
 * @returns {Promise<User | null>} A promise that resolves to the user or null if not found or soft-deleted.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    if (!email) {
        console.warn("[getUserByEmail] Called with empty email.");
        return null;
    }
    const lowercasedEmail = email.toLowerCase();
    console.log(`[getUserByEmail] Attempting to find user with lowercase email: '${lowercasedEmail}'`);

    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("email", "==", lowercasedEmail));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[getUserByEmail] Query for '${lowercasedEmail}' executed. Snapshot empty: ${querySnapshot.empty}. Docs count: ${querySnapshot.docs.length}`);

            if (querySnapshot.empty) {
                console.log(`[getUserByEmail] No user document found for email: '${lowercasedEmail}' in collection '${USERS_COLLECTION}'.`);
                return null;
            }

            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            // Use JSON.stringify for potentially large objects to avoid overly verbose console output by default
            console.log(`[getUserByEmail] Document found for '${lowercasedEmail}'. ID: ${docSnap.id}. Data (stringified):`, JSON.stringify(userData).substring(0, 500) + (JSON.stringify(userData).length > 500 ? '...' : ''));


            if (docSnap.exists() && userData.isDeleted !== true) {
                console.log(`[getUserByEmail] User '${lowercasedEmail}' is valid and not soft-deleted. Returning user object.`);
                return { id: docSnap.id, ...userData } as User;
            } else {
                if (!docSnap.exists()) { // This condition should ideally not be met if querySnapshot was not empty
                    console.warn(`[getUserByEmail] Document for '${lowercasedEmail}' was found in query but docSnap.exists() is false. This is unexpected.`);
                }
                if (userData.isDeleted === true) {
                    console.log(`[getUserByEmail] User '${lowercasedEmail}' found but is marked as soft-deleted.`);
                }
                return null;
            }
        } catch (error) {
            console.error(`[getUserByEmail] Error during Firestore query for email '${lowercasedEmail}':`, error);
            throw error; // Re-throw to be caught by retryOperation or calling function
        }
    });
}


/**
 * Fetches all non-soft-deleted users associated with a specific company ID.
 * Note: For users created before the soft-delete feature, manually add 'isDeleted: false' in Firestore for them to be included.
 * @param {string} companyId - The ID of the company.
 * @returns {Promise<User[]>} A promise that resolves to an array of users.
 */
export async function getUsersByCompanyId(companyId: string): Promise<User[]> {
    if (!companyId) {
        console.warn("getUsersByCompanyId called with empty company ID.");
        return [];
    }
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("companyId", "==", companyId), where("isDeleted", "==", false)); // Filter out soft-deleted
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        return users;
    });
}

/**
 * Gets the count of **active and non-soft-deleted** users associated with a specific company ID.
 * @param {string} companyId - The ID of the company.
 * @returns {Promise<number>} A promise that resolves to the number of active users.
 */
export async function getUserCountByCompanyId(companyId: string): Promise<number> {
    if (!companyId) {
        console.warn("getUserCountByCompanyId called with empty company ID.");
        return 0;
    }
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(
            usersRef,
            where("companyId", "==", companyId),
            where("isActive", "==", true),
            where("isDeleted", "==", false) // Only count non-soft-deleted users
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    });
}


/**
 * Adds a new user to the Firestore database.
 * Assumes Firebase Auth user has already been created.
 * Initializes with isDeleted: false and deletedAt: null. Stores email in lowercase.
 * @param {Omit<UserFormData, 'password'>} userData - The data for the new user (excluding password).
 * @returns {Promise<User | null>} A promise that resolves to the newly created user or null on failure.
 */
export async function addUser(userData: Omit<UserFormData, 'password'>): Promise<User | null> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        // Add default fields like isActive and timestamps
        const newUserDoc = {
            ...userData,
            email: userData.email.toLowerCase(), // Store email in lowercase
            isActive: true,
            isDeleted: false, // Initialize as not deleted
            deletedAt: null,  // Initialize as null
            createdAt: serverTimestamp(), // Use server timestamp
            lastLogin: null, // Example default
            assignedCourseIds: userData.assignedCourseIds || [], // Ensure it's an array
            courseProgress: {}, // Initialize empty progress object
            profileImageUrl: userData.profileImageUrl || null,
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

/**
 * Updates an existing user in Firestore. Stores email in lowercase if provided.
 * @param {string} userId - The ID of the user to update.
 * @param {Partial<UserFormData>} userData - The partial data to update.
 * @returns {Promise<User | null>} A promise that resolves to the updated user or null on failure.
 */
export async function updateUser(userId: string, userData: Partial<UserFormData>): Promise<User | null> {
    if (!userId) {
        console.warn("updateUser called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        // Remove password field if present in the update data
        const { password, ...dataToUpdate } = userData;

        const updatePayload: Partial<User> = { ...dataToUpdate };
        if (dataToUpdate.email) {
            updatePayload.email = dataToUpdate.email.toLowerCase(); // Store email in lowercase
        }
        if (dataToUpdate.companyId === null) {
            updatePayload.companyId = ''; // Store empty string if company is unassigned
        }
        if (dataToUpdate.profileImageUrl === null) {
            updatePayload.profileImageUrl = null;
        }


        await updateDoc(userRef, updatePayload);
        const updatedDocSnap = await getDoc(userRef);
        // Check if document exists and isDeleted is not explicitly true
        if (updatedDocSnap.exists() && updatedDocSnap.data().isDeleted !== true) {
            return { id: userId, ...updatedDocSnap.data() } as User;
        } else {
            console.error("Failed to fetch updated user doc or user is soft-deleted.");
            return null;
        }
    });
}

/**
 * Updates the role of a user.
 * @param {string} userId - The ID of the user to update.
 * @param {UserRole} newRole - The new role to assign.
 * @returns {Promise<User | null>} A promise that resolves to the updated user or null on failure.
 */
export async function updateUserRole(userId: string, newRole: UserRole): Promise<User | null> {
    return updateUser(userId, { role: newRole });
}

/**
 * Toggles the active status of a user (activates/deactivates).
 * Does not operate on soft-deleted users.
 * @param {string} userId - The ID of the user to toggle.
 * @returns {Promise<User | null>} A promise that resolves to the updated user or null on failure.
 */
export async function toggleUserStatus(userId: string): Promise<User | null> {
    if (!userId) {
        console.warn("toggleUserStatus called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            const currentStatus = docSnap.data().isActive;
            await updateDoc(userRef, { isActive: !currentStatus });
            const updatedUser = await getUserById(userId); // Re-fetch to get the complete updated user
            return updatedUser;
        } else {
            console.error("User not found or is soft-deleted for status toggle.");
            return null;
        }
    });
}


/**
 * Soft deletes a user from Firestore by setting isDeleted to true and isActive to false.
 * Does NOT delete the corresponding Firebase Auth user.
 * @param {string} userId - The ID of the user to soft delete.
 * @returns {Promise<boolean>} A promise that resolves to true if soft deletion was successful, false otherwise.
 */
export async function deleteUser(userId: string): Promise<boolean> {
    if (!userId) {
        console.warn("deleteUser (soft delete) called with empty ID.");
        return false;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            isActive: false // Also mark as inactive
        });
        return true;
    }, 3);
}

/**
 * Assigns or unassigns multiple courses to/from a user's assignedCourseIds array.
 * Initializes or removes progress tracking for the courses.
 * @param {string} userId - The ID of the user.
 * @param {string[]} courseIds - Array of course IDs to assign or unassign.
 * @param {'assign' | 'unassign'} action - Specify whether to assign or unassign.
 * @returns {Promise<User | null>} The updated user document or null on failure.
 */
export const toggleUserCourseAssignments = async (userId: string, courseIds: string[], action: 'assign' | 'unassign'): Promise<User | null> => {
    if (!userId || !Array.isArray(courseIds) || courseIds.length === 0) {
        console.warn("toggleUserCourseAssignments called with invalid input.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) { // Check not soft-deleted
            console.error(`User ${userId} not found or is soft-deleted.`);
            return null;
        }

        const updateData: { [key: string]: any } = {};
        const currentProgress = userSnap.data()?.courseProgress || {};
        const currentAssignedIds = userSnap.data()?.assignedCourseIds || [];

        if (action === 'assign') {
            // Add courses only if they are not already assigned
            const coursesToAdd = courseIds.filter(id => !currentAssignedIds.includes(id));
            if (coursesToAdd.length > 0) {
                updateData.assignedCourseIds = arrayUnion(...coursesToAdd);

                // Initialize progress for new assignments
                coursesToAdd.forEach(courseId => {
                    if (!currentProgress[courseId]) {
                        const progressFieldPath = `courseProgress.${courseId}`;
                        updateData[progressFieldPath] = {
                            completedItems: [],
                            status: "Not Started",
                            progress: 0,
                            lastUpdated: serverTimestamp()
                        };
                        console.log(`Initialized progress for user ${userId}, course ${courseId}`);
                    }
                });
            }
        } else { // action === 'unassign'
            // Remove courses only if they are currently assigned
            const coursesToRemove = courseIds.filter(id => currentAssignedIds.includes(id));
            if (coursesToRemove.length > 0) {
                updateData.assignedCourseIds = arrayRemove(...coursesToRemove);

                // Remove progress for unassigned courses
                coursesToRemove.forEach(courseId => {
                    const progressFieldPath = `courseProgress.${courseId}`;
                    updateData[progressFieldPath] = deleteField();
                });
            }
        }

        // Perform update only if there are changes
        if (Object.keys(updateData).length > 0) {
            await updateDoc(userRef, updateData);
        }

        // Re-fetch user data to return updated state
        const updatedUserSnap = await getDoc(userRef);
        if (updatedUserSnap.exists()) {
            return { id: userId, ...updatedUserSnap.data() } as User;
        } else {
            console.error("Failed to fetch user after toggling course assignment.");
            return null;
        }
    });
};


/**
 * Fetches non-soft-deleted users who do not have a companyId assigned (companyId is null or empty string).
 * @returns {Promise<User[]>} An array of users without a company ID.
 */
export async function getUsersWithoutCompany(): Promise<User[]> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const users: User[] = [];
        const userIds = new Set<string>();

        // Query for users where companyId is null AND isDeleted is false
        const qNull = query(usersRef, where('companyId', '==', null), where("isDeleted", "==", false));
        const snapshotNull = await getDocs(qNull);
        snapshotNull.forEach((doc) => {
            if (!userIds.has(doc.id)) {
                users.push({ id: doc.id, ...doc.data() } as User);
                userIds.add(doc.id);
            }
        });

        // Query for users where companyId is an empty string AND isDeleted is false
        const qEmpty = query(usersRef, where('companyId', '==', ''), where("isDeleted", "==", false));
        const snapshotEmpty = await getDocs(qEmpty);
        snapshotEmpty.forEach((doc) => {
             if (!userIds.has(doc.id)) {
                 users.push({ id: doc.id, ...doc.data() } as User);
                 userIds.add(doc.id);
             }
         });

        console.log(`Found ${users.length} users without a companyId.`);
        return users;
    });
}

/**
 * Assigns a default companyId to non-soft-deleted users who are missing one.
 * @param {string} defaultCompanyId - The ID of the default company to assign.
 * @returns {Promise<number>} The number of users updated.
 */
export async function assignMissingCompanyToUsers(defaultCompanyId: string): Promise<number> {
    if (!defaultCompanyId) {
        console.error("Cannot assign missing company: defaultCompanyId is required.");
        return 0;
    }
    return retryOperation(async () => {
        const usersToUpdate = await getUsersWithoutCompany(); // This now only gets non-deleted users
        if (usersToUpdate.length === 0) {
            console.log("No users found missing a companyId.");
            return 0;
        }

        const batch = writeBatch(db);
        usersToUpdate.forEach(user => {
            const userRef = doc(db, USERS_COLLECTION, user.id);
            console.log(`Assigning company ${defaultCompanyId} to user ${user.email} (${user.id})`);
            batch.update(userRef, { companyId: defaultCompanyId, isDeleted: false }); // Ensure isDeleted is false
        });

        await batch.commit();
        console.log(`Successfully assigned companyId ${defaultCompanyId} to ${usersToUpdate.length} users.`);
        return usersToUpdate.length;
    }, 3);
}

/**
 * Assigns a default locationId to non-soft-deleted users of a specific company who are missing one.
 * @param {string} companyId - The ID of the company whose users should be checked.
 * @param {string} defaultLocationId - The ID of the default location to assign.
 * @returns {Promise<number>} The number of users updated.
 */
export async function assignMissingLocationToUsers(companyId: string, defaultLocationId: string): Promise<number> {
    if (!companyId || !defaultLocationId) {
        console.error("Cannot assign missing location: companyId and defaultLocationId are required.");
        return 0;
    }

    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        // Query for users in the specified company who are not soft-deleted
        const companyUsersQuery = query(usersRef, where('companyId', '==', companyId), where("isDeleted", "==", false));
        const companyUsersSnapshot = await getDocs(companyUsersQuery);

        let updatedCount = 0;
        const batch = writeBatch(db);

        companyUsersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data() as User; // Cast to User type
            // Check if assignedLocationIds is missing, null, or an empty array
            if (!userData.assignedLocationIds || !Array.isArray(userData.assignedLocationIds) || userData.assignedLocationIds.length === 0) {
                console.log(`Assigning location ${defaultLocationId} to user ${userData.email} (${userDoc.id})`);
                const userRef = doc(db, USERS_COLLECTION, userDoc.id);
                batch.update(userRef, { assignedLocationIds: [defaultLocationId] }); // Assign as an array
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            console.log(`Successfully assigned location ${defaultLocationId} to ${updatedCount} users in company ${companyId}.`);
        } else {
            console.log(`No users found in company ${companyId} needing location assignment.`);
        }

        return updatedCount;
    }, 3);
}

/**
 * Fetches a user's progress for a specific course.
 * Calculates progress based on completed items vs total items in the course curriculum.
 * @param {string} userId - The ID of the user.
 * @param {string} courseId - The ID of the course.
 * @returns {Promise<{ progress: number; status: "Not Started" | "Started" | "In Progress" | "Completed", completedItems: string[], lastUpdated?: Timestamp | Date | null }>} - The user's progress details.
 */
export const getUserCourseProgress = async (userId: string, courseId: string): Promise<{ progress: number; status: "Not Started" | "Started" | "In Progress" | "Completed"; completedItems: string[]; lastUpdated?: Timestamp | Date | null }> => {
    console.log(`Fetching progress for user ${userId} and course ${courseId}`);
    const defaultProgress = { progress: 0, status: "Not Started" as const, completedItems: [], lastUpdated: null };

    try {
        // 1. Fetch the User document
        const user = await getUserById(userId); // Use getUserById to respect soft delete

        if (!user) {
            console.warn(`User ${userId} not found or is soft-deleted. Returning default progress.`);
            return defaultProgress;
        }

        // 2. Fetch the Course document to get the curriculum length
        const course = await getCourseById(courseId);
        if (!course || !course.curriculum || course.curriculum.length === 0) {
            console.warn(`Course ${courseId} not found or has no curriculum. Cannot calculate progress.`);
            const storedProgress = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;
            return {
                progress: storedProgress?.progress ?? 0,
                status: storedProgress?.status ?? "Not Started",
                completedItems: storedProgress?.completedItems ?? [],
                lastUpdated: storedProgress?.lastUpdated ?? null
            };
        }

        const totalItems = course.curriculum.length;

        // 3. Get the progress data from the user document
        const progressData = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;
        const completedItems = progressData?.completedItems || [];
        const completedCount = completedItems.length;

        // 4. Calculate progress based on completed items
        const calculatedProgress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        // 5. Determine status
        let currentStatus = progressData?.status || "Not Started";
        if (completedCount === totalItems && totalItems > 0) {
            currentStatus = "Completed";
        } else if (completedCount > 0) {
            currentStatus = "In Progress";
        }

        console.log(`Calculated progress for ${userId} on ${courseId}: ${calculatedProgress}%, Status: ${currentStatus}`);
        return { progress: calculatedProgress, status: currentStatus, completedItems, lastUpdated: progressData?.lastUpdated ?? null };

    } catch (error) {
        console.error(`Error fetching progress for user ${userId}, course ${courseId}:`, error);
        return defaultProgress;
    }
};

/**
 * Calculates the overall progress percentage for a non-soft-deleted user across all assigned courses.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<number>} The overall progress percentage (0-100).
 */
export const getUserOverallProgress = async (userId: string): Promise<number> => {
    console.log(`Calculating overall progress for user ${userId}`);
    const user = await getUserById(userId); // Uses soft-delete aware fetch
    if (!user || !user.assignedCourseIds || user.assignedCourseIds.length === 0) {
        console.log(`User ${userId} has no assigned courses or is soft-deleted.`);
        return 0;
    }

    let totalCurriculumItems = 0;
    let totalCompletedItems = 0;

    for (const courseId of user.assignedCourseIds) {
        const course = await getCourseById(courseId);
        if (course?.curriculum && course.curriculum.length > 0) {
            const courseTotal = course.curriculum.length;
            totalCurriculumItems += courseTotal;
            const courseProgressData = user.courseProgress?.[courseId];
            const completedCount = courseProgressData?.completedItems?.length || 0;
            totalCompletedItems += completedCount;
            const individualProgress = courseTotal > 0 ? Math.round((completedCount / courseTotal) * 100) : 0;
            console.log(`  - Course ${courseId}: ${completedCount}/${courseTotal} items completed (${individualProgress}%)`);
        } else {
            console.warn(`  - Course ${courseId} not found or has no curriculum items.`);
        }
    }

    if (totalCurriculumItems === 0) {
        console.log(`User ${userId} assigned courses have no curriculum items.`);
        return 0;
    }

    const overallProgress = Math.round((totalCompletedItems / totalCurriculumItems) * 100);
    console.log(`Overall progress for user ${userId}: ${totalCompletedItems}/${totalCurriculumItems} items completed (${overallProgress}%)`);
    return overallProgress;
};


/**
 * Updates a user's progress for a specific course by adding a completed item.
 * Recalculates progress percentage and updates status.
 * @param {string} userId - The ID of the user.
 * @param {string} courseId - The ID of the course.
 * @param {number} completedItemIndex - The index of the item just completed (0-based). Used to get the item ID.
 */
export const updateEmployeeProgress = async (userId: string, courseId: string, completedItemIndex: number): Promise<void> => {
    if (!userId || !courseId || completedItemIndex < 0) {
        console.error("Invalid input for updateEmployeeProgress");
        return;
    }

    console.log(`Updating progress for user ${userId}, course ${courseId}. Completed item index: ${completedItemIndex}`);

    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const course = await getCourseById(courseId);

        if (!course || !course.curriculum || completedItemIndex >= course.curriculum.length) {
            console.error(`Invalid course data or item index for progress update. Course: ${courseId}, Index: ${completedItemIndex}`);
            throw new Error("Invalid course data or item index.");
        }

        const completedItemId = course.curriculum[completedItemIndex];
        if (!completedItemId) {
             console.error(`Could not find item ID at index ${completedItemIndex} for course ${courseId}`);
             throw new Error("Could not find item ID.");
        }
        const progressFieldPath = `courseProgress.${courseId}`;
        const totalItems = course.curriculum.length;

        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) { // Check not soft-deleted
             console.error(`User ${userId} not found or is soft-deleted for progress update.`);
             throw new Error("User not found or is soft-deleted.");
        }
        const currentProgressData = userSnap.data()?.courseProgress?.[courseId] as UserCourseProgressData | undefined;

        const updatedCompletedItems = Array.from(new Set([...(currentProgressData?.completedItems || []), completedItemId]));
        const completedCount = updatedCompletedItems.length;

        let newStatus: UserCourseProgressData['status'] = "In Progress";
        if (completedCount === totalItems && totalItems > 0) {
            newStatus = "Completed";
        } else if (completedCount === 0) {
            newStatus = "Not Started";
        } else if (completedCount > 0 && (!currentProgressData || currentProgressData.status === "Not Started")) {
             newStatus = "In Progress";
        } else if (currentProgressData?.status) {
            // Keep current status if it's "In Progress" or "Started" and not yet completed
            if(currentProgressData.status === "In Progress" || currentProgressData.status === "Started"){
                newStatus = currentProgressData.status;
            }
        }


        const newProgressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        await updateDoc(userRef, {
            [`${progressFieldPath}.completedItems`]: updatedCompletedItems,
            [`${progressFieldPath}.status`]: newStatus,
            [`${progressFieldPath}.progress`]: newProgressPercentage,
            [`${progressFieldPath}.lastUpdated`]: serverTimestamp(),
        });
        console.log(`Progress updated successfully for user ${userId}, course ${courseId}. New progress: ${newProgressPercentage}%, Status: ${newStatus}`);
    });
};

/**
 * Retrieves the company object for the current user.
 * This is a placeholder and will return null because reliably getting the
 * current user server-side in RootLayout requires more advanced session management.
 * @returns {Promise<Company | null>} The company object or null.
 */
export async function getUserCompany(): Promise<Company | null> {
  // This function is called from RootLayout (a Server Component).
  // Directly using `auth.currentUser` from the Firebase client SDK is not reliable
  // in Server Components for determining the current authenticated user.
  // Proper server-side session management (e.g., NextAuth.js, Firebase session cookies)
  // would be needed to get the user's ID here.

  // For now, this function acts as a placeholder and will return null,
  // causing the layout to use default theme colors.
  // This resolves the "Export getUserCompany doesn't exist" error.
  // A future step would be to implement proper server-side user identification here.
  console.warn(
    "getUserCompany in user-data.ts is a placeholder and currently cannot reliably determine the current user's company on the server for RootLayout. It will return null."
  );
  return null;
}
