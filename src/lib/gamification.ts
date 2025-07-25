
import type { User } from './user';
import type { BadgeInfo } from '@/components/gamification/BadgeCard';
import { BookOpen, Flame, Zap } from 'lucide-react';

/**
 * Checks a user's data against various criteria to determine which badges they have earned.
 * @param user - The full User object to check achievements for.
 * @returns A promise that resolves to an array of BadgeInfo objects for earned badges.
 */
export async function getBadgesForUser(user: User): Promise<BadgeInfo[]> {
    const earnedBadges: BadgeInfo[] = [];

    // --- Badge Logic ---

    // Badge 1: First Course Started
    const hasStartedAnyCourse = user.courseProgress && Object.values(user.courseProgress).some(p => p.status !== 'Not Started');
    if (hasStartedAnyCourse) {
        earnedBadges.push({
            name: "First Step",
            description: "Awarded for starting your very first course. The journey of a thousand miles begins with a single step!",
            Icon: BookOpen,
            color: 'text-green-500',
            dateAwarded: new Date() // Placeholder: In a real app, this would be stored and retrieved
        });
    }

    // Badge 2: Five Courses Completed
    const completedCoursesCount = user.courseProgress ? Object.values(user.courseProgress).filter(p => p.status === 'Completed').length : 0;
    if (completedCoursesCount >= 5) {
        earnedBadges.push({
            name: "Five Course Finisher",
            description: "Awarded for successfully completing five different courses. Your dedication is impressive!",
            Icon: Zap,
            color: 'text-blue-500',
            dateAwarded: new Date() // Placeholder
        });
    }

    // --- Future Badge Ideas (placeholders for now) ---
    // Badge 3: Login Streak
    // earnedBadges.push({
    //     name: "Committed Learner",
    //     description: "Awarded for logging in and learning for 7 consecutive days.",
    //     Icon: Flame,
    //     color: 'text-orange-500',
    //     dateAwarded: null // Not yet earned
    // });
    
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
