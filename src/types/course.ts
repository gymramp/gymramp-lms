
// Define question types
export type QuestionType = 'multiple-choice' | 'true-false' | 'multiple-select'; // Added multiple-select
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Represents a single question within a quiz
export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    options: string[]; // Always an array of available option texts

    // For single-answer types ('multiple-choice', 'true-false')
    correctAnswer?: string; // The single correct option text

    // For multi-answer type ('multiple-select')
    correctAnswers?: string[]; // Array of correct option texts
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
  description: string; // Short description
  longDescription: string; // Detailed description
  imageUrl: string;
  featuredImageUrl?: string | null;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string; // e.g., "Approx. 6 hours"
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
  price: string; // e.g., "$499" (One-time base price)
  firstSubscriptionPrice?: string | null; // e.g., "$29/mo" (for months 4-12)
  stripeFirstPriceId?: string | null; // Stripe Price ID for the first subscription tier
  secondSubscriptionPrice?: string | null; // e.g., "$19/mo" (for month 13+ onwards)
  stripeSecondPriceId?: string | null; // Stripe Price ID for the second subscription tier
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

