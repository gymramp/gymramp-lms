
// Define question types
export type QuestionType = 'multiple-choice' | 'true-false' | 'multiple-select';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Represents a single question within a quiz
export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    options: string[];

    correctAnswer?: string; 
    correctAnswers?: string[];
}

// Represents a standalone quiz in the library
export interface Quiz {
    id: string;
    title: string;
    questions: Question[];
    questionCount?: number;
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
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
  curriculum: string[];
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
}

// Type for the form data when adding/editing a course metadata (global library)
export type CourseFormData = Omit<Course, 'id' | 'isDeleted' | 'deletedAt' | 'curriculum'>;


// Type for the form data when adding/editing a lesson
export interface LessonFormData {
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null;
    exerciseFilesInfo?: string | null;
    isPreviewAvailable?: boolean;
    playbackTime?: string | null;
}

// Type for the form data when adding/editing a quiz (basic for now)
export interface QuizFormData {
    title: string;
}

// Type for adding/editing a single question
export interface QuestionFormData {
    type: QuestionType;
    text: string;
    options: string[];
    correctAnswer?: string;
    correctAnswers?: string[];
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
  price: string; 
  firstSubscriptionPrice?: string | null; 
  stripeFirstPriceId?: string | null; 
  secondSubscriptionPrice?: string | null; 
  stripeSecondPriceId?: string | null; 
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Type for form data when adding/editing a Program
export type ProgramFormData = Omit<Program, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'courseIds'> & {
  price: string;
  firstSubscriptionPrice?: string | null;
  stripeFirstPriceId?: string | null;
  secondSubscriptionPrice?: string | null;
  stripeSecondPriceId?: string | null;
};

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
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export type BrandCourseFormData = Omit<BrandCourse, 'id' | 'brandId' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt' | 'curriculum'>;

export interface BrandLesson {
    id: string;
    brandId: string;
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null;
    exerciseFilesInfo?: string | null;
    playbackTime?: string | null;
    // isPreviewAvailable is likely not needed for brand-specific content unless they have their own public catalog
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

// Ensure brandId is part of the form data for creation
export type BrandLessonFormData = Omit<BrandLesson, 'id' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'>;


export interface BrandQuiz {
    id: string;
    brandId: string;
    title: string;
    questions: BrandQuestion[];
    isDeleted?: boolean;
    deletedAt?: Timestamp | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export type BrandQuizFormData = Omit<BrandQuiz, 'id' | 'brandId' | 'questions' | 'isDeleted' | 'deletedAt' | 'createdAt' | 'updatedAt'>;

export interface BrandQuestion {
    id: string; // Could be generated client-side or by Firestore function
    text: string;
    type: QuestionType;
    options: string[];
    correctAnswer?: string;
    correctAnswers?: string[];
}

export type BrandQuestionFormData = Omit<BrandQuestion, 'id'>;
