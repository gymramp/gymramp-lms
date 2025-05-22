
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as DialogUITitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';
import type { User, UserCourseProgressData, Company } from '@/types/user';
import { getUserByEmail, getUserCourseProgress, getCompanyById } from '@/lib/user-data';
import { getCourseById } from '@/lib/firestore-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { CourseCertificate } from '@/components/learn/CourseCertificate'; // Import the certificate component

// Type for course with completion data
type CompletedCourse = Course & {
    completionDate: Date | null;
    // courseId for linking, as Course might be global or brand-specific
    effectiveCourseId: string;
};

export default function MyCertificatesPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userBrand, setUserBrand] = useState<Company | null>(null);
    const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [selectedCertificate, setSelectedCertificate] = useState<CompletedCourse | null>(null);
    const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);


    // Effect 1: Handle Auth State Change and Set User
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    setCurrentUser(userDetails);
                    if (userDetails?.companyId) {
                        const brand = await getCompanyById(userDetails.companyId);
                        setUserBrand(brand);
                    }
                } catch (error) {
                    setCurrentUser(null); setUserBrand(null);
                    toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
                }
            } else {
                setCurrentUser(null); setUserBrand(null);
            }
            setIsLoading(false);
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
                // TODO: Logic to differentiate between global and brand-specific courses if needed
                // For now, assumes all assignedCourseIds refer to global courses
                const course = await getCourseById(courseId);
                if (!course) return null;

                const progressData = await getUserCourseProgress(userId, courseId);
                 if (progressData.status === 'Completed') {
                    const completionDateObject = progressData.lastUpdated instanceof Timestamp
                        ? progressData.lastUpdated.toDate()
                        : progressData.lastUpdated instanceof Date
                            ? progressData.lastUpdated
                            : null;

                    return { ...course, completionDate: completionDateObject, effectiveCourseId: courseId };
                }
                return null;
            });

            const fetchedCompletedCourses = (await Promise.all(coursesDataPromises))
                .filter(Boolean) as CompletedCourse[];

            setCompletedCourses(fetchedCompletedCourses);

        } catch (error) {
            toast({ title: "Error", description: "Could not load completed courses.", variant: "destructive" });
            setCompletedCourses([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, toast]);

    useEffect(() => {
        if (currentUser?.id) {
            fetchCompletedCourses(currentUser.id);
        } else if (currentUser === null && !isLoading) { // Ensure it runs only after auth check
             setCompletedCourses([]);
        }
    }, [currentUser, isLoading, fetchCompletedCourses]);

    const handleViewCertificate = (course: CompletedCourse) => {
        setSelectedCertificate(course);
        setIsCertificateDialogOpen(true);
    };

    return (
        <div className="container mx-auto py-12 md:py-16 lg:py-20">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
                    My Certificates
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-muted-foreground md:text-xl">
                    View and print certificates for your completed courses.
                </p>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                           <Skeleton className="h-40 w-full" />
                           <CardContent className="p-4">
                             <Skeleton className="h-5 w-3/4 mb-2" />
                             <Skeleton className="h-4 w-1/2" />
                           </CardContent>
                        </Card>
                    ))}
                </div>
            ) : completedCourses.length === 0 ? (
                <div className="text-center py-16">
                    <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-foreground">No Certificates Earned Yet</p>
                    <p className="text-muted-foreground mt-2">Complete courses in "My Learning" to earn certificates.</p>
                    <Button variant="link" asChild className="mt-4">
                        <Link href="/courses/my-courses">Go to My Learning</Link>
                    </Button>
                </div>
            ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedCourses.map((course) => (
                       <Card key={course.effectiveCourseId} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                            {course.featuredImageUrl || course.imageUrl ? (
                                <div className="relative aspect-video w-full">
                                <Image
                                    src={course.featuredImageUrl || course.imageUrl}
                                    alt={course.title}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    className="bg-muted"
                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x350.png?text=Course`; }}
                                />
                                </div>
                            ) : (
                                <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                    <Award className="h-16 w-16 text-muted-foreground" />
                                </div>
                            )}
                            <CardContent className="p-4 flex-grow flex flex-col">
                                <CardTitle className="text-lg font-semibold line-clamp-2 mb-1">{course.title}</CardTitle>
                                {course.completionDate && (
                                    <p className="text-xs text-muted-foreground">
                                        Completed: {course.completionDate.toLocaleDateString()}
                                    </p>
                                )}
                                <div className="mt-auto pt-3">
                                <Button onClick={() => handleViewCertificate(course)} className="w-full">
                                    View Certificate
                                </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {selectedCertificate && currentUser && (
                <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden print-content">
                        <CourseCertificate
                            courseName={selectedCertificate.title}
                            userName={currentUser.name}
                            completionDate={selectedCertificate.completionDate || new Date()}
                            brandName={userBrand?.name}
                            brandLogoUrl={userBrand?.logoUrl}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
