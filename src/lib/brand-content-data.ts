

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
import type { BrandCourse, BrandCourseFormData, BrandLesson, BrandLessonFormData, BrandQuiz, BrandQuizFormData, BrandQuestion, BrandQuestionFormData, QuestionType, QuizTranslation, CourseTranslation, LessonTranslation } from '@/types/course';
import { getLessonById, getQuizById } from './firestore-data';

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

const sanitizeCourseTranslations = (translations?: { [key: string]: CourseTranslation }): { [key: string]: CourseTranslation } => {
  if (!translations) return {};
  const sanitized: { [key: string]: CourseTranslation } = {};
  for (const locale in translations) {
    if (Object.prototype.hasOwnProperty.call(translations, locale)) {
      const translation = translations[locale];
      if (translation && (translation.title || translation.description || translation.longDescription)) {
          sanitized[locale] = {
              title: translation.title || null,
              description: translation.description || null,
              longDescription: translation.longDescription || null,
          };
      }
    }
  }
  return sanitized;
};


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
            certificateTemplateId: courseData.certificateTemplateId || null, // Save certificate template
            curriculum: [], // Initialize with empty curriculum
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            translations: sanitizeCourseTranslations(courseData.translations),
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
        
        const dataToUpdate: Partial<BrandCourseFormData & { updatedAt: Timestamp }> = { ...courseData, updatedAt: serverTimestamp() as Timestamp };
        if (courseData.imageUrl === '') dataToUpdate.imageUrl = `https://placehold.co/600x350.png?text=${encodeURIComponent(courseData.title || currentDocSnap.data().title)}`;
        if (courseData.featuredImageUrl === '') dataToUpdate.featuredImageUrl = null;
        if (courseData.certificateTemplateId === '') dataToUpdate.certificateTemplateId = null;
        if (courseData.translations) {
            dataToUpdate.translations = sanitizeCourseTranslations(courseData.translations);
        }

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
const sanitizeLessonTranslations = (translations?: { [key: string]: LessonTranslation }): { [key: string]: LessonTranslation } => {
  if (!translations) return {};
  const sanitized: { [key: string]: LessonTranslation } = {};
  for (const locale in translations) {
    if (Object.prototype.hasOwnProperty.call(translations, locale)) {
      const translation = translations[locale];
      if (translation && (translation.title || translation.content || translation.videoUrl)) {
          sanitized[locale] = {
              title: translation.title || null,
              content: translation.content || null,
              videoUrl: translation.videoUrl || null,
          };
      }
    }
  }
  return sanitized;
};


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
            translations: sanitizeLessonTranslations(lessonData.translations),
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

        const dataToUpdate: Partial<Omit<BrandLessonFormData, 'translations' | 'brandId'>> & { translations?: { [key: string]: LessonTranslation; }; updatedAt?: Timestamp } = { updatedAt: serverTimestamp() as Timestamp };
        
        if (lessonData.translations) {
            dataToUpdate.translations = sanitizeLessonTranslations(lessonData.translations);
        }

        for (const key in lessonData) {
            if (Object.prototype.hasOwnProperty.call(lessonData, key) && key !== 'translations' && key !== 'brandId') {
                const value = lessonData[key as keyof typeof lessonData];
                if (key === 'videoUrl' || key === 'featuredImageUrl' || key === 'exerciseFilesInfo' || key === 'playbackTime') {
                    (dataToUpdate as any)[key] = (value as string)?.trim() || null;
                } else {
                    (dataToUpdate as any)[key] = value;
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


// --- BrandQuiz Functions ---

const sanitizeQuizTranslations = (translations?: { [key: string]: Pick<QuizTranslation, 'title'> }): { [key: string]: Pick<QuizTranslation, 'title'> } => {
    if (!translations) return {};
    const sanitized: { [key: string]: Pick<QuizTranslation, 'title'> } = {};
    for (const locale in translations) {
        if (Object.prototype.hasOwnProperty.call(translations, locale)) {
            const translation = translations[locale];
            if (translation && translation.title) {
                sanitized[locale] = {
                    title: translation.title || null,
                };
            }
        }
    }
    return sanitized;
};


export async function createBrandQuiz(brandId: string, quizData: BrandQuizFormData): Promise<BrandQuiz | null> {
    if (!brandId) {
        console.error("Brand ID is required to create a brand quiz.");
        return null;
    }
    return retryOperation(async () => {
        const quizzesRef = collection(db, BRAND_QUIZZES_COLLECTION);
        const newQuizDoc = {
            ...quizData, // Contains title and brandId
            questions: [], // Initialize with empty questions array
            translations: sanitizeQuizTranslations(quizData.translations),
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(quizzesRef, newQuizDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            const createdQuiz = { id: docRef.id, ...newDocSnap.data() } as BrandQuiz;
            createdQuiz.questionCount = 0; // Initialize count
            return createdQuiz;
        } else {
            return null;
        }
    });
}

export async function getBrandQuizzesByBrandId(brandId: string): Promise<BrandQuiz[]> {
    if (!brandId) return [];
    return retryOperation(async () => {
        const quizzesRef = collection(db, BRAND_QUIZZES_COLLECTION);
        const q = query(quizzesRef, where("brandId", "==", brandId), where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const quizzes: BrandQuiz[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            quizzes.push({
                id: doc.id,
                ...data,
                questionCount: data.questions?.length || 0 // Calculate questionCount
            } as BrandQuiz);
        });
        return quizzes;
    });
}

export async function getBrandQuizById(quizId: string, locale?: string): Promise<BrandQuiz | null> {
    if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, quizId);
        const docSnap = await getDoc(quizRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            let quizData = { id: docSnap.id, ...docSnap.data(), questions: docSnap.data().questions || [] } as BrandQuiz;

            if (locale && locale !== 'en' && quizData.translations && quizData.translations[locale]) {
                const translation = quizData.translations[locale];
                console.log(`[getBrandQuizById] Merging translation for locale '${locale}' for brand quiz '${quizId}'.`);
                if (translation.title) quizData.title = translation.title;
            }
            return quizData;
        } else {
            return null;
        }
    });
}

export async function updateBrandQuiz(quizId: string, quizData: Partial<BrandQuizFormData>): Promise<BrandQuiz | null> {
    if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) return null;
        
        const dataToUpdate: Partial<BrandQuizFormData & { updatedAt: Timestamp }> = { updatedAt: serverTimestamp() as Timestamp };
        if (quizData.title !== undefined) dataToUpdate.title = quizData.title;
        if (quizData.translations !== undefined) dataToUpdate.translations = sanitizeQuizTranslations(quizData.translations);

        await updateDoc(quizRef, dataToUpdate);
        const updatedDocSnap = await getDoc(quizRef);
        if (updatedDocSnap.exists()) {
            const data = updatedDocSnap.data();
            return {
                id: quizId,
                ...data,
                questions: data.questions || [] // Ensure questions is always an array
            } as BrandQuiz;
        } else {
            return null;
        }
    });
}

export async function deleteBrandQuizAndCleanUp(quizId: string, brandId: string): Promise<boolean> {
    if (!quizId || !brandId) return false;
    return retryOperation(async () => {
        const prefixedQuizId = `brandQuiz-${quizId}`;
        await removeBrandItemFromBrandCourseCurriculums(brandId, prefixedQuizId);

        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, quizId);
        await updateDoc(quizRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}

// --- BrandQuestion Management Functions (within a BrandQuiz) ---

export async function addBrandQuestionToBrandQuiz(brandQuizId: string, questionData: BrandQuestionFormData): Promise<BrandQuestion | null> {
    if (!brandQuizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, brandQuizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Brand Quiz with ID ${brandQuizId} not found or is soft-deleted.`);
        }

        const questionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const questionForFirestore: BrandQuestion = {
            id: questionId,
            type: questionData.type,
            text: questionData.text,
            options: questionData.options || [],
            translations: questionData.translations,
        };

        if (questionData.type === 'multiple-select') {
            questionForFirestore.correctAnswers = questionData.correctAnswers || [];
        } else {
            questionForFirestore.correctAnswer = questionData.correctAnswer || '';
        }

        await updateDoc(quizRef, {
            questions: arrayUnion(questionForFirestore),
            updatedAt: serverTimestamp(),
        });

        const updatedQuizSnap = await getDoc(quizRef);
        const updatedQuiz = updatedQuizSnap.data() as BrandQuiz;
        const addedQuestion = updatedQuiz?.questions?.find(q => q.id === questionId);
        return addedQuestion || null;
    });
}

export async function updateBrandQuestionInBrandQuiz(brandQuizId: string, questionId: string, questionData: Partial<BrandQuestionFormData>): Promise<BrandQuestion | null> {
    if (!brandQuizId || !questionId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, brandQuizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Brand Quiz with ID ${brandQuizId} not found or is soft-deleted.`);
        }

        const currentQuestions: BrandQuestion[] = quizSnap.data().questions || [];
        let questionFound = false;
        const newQuestionsArray = currentQuestions.map(q => {
            if (q.id === questionId) {
                questionFound = true;
                const updatedQuestionData: BrandQuestion = {
                    ...q, // Spread existing question to preserve ID and other fields
                    type: questionData.type !== undefined ? questionData.type : q.type,
                    text: questionData.text !== undefined ? questionData.text : q.text,
                    options: questionData.options !== undefined ? questionData.options : q.options,
                    translations: questionData.translations !== undefined ? questionData.translations : q.translations,
                };
                if (updatedQuestionData.type === 'multiple-select') {
                    updatedQuestionData.correctAnswers = questionData.correctAnswers !== undefined ? questionData.correctAnswers : q.correctAnswers;
                    delete updatedQuestionData.correctAnswer; // Ensure only one correct answer field
                } else {
                    updatedQuestionData.correctAnswer = questionData.correctAnswer !== undefined ? questionData.correctAnswer : q.correctAnswer;
                    delete updatedQuestionData.correctAnswers; // Ensure only one correct answer field
                }
                return updatedQuestionData;
            }
            return q;
        });

        if (!questionFound) {
             throw new Error(`Brand Question with ID ${questionId} not found in brand quiz ${brandQuizId}.`);
        }

        await updateDoc(quizRef, { questions: newQuestionsArray, updatedAt: serverTimestamp() });

        const updatedQuizSnap = await getDoc(quizRef);
        const updatedQuiz = updatedQuizSnap.data() as BrandQuiz;
        const updatedQuestion = updatedQuiz?.questions?.find(q => q.id === questionId);
        return updatedQuestion || null;
    });
}

export async function deleteBrandQuestionFromBrandQuiz(brandQuizId: string, questionId: string): Promise<boolean> {
    if (!brandQuizId || !questionId) return false;
    return retryOperation(async () => {
        const quizRef = doc(db, BRAND_QUIZZES_COLLECTION, brandQuizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
             throw new Error(`Brand Quiz with ID ${brandQuizId} not found or is soft-deleted.`);
        }

        const currentQuestions: BrandQuestion[] = quizSnap.data().questions || [];
        const questionToRemove = currentQuestions.find(q => q.id === questionId);
        if (!questionToRemove) {
            console.warn(`Brand Question with ID ${questionId} not found in brand quiz ${brandQuizId} for deletion.`);
            return false;
        }
        const newQuestionsArray = currentQuestions.filter(q => q.id !== questionId);
        await updateDoc(quizRef, { questions: newQuestionsArray, updatedAt: serverTimestamp() });
        return true;
    }, 3);
}
