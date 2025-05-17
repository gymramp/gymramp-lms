
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, PlayCircle, Award, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';
import type { User, UserCourseProgressData } from '@/types/user';
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data';
import { getCourseById } from '@/lib/firestore-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

// Type for course combined with progress data
type CourseWithProgress = Course & {
  progress: number;
  status: "Not Started" | "Started" | "In Progress" | "Completed";
  completedItems: string[];
  lastUpdated?: Timestamp | Date | null;
};


export default function MyCoursesPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assignedCoursesWithProgress, setAssignedCoursesWithProgress] = useState<CourseWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

  const fetchCourseData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
        const userDetails = currentUser;

        if (!userDetails) {
            setAssignedCoursesWithProgress([]);
            setIsLoading(false);
            return;
        }

        const assignedCourseIds = userDetails.assignedCourseIds || [];

        if (assignedCourseIds.length === 0) {
            setAssignedCoursesWithProgress([]);
            setIsLoading(false);
            return;
        }

        const courseProgressPromises = assignedCourseIds.map(async (courseId) => {
            const course = await getCourseById(courseId);
            if (!course) {
                return null;
            }
             const progressData = await getUserCourseProgress(userId, courseId);
             return {
                 ...course,
                 progress: progressData.progress,
                 status: progressData.status,
                 completedItems: progressData.completedItems,
                 lastUpdated: progressData.lastUpdated
             };
        });

        const coursesWithProgressData = (await Promise.all(courseProgressPromises))
                                    .filter(Boolean) as CourseWithProgress[];

        setAssignedCoursesWithProgress(coursesWithProgressData);

    } catch (error) {
        console.error("Error fetching assigned courses/progress:", error);
        toast({ title: "Error", description: "Could not load assigned courses or progress.", variant: "destructive" });
        setAssignedCoursesWithProgress([]);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, toast]);

   useEffect(() => {
        if (currentUser?.id) {
            fetchCourseData(currentUser.id);
        } else if (currentUser === null) {
             setAssignedCoursesWithProgress([]);
             setIsLoading(false);
        }
    }, [currentUser?.id, fetchCourseData]);


  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
          My Learning
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground md:text-xl">
          Your assigned courses. Start or continue learning.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap justify-center gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]">
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                 <Skeleton className="h-2 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : assignedCoursesWithProgress.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-foreground">No Courses Assigned</p>
          <p className="text-muted-foreground mt-2">You currently have no courses assigned. Contact your manager or administrator.</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-6">
          {assignedCoursesWithProgress.map((course) => {
            const isCompleted = course.status === 'Completed';
            return (
                <Card key={course.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]">
                  <CardHeader className="p-0">
                    <div className="relative aspect-video w-full">
                      <Image
                        src={course.featuredImageUrl || course.imageUrl || `https://picsum.photos/seed/${course.id}/600/350`}
                        alt={course.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }}
                        className="bg-muted"
                        data-ai-hint="course cover"
                         onError={(e) => {
                             const target = e.target as HTMLImageElement;
                             target.onerror = null;
                              if (course.imageUrl && target.src !== course.imageUrl) {
                                 target.src = course.imageUrl;
                             } else {
                                 target.src = `https://picsum.photos/seed/${course.id}/600/350`;
                             }
                         }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow p-4 space-y-3">
                     <CardTitle className="text-lg font-semibold leading-tight">{course.title}</CardTitle>
                     <CardDescription className="text-sm text-muted-foreground flex-grow line-clamp-3">{course.description}</CardDescription>
                    <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                           <span>Progress</span>
                           <span>{course.progress}%</span>
                        </div>
                         <Progress value={course.progress} aria-label={`${course.title} progress ${course.progress}%`} className="h-2" />
                         <p className="text-xs text-muted-foreground">Status: {course.status}</p>
                     </div>
                  </CardContent>
                   <CardFooter className="p-4 pt-0">
                     <Button asChild className={cn("w-full", isCompleted ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground" : "bg-primary hover:bg-primary/90")}>
                        <Link href={`/learn/${course.id}`}>
                             {isCompleted ? (
                                <span className='flex items-center gap-2'>
                                    <Eye className="h-4 w-4" />
                                    View Course
                                </span>
                             ) : (
                                <span className='flex items-center gap-2'>
                                    <PlayCircle className="h-4 w-4" />
                                    {course.status === 'Not Started' ? 'Start Learning' : 'Continue Learning'}
                                </span>
                             )}
                        </Link>
                     </Button>
                  </CardFooter>
                </Card>
            );
            })}
        </div>
      )}
    </div>
  );
}
