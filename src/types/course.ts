
// Define question types
export type QuestionType = 'multiple-choice' | 'true-false';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Represents a single question within a quiz
export interface Question {
    id: string; // Added ID for managing individual questions
    text: string;
    type: QuestionType; // Type of question
    options: string[]; // Array of possible answers (e.g., ["True", "False"] for true-false)
    correctAnswer: string; // The correct answer from the options
}

// Represents a standalone quiz in the library
export interface Quiz {
    id: string;
    title: string;
    questions: Question[]; // Ensure questions array exists (fetched separately)
    questionCount?: number; // Optional: Added for displaying count easily
    isDeleted?: boolean; // For soft deletes
    deletedAt?: Timestamp | null; // Timestamp of soft deletion
}

// Represents a single standalone lesson in the library
export interface Lesson {
    id: string;
    title: string;
    content: string; // Text content of the lesson (could be Markdown or HTML from WYSIWYG)
    videoUrl?: string | null; // Optional video URL, allow null
    featuredImageUrl?: string | null; // Optional image URL, allow null
    exerciseFilesInfo?: string | null; // Optional field, allow null
    isPreviewAvailable?: boolean; // Whether the lesson can be previewed without enrollment
    playbackTime?: string | null; // Optional playback time, allow null
    isDeleted?: boolean; // For soft deletes
    deletedAt?: Timestamp | null; // Timestamp of soft deletion
}

// Represents a course in the global library
export interface Course {
  id: string;
  title: string;
  description: string; // Short description
  longDescription: string; // Detailed description
  imageUrl: string; // General image URL (can be used as fallback or specific purpose)
  featuredImageUrl?: string | null; // Optional: Primary image for display (e.g., course card)
  modules: string[]; // Simple list of module titles for now
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string; // e.g., "Approx. 6 hours"
  price: string; // e.g., "$199"
  curriculum: string[]; // Array of prefixed lesson/quiz IDs in order (e.g., 'lesson-abc', 'quiz-xyz')
  moduleAssignments?: Record<string, string[]>; // Optional: Maps module title to array of prefixed item IDs
  quizzes?: Quiz[]; // Keep quizzes array (might be used elsewhere or legacy)
  isDeleted?: boolean; // For soft deletes
  deletedAt?: Timestamp | null; // Timestamp of soft deletion
}

// Type for the form data when adding/editing a course metadata (global library)
// Ensure featuredImageUrl is included
export type CourseFormData = Omit<Course, 'id' | 'modules' | 'curriculum' | 'moduleAssignments' | 'quizzes' | 'isDeleted' | 'deletedAt'> & {
    numberOfModules: number;
    // featuredImageUrl is now handled by the base Omit, ensure it's optional in Course type
};


// Type for the form data when adding/editing a lesson
export interface LessonFormData {
    title: string;
    content: string;
    videoUrl?: string | null;
    featuredImageUrl?: string | null; // Optional image URL
    exerciseFilesInfo?: string | null; // Optional text for exercise files
    isPreviewAvailable?: boolean; // Add preview flag
    playbackTime?: string | null; // Optional playback time
}

// Type for the form data when adding/editing a quiz (basic for now)
export interface QuizFormData {
    title: string;
}

// Type for adding/editing a single question (includes type)
export interface QuestionFormData {
    type: QuestionType;
    text: string;
    option1?: string; // Optional for true-false
    option2?: string; // Optional for true-false
    option3?: string; // Optional for true-false
    option4?: string; // Optional for true-false
    correctAnswer: string; // Store the text/value of the correct answer
}

// Represents user's progress on a specific course
export interface UserCourseProgress {
    userId: string;
    courseId: string;
    progress: number; // Percentage
    status: "Not Started" | "Started" | "In Progress" | "Completed";
    lastAccessed?: Date; // Optional: timestamp
}

// Type for assigning a course to an employee (Now User)
export interface AssignCourseData {
    courseId: string;
}
