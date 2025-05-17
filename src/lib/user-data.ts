
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
import { createDefaultCompany, getCompanyById } from './company-data';
import { getCourseById } from './firestore-data';

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
        const q = query(usersRef, where("email", "==", lowercasedEmail), where("isDeleted", "==", false));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[getUserByEmail] Query for '${lowercasedEmail}' (and isDeleted:false) executed. Snapshot empty: ${querySnapshot.empty}. Docs count: ${querySnapshot.docs.length}`);

            if (querySnapshot.empty) {
                console.log(`[getUserByEmail] No user document found for email: '${lowercasedEmail}' with isDeleted:false in collection '${USERS_COLLECTION}'.`);
                const qAll = query(usersRef, where("email", "==", lowercasedEmail));
                const allSnapshot = await getDocs(qAll);
                if (!allSnapshot.empty) {
                    const foundDoc = allSnapshot.docs[0];
                    console.log(`[getUserByEmail] Fallback check: Found document for '${lowercasedEmail}'. ID: ${foundDoc.id}. isDeleted status: ${foundDoc.data().isDeleted}`);
                }
                return null;
            }

            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            console.log(`[getUserByEmail] Document found for '${lowercasedEmail}' with isDeleted:false. ID: ${docSnap.id}. Data (first 500 chars):`, JSON.stringify(userData).substring(0, 500) + (JSON.stringify(userData).length > 500 ? '...' : ''));

            if (docSnap.exists()) {
                console.log(`[getUserByEmail] User '${lowercasedEmail}' is valid and not soft-deleted (verified by query). Returning user object.`);
                return { id: docSnap.id, ...userData } as User;
            } else {
                console.warn(`[getUserByEmail] Document for '${lowercasedEmail}' was found in query but docSnap.exists() is false. This is unexpected.`);
                return null;
            }
        } catch (error) {
            console.error(`[getUserByEmail] Error during Firestore query for email '${lowercasedEmail}':`, error);
            throw error;
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
            where("isActive", "==", true),
            where("isDeleted", "==", false)
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    });
}


export async function addUser(userData: Omit<UserFormData, 'password'>): Promise<User | null> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const newUserDoc = {
            ...userData,
            email: userData.email.toLowerCase(),
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            lastLogin: null,
            assignedCourseIds: userData.assignedCourseIds || [],
            courseProgress: {},
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

export async function updateUser(userId: string, userData: Partial<UserFormData>): Promise<User | null> {
    if (!userId) {
        console.warn("updateUser called with empty ID.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const { password, ...dataToUpdate } = userData;

        const updatePayload: Partial<User> = { ...dataToUpdate };
        if (dataToUpdate.email) {
            updatePayload.email = dataToUpdate.email.toLowerCase();
        }
        if (dataToUpdate.companyId === null) {
            updatePayload.companyId = '';
        }
        if (dataToUpdate.profileImageUrl === null) {
            updatePayload.profileImageUrl = null;
        }


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
            await updateDoc(userRef, { isActive: !currentStatus });
            const updatedUser = await getUserById(userId);
            return updatedUser;
        } else {
            console.error("User not found or is soft-deleted for status toggle.");
            return null;
        }
    });
}


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
            isActive: false
        });
        return true;
    }, 3);
}

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

        const updateData: { [key: string]: any } = {};
        const currentProgress = userSnap.data()?.courseProgress || {};
        const currentAssignedIds = userSnap.data()?.assignedCourseIds || [];

        if (action === 'assign') {
            const coursesToAdd = courseIds.filter(id => !currentAssignedIds.includes(id));
            if (coursesToAdd.length > 0) {
                updateData.assignedCourseIds = arrayUnion(...coursesToAdd);

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
        } else {
            const coursesToRemove = courseIds.filter(id => currentAssignedIds.includes(id));
            if (coursesToRemove.length > 0) {
                updateData.assignedCourseIds = arrayRemove(...coursesToRemove);

                coursesToRemove.forEach(courseId => {
                    const progressFieldPath = `courseProgress.${courseId}`;
                    updateData[progressFieldPath] = deleteField();
                });
            }
        }

        if (Object.keys(updateData).length > 0) {
            await updateDoc(userRef, updateData);
        }

        const updatedUserSnap = await getDoc(userRef);
        if (updatedUserSnap.exists()) {
            return { id: userId, ...updatedUserSnap.data() } as User;
        } else {
            console.error("Failed to fetch user after toggling course assignment.");
            return null;
        }
    });
};


export async function getUsersWithoutCompany(): Promise<User[]> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const users: User[] = [];
        const userIds = new Set<string>();

        const qNull = query(usersRef, where('companyId', '==', null), where("isDeleted", "==", false));
        const snapshotNull = await getDocs(qNull);
        snapshotNull.forEach((doc) => {
            if (!userIds.has(doc.id)) {
                users.push({ id: doc.id, ...doc.data() } as User);
                userIds.add(doc.id);
            }
        });

        const qEmpty = query(usersRef, where('companyId', '==', ''), where("isDeleted", "==", false));
        const snapshotEmpty = await getDocs(qEmpty);
        snapshotEmpty.forEach((doc) => {
             if (!userIds.has(doc.id)) {
                 users.push({ id: doc.id, ...doc.data() } as User);
                 userIds.add(doc.id);
             }
         });

        console.log(`Found ${users.length} users without a brand ID.`);
        return users;
    });
}

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
            batch.update(userRef, { companyId: defaultCompanyId, isDeleted: false });
        });

        await batch.commit();
        console.log(`Successfully assigned brand ID ${defaultCompanyId} to ${usersToUpdate.length} users.`);
        return usersToUpdate.length;
    }, 3);
}

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
            if (!userData.assignedLocationIds || !Array.isArray(userData.assignedLocationIds) || userData.assignedLocationIds.length === 0) {
                console.log(`Assigning location ${defaultLocationId} to user ${userData.email} (${userDoc.id})`);
                const userRef = doc(db, USERS_COLLECTION, userDoc.id);
                batch.update(userRef, { assignedLocationIds: [defaultLocationId] });
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

export const getUserCourseProgress = async (userId: string, courseId: string): Promise<{ progress: number; status: "Not Started" | "Started" | "In Progress" | "Completed"; completedItems: string[]; lastUpdated?: Timestamp | Date | null }> => {
    console.log(`Fetching progress for user ${userId} and course ${courseId}`);
    const defaultProgress = { progress: 0, status: "Not Started" as const, completedItems: [], lastUpdated: null };

    try {
        const user = await getUserById(userId);

        if (!user) {
            console.warn(`User ${userId} not found or is soft-deleted. Returning default progress.`);
            return defaultProgress;
        }

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
        const progressData = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;
        const completedItems = progressData?.completedItems || [];
        const completedCount = completedItems.length;
        const calculatedProgress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
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
        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
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

export async function getUserCompany(): Promise<Company | null> {
  console.warn(
    "getUserCompany in user-data.ts is a placeholder and currently cannot reliably determine the current user's brand on the server for RootLayout. It will return null."
  );
  return null;
}
