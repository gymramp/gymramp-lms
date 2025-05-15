
'use client';

import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading
import { BookOpen, PlayCircle, Award, Eye } from 'lucide-react'; // Changed Award to Eye for viewing completed course
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';
import type { User, UserCourseProgressData } from '@/types/user'; // Import User type and progress data type
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data'; // Use correct user data functions
import { getCourseById } from '@/lib/firestore-data'; // Fetch course details
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '@/lib/utils'; // Import cn
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Type for course combined with progress data
type CourseWithProgress = Course & {
  progress: number;
  status: "Not Started" | "Started" | "In Progress" | "Completed";
  completedItems: string[];
  lastUpdated?: Timestamp | Date | null;
};


export default function MyCoursesPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assignedCoursesWithProgress, setAssignedCoursesWithProgress] = useState<CourseWithProgress[]>([]); // State for combined data
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Effect 1: Handle Auth State Change and Set User
  useEffect(() => {
    setIsLoading(true); // Start loading when checking auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
        } catch (error) {
           console.error("Error fetching user details:", error);
           setCurrentUser(null);
           toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
           setIsLoading(false); // Stop loading on error
        }
      } else {
        // No user logged in
        setCurrentUser(null);
        setIsLoading(false); // Stop loading if no user
        // Optionally redirect to login
        // router.push('/login');
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [toast]); // Dependency: toast (stable)

  // Effect 2: Fetch Course Data when User ID is available
  const fetchCourseData = useCallback(async (userId: string) => {
    setIsLoading(true); // Ensure loading is true when fetching starts
    try {
        const userDetails = currentUser; // Use already fetched userDetails if available

        if (!userDetails) {
            console.error("User details not available for fetching courses.");
             setAssignedCoursesWithProgress([]);
            setIsLoading(false);
            return;
        }

        // Fetch assigned courses for the specific user
        const assignedCourseIds = userDetails.assignedCourseIds || [];

        if (assignedCourseIds.length === 0) {
            console.log(`No courses assigned found for user ${userDetails.email}`);
            setAssignedCoursesWithProgress([]);
            setIsLoading(false);
            return;
        }

        console.log(`Fetching details and progress for assigned course IDs: ${assignedCourseIds.join(', ')}`);

        // Fetch course details and progress in parallel
        const courseProgressPromises = assignedCourseIds.map(async (courseId) => {
            const course = await getCourseById(courseId);
            if (!course) {
                console.warn(`Assigned course ${courseId} could not be found.`);
                return null; // Skip if course details are missing
            }
             // Fetch progress for this specific course using the actual user ID and course ID
             // Assume getUserCourseProgress returns the structure { progress: number; status: string; completedItems: string[]; lastUpdated?: Timestamp | Date }
             const progressData = await getUserCourseProgress(userId, courseId);
             return {
                 ...course,
                 progress: progressData.progress,
                 status: progressData.status,
                 completedItems: progressData.completedItems,
                 lastUpdated: progressData.lastUpdated // Include lastUpdated if returned
             };
        });

        const coursesWithProgressData = (await Promise.all(courseProgressPromises))
                                    .filter(Boolean) as CourseWithProgress[]; // Filter out nulls

        setAssignedCoursesWithProgress(coursesWithProgressData);
        console.log("Assigned courses with progress:", coursesWithProgressData);

    } catch (error) {
        console.error("Error fetching assigned courses/progress:", error);
        toast({ title: "Error", description: "Could not load assigned courses or progress.", variant: "destructive" });
        setAssignedCoursesWithProgress([]);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, toast]); // Depend on currentUser state

   // Trigger data fetching when currentUser ID becomes available
   useEffect(() => {
        if (currentUser?.id) {
            fetchCourseData(currentUser.id);
        } else if (currentUser === null) {
            // Handle case where user logs out or auth state is confirmed null
             setAssignedCoursesWithProgress([]);
             setIsLoading(false); // Ensure loading stops if user becomes null after initial load
        }
    }, [currentUser?.id, fetchCourseData]); // Depend on currentUser.id


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
        // Loading State Skeleton - Use flex here too for consistency
        <div className="flex flex-wrap justify-center gap-6">
          {[...Array(3)].map((_, i) => ( // Show 3 skeletons as an example
            <Card key={i} className="overflow-hidden w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]"> {/* Adjust width based on desired column count */}
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
        // Empty State
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-foreground">No Courses Assigned</p>
          <p className="text-muted-foreground mt-2">You currently have no courses assigned. Contact your manager or administrator.</p>
          {/* Optional: Link to browse public courses if available */}
          {/* <Button variant="link" asChild><Link href="/courses">Browse Catalog</Link></Button> */}
        </div>
      ) : (
        // Display Assigned Courses - Use Flexbox for centering
        <div className="flex flex-wrap justify-center gap-6">
          {assignedCoursesWithProgress.map((course) => {
            const isCompleted = course.status === 'Completed';
            return (
                <Card key={course.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]"> {/* Control width for responsiveness */}
                  <CardHeader className="p-0">
                    <div className="relative aspect-video w-full">
                      <Image
                        src={course.featuredImageUrl || course.imageUrl || `https://picsum.photos/seed/${course.id}/600/350`}
                        alt={course.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // Responsive sizes
                        style={{ objectFit: 'cover' }}
                        className="bg-muted"
                        data-ai-hint="course cover"
                         onError={(e) => {
                             const target = e.target as HTMLImageElement;
                             target.onerror = null; // Prevent infinite loops
                              // Try fallback to general imageUrl if featured fails
                              if (course.imageUrl && target.src !== course.imageUrl) {
                                 target.src = course.imageUrl;
                             } else { // If general imageUrl also fails or is not set, use picsum
                                 target.src = `https://picsum.photos/seed/${course.id}/600/350`;
                             }
                         }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-grow p-4 space-y-3">
                     <CardTitle className="text-lg font-semibold leading-tight">{course.title}</CardTitle>
                     <CardDescription className="text-sm text-muted-foreground flex-grow line-clamp-3">{course.description}</CardDescription> {/* Limit description lines */}
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
                       {/* Link to the learning page for this specific course */}
                        <Link href={`/learn/${course.id}`}>
                             {isCompleted ? (
                                <span className='flex items-center gap-2'>
                                    <Eye className="h-4 w-4" />
                                    View Course {/* Changed text */}
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
