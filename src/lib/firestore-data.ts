
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
    Timestamp // Import Timestamp
} from 'firebase/firestore';
import type { Course, Lesson, Quiz, Question, CourseFormData, LessonFormData, QuizFormData, QuestionFormData, QuestionType, Program, ProgramFormData } from '@/types/course';

const COURSES_COLLECTION = 'courses';
const LESSONS_COLLECTION = 'lessons';
const QUIZZES_COLLECTION = 'quizzes';
const PROGRAMS_COLLECTION = 'programs'; // New collection for programs

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


// --- Course Library Functions ---

/**
 * Fetches all non-soft-deleted courses from the Firestore database.
 * Note: For courses created before soft-delete, manually add 'isDeleted: false' for inclusion.
 * @returns {Promise<Course[]>} A promise that resolves to an array of courses.
 */
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

/**
 * Fetches a single non-soft-deleted course by its ID.
 * Handles courses created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} courseId - The ID of the course to fetch.
 * @returns {Promise<Course | null>} A promise that resolves to the course or null if not found or soft-deleted.
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
     if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const docSnap = await getDoc(courseRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Course;
        } else {
            return null;
        }
    });
}

/**
 * Adds a new course to the Firestore database. Initializes with isDeleted: false and deletedAt: null.
 * @param {CourseFormData} courseData - The data for the new course.
 * @returns {Promise<Course | null>} A promise that resolves to the newly created course or null on failure.
 */
export async function addCourse(courseData: CourseFormData): Promise<Course | null> {
    return retryOperation(async () => {
        const coursesRef = collection(db, COURSES_COLLECTION);
        const { numberOfModules, ...restData } = courseData;

        const moduleTitles = Array.from({ length: numberOfModules }, (_, i) => `Module ${i + 1}`);

        const newCourseDoc = {
            ...restData,
            modules: moduleTitles,
            curriculum: [],
            moduleAssignments: {},
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

/**
 * Updates an existing course's metadata (excluding curriculum/modules).
 * @param {string} courseId - The ID of the course to update.
 * @param {CourseFormData} courseData - The data to update.
 * @returns {Promise<Course | null>} A promise that resolves to the updated course or null on failure.
 */
export async function updateCourseMetadata(courseId: string, courseData: CourseFormData): Promise<Course | null> {
     if (!courseId) return null;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const { numberOfModules, ...restData } = courseData;

        const currentDocSnap = await getDoc(courseRef);
        if (!currentDocSnap.exists() || currentDocSnap.data().isDeleted === true) {
             throw new Error("Course not found or is soft-deleted for update.");
        }
        const currentData = currentDocSnap.data() as Course;
        const moduleTitles = Array.from({ length: numberOfModules }, (_, i) => `Module ${i + 1}`);
        const updatedDocData = {
            ...currentData, // Preserve existing fields like curriculum, moduleAssignments
            ...restData,    // Apply new metadata
            modules: moduleTitles, // Update module titles based on new numberOfModules
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

/**
 * Updates the curriculum order and module assignments for a non-soft-deleted course.
 * @param {string} courseId - The ID of the course to update.
 * @param {string[]} curriculum - The ordered array of prefixed lesson/quiz IDs.
 * @param {Record<string, string[]>} moduleAssignments - Map of module title to item IDs.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export const updateCourseCurriculum = async (courseId: string, curriculum: string[], moduleAssignments: Record<string, string[]>): Promise<boolean> => {
    if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists() || courseSnap.data().isDeleted === true) return false;

        await updateDoc(courseRef, {
            curriculum: curriculum,
            moduleAssignments: moduleAssignments || {},
            updatedAt: serverTimestamp(),
        });
        return true;
    });
};

/**
 * Updates only the `modules` array (list of module titles) for a non-soft-deleted course.
 * @param {string} courseId - The ID of the course to update.
 * @param {string[]} modules - The new array of module titles.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export const updateCourseModules = async (courseId: string, modules: string[]): Promise<boolean> => {
    if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        const courseSnap = await getDoc(courseRef);
        if (!courseSnap.exists() || courseSnap.data().isDeleted === true) return false;

        await updateDoc(courseRef, {
            modules: modules,
            updatedAt: serverTimestamp()
        });
        return true;
    });
};


/**
 * Soft deletes a course from Firestore by setting isDeleted to true and deletedAt.
 * @param {string} courseId - The ID of the course to soft delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function deleteCourse(courseId: string): Promise<boolean> {
     if (!courseId) return false;
    return retryOperation(async () => {
        const courseRef = doc(db, COURSES_COLLECTION, courseId);
        await updateDoc(courseRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}


// --- Lesson Library Functions ---

/**
 * Creates a new standalone lesson in the Firestore database. Initializes with isDeleted: false and deletedAt: null.
 * @param {LessonFormData} lessonData - Data for the new lesson.
 * @returns {Promise<Lesson | null>} The created lesson object or null on failure.
 */
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

/**
 * Fetches all non-soft-deleted standalone lessons from the Firestore database.
 * Note: For lessons created before soft-delete, manually add 'isDeleted: false' for inclusion.
 * @returns {Promise<Lesson[]>} An array of all lessons.
 */
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

/**
 * Fetches a single non-soft-deleted standalone lesson by its ID.
 * Handles lessons created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} lessonId - The ID of the lesson to fetch.
 * @returns {Promise<Lesson | null>} The lesson object or null if not found or soft-deleted.
 */
export async function getLessonById(lessonId: string): Promise<Lesson | null> {
     if (!lessonId) return null;
    return retryOperation(async () => {
        const lessonRef = doc(db, LESSONS_COLLECTION, lessonId);
        const docSnap = await getDoc(lessonRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Lesson;
        } else {
            return null;
        }
    });
}

/**
 * Updates an existing standalone lesson in Firestore.
 * @param {string} lessonId - The ID of the lesson to update.
 * @param {Partial<LessonFormData>} lessonData - The data to update.
 * @returns {Promise<Lesson | null>} The updated lesson object or null on failure.
 */
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

/**
 * Soft deletes a standalone lesson from Firestore by setting isDeleted to true and deletedAt.
 * @param {string} lessonId - The ID of the lesson to soft delete.
 * @returns {Promise<boolean>} True if soft deletion was successful, false otherwise.
 */
export async function deleteLesson(lessonId: string): Promise<boolean> {
     if (!lessonId) return false;
    return retryOperation(async () => {
        const lessonRef = doc(db, LESSONS_COLLECTION, lessonId);
        await updateDoc(lessonRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}


// --- Quiz Library Functions ---

/**
 * Creates a new standalone quiz in the Firestore database. Initializes with isDeleted: false and deletedAt: null.
 * @param {QuizFormData} quizData - Data for the new quiz.
 * @returns {Promise<Quiz | null>} The created quiz object or null on failure.
 */
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

/**
 * Fetches all non-soft-deleted standalone quizzes from the Firestore database.
 * Note: For quizzes created before soft-delete, manually add 'isDeleted: false' for inclusion.
 * @returns {Promise<Quiz[]>} An array of all quizzes.
 */
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

/**
 * Fetches a single non-soft-deleted standalone quiz by its ID.
 * Handles quizzes created before the soft-delete feature by checking if isDeleted is explicitly true.
 * @param {string} quizId - The ID of the quiz to fetch.
 * @returns {Promise<Quiz | null>} The quiz object or null if not found or soft-deleted.
 */
export async function getQuizById(quizId: string): Promise<Quiz | null> {
     if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const docSnap = await getDoc(quizRef);
        // Check if document exists and isDeleted is not explicitly true
        if (docSnap.exists() && docSnap.data().isDeleted !== true) {
            return { id: docSnap.id, ...docSnap.data() } as Quiz;
        } else {
            return null;
        }
    });
}

/**
 * Updates an existing standalone quiz in Firestore.
 * @param {string} quizId - The ID of the quiz to update.
 * @param {Partial<QuizFormData>} quizData - The data to update.
 * @returns {Promise<Quiz | null>} The updated quiz object or null on failure.
 */
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

/**
 * Soft deletes a standalone quiz from Firestore by setting isDeleted to true and deletedAt.
 * @param {string} quizId - The ID of the quiz to soft delete.
 * @returns {Promise<boolean>} True if soft deletion was successful, false otherwise.
 */
export async function deleteQuiz(quizId: string): Promise<boolean> {
     if (!quizId) return false;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        await updateDoc(quizRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}

// --- Question Management Functions (within a Quiz) ---

// Define a type for the payload expected by addQuestionToQuiz and updateQuestion
type QuestionPayload = {
    type: QuestionType;
    text: string;
    options: string[];
    correctAnswer: string;
};


/**
 * Adds a new question to a specific non-soft-deleted quiz.
 * @param {string} quizId - The ID of the quiz to add the question to.
 * @param {QuestionPayload} questionData - The data for the new question, including the final 'options' array.
 * @returns {Promise<Question | null>} The newly created question object or null on failure.
 */
export async function addQuestionToQuiz(quizId: string, questionData: QuestionPayload): Promise<Question | null> {
    if (!quizId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Quiz with ID ${quizId} not found or is soft-deleted.`);
        }

        const questionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const newQuestion: Question = {
            id: questionId,
            type: questionData.type,
            text: questionData.text,
            options: questionData.options, // Directly use the provided options array
            correctAnswer: questionData.correctAnswer,
        };

        await updateDoc(quizRef, {
            questions: arrayUnion(newQuestion),
            updatedAt: serverTimestamp(),
        });

        const updatedQuizSnap = await getDoc(quizRef);
        const updatedQuiz = updatedQuizSnap.data() as Quiz;
        const addedQuestion = updatedQuiz?.questions?.find(q => q.id === questionId);
        return addedQuestion || null;
    });
}

/**
 * Updates an existing question within a specific non-soft-deleted quiz's questions array.
 * @param {string} quizId - The ID of the quiz containing the question.
 * @param {string} questionId - The ID of the question to update.
 * @param {QuestionPayload} questionData - The new data for the question, including the final 'options' array.
 * @returns {Promise<Question | null>} The updated question object or null on failure.
 */
export async function updateQuestion(quizId: string, questionId: string, questionData: QuestionPayload): Promise<Question | null> {
     if (!quizId || !questionId) return null;
    return retryOperation(async () => {
        const quizRef = doc(db, QUIZZES_COLLECTION, quizId);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists() || quizSnap.data().isDeleted === true) {
            throw new Error(`Quiz with ID ${quizId} not found or is soft-deleted.`);
        }

        const currentQuestions: Question[] = quizSnap.data().questions || [];
        let updatedQuestionData: Question | null = null; // To store the question data that was updated
        const newQuestionsArray = currentQuestions.map(q => {
            if (q.id === questionId) {
                updatedQuestionData = {
                    ...q, // Preserves original ID
                    type: questionData.type,
                    text: questionData.text,
                    options: questionData.options, // Directly use the provided options array
                    correctAnswer: questionData.correctAnswer,
                };
                 return updatedQuestionData;
            }
            return q;
        });

        if (!updatedQuestionData) {
             throw new Error(`Question with ID ${questionId} not found in quiz ${quizId}.`);
        }
        await updateDoc(quizRef, { questions: newQuestionsArray, updatedAt: serverTimestamp() });
        return updatedQuestionData;
    });
}


/**
 * Deletes a question from a specific non-soft-deleted quiz's questions array.
 * @param {string} quizId - The ID of the quiz containing the question.
 * @param {string} questionId - The ID of the question to delete.
 * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
 */
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


/**
 * Helper function to remove a lesson/quiz from all non-soft-deleted course curriculums.
 * @param {string} prefixedItemId - The prefixed ID (e.g., 'lesson-abc', 'quiz-xyz').
 */
async function removeItemFromAllCurriculums(prefixedItemId: string): Promise<void> {
   return retryOperation(async () => {
       const coursesRef = collection(db, COURSES_COLLECTION);
       const q = query(coursesRef, where("curriculum", "array-contains", prefixedItemId), where("isDeleted", "==", false));
       const snapshot = await getDocs(q);

       if (snapshot.empty) return;

       const batch = writeBatch(db);
       snapshot.forEach(doc => {
           const courseRef = doc.ref;
           batch.update(courseRef, { curriculum: arrayRemove(prefixedItemId) });
           const assignments = doc.data().moduleAssignments as Record<string, string[]> || {};
           let assignmentsUpdated = false;
           const updatedAssignments: Record<string, string[]> = {};
           for (const moduleTitle in assignments) {
               const originalItems = assignments[moduleTitle];
               updatedAssignments[moduleTitle] = originalItems.filter(id => id !== prefixedItemId);
               if (updatedAssignments[moduleTitle].length !== originalItems.length) {
                   assignmentsUpdated = true;
               }
           }
           if (assignmentsUpdated) {
               batch.update(courseRef, { moduleAssignments: updatedAssignments });
           }
       });
       await batch.commit();
       console.log(`Removed item ${prefixedItemId} from ${snapshot.size} course curriculums/assignments.`);
   });
}

// Aliased delete functions now first remove from curriculum then soft delete the item
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

/**
 * Creates a new program in Firestore.
 * @param {ProgramFormData} programData - The data for the new program.
 * @returns {Promise<Program | null>} The created program or null on failure.
 */
export async function createProgram(programData: ProgramFormData): Promise<Program | null> {
    return retryOperation(async () => {
        const programsRef = collection(db, PROGRAMS_COLLECTION);
        const newProgramDoc = {
            ...programData,
            courseIds: [], // Initialize with empty courseIds
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

/**
 * Fetches all non-soft-deleted programs from Firestore.
 * @returns {Promise<Program[]>} An array of all programs.
 */
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

/**
 * Fetches a single non-soft-deleted program by its ID.
 * @param {string} programId - The ID of the program to fetch.
 * @returns {Promise<Program | null>} The program or null if not found or soft-deleted.
 */
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

/**
 * Updates an existing program's title and description in Firestore.
 * @param {string} programId - The ID of the program to update.
 * @param {Partial<ProgramFormData>} programData - The data to update (title, description).
 * @returns {Promise<Program | null>} The updated program or null on failure.
 */
export async function updateProgram(programId: string, programData: Partial<ProgramFormData>): Promise<Program | null> {
    if (!programId) return null;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        const programSnap = await getDoc(programRef);
        if (!programSnap.exists() || programSnap.data().isDeleted === true) return null;

        const dataToUpdate: Partial<ProgramFormData & {updatedAt: Timestamp}> = {updatedAt: serverTimestamp() as Timestamp};
        if (programData.title !== undefined) dataToUpdate.title = programData.title;
        if (programData.description !== undefined) dataToUpdate.description = programData.description;


        if (Object.keys(dataToUpdate).length <= 1 && !dataToUpdate.title && !dataToUpdate.description) { // only updatedAt
            const currentDoc = await getDoc(programRef);
            return currentDoc.exists() ? {id: currentDoc.id, ...currentDoc.data()} as Program : null;
        }
        
        await updateDoc(programRef, dataToUpdate);
        const updatedDocSnap = await getDoc(programRef);
        if (updatedDocSnap.exists()) {
            return { id: programId, ...updatedDocSnap.data() } as Program;
        } else {
            return null;
        }
    });
}

/**
 * Updates the list of assigned courses for a program.
 * @param {string} programId The ID of the program to update.
 * @param {string[]} courseIds An array of course IDs that should be assigned.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
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

/**
 * Soft deletes a program from Firestore.
 * @param {string} programId - The ID of the program to soft delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function deleteProgram(programId: string): Promise<boolean> {
    if (!programId) return false;
    return retryOperation(async () => {
        const programRef = doc(db, PROGRAMS_COLLECTION, programId);
        await updateDoc(programRef, { isDeleted: true, deletedAt: serverTimestamp() });
        return true;
    }, 3);
}
