
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
    arrayUnion,
    arrayRemove,
    Timestamp
} from 'firebase/firestore';
import type { BrandCourse, BrandCourseFormData, BrandLesson, BrandLessonFormData, BrandQuiz, BrandQuizFormData, BrandQuestion, BrandQuestionFormData } from '@/types/course';

const BRAND_COURSES_COLLECTION = 'brandCourses';
const BRAND_LESSONS_COLLECTION = 'brandLessons';
const BRAND_QUIZZES_COLLECTION = 'brandQuizzes';

// --- Retry Logic Helper ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = MAX_RETRIES, baseDelay = BASE_DELAY_MS): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            if (attempt === maxRetries) {
                console.error(`Max retries (${maxRetries}) for brand-content op. Failed: ${error.message}`);
                throw error;
            }
            const delay = Math.min(Math.pow(2, attempt) * baseDelay, 10000);
            console.warn(`Brand-content op failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
}

// --- BrandCourse Functions ---

export async function createBrandCourse(brandId: string, courseData: BrandCourseFormData): Promise<BrandCourse | null> {
    if (!brandId) {
        console.error("Brand ID is required to create a brand course.");
        return null;
    }
    return retryOperation(async () => {
        const coursesRef = collection(db, BRAND_COURSES_COLLECTION);
        const newCourseDoc = {
            ...courseData,
            brandId: brandId,
            imageUrl: courseData.imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(courseData.title)}`,
            featuredImageUrl: courseData.featuredImageUrl || null,
            curriculum: [], // Initialize with empty curriculum
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(coursesRef, newCourseDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as BrandCourse;
        } else {
            return null;
        }
    });
}

export async function getBrandCoursesByBrandId(brandId: string): Promise<BrandCourse[]> {
    if (!brandId) return [];
    return retryOperation(async () => {
        const coursesRef = collection(db, BRAND_COURSES_COLLECTION);
        const q = query(coursesRef, where("brandId", "==", brandId), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const courses: BrandCourse[] = [];
        querySnapshot.forEach((doc) => {
            courses.push({ id: doc.id, ...doc.data() } as BrandCourse);
        });
        return courses;
    });
}

export async function getBrandCourseById(courseId: string): Promise<BrandCourse | null> {
    if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, BRAND_COURSES_COLLECTION, courseId);
        const docSnap = await getDoc(courseRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as BrandCourse;
        } else {
            return null;
        }
    });
}

export async function updateBrandCourseMetadata(courseId: string, courseData: Partial<BrandCourseFormData>): Promise<BrandCourse | null> {
    if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, BRAND_COURSES_COLLECTION, courseId);
        const currentDocSnap = await getDoc(courseRef);
        if (!currentDocSnap.exists() || currentDocSnap.data().isDeleted === true) {
            throw new Error("Brand course not found or is soft-deleted for update.");
        }
        const dataToUpdate: Partial<BrandCourse> = { ...courseData, updatedAt: serverTimestamp() as Timestamp };
        if (courseData.imageUrl === '') dataToUpdate.imageUrl = `https://placehold.co/600x350.png?text=${encodeURIComponent(currentDocSnap.data().title)}`;
        if (courseData.featuredImageUrl === '') dataToUpdate.featuredImageUrl = null;

        await updateDoc(courseRef, dataToUpdate);
        const updatedDocSnap = await getDoc(courseRef);
        return updatedDocSnap.exists() ? { id: courseId, ...updatedDocSnap.data() } as BrandCourse : null;
    });
}

export async function deleteBrandCourse(courseId: string): Promise<boolean> {
    if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, BRAND_COURSES_COLLECTION, courseId);
        await updateDoc(courseRef, { isDeleted: true, deletedAt: serverTimestamp() });
        // Note: This does not automatically remove associated brandLessons or brandQuizzes.
        // A more complex cleanup might be needed if those should also be hard/soft deleted.
        return true;
    }, 3);
}

export const updateBrandCourseCurriculum = async (brandCourseId: string, curriculum: string[]): Promise<boolean> => {
    if (!brandCourseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, BRAND_COURSES_COLLECTION, brandCourseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists() || courseSnap.data().isDeleted === true) return false;

        await updateDoc(courseRef, {
            curriculum: curriculum,
            updatedAt: serverTimestamp(),
        });
        return true;
    });
};


// --- BrandLesson Functions ---

export async function createBrandLesson(brandId: string, lessonData: BrandLessonFormData): Promise<BrandLesson | null> {
    if (!brandId) {
        console.error("Brand ID is required to create a brand lesson.");
        return null;
    }
    return retryOperation(async () => {
        const lessonsRef = collection(db, BRAND_LESSONS_COLLECTION);
        const dataToSave = {
            ...lessonData, // brandId is already in lessonData
            videoUrl: lessonData.videoUrl?.trim() || null,
            featuredImageUrl: lessonData.featuredImageUrl?.trim() || null,
            exerciseFilesInfo: lessonData.exerciseFilesInfo?.trim() || null,
            playbackTime: lessonData.playbackTime?.trim() || null,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(lessonsRef, dataToSave);
        const newDocSnap = await getDoc(docRef);
        return newDocSnap.exists() ? { id: docRef.id, ...newDocSnap.data() } as BrandLesson : null;
    });
}

export async function getBrandLessonsByBrandId(brandId: string): Promise<BrandLesson[]> {
    if (!brandId) return [];
    return retryOperation(async () => {
        const lessonsRef = collection(db, BRAND_LESSONS_COLLECTION);
        const q = query(lessonsRef, where("brandId", "==", brandId), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const lessons: BrandLesson[] = [];
        querySnapshot.forEach((doc) => {
            lessons.push({ id: doc.id, ...doc.data() } as BrandLesson);
        });
        return lessons;
    });
}

export async function getBrandLessonById(lessonId: string): Promise<BrandLesson | null> {
    if (!lessonId) return null;
    return retryOperation(async () => {
        const lessonRef = doc(db, BRAND_LESSONS_COLLECTION, lessonId);
        const docSnap = await getDoc(lessonRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as BrandLesson;
        } else {
            return null;
        }
    });
}

export async function updateBrandLesson(lessonId: string, lessonData: Partial<BrandLessonFormData>): Promise<BrandLesson | null> {
    if (!lessonId) return null;
    return retryOperation(async () => {
        const lessonRef = doc(db, BRAND_LESSONS_COLLECTION, lessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists() || lessonSnap.data().isDeleted === true) return null;

        const dataToUpdate: Partial<BrandLessonFormData & {updatedAt: Timestamp}> = { updatedAt: serverTimestamp() as Timestamp };
        for (const key in lessonData) {
            if (Object.prototype.hasOwnProperty.call(lessonData, key)) {
                const value = lessonData[key as keyof BrandLessonFormData];
                 if (key === 'brandId' && value === undefined) continue; // Don't null out brandId
                if (key === 'videoUrl' || key === 'featuredImageUrl' || key === 'exerciseFilesInfo' || key === 'playbackTime') {
                    (dataToUpdate as any)[key] = (value as string)?.trim() || null;
                } else {
                    (dataToUpdate as any)[key as keyof BrandLessonFormData] = value;
                }
            }
        }
        
        await updateDoc(lessonRef, dataToUpdate);
        const updatedDocSnap = await getDoc(lessonRef);
        return updatedDocSnap.exists() ? { id: lessonId, ...updatedDocSnap.data() } as BrandLesson : null;
    });
}

async function removeBrandItemFromBrandCourseCurriculums(brandId: string, prefixedItemId: string): Promise<void> {
   return retryOperation(async () => {
       const coursesRef = collection(db, BRAND_COURSES_COLLECTION);
       const q = query(coursesRef, 
                       where("brandId", "==", brandId), 
                       where("curriculum", "array-contains", prefixedItemId),
                       where("isDeleted", "==", false));
       const snapshot = await getDocs(q);

       if (snapshot.empty) return;

       const batch = writeBatch(db);
       snapshot.forEach(courseDoc => {
           const courseRef = courseDoc.ref;
           batch.update(courseRef, { curriculum: arrayRemove(prefixedItemId), updatedAt: serverTimestamp() });
       });
       await batch.commit();
       console.log(`Removed brand item ${prefixedItemId} from ${snapshot.size} brand course curriculums for brand ${brandId}.`);
   });
}

export async function deleteBrandLessonAndCleanUp(lessonId: string, brandId: string): Promise<boolean> {
    if (!lessonId || !brandId) return false;
    return retryOperation(async () => {
        const prefixedLessonId = `brandLesson-${lessonId}`;
        await removeBrandItemFromBrandCourseCurriculums(brandId, prefixedLessonId);
        
        const lessonRef = doc(db, BRAND_LESSONS_COLLECTION, lessonId);
        await updateDoc(lessonRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}


// --- BrandQuiz Functions (Placeholder for now, to be implemented similarly) ---

export async function getAllBrandQuizzesByBrandId(brandId: string): Promise<BrandQuiz[]> {
    if (!brandId) return [];
    // This is a placeholder. Actual implementation will query BRAND_QUIZZES_COLLECTION.
    console.warn("getAllBrandQuizzesByBrandId is not fully implemented yet.");
    return Promise.resolve([]); 
}

export async function getBrandQuizById(quizId: string): Promise<BrandQuiz | null> {
    if (!quizId) return null;
    // Placeholder
    console.warn(`getBrandQuizById for ${quizId} is not fully implemented.`);
    return Promise.resolve(null);
}

// ... other BrandQuiz and BrandQuestion CRUD functions will go here ...
