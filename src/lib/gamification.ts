
import type { User } from '@/types/user';
import type { BadgeInfo } from '@/components/gamification/BadgeCard';
import { BookOpen, Flame, Zap, Rocket, Star, Trophy, Award, Crown, Target, Heart, CalendarDays } from 'lucide-react';
import { getCourseById } from './firestore-data';

/**
 * Checks a user's data against various criteria to determine which badges they have earned.
 * @param user - The full User object to check achievements for.
 * @returns A promise that resolves to an array of BadgeInfo objects for earned badges.
 */
export async function getBadgesForUser(user: User): Promise<BadgeInfo[]> {
    const earnedBadges: BadgeInfo[] = [];

    const courseProgressValues = Object.values(user.courseProgress || {});
    const quizAttempts = courseProgressValues.flatMap(p => Object.entries(p.quizAttempts || {}));

    // Badge: First Course Started
    if (courseProgressValues.some(p => p.status !== 'Not Started')) {
        earnedBadges.push({
            name: "First Step",
            description: "Awarded for starting your very first course.",
            Icon: BookOpen,
            color: 'text-green-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Five Courses Completed
    if (courseProgressValues.filter(p => p.status === 'Completed').length >= 5) {
        earnedBadges.push({
            name: "Five Course Finisher",
            description: "Awarded for successfully completing five different courses.",
            Icon: Zap,
            color: 'text-blue-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Quiz Whiz (Perfect score on first attempt)
    // Simplified: Check if any quiz was passed with only 1 attempt.
    if (quizAttempts.some(([, attempts]) => attempts === 1)) {
        earnedBadges.push({
            name: "Quiz Whiz",
            description: "Get a perfect score on a quiz on your first attempt.",
            Icon: Star,
            color: 'text-yellow-500',
            dateAwarded: new Date() // Placeholder
        });
    }
    
    // Badge: Program Prodigy (Placeholder logic)
    // This would require fetching program data and checking if all courses in a program are complete.
    // For now, let's assume if they completed 3 specific courses, they get the badge.
    const completedCourseIds = new Set(
        Object.entries(user.courseProgress || {})
            .filter(([, progress]) => progress.status === 'Completed')
            .map(([courseId]) => courseId)
    );
    if (completedCourseIds.has('courseId1') && completedCourseIds.has('courseId2') && completedCourseIds.has('courseId3')) {
        earnedBadges.push({
            name: "Program Prodigy",
            description: "Complete all courses within a single Program.",
            Icon: Award,
            color: 'text-indigo-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Category Captain (Placeholder logic)
    // This is complex and requires course metadata. We'll simulate it.
    // Let's say completing 4 courses grants a "Sales" category badge.
    if (completedCourseIds.size >= 4) {
        earnedBadges.push({
            name: "Category Captain",
            description: "Finish all available courses within a specific category.",
            Icon: Crown,
            color: 'text-purple-500',
            dateAwarded: new Date() // Placeholder
        });
    }
    
    // Badge: Learning Leader (Placeholder logic)
    // In a real app, this would involve a leaderboard or ranking system.
    // We'll award it if the user has completed more than 10 courses.
    if (completedCourseIds.size > 10) {
        earnedBadges.push({
            name: "Learning Leader",
            description: "Be in the top 10% of users for total courses completed.",
            Icon: Trophy,
            color: 'text-amber-600',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Daily Dedication (Placeholder logic)
    // Requires tracking daily login/activity. We'll award it if the user was created within the last 7 days.
    const userCreatedAt = user.createdAt ? (user.createdAt as any).toDate() : new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (userCreatedAt > sevenDaysAgo) {
         earnedBadges.push({
            name: "Daily Dedication",
            description: "Complete at least one lesson every day for a full week.",
            Icon: Flame,
            color: 'text-orange-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Weekend Warrior (Placeholder logic)
    // Requires tracking login day. Let's award it if today is a weekend.
    const today = new Date().getDay();
    if (today === 0 || today === 6) {
        earnedBadges.push({
            name: "Weekend Warrior",
            description: "Log in and complete a lesson on a Saturday or Sunday.",
            Icon: CalendarDays,
            color: 'text-rose-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Rapid Learner (Placeholder logic)
    // Requires tracking start and end dates. We'll award it if they have at least one completion.
    if (completedCourseIds.size > 0) {
        earnedBadges.push({
            name: "Rapid Learner",
            description: "Finish an entire course within 48 hours of starting it.",
            Icon: Rocket,
            color: 'text-cyan-500',
            dateAwarded: new Date() // Placeholder
        });
    }
    
    // Badge: Upsell Expert (Placeholder)
    if (completedCourseIds.has('courseId_upsell1') || completedCourseIds.size > 2) {
        earnedBadges.push({
            name: "Upsell Expert",
            description: "Complete a specific set of courses related to upselling techniques.",
            Icon: Zap,
            color: 'text-lime-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Client Retention Rockstar (Placeholder)
    if (completedCourseIds.has('courseId_retention1') || completedCourseIds.size > 3) {
        earnedBadges.push({
            name: "Client Retention Rockstar",
            description: "Finish all courses focused on customer service and retention.",
            Icon: Heart,
            color: 'text-pink-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // Badge: Closer (Placeholder)
     if (completedCourseIds.has('courseId_advanced_sales') || completedCourseIds.size > 6) {
        earnedBadges.push({
            name: "Closer",
            description: "Successfully complete the final, most advanced sales course.",
            Icon: Target,
            color: 'text-red-500',
            dateAwarded: new Date() // Placeholder
        });
    }
    
    return earnedBadges;
}

/**
 * A placeholder for a more complex function that would be triggered
 * by specific events (e.g., course completion, quiz submission) to
 * check for and award new badges.
 * 
 * @param userId The ID of the user who performed an action.
 * @param eventType The type of event that occurred (e.g., 'COURSE_COMPLETED', 'QUIZ_PASSED').
 * @param eventData Additional data related to the event.
 */
export async function checkForAndAwardBadges(userId: string, eventType: string, eventData: any): Promise<void> {
    // In a real application, this function would:
    // 1. Fetch the user's data.
    // 2. Fetch the user's currently awarded badges.
    // 3. Based on the eventType, check if they now qualify for any new badges.
    // 4. If they do, and they don't already have it, award the new badge by updating their user profile.
    // 5. Potentially send a notification about the new badge.
    
    console.log(`Checking for badges for user ${userId} due to event: ${eventType}`, eventData);
    
    // Example pseudo-logic:
    // if (eventType === 'COURSE_COMPLETED') {
    //   const user = await getUserById(userId);
    //   const completedCount = Object.values(user.courseProgress).filter(p => p.status === 'Completed').length;
    //   if (completedCount === 5 && !user.badges.includes('five-courses-badge')) {
    //     // award a new badge
    //   }
    // }
}
