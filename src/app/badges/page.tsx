
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpen } from 'lucide-react'; // Import icons
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';
import type { User, UserCourseProgressData } from '@/types/user';
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data';
import { getCourseById } from '@/lib/firestore-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { BadgeItem } from '@/components/learn/BadgeItem'; // Import BadgeItem component

// Type for course with completion data
type CompletedCourse = Course & {
    completionDate: Date | null;
};

export default function MyBadgesPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Effect 1: Handle Auth State Change and Set User
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    setCurrentUser(userDetails);
                } catch (error) {
                    console.error("Error fetching user details:", error);
                    setCurrentUser(null);
                    toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
                    setIsLoading(false);
                }
            } else {
                setCurrentUser(null);
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [toast]);

    // Effect 2: Fetch Completed Courses when User ID is available
    const fetchCompletedCourses = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            const userDetails = currentUser;
            if (!userDetails) {
                 setCompletedCourses([]);
                 setIsLoading(false);
                 return;
            }

            const assignedCourseIds = userDetails.assignedCourseIds || [];
            if (assignedCourseIds.length === 0) {
                setCompletedCourses([]);
                setIsLoading(false);
                return;
            }

            const coursesDataPromises = assignedCourseIds.map(async (courseId) => {
                const course = await getCourseById(courseId);
                if (!course) return null;

                const progressData = await getUserCourseProgress(userId, courseId);
                 if (progressData.status === 'Completed') {
                    // Convert Firestore Timestamp to JS Date if necessary
                    const completionDateObject = progressData.lastUpdated instanceof Timestamp
                        ? progressData.lastUpdated.toDate()
                        : progressData.lastUpdated instanceof Date
                            ? progressData.lastUpdated
                            : null; // Fallback to null if no valid date

                    return { ...course, completionDate: completionDateObject };
                }
                return null; // Not completed
            });

            const fetchedCompletedCourses = (await Promise.all(coursesDataPromises))
                .filter(Boolean) as CompletedCourse[];

            setCompletedCourses(fetchedCompletedCourses);

        } catch (error) {
            console.error("Error fetching completed courses:", error);
            toast({ title: "Error", description: "Could not load completed courses.", variant: "destructive" });
            setCompletedCourses([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, toast]); // Depend on currentUser

    // Trigger data fetching when currentUser ID becomes available
    useEffect(() => {
        if (currentUser?.id) {
            fetchCompletedCourses(currentUser.id);
        } else if (currentUser === null) {
             setCompletedCourses([]);
             setIsLoading(false);
        }
    }, [currentUser?.id, fetchCompletedCourses]);

    return (
        <div className="container mx-auto py-12 md:py-16 lg:py-20">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
                    My Badges
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-muted-foreground md:text-xl">
                    Certificates for your completed courses.
                </p>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-64 w-full" />
                    ))}
                </div>
            ) : completedCourses.length === 0 ? (
                <div className="text-center py-16">
                    <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-foreground">No Badges Earned Yet</p>
                    <p className="text-muted-foreground mt-2">Complete courses in "My Learning" to earn badges.</p>
                    <Button variant="link" asChild className="mt-4">
                        <Link href="/courses/my-courses">Go to My Learning</Link>
                    </Button>
                </div>
            ) : (
                 // Grid layout for badges
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedCourses.map((course) => (
                        <BadgeItem
                            key={course.id}
                            courseName={course.title}
                            userName={currentUser?.name || 'User'}
                            completionDate={course.completionDate || new Date()} // Provide a default date if null
                            imageUrl={course.featuredImageUrl || course.imageUrl}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
