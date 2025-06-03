
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, PlayCircle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course, BrandCourse } from '@/types/course';
import type { User, UserCourseProgressData } from '@/types/user';
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data';
import { getCourseById, getAllPrograms } from '@/lib/firestore-data'; 
import { getBrandCourseById, getBrandCoursesByBrandId } from '@/lib/brand-content-data'; 
import { getCompanyById } from '@/lib/company-data'; 
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '@/lib/utils';
import type { Timestamp } from 'firebase/firestore'; 

type CourseWithProgress = (Course | BrandCourse) & {
  progress: number;
  status: "Not Started" | "Started" | "In Progress" | "Completed";
  completedItems: string[];
  lastUpdated?: string | null; 
};


export default function MyCoursesPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assignedCoursesWithProgress, setAssignedCoursesWithProgress] = useState<CourseWithProgress[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
        } catch (error) {
           console.error("Error fetching user details:", error);
           setCurrentUser(null);
           toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
        }
      } else {
        setCurrentUser(null);
      }
      setIsLoadingUser(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const fetchCourseData = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      setAssignedCoursesWithProgress([]);
      setIsLoadingCourses(false); 
      return;
    }
    setIsLoadingCourses(true);
    try {
      let effectiveAssignedCourseIds = new Set<string>(currentUser.assignedCourseIds || []);

      if (currentUser.companyId) {
        const brand = await getCompanyById(currentUser.companyId);
        if (brand && brand.assignedProgramIds && brand.assignedProgramIds.length > 0) {
          const allPrograms = await getAllPrograms();
          const brandPrograms = allPrograms.filter(p => brand.assignedProgramIds!.includes(p.id));
          brandPrograms.forEach(program => {
            (program.courseIds || []).forEach(courseId => effectiveAssignedCourseIds.add(courseId));
          });
        }
        if (brand && brand.canManageCourses) {
            const brandCreatedCourses = await getBrandCoursesByBrandId(brand.id);
            brandCreatedCourses.forEach(bc => effectiveAssignedCourseIds.add(bc.id));
        }
      }
      
      const uniqueCourseIds = Array.from(effectiveAssignedCourseIds);

      if (uniqueCourseIds.length === 0) {
        setAssignedCoursesWithProgress([]);
        setIsLoadingCourses(false);
        return;
      }

      const courseProgressPromises = uniqueCourseIds.map(async (courseId) => {
        let courseDetails: Course | BrandCourse | null = null;
        
        courseDetails = await getCourseById(courseId);
        if (!courseDetails) {
          courseDetails = await getBrandCourseById(courseId);
        }

        if (!courseDetails || courseDetails.isDeleted) {
          console.warn(`Course (global or brand) with ID ${courseId} not found or is deleted.`);
          return null;
        }
        
        const progressData = await getUserCourseProgress(currentUser.id, courseId);
        return {
          ...courseDetails, 
          progress: progressData.progress,
          status: progressData.status,
          completedItems: progressData.completedItems,
          lastUpdated: progressData.lastUpdated as string | null 
        } as CourseWithProgress; 
      });

      const coursesWithProgressData = (await Promise.all(courseProgressPromises))
        .filter(Boolean) as CourseWithProgress[];

      setAssignedCoursesWithProgress(coursesWithProgressData);

    } catch (error) {
      console.error("Error fetching assigned courses/progress:", error);
      toast({ title: "Error", description: "Could not load assigned courses or progress.", variant: "destructive" });
      setAssignedCoursesWithProgress([]);
    } finally {
      setIsLoadingCourses(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (!isLoadingUser && currentUser) {
      fetchCourseData();
    } else if (!isLoadingUser && !currentUser) {
      setAssignedCoursesWithProgress([]);
      setIsLoadingCourses(false);
    }
  }, [isLoadingUser, currentUser, fetchCourseData]);

  const isLoading = isLoadingUser || isLoadingCourses;

  return (
    <div className="container mx-auto">
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
              <CardHeader> <Skeleton className="h-6 w-3/4" /> <Skeleton className="h-4 w-full mt-2" /> <Skeleton className="h-4 w-1/2 mt-1" /> </CardHeader>
              <CardContent> <Skeleton className="h-2 w-full" /> </CardContent>
              <CardFooter> <Skeleton className="h-10 w-full" /> </CardFooter>
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
            const imageUrl = course.featuredImageUrl || (course as Course).imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(course.title)}`;
            return (
              <Card key={course.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)]">
                <CardHeader className="p-0">
                  <div className="relative aspect-video w-full">
                    <Image
                      src={imageUrl}
                      alt={course.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="bg-muted object-cover object-top"
                      data-ai-hint="course cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = `https://placehold.co/600x350.png?text=${encodeURIComponent(course.title)}`;
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
                           {isCompleted ? ( <span className='flex items-center gap-2'> <Eye className="h-4 w-4" /> View Course </span> )
                                        : ( <span className='flex items-center gap-2'> <PlayCircle className="h-4 w-4" /> {course.status === 'Not Started' ? 'Start Learning' : 'Continue Learning'} </span> )}
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

    