

import { z } from 'zod';
// Define question types
export type QuestionType = 'multiple-choice' | 'true-false' | 'multiple-select';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Represents a single question within a quiz (Global or Brand)
export interface QuestionBase {
    id: string; // Can be generated client-side or by Firestore function
    text: string;
    type: QuestionType;
    options: string[]; // Always an array of available option texts

    // For single-answer types ('multiple-choice', 'true-false')
    correctAnswer?: string; // The single correct option text

    // For multi-answer type ('multiple-select')
    correctAnswers?: string[]; // Array of correct option texts
}

export type QuestionFormDataBase = Omit<QuestionBase, 'id'>;


// --- Global Library Content ---

export interface Question extends QuestionBase {}
export type QuestionFormData = QuestionFormDataBase;

// Translation object for a Quiz
export interface QuizTranslation {
  title?: string;
  questions?: Question[];
}

// Represents a standalone quiz in the library
export interface Quiz {
    id: string;
    title: string;
    questions: Question[];
    questionCount?: number; // Denormalized for list views
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    translations?: { [key: string]: QuizTranslation }; // e.g., { 'es': { title: '...', questions: [...] } }
}

// Translation object for a Lesson
export interface LessonTranslation {
  title?: string;
  content?: string;
  videoUrl?: string | null;
}

// Represents a single standalone lesson in the library
export interface Lesson {
    id: string;
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null;
    exerciseFilesInfo?: string | null;
    isPreviewAvailable?: boolean;
    playbackTime?: string | null;
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    translations?: { [key: string]: LessonTranslation }; // e.g., { 'es': { title: '...', content: '...', videoUrl: '...' } }
}

// Translation object for a Course
export interface CourseTranslation {
    title?: string;
    description?: string;
    longDescription?: string;
}

// Represents a course in the global library
export interface Course {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  imageUrl: string;
  featuredImageUrl?: string | null;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  curriculum: string[]; // Array of 'lesson-[id]' or 'quiz-[id]'
  certificateTemplateId?: string | null; // Added for certificate template
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  translations?: { [key: string]: CourseTranslation }; // e.g., { 'es': { title: '...', description: '...', longDescription: '...' } }
}

// Type for the form data when adding/editing a course metadata (global library)
export type CourseFormData = Omit<Course, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'curriculum' | 'translations'> & {
    certificateTemplateId?: string | null;
};


// Type for the form data when adding/editing a lesson
export interface LessonFormData {
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null;
    exerciseFilesInfo?: string | null;
    isPreviewAvailable?: boolean;
    playbackTime?: string | null;
    translations?: { [key: string]: LessonTranslation };
}

// Type for the form data when adding/editing a quiz (basic for now)
export interface QuizFormData {
    title: string;
}


// Represents user's progress on a specific course
export interface UserCourseProgress {
    userId: string;
    courseId: string;
    progress: number; // Percentage
    status: "Not Started" | "Started" | "In Progress" | "Completed";
    lastAccessed?: Date;
}

// Type for assigning a course to an employee (Now User)
export interface AssignCourseData {
    courseId: string;
}

// Represents a Program (collection of courses)
export interface Program {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  isStandardSubscription: boolean; // New field to differentiate pricing model
  // For standard monthly subscription model
  standardSubscriptionPrice: string | null;
  stripeStandardPriceId: string | null;
  // For one-time + tiered subscription model
  price: string | null;
  firstSubscriptionPrice: string | null;
  stripeFirstPriceId: string | null;
  secondSubscriptionPrice: string | null;
  stripeSecondPriceId: string | null;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Type for form data when adding/editing a Program
export type ProgramFormData = Omit<Program, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'>;


// --- Brand Specific Content ---

export interface BrandCourse {
    id: string;
    brandId: string; // ID of the Brand that owns this course
    title: string;
    description: string;
    longDescription: string;
    imageUrl: string; // Default placeholder or brand-specific upload
    featuredImageUrl?: string | null;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    duration: string;
    curriculum: string[]; // Array of 'brandLesson-[id]' or 'brandQuiz-[id]'
    certificateTemplateId?: string | null; // Added for certificate template
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    translations?: { [key: string]: CourseTranslation };
}

export type BrandCourseFormData = Omit<BrandCourse, 'id' | 'brandId' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'curriculum' | 'translations'> & {
    certificateTemplateId?: string | null;
};

export interface BrandLesson {
    id: string;
    brandId: string;
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null;
    exerciseFilesInfo?: string | null;
    playbackTime?: string | null;
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    translations?: { [key: string]: LessonTranslation };
}

export type BrandLessonFormData = Omit<BrandLesson, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'translations'> & {
  brandId: string; // Required for creation
};


export interface BrandQuestion extends QuestionBase {}
export type BrandQuestionFormData = QuestionFormDataBase;

export interface BrandQuiz {
    id: string;
    brandId: string;
    title: string;
    questions: BrandQuestion[];
    questionCount?: number; // Denormalized for list views
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    translations?: { [key: string]: QuizTranslation };
}

export type BrandQuizFormData = Omit<BrandQuiz, 'id' | 'brandId' | 'questions' | 'questionCount' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'translations'> & {
  brandId: string; // Required for creation
};

// --- AI Translation Types ---

export const TranslateContentInputSchema = z.object({
  sourceTitle: z.string().describe('The original English title of the lesson.'),
  sourceContent: z.string().describe('The original English content of the lesson in HTML format.'),
  targetLocale: z.string().describe('The target language code (e.g., "es", "fr").'),
});
export type TranslateContentInput = z.infer<typeof TranslateContentInputSchema>;

export const TranslateContentOutputSchema = z.object({
  translatedTitle: z.string().describe('The translated title.'),
  translatedContent: z.string().describe('The translated content, preserving HTML tags.'),
});
export type TranslateContentOutput = z.infer<typeof TranslateContentOutputSchema>;
