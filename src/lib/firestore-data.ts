


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
    Timestamp,
    documentId
} from 'firebase/firestore';
import type { Course, Lesson, Quiz, Question, CourseFormData, LessonFormData, QuizFormData, QuestionFormData, QuestionType, Program, ProgramFormData } from '@/types/course';

const COURSES_COLLECTION = 'courses';
const LESSONS_COLLECTION = 'lessons';
const QUIZZES_COLLECTION = 'quizzes';
const PROGRAMS_COLLECTION = 'programs';

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


// --- Course Library Functions ---

export async function getAllCourses(): Promise<Course[]> {
    return retryOperation(async () => {
        const coursesRef = collection(db, COURSES_COLLECTION);
        const q = query(coursesRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const courses: Course[] = [];
        querySnapshot.forEach((doc) => {
            courses.push({ id: doc.id, ...doc.data() } as Course);
        });
        return courses;
    });
}

export async function getCourseById(courseId: string): Promise<Course | null> {
     if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const docSnap = await getDoc(courseRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Course;
        } else {
            return null;
        }
    });
}

export async function addCourse(courseData: CourseFormData): Promise<Course | null> {
    return retryOperation(async () => {
        const coursesRef = collection(db, COURSES_COLLECTION);
        const newCourseDoc = {
            title: courseData.title,
            description: courseData.description,
            longDescription: courseData.longDescription,
            imageUrl: courseData.imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(courseData.title)}`,
            featuredImageUrl: courseData.featuredImageUrl || null,
            level: courseData.level,
            duration: courseData.duration,
            certificateTemplateId: courseData.certificateTemplateId || null, // Save certificate template
            curriculum: [],
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(coursesRef, newCourseDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as Course;
        } else {
            return null;
        }
    });
}

export async function updateCourseMetadata(courseId: string, courseData: Partial<CourseFormData>): Promise<Course | null> {
     if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const currentDocSnap = await getDoc(courseRef);
        if (!currentDocSnap.exists() || currentDocSnap.data().isDeleted === true) {
             throw new Error("Course not found or is soft-deleted for update.");
        }

        const updatedDocData: Partial<Course> = {
            title: courseData.title,
            description: courseData.description,
            longDescription: courseData.longDescription,
            imageUrl: courseData.imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(courseData.title || currentDocSnap.data().title)}`,
            featuredImageUrl: courseData.featuredImageUrl === '' ? null : courseData.featuredImageUrl,
            level: courseData.level,
            duration: courseData.duration,
            certificateTemplateId: courseData.certificateTemplateId === '' ? null : courseData.certificateTemplateId, // Handle empty string from form
            updatedAt: serverTimestamp(),
        };


        await updateDoc(courseRef, updatedDocData);
        const updatedDocSnap = await getDoc(courseRef);
        if (updatedDocSnap.exists()) {
            return { id: courseId, ...updatedDocSnap.data() } as Course;
        } else {
            return null;
        }
    });
}

export const updateCourseCurriculum = async (courseId: string, curriculum: string[]): Promise<boolean> => {
    if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists() || courseSnap.data().isDeleted === true) return false;

        await updateDoc(courseRef, {
            curriculum: curriculum,
            updatedAt: serverTimestamp(),
        });
        return true;
    });
};

export async function deleteCourse(courseId: string): Promise<boolean> {
     if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        await updateDoc(courseRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}


// --- Lesson Library Functions ---

export async function createLesson(lessonData: LessonFormData): Promise<Lesson | null> {
    return retryOperation(async () => {
        const lessonsRef = collection(db, LESSONS_COLLECTION);
        const dataToSave = {
            ...lessonData,
            videoUrl: lessonData.videoUrl?.trim() || null,
            featuredImageUrl: lessonData.featuredImageUrl?.trim() || null,
            exerciseFilesInfo: lessonData.exerciseFilesInfo?.trim() || null,
            playbackTime: lessonData.playbackTime?.trim() || null,
            isPreviewAvailable: lessonData.isPreviewAvailable || false,
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(lessonsRef, dataToSave);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as Lesson;
        } else {
            return null;
        }
    });
}

export async function getAllLessons(): Promise<Lesson[]> {
    return retryOperation(async () => {
        const lessonsRef = collection(db, LESSONS_COLLECTION);
        const q = query(lessonsRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const lessons: Lesson[] = [];
        querySnapshot.forEach((doc) => {
            lessons.push({ id: doc.id, ...doc.data() } as Lesson);
        });
        return lessons;
    });
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
     if (!lessonId) return null;
    return retryOperation(async () => {
        const lessonRef = doc(db, LESSONS_COLLECTION, lessonId);
        const docSnap = await getDoc(lessonRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Lesson;
        } else {
            return null;
        }
    });
}

export async function updateLesson(lessonId: string, lessonData: Partial<LessonFormData>): Promise<Lesson | null> {
     if (!lessonId) return null;
    return retryOperation(async () => {
        const lessonRef = doc(db, LESSONS_COLLECTION, lessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists() || lessonSnap.data().isDeleted === true) return null;

         const dataToUpdate: Partial<LessonFormData & {updatedAt: Timestamp}> = { updatedAt: serverTimestamp() as Timestamp };
         for (const key in lessonData) {
             if (Object.prototype.hasOwnProperty.call(lessonData, key)) {
                 const value = lessonData[key as keyof LessonFormData];
                 if (key === 'videoUrl' || key === 'featuredImageUrl' || key === 'exerciseFilesInfo' || key === 'playbackTime') {
                     (dataToUpdate as any)[key] = (value as string)?.trim() || null;
                 } else if (key === 'isPreviewAvailable') {
                     (dataToUpdate as any)[key] = !!value;
                 } else {
                     (dataToUpdate as any)[key as keyof LessonFormData] = value;
                 }
             }
         }

        await updateDoc(lessonRef, dataToUpdate);
        const updatedDocSnap = await getDoc(lessonRef);
        if (updatedDocSnap.exists()) {
            return { id: lessonId, ...updatedDocSnap.data() } as Lesson;
        } else {
            return null;
        }
    });
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
     if (!lessonId) return false;
    return retryOperation(async () => {
        const lessonRef = doc(db, LESSONS_COLLECTION, lessonId);
        await updateDoc(lessonRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}


// --- Quiz Library Functions ---

export async function createQuiz(quizData: QuizFormData): Promise<Quiz | null> {
    return retryOperation(async () => {
        const quizzesRef = collection(db, QUIZZES_COLLECTION);
        const newQuizDoc = {
            ...quizData,
            questions: [],
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(quizzesRef, newQuizDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as Quiz;
        } else {
            return null;
        }
    });
}

export async function getAllQuizzes(): Promise<Quiz[]> {
    return retryOperation(async () => {
        const quizzesRef = collection(db, QUIZZES_COLLECTION);
        const q = query(quizzesRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const quizzes: Quiz[] = [];
        querySnapshot.forEach((doc) => {
            quizzes.push({ id: doc.id, ...doc.data() } as Quiz);
        });
        return quizzes;
    });
}

export async function getQuizById(quizId: string): Promise<Quiz | null> {
     if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const docSnap = await getDoc(quizRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Quiz;
        } else {
            return null;
        }
    });
}

export async function updateQuiz(quizId: string, quizData: Partial<QuizFormData>): Promise<Quiz | null> {
     if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) return null;

        await updateDoc(quizRef, {...quizData, updatedAt: serverTimestamp() });
        const updatedDocSnap = await getDoc(quizRef);
        if (updatedDocSnap.exists()) {
            return { id: quizId, ...updatedDocSnap.data() } as Quiz;
        } else {
            return null;
        }
    });
}

export async function deleteQuiz(quizId: string): Promise<boolean> {
     if (!quizId) return false;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        await updateDoc(quizRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}

// --- Question Management Functions (within a Quiz) ---

export type QuestionPayload = Omit<Question, 'id'>;


export async function addQuestionToQuiz(quizId: string, questionData: QuestionPayload): Promise<Question | null> {
    if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Quiz with ID ${quizId} not found or is soft-deleted.`);
        }

        const questionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const questionForFirestore: Question = {
            id: questionId,
            type: questionData.type,
            text: questionData.text,
            options: questionData.options || [],
        };

        if (questionData.type === 'multiple-select') {
            questionForFirestore.correctAnswers = questionData.correctAnswers || [];
        } else {
            questionForFirestore.correctAnswer = questionData.correctAnswer || '';
        }

        console.log("[addQuestionToQuiz] Object to be written/unioned:", JSON.stringify(questionForFirestore, null, 2));

        await updateDoc(quizRef, {
            questions: arrayUnion(questionForFirestore),
            updatedAt: serverTimestamp(),
        });

        const updatedQuizSnap = await getDoc(quizRef);
        const updatedQuiz = updatedQuizSnap.data() as Quiz;
        const addedQuestion = updatedQuiz?.questions?.find(q => q.id === questionId);
        return addedQuestion || null;
    });
}

export async function updateQuestion(quizId: string, questionId: string, questionData: QuestionPayload): Promise<Question | null> {
     if (!quizId || !questionId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Quiz with ID ${quizId} not found or is soft-deleted.`);
        }

        const currentQuestions: Question[] = quizSnap.data().questions || [];
        let questionFound = false;
        const newQuestionsArray = currentQuestions.map(q => {
            if (q.id === questionId) {
                questionFound = true;
                const updatedQuestionData: Question = {
                    id: q.id, // Preserve existing ID
                    type: questionData.type,
                    text: questionData.text,
                    options: questionData.options || [],
                };
                if (questionData.type === 'multiple-select') {
                    updatedQuestionData.correctAnswers = questionData.correctAnswers || [];
                } else {
                    updatedQuestionData.correctAnswer = questionData.correctAnswer || '';
                }
                 console.log("[updateQuestion] Object to replace item in array:", JSON.stringify(updatedQuestionData, null, 2));
                return updatedQuestionData;
            }
            return q;
        });

        if (!questionFound) {
             throw new Error(`Question with ID ${questionId} not found in quiz ${quizId}.`);
        }

        await updateDoc(quizRef, { questions: newQuestionsArray, updatedAt: serverTimestamp() });

        // Fetch the updated question from the array to return it
        const updatedQuizSnap = await getDoc(quizRef);
        const updatedQuiz = updatedQuizSnap.data() as Quiz;
        const updatedQuestion = updatedQuiz?.questions?.find(q => q.id === questionId);
        return updatedQuestion || null;
    });
}

export async function deleteQuestion(quizId: string, questionId: string): Promise<boolean> {
     if (!quizId || !questionId) return false;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
             throw new Error(`Quiz with ID ${quizId} not found or is soft-deleted.`);
        }

        const currentQuestions: Question[] = quizSnap.data().questions || [];
        const questionToRemove = currentQuestions.find(q => q.id === questionId);
        if (!questionToRemove) {
            console.warn(`Question with ID ${questionId} not found in quiz ${quizId} for deletion.`);
            return false;
        }
        const newQuestionsArray = currentQuestions.filter(q => q.id !== questionId);
        await updateDoc(quizRef, { questions: newQuestionsArray, updatedAt: serverTimestamp() });
        return true;
    }, 3);
}

async function removeItemFromAllCurriculums(prefixedItemId: string): Promise<void> {
   return retryOperation(async () => {
       const coursesRef = collection(db, COURSES_COLLECTION);
       const q = query(coursesRef, where("curriculum", "array-contains", prefixedItemId), where("isDeleted", "==", false));
       const snapshot = await getDocs(q);

       if (snapshot.empty) return;

       const batch = writeBatch(db);
       snapshot.forEach(courseDoc => {
           const courseRef = courseDoc.ref;
           batch.update(courseRef, { curriculum: arrayRemove(prefixedItemId) });
       });
       await batch.commit();
       console.log(`Removed item ${prefixedItemId} from ${snapshot.size} course curriculums.`);
   });
}

export async function deleteLessonAndCleanUp(lessonId: string): Promise<boolean> {
    if (!lessonId) return false;
    const prefixedLessonId = `lesson-${lessonId}`;
    await removeItemFromAllCurriculums(prefixedLessonId);
    return deleteLesson(lessonId);
}

export async function deleteQuizAndCleanUp(quizId: string): Promise<boolean> {
     if (!quizId) return false;
     const prefixedQuizId = `quiz-${quizId}`;
     await removeItemFromAllCurriculums(prefixedQuizId);
     return deleteQuiz(quizId);
}

// --- Program Functions ---

export async function createProgram(programData: ProgramFormData): Promise<Program | null> {
    return retryOperation(async () => {
        const programsRef = collection(db, PROGRAMS_COLLECTION);
        const newProgramDoc = {
            title: programData.title,
            description: programData.description,
            isStandardSubscription: programData.isStandardSubscription,
            standardSubscriptionPrice: programData.standardSubscriptionPrice || null,
            stripeStandardPriceId: programData.stripeStandardPriceId || null,
            price: programData.price || null,
            firstSubscriptionPrice: programData.firstSubscriptionPrice || null,
            stripeFirstPriceId: programData.stripeFirstPriceId || null,
            secondSubscriptionPrice: programData.secondSubscriptionPrice || null,
            stripeSecondPriceId: programData.stripeSecondPriceId || null,
            courseIds: programData.courseIds || [],
            isDeleted: false,
            deletedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(programsRef, newProgramDoc);
        const newDocSnap = await getDoc(docRef);
        if (newDocSnap.exists()) {
            return { id: docRef.id, ...newDocSnap.data() } as Program;
        } else {
            return null;
        }
    });
}

export async function getAllPrograms(): Promise<Program[]> {
    return retryOperation(async () => {
        const programsRef = collection(db, PROGRAMS_COLLECTION);
        const q = query(programsRef, where("isDeleted", "==", false));
        const querySnapshot = await getDocs(q);
        const programs: Program[] = [];
        querySnapshot.forEach((doc) => {
            programs.push({ id: doc.id, ...doc.data() } as Program);
        });
        return programs;
    });
}

export async function getProgramsByIds(programIds: string[]): Promise<Program[]> {
    if (!programIds || programIds.length === 0) {
        return [];
    }
    return retryOperation(async () => {
        const programsRef = collection(db, PROGRAMS_COLLECTION);
        const programs: Program[] = [];
        // Firestore 'in' query is limited to 30 elements, so we chunk it.
        for (let i = 0; i < programIds.length; i += 30) {
            const chunk = programIds.slice(i, i + 30);
            const q = query(programsRef, where(documentId(), "in", chunk));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                if (doc.data().isDeleted !== true) {
                    programs.push({ id: doc.id, ...doc.data() } as Program);
                }
            });
        }
        return programs;
    });
}

export async function getProgramById(programId: string): Promise<Program | null> {
    if (!programId) return null;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        const docSnap = await getDoc(programRef);
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Program;
        } else {
            return null;
        }
    });
}

export async function updateProgram(programId: string, programData: Partial<ProgramFormData>): Promise<Program | null> {
    if (!programId) return null;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        const programSnap = await getDoc(programRef);
        if (!programSnap.exists() || programSnap.data().isDeleted === true) return null;

        const dataToUpdate: Partial<ProgramFormData & {updatedAt: Timestamp}> = { ...programData, updatedAt: serverTimestamp() as Timestamp };
        await updateDoc(programRef, dataToUpdate);
        const updatedDocSnap = await getDoc(programRef);
        if (updatedDocSnap.exists()) {
            return { id: programId, ...updatedDocSnap.data() } as Program;
        } else {
            return null;
        }
    });
}

export const updateProgramCourseAssignments = async (programId: string, courseIds: string[]): Promise<boolean> => {
    if (!programId) return false;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        const programSnap = await getDoc(programRef);
        if (!programSnap.exists() || programSnap.data().isDeleted === true) return false;

        await updateDoc(programRef, {
            courseIds: courseIds,
            updatedAt: serverTimestamp()
        });
        return true;
    });
};

export async function deleteProgram(programId: string): Promise<boolean> {
    if (!programId) return false;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        await updateDoc(programRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}
