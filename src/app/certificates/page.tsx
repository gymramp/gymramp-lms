
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as DialogUITitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course, BrandCourse } from '@/types/course';
import type { User, UserCourseProgressData, Company } from '@/types/user';
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; // Corrected import
import { getCourseById } from '@/lib/firestore-data';
import { getBrandCourseById } from '@/lib/brand-content-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { CourseCertificate } from '@/components/learn/CourseCertificate';

type CompletedCourseDisplay = (Course | BrandCourse) & {
    completionDate: Date | null;
    effectiveCourseId: string; // To distinguish if it was a global or brand course ID
};

export default function MyCertificatesPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userBrand, setUserBrand] = useState<Company | null>(null);
    const [completedCourses, setCompletedCourses] = useState<CompletedCourseDisplay[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [selectedCertificate, setSelectedCertificate] = useState<CompletedCourseDisplay | null>(null);
    const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);

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
        });
        return () => unsubscribe();
    }, [toast]);

    const fetchCompletedCourses = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            const userDetails = currentUser; // Use state currentUser
            if (!userDetails?.id) {
                 setCompletedCourses([]);
                 setIsLoading(false);
                 return;
            }

            // Ensure assignedCourseIds exists and is an array before mapping
            const assignedCourseIds = Array.isArray(userDetails.assignedCourseIds) ? userDetails.assignedCourseIds : [];

            if (assignedCourseIds.length === 0) {
                setCompletedCourses([]);
                setIsLoading(false);
                return;
            }

            const coursesDataPromises = assignedCourseIds.map(async (courseId) => {
                let courseData: Course | BrandCourse | null = null;

                // Try fetching as global course first
                courseData = await getCourseById(courseId);
                if (!courseData) {
                    // If not found as global, try as brand course
                    courseData = await getBrandCourseById(courseId);
                }

                if (!courseData) {
                    console.warn(`Course or BrandCourse with ID ${courseId} not found for user ${userId}.`);
                    return null;
                }

                const progressData = await getUserCourseProgress(userId, courseId);
                if (progressData.status === 'Completed') {
                    const completionDateObject = progressData.lastUpdated instanceof Timestamp
                        ? progressData.lastUpdated.toDate()
                        : progressData.lastUpdated instanceof Date
                            ? progressData.lastUpdated
                            : null;
                    return { ...courseData, completionDate: completionDateObject, effectiveCourseId: courseId };
                }
                return null;
            });

            const fetchedCompletedCourses = (await Promise.all(coursesDataPromises))
                .filter(Boolean) as CompletedCourseDisplay[];

            setCompletedCourses(fetchedCompletedCourses);

        } catch (error) {
            console.error("Error loading completed courses:", error);
            toast({ title: "Error", description: "Could not load completed courses.", variant: "destructive" });
            setCompletedCourses([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, toast]); // currentUser is the dependency here

    useEffect(() => {
        if (currentUser?.id) {
            fetchCompletedCourses(currentUser.id);
        } else if (!isLoading && !currentUser) { // Ensure isLoading is false before deciding no user
             setCompletedCourses([]);
             setIsLoading(false); // Make sure loading is set to false if there's no user
        }
    }, [currentUser, isLoading, fetchCompletedCourses]);

    const handleViewCertificate = (course: CompletedCourseDisplay) => {
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
                                    src={course.featuredImageUrl || course.imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(course.title)}`}
                                    alt={course.title}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    className="bg-muted"
                                    data-ai-hint="course certificate"
                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x350.png?text=${encodeURIComponent(course.title)}`; }}
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
                     <DialogHeader className="p-6 print-hide">
                        <DialogUITitle>Course Certificate</DialogUITitle>
                        <DialogDescription>
                            Congratulations on completing {selectedCertificate.title}!
                        </DialogDescription>
                    </DialogHeader>
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
