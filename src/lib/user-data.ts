
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
    getCountFromServer,
    increment // Import increment
} from 'firebase/firestore';
import type { User, UserFormData, UserRole, UserCourseProgressData, Company } from '@/types/user';
import { auth, googleAuthProvider } from './firebase'; // Import googleAuthProvider
import { signInWithPopup } from 'firebase/auth'; // Import signInWithPopup
import { createDefaultCompany, getCompanyById as getCompanyDataById, getCompanyBySubdomainSlug, getCompanyByCustomDomain } from './company-data'; // Renamed import
import { getCourseById } from './firestore-data';
import { getBrandCourseById } from './brand-content-data'; // Import for brand courses
import type { Course, BrandCourse } from '@/types/course'; // Import BrandCourse type
import { createNotification } from './notifications-data'; // Import createNotification

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
            console.log(`[getUserByEmail] Query for '${lowercasedEmail}' and isDeleted:false executed. Snapshot empty: ${querySnapshot.empty}. Docs count: ${querySnapshot.docs.length}`);

            if (querySnapshot.empty) {
                console.log(`[getUserByEmail] No user document found for email: '${lowercasedEmail}' with isDeleted:false in collection '${USERS_COLLECTION}'.`);
                return null;
            }

            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            console.log(`[getUserByEmail] Document found for '${lowercasedEmail}' with isDeleted:false. ID: ${docSnap.id}.`);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...userData } as User;
            } else {
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


export async function addUser(userData: Omit<UserFormData, 'password'> & { requiresPasswordChange?: boolean }): Promise<User | null> {
    return retryOperation(async () => {
        const usersRef = collection(db, USERS_COLLECTION);
        const newUserDoc: Partial<User> = {
            name: userData.name,
            email: userData.email.toLowerCase(),
            role: userData.role,
            companyId: userData.companyId || '',
            assignedLocationIds: userData.assignedLocationIds || [],
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp() as Timestamp,
            lastLogin: null,
            assignedCourseIds: userData.assignedCourseIds || [],
            courseProgress: {},
            profileImageUrl: userData.profileImageUrl || null,
            requiresPasswordChange: userData.requiresPasswordChange === true,
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
        const { ...dataToUpdate } = userData; // Omit password, though it's not expected here anyway

        const updatePayload: Partial<User> = {};

        // Only add fields to the payload if they are explicitly provided in userData
        if (dataToUpdate.name !== undefined) updatePayload.name = dataToUpdate.name;
        if (dataToUpdate.email !== undefined) updatePayload.email = dataToUpdate.email.toLowerCase();
        if (dataToUpdate.role !== undefined) updatePayload.role = dataToUpdate.role;
        if (dataToUpdate.companyId !== undefined) updatePayload.companyId = dataToUpdate.companyId || '';
        if (dataToUpdate.assignedLocationIds !== undefined) updatePayload.assignedLocationIds = dataToUpdate.assignedLocationIds;
        if (dataToUpdate.assignedCourseIds !== undefined) updatePayload.assignedCourseIds = dataToUpdate.assignedCourseIds;
        if (dataToUpdate.isActive !== undefined) updatePayload.isActive = dataToUpdate.isActive;
        if (dataToUpdate.profileImageUrl !== undefined) updatePayload.profileImageUrl = dataToUpdate.profileImageUrl === '' ? null : dataToUpdate.profileImageUrl;
        if (dataToUpdate.requiresPasswordChange !== undefined) updatePayload.requiresPasswordChange = dataToUpdate.requiresPasswordChange;


        if (Object.keys(updatePayload).length === 0 && dataToUpdate.requiresPasswordChange === undefined) {
            console.warn("updateUser called with no data to update for user:", userId);
            const currentUserDocSnap = await getDoc(userRef);
            if (currentUserDocSnap.exists() && currentUserDocSnap.data().isDeleted !== true) {
                return { id: userId, ...currentUserDocSnap.data() } as User;
            }
            return null;
        }

        updatePayload.updatedAt = serverTimestamp() as Timestamp;

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
            isActive: false,
            updatedAt: serverTimestamp(),
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

        const updateData: { [key: string]: any } = { updatedAt: serverTimestamp() };
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
                            videoProgress: {},
                            timeSpentSeconds: 0, // Initialize new field
                            quizAttempts: {},    // Initialize new field
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

        if (Object.keys(updateData).length > 1) {
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
            batch.update(userRef, { companyId: defaultCompanyId, isDeleted: false, updatedAt: serverTimestamp() });
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

export const getUserCourseProgress = async (userId: string, courseId: string): Promise<UserCourseProgressData> => {
    console.log(`Fetching progress for user ${userId} and course ${courseId}`);
    const defaultProgress: UserCourseProgressData = {
        progress: 0,
        status: "Not Started" as const,
        completedItems: [],
        videoProgress: {},
        timeSpentSeconds: 0,
        quizAttempts: {},
        lastUpdated: null
    };

    try {
        const user = await getUserById(userId);
        if (!user) {
            console.warn(`User ${userId} not found or is soft-deleted. Returning default progress.`);
            return defaultProgress;
        }

        let courseData: Course | BrandCourse | null = await getCourseById(courseId);
        if (!courseData) {
            courseData = await getBrandCourseById(courseId);
        }

        const storedProgress = user.courseProgress?.[courseId] as UserCourseProgressData | undefined;

        if (!courseData || !courseData.curriculum || courseData.curriculum.length === 0) {
            console.warn(`Course ${courseId} (global or brand) not found or has no curriculum. Cannot calculate progress accurately.`);
            return {
                progress: storedProgress?.progress ?? 0,
                status: storedProgress?.status ?? "Not Started",
                completedItems: storedProgress?.completedItems ?? [],
                videoProgress: storedProgress?.videoProgress ?? {},
                timeSpentSeconds: storedProgress?.timeSpentSeconds ?? 0,
                quizAttempts: storedProgress?.quizAttempts ?? {},
                lastUpdated: storedProgress?.lastUpdated ?? null
            };
        }

        const totalItems = courseData.curriculum.length;
        const completedItems = storedProgress?.completedItems || [];
        const completedCount = completedItems.length;
        const calculatedProgress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        let currentStatus = storedProgress?.status || "Not Started";
        if (completedCount === totalItems && totalItems > 0) {
            currentStatus = "Completed";
        } else if (completedCount > 0) {
            currentStatus = "In Progress";
        } else if (storedProgress?.status === "Started" && completedCount === 0) {
            currentStatus = "Started";
        }

        console.log(`Calculated progress for ${userId} on ${courseId}: ${calculatedProgress}%, Status: ${currentStatus}`);
        return {
            progress: calculatedProgress,
            status: currentStatus,
            completedItems,
            videoProgress: storedProgress?.videoProgress ?? {},
            timeSpentSeconds: storedProgress?.timeSpentSeconds ?? 0,
            quizAttempts: storedProgress?.quizAttempts ?? {},
            lastUpdated: storedProgress?.lastUpdated ?? null
        };

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
        let courseData: Course | BrandCourse | null = await getCourseById(courseId);
        if (!courseData) {
            courseData = await getBrandCourseById(courseId);
        }

        if (courseData?.curriculum && courseData.curriculum.length > 0) {
            const courseTotal = courseData.curriculum.length;
            totalCurriculumItems += courseTotal;

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

        let course: Course | BrandCourse | null = await getCourseById(courseId);
        if (!course) {
            course = await getBrandCourseById(courseId);
        }

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
        } else if (completedCount === 0 && (!currentProgressData || currentProgressData.status === "Not Started")) {
            newStatus = "Not Started";
        } else if (completedCount > 0 && (!currentProgressData || currentProgressData.status === "Not Started")) {
             newStatus = "Started";
        } else if (currentProgressData?.status) {
            newStatus = currentProgressData.status;
             if (newStatus === "Started" && completedCount > 0 && completedCount < totalItems) {
                newStatus = "In Progress";
            }
        }

        const newProgressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        const videoProgressMapPath = `${progressFieldPath}.videoProgress`;
        const timeSpentSecondsPath = `${progressFieldPath}.timeSpentSeconds`;
        const quizAttemptsPath = `${progressFieldPath}.quizAttempts`;

        const currentVideoProgress = currentProgressData?.videoProgress || {};
        const currentTimeSpent = currentProgressData?.timeSpentSeconds || 0;
        const currentQuizAttempts = currentProgressData?.quizAttempts || {};

        if (newStatus === "Completed" && currentProgressData?.status !== "Completed") {
            createNotification({
                recipientId: userId,
                senderId: 'SYSTEM',
                senderName: 'Gymramp',
                type: 'course_completion',
                content: `Congratulations! You've completed the course: ${course.title}.`,
                href: `/certificates` // Link to certificates page
            });
        }

        await updateDoc(userRef, {
            [`${progressFieldPath}.completedItems`]: updatedCompletedItems,
            [`${progressFieldPath}.status`]: newStatus,
            [`${progressFieldPath}.progress`]: newProgressPercentage,
            [videoProgressMapPath]: currentVideoProgress,
            [timeSpentSecondsPath]: currentTimeSpent,
            [quizAttemptsPath]: currentQuizAttempts,
            [`${progressFieldPath}.lastUpdated`]: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log(`Progress updated successfully for user ${userId}, course ${courseId}. New progress: ${newProgressPercentage}%, Status: ${newStatus}`);
    });
};


// Function to update user's video progress for a specific lesson item in a course
export const updateUserVideoProgress = async (
    userId: string,
    courseId: string,
    lessonItemId: string, // This is the prefixed ID like 'lesson-xyz' or 'brandLesson-abc'
    currentTime: number
): Promise<void> => {
    if (!userId || !courseId || !lessonItemId || typeof currentTime !== 'number' || currentTime < 0) {
        console.error("Invalid input for updateUserVideoProgress", { userId, courseId, lessonItemId, currentTime });
        return;
    }

    console.log(`Saving video progress for user ${userId}, course ${courseId}, lesson ${lessonItemId}, time ${currentTime}`);

    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
            console.error(`User ${userId} not found or is soft-deleted for video progress update.`);
            throw new Error("User not found or is soft-deleted.");
        }

        const videoProgressFieldPath = `courseProgress.${courseId}.videoProgress.${lessonItemId}`;

        await updateDoc(userRef, {
            [videoProgressFieldPath]: currentTime,
            [`courseProgress.${courseId}.lastUpdated`]: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log(`Video progress updated for user ${userId}, course ${courseId}, lesson ${lessonItemId} to ${currentTime}s`);
    });
};

// New function to update time spent on a course
export async function updateUserTimeSpentOnCourse(userId: string, courseId: string, additionalTimeSpentSeconds: number): Promise<User | null> {
    if (!userId || !courseId || typeof additionalTimeSpentSeconds !== 'number' || additionalTimeSpentSeconds <= 0) {
        console.warn("updateUserTimeSpentOnCourse called with invalid input.");
        return null;
    }
    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
            console.error(`User ${userId} not found or is soft-deleted for time spent update.`);
            return null;
        }

        const courseProgressFieldPath = `courseProgress.${courseId}.timeSpentSeconds`;
        const currentProgress = userSnap.data()?.courseProgress?.[courseId] as UserCourseProgressData | undefined;
        const newTimeSpent = (currentProgress?.timeSpentSeconds || 0) + additionalTimeSpentSeconds;

        await updateDoc(userRef, {
            [courseProgressFieldPath]: newTimeSpent,
            [`courseProgress.${courseId}.lastUpdated`]: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        console.log(`Time spent on course ${courseId} for user ${userId} updated to ${newTimeSpent} seconds.`);
        const updatedUserSnap = await getDoc(userRef);
        return updatedUserSnap.exists() ? { id: userId, ...updatedUserSnap.data() } as User : null;
    });
}

// New function to increment quiz attempts
export async function incrementUserQuizAttempts(userId: string, courseId: string, quizId: string): Promise<User | null> {
    if (!userId || !courseId || !quizId) {
        console.warn("incrementUserQuizAttempts called with invalid input.");
        return null;
    }
     // quizId here is the "short ID", e.g., "quizId123", not "quiz-quizId123"
    const actualQuizId = quizId.startsWith('quiz-') ? quizId.substring(5) : (quizId.startsWith('brandQuiz-') ? quizId.substring(10) : quizId);


    return retryOperation(async () => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isDeleted === true) {
            console.error(`User ${userId} not found or is soft-deleted for quiz attempt update.`);
            return null;
        }

        const quizAttemptsFieldPath = `courseProgress.${courseId}.quizAttempts.${actualQuizId}`;

        await updateDoc(userRef, {
            [quizAttemptsFieldPath]: increment(1), // Use Firestore increment
            [`courseProgress.${courseId}.lastUpdated`]: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        console.log(`Quiz attempts for quiz ${actualQuizId} in course ${courseId} for user ${userId} incremented.`);
        const updatedUserSnap = await getDoc(userRef);
        return updatedUserSnap.exists() ? { id: userId, ...updatedUserSnap.data() } as User : null;
    });
}

// --- Google Sign-In Handler ---

export async function handleGoogleSignIn(): Promise<void> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const gUser = result.user;

    if (!gUser.email) {
      throw new Error("No email returned from Google Sign-In.");
    }

    // Check if user already exists in Firestore
    let appUser = await getUserByEmail(gUser.email);

    if (!appUser) {
      // User doesn't exist, so create them (Just-In-Time Provisioning)
      console.log(`New user via Google Sign-In: ${gUser.email}. Creating Firestore entry.`);
      
      // Get or create the default company
      const defaultCompany = await createDefaultCompany();
      if (!defaultCompany) {
        throw new Error("Could not get or create the default company for new user.");
      }

      const newUserFormData: Omit<UserFormData, 'password'> = {
        name: gUser.displayName || 'New User',
        email: gUser.email,
        role: 'Staff', // New users from public sign-in default to 'Staff'
        companyId: defaultCompany.id,
        assignedLocationIds: [], // No locations by default
        profileImageUrl: gUser.photoURL || null,
      };

      appUser = await addUser(newUserFormData);
      if (!appUser) {
        throw new Error("Failed to create new user in Firestore after Google Sign-In.");
      }
    } else {
        console.log(`Existing user ${appUser.name} logged in via Google.`);
        // Optionally update last login time here
    }

    // The onAuthStateChanged listener in page.tsx will handle redirection
  } catch (error) {
    console.error("Error during Google Sign-In process: ", error);
    // Re-throw the error so the calling component can handle it (e.g., show a toast)
    throw error;
  }
}

// --- Helper Functions ---
function serializeUserDocumentData(data: any): any {
    if (!data) return null;
    const serialized = { ...data };
    if (data.createdAt instanceof Timestamp) serialized.createdAt = data.createdAt.toDate().toISOString();
    if (data.lastLogin instanceof Timestamp) serialized.lastLogin = data.lastLogin.toDate().toISOString();
    if (data.deletedAt instanceof Timestamp) serialized.deletedAt = data.deletedAt.toDate().toISOString();
    if (data.courseProgress) {
        Object.keys(data.courseProgress).forEach(courseId => {
            const progress = data.courseProgress[courseId];
            if (progress && progress.lastUpdated instanceof Timestamp) {
                serialized.courseProgress[courseId].lastUpdated = progress.lastUpdated.toDate().toISOString();
            }
        });
    }
    return serialized;
}
