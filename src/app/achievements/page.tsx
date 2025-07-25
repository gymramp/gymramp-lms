
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as DialogUITitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpen, Star, Trophy, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course, BrandCourse } from '@/types/course';
import type { User, Company } from '@/types/user';
import { getUserByEmail, getUserCourseProgress } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import { getCourseById } from '@/lib/firestore-data';
import { getBrandCourseById } from '@/lib/brand-content-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { CourseCertificate } from '@/components/learn/CourseCertificate';
import { BadgeCard, type BadgeInfo } from '@/components/gamification/BadgeCard';
import { getBadgesForUser } from '@/lib/gamification';

type CompletedCourseDisplay = (Course | BrandCourse) & {
    completionDate: Date | null;
    effectiveCourseId: string;
};

export default function MyAchievementsPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userBrand, setUserBrand] = useState<Company | null>(null);
    const [completedCourses, setCompletedCourses] = useState<CompletedCourseDisplay[]>([]);
    const [earnedBadges, setEarnedBadges] = useState<BadgeInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [selectedCertificate, setSelectedCertificate] = useState<CompletedCourseDisplay | null>(null);
    const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser?.email) {
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
                setCurrentUser(null);
            }
        });
        return () => unsubscribe();
    }, [toast]);

    const fetchAchievements = useCallback(async () => {
        if (!currentUser?.id) {
            setCompletedCourses([]);
            setEarnedBadges([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // Fetch completed courses for certificates
            const assignedCourseIds = Array.isArray(currentUser.assignedCourseIds) ? currentUser.assignedCourseIds : [];
            const coursesDataPromises = assignedCourseIds.map(async (courseId) => {
                let courseData: Course | BrandCourse | null = await getCourseById(courseId) || await getBrandCourseById(courseId);
                if (!courseData) return null;
                const progressData = await getUserCourseProgress(currentUser.id, courseId);
                if (progressData.status === 'Completed') {
                    return { ...courseData, completionDate: new Date(progressData.lastUpdated as string), effectiveCourseId: courseId };
                }
                return null;
            });
            const fetchedCompletedCourses = (await Promise.all(coursesDataPromises)).filter(Boolean) as CompletedCourseDisplay[];
            setCompletedCourses(fetchedCompletedCourses);

            // Fetch earned badges
            const badges = await getBadgesForUser(currentUser);
            setEarnedBadges(badges);

        } catch (error) {
            console.error("Error loading achievements:", error);
            toast({ title: "Error", description: "Could not load your achievements.", variant: "destructive" });
            setCompletedCourses([]);
            setEarnedBadges([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, toast]);

    useEffect(() => {
        if (currentUser) {
            fetchAchievements();
        } else {
            setIsLoading(false);
        }
    }, [currentUser, fetchAchievements]);

    const handleViewCertificate = (course: CompletedCourseDisplay) => {
        setSelectedCertificate(course);
        setIsCertificateDialogOpen(true);
    };

    const hasAchievements = completedCourses.length > 0 || earnedBadges.length > 0;

    return (
        <div className="container mx-auto">
            <div className="mb-12 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
                    My Achievements
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-muted-foreground md:text-xl">
                    View your earned badges and course completion certificates.
                </p>
            </div>
            
            {isLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
                 </div>
            ) : !hasAchievements ? (
                <div className="text-center py-16">
                    <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-foreground">No Achievements Yet</p>
                    <p className="text-muted-foreground mt-2">Start learning to earn badges and certificates!</p>
                    <Button variant="link" asChild className="mt-4"><Link href="/courses/my-courses">Go to My Learning</Link></Button>
                </div>
            ) : (
                <div className="space-y-12">
                    {earnedBadges.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-primary mb-6 flex items-center gap-2">
                                <Sparkles className="h-6 w-6" /> Badges
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                                {earnedBadges.map((badge, index) => (
                                    <BadgeCard key={index} badge={badge} />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {completedCourses.length > 0 && (
                         <div>
                            <h2 className="text-2xl font-bold tracking-tight text-primary mb-6 flex items-center gap-2">
                                <Award className="h-6 w-6" /> Certificates
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {completedCourses.map((course) => (
                                <Card key={course.effectiveCourseId} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                                    {course.featuredImageUrl || course.imageUrl ? (
                                        <div className="relative aspect-video w-full"><Image src={course.featuredImageUrl || course.imageUrl || ''} alt={course.title} fill style={{ objectFit: 'cover' }} className="bg-muted" data-ai-hint="course certificate" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x350.png?text=${encodeURIComponent(course.title)}`; }}/></div>
                                    ) : (
                                        <div className="aspect-video w-full bg-muted flex items-center justify-center"><Award className="h-16 w-16 text-muted-foreground" /></div>
                                    )}
                                    <CardContent className="p-4 flex-grow flex flex-col">
                                        <CardTitle className="text-lg font-semibold line-clamp-2 mb-1">{course.title}</CardTitle>
                                        <p className="text-xs text-muted-foreground">Completed: {course.completionDate?.toLocaleDateString()}</p>
                                        <div className="mt-auto pt-3"><Button onClick={() => handleViewCertificate(course)} className="w-full">View Certificate</Button></div>
                                    </CardContent>
                                </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedCertificate && currentUser && (
                <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
                     <DialogHeader className="p-6 print-hide"><DialogUITitle>Course Certificate</DialogUITitle><DialogDescription>Congratulations on completing {selectedCertificate.title}!</DialogDescription></DialogHeader>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden print-content"><CourseCertificate courseName={selectedCertificate.title} userName={currentUser.name} completionDate={selectedCertificate.completionDate || new Date()} brandName={userBrand?.name} brandLogoUrl={userBrand?.logoUrl} /></DialogContent>
                </Dialog>
            )}
        </div>
    );
}

