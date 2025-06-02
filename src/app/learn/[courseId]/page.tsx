
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle as DialogUITitle, DialogDescription as DialogUIDescription } from '@/components/ui/dialog';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Lock, PlayCircle, FileText, HelpCircle, ChevronLeft, ChevronRight, Menu, Award, MousePointerClick, Video as VideoIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getCourseById, getLessonById, getQuizById } from '@/lib/firestore-data';
import { getBrandCourseById, getBrandLessonById, getBrandQuizById } from '@/lib/brand-content-data';
import type { Course, Lesson, Quiz, BrandCourse, BrandLesson, BrandQuiz } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail, getUserCourseProgress, updateEmployeeProgress, updateUserVideoProgress } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import type { User, UserCourseProgressData, Company } from '@/types/user';
import { QuizTaking } from '@/components/learn/QuizTaking';
import { CourseCertificate } from '@/components/learn/CourseCertificate';
import { cn } from '@/lib/utils';
import type { Timestamp } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type CurriculumDisplayItem = {
    id: string;
    type: 'lesson' | 'quiz' | 'brandLesson' | 'brandQuiz';
    data: Lesson | Quiz | BrandLesson | BrandQuiz & { timedEvents?: Array<{ timestamp: number; type: 'quiz'; quizId: string; eventId: string }> };
};

const SCRUB_TOLERANCE = 2; // seconds
const SAVE_PROGRESS_INTERVAL = 5000; // 5 seconds

export default function LearnCoursePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | BrandCourse | null>(null);
    const [certificateBrandDetails, setCertificateBrandDetails] = useState<Company | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userBrandDetails, setUserBrandDetails] = useState<Company | null>(null);
    const [curriculumItems, setCurriculumItems] = useState<CurriculumDisplayItem[]>([]);
    const [currentContentItem, setCurrentContentItem] = useState<CurriculumDisplayItem | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userProgressData, setUserProgressData] = useState<UserCourseProgressData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [completedItemIds, setCompletedItemIds] = useState<string[]>([]);
    const [isVideoWatched, setIsVideoWatched] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showCertificateDialog, setShowCertificateDialog] = useState(false);
    const [hasShownInitialCertificate, setHasShownInitialCertificate] = useState(false);
    const [isBrandSpecificCourse, setIsBrandSpecificCourse] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const [highestWatchedTime, setHighestWatchedTime] = useState(0);
    const [lastSavedVideoTime, setLastSavedVideoTime] = useState<number | null>(null);
    const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State for timed quizzes
    const [showTimedQuizModal, setShowTimedQuizModal] = useState(false);
    const [currentTimedQuizData, setCurrentTimedQuizData] = useState<Quiz | BrandQuiz | null>(null);
    const [triggeredEventIds, setTriggeredEventIds] = useState<Set<string>>(new Set());
    const [isLoadingTimedQuiz, setIsLoadingTimedQuiz] = useState(false);

    const isVideoLesson = currentContentItem?.type === 'lesson' || currentContentItem?.type === 'brandLesson';
    const isCurrentUserOnTrial = !!userBrandDetails?.isTrial;

    useEffect(() => {
        setIsMounted(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    setCurrentUser(userDetails);
                } catch (error) {
                    setCurrentUser(null); router.push('/login');
                }
            } else {
                setCurrentUser(null); router.push('/login');
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadCourseData = useCallback(async (userId: string, userCompanyId?: string | null) => {
        if (!courseId) { setIsLoading(false); return; }
        setIsLoading(true);
        setHasShownInitialCertificate(false);
        try {
            let fetchedCourseData: Course | BrandCourse | null = null;
            let isBrandCourse = false;

            if (userCompanyId) {
                const brandData = await getCompanyById(userCompanyId);
                setUserBrandDetails(brandData);
            } else {
                setUserBrandDetails(null);
            }

            fetchedCourseData = await getCourseById(courseId);
            if (!fetchedCourseData) {
                fetchedCourseData = await getBrandCourseById(courseId);
                if (fetchedCourseData) isBrandCourse = true;
            }
            setIsBrandSpecificCourse(isBrandCourse);

            if (fetchedCourseData) {
                setCourse(fetchedCourseData);
                if (fetchedCourseData.isDeleted) {
                    toast({ title: "Course Unavailable", description: "This course is no longer available.", variant: "destructive" });
                    router.push('/courses/my-courses'); setIsLoading(false); return;
                }

                let brandIdForCertificate: string | null = null;
                if (isBrandCourse && (fetchedCourseData as BrandCourse).brandId) brandIdForCertificate = (fetchedCourseData as BrandCourse).brandId;
                else if (userCompanyId) brandIdForCertificate = userCompanyId;

                if (brandIdForCertificate) {
                    const certBrand = await getCompanyById(brandIdForCertificate);
                    setCertificateBrandDetails(certBrand);
                } else {
                    setCertificateBrandDetails(null);
                }

                const allItemsMap = new Map<string, CurriculumDisplayItem>();
                for (const prefixedId of (fetchedCourseData.curriculum || [])) {
                    const [typePrefix, id] = prefixedId.split('-');
                    let itemData: Lesson | Quiz | BrandLesson | BrandQuiz | null = null;
                    let itemType: CurriculumDisplayItem['type'] = typePrefix as CurriculumDisplayItem['type'];
                    if (isBrandCourse) {
                        if (typePrefix === 'brandLesson') itemData = await getBrandLessonById(id);
                        else if (typePrefix === 'brandQuiz') itemData = await getBrandQuizById(id);
                        else { // Fallback to global if mixed curriculum is possible (though unlikely for brand course)
                            if (typePrefix === 'lesson') itemData = await getLessonById(id);
                            else if (typePrefix === 'quiz') itemData = await getQuizById(id);
                            itemType = typePrefix as 'lesson' | 'quiz';
                        }
                    } else { // Global course
                        if (typePrefix === 'lesson') itemData = await getLessonById(id);
                        else if (typePrefix === 'quiz') itemData = await getQuizById(id);
                        itemType = typePrefix as 'lesson' | 'quiz';
                    }
                    if (itemData) allItemsMap.set(prefixedId, { id: prefixedId, type: itemType, data: itemData as CurriculumDisplayItem['data'] });
                }
                const orderedItems = (fetchedCourseData.curriculum || []).map(id => allItemsMap.get(id)).filter(Boolean) as CurriculumDisplayItem[];
                setCurriculumItems(orderedItems);

                const progressData = await getUserCourseProgress(userId, courseId);
                setUserProgressData(progressData);
                setCompletedItemIds(progressData.completedItems || []);
                setTriggeredEventIds(new Set()); // Reset session-based triggered events

                let initialItemIndex = 0;
                if (orderedItems.length > 0) {
                    if (progressData.status !== 'Completed') {
                        const firstUncompletedIndex = orderedItems.findIndex(item => !(progressData.completedItems || []).includes(item.id));
                        initialItemIndex = firstUncompletedIndex !== -1 ? firstUncompletedIndex : Math.max(0, orderedItems.length - 1);
                    } else {
                         initialItemIndex = 0;
                    }
                }
                setCurrentContentItem(orderedItems[initialItemIndex] || null);
                setCurrentIndex(initialItemIndex);

            } else {
                toast({ title: "Error", description: "Course not found.", variant: "destructive" });
                router.push('/courses/my-courses');
            }
        } catch (error) {
            console.error("Error loading course data:", error);
            toast({ title: "Error", description: "Could not load course data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, router, toast]);

    useEffect(() => {
        if (currentUser?.id) {
            loadCourseData(currentUser.id, currentUser.companyId);
        }
    }, [currentUser, courseId, loadCourseData]);

    const isCourseCompleted = userProgressData?.status === "Completed";

    useEffect(() => {
        setIsVideoWatched(false);
        setHighestWatchedTime(0);
        setLastSavedVideoTime(null);
        if (saveProgressTimeoutRef.current) {
            clearTimeout(saveProgressTimeoutRef.current);
            saveProgressTimeoutRef.current = null;
        }
        setTriggeredEventIds(new Set()); // Reset triggered events when content item changes

        if (currentContentItem && (currentContentItem.type === 'lesson' || currentContentItem.type === 'brandLesson')) {
            const videoData = currentContentItem.data as Lesson | BrandLesson;
            if (videoData.videoUrl && userProgressData?.videoProgress) {
                const savedTime = userProgressData.videoProgress[currentContentItem.id] ?? 0;
                setHighestWatchedTime(savedTime);
                setLastSavedVideoTime(savedTime);
                if (videoRef.current) {
                    videoRef.current.currentTime = savedTime;
                }
            }
            if (completedItemIds.includes(currentContentItem.id)) {
                setIsVideoWatched(true);
            }
        } else {
            setIsVideoWatched(true);
        }
    }, [currentContentItem, userProgressData, completedItemIds]);


    const saveCurrentVideoProgress = useCallback(async (timeToSave?: number) => {
        if (!isMounted || !currentUser?.id || !courseId || !currentContentItem || !isVideoLesson) return;
        const videoElement = videoRef.current;
        const actualTimeToSave = typeof timeToSave === 'number' ? timeToSave : videoElement?.currentTime;

        if (typeof actualTimeToSave !== 'number' || isNaN(actualTimeToSave)) return;
        
        const lastSaved = lastSavedVideoTime ?? -SAVE_PROGRESS_INTERVAL; 
        if (typeof timeToSave === 'number' || Math.abs(actualTimeToSave - lastSaved) >= (SAVE_PROGRESS_INTERVAL / 1000 - 1) ) {
            try {
                await updateUserVideoProgress(currentUser.id, courseId, currentContentItem.id, actualTimeToSave);
                setLastSavedVideoTime(actualTimeToSave);
            } catch (error) {
                console.error("Failed to save video progress:", error);
            }
        }
    }, [currentUser, courseId, currentContentItem, isVideoLesson, lastSavedVideoTime, isMounted]);

    const handleItemCompletion = useCallback(async (itemIdToComplete: string): Promise<boolean> => {
        if (!currentUser?.id || !courseId || !itemIdToComplete) return false;
        const overallIndex = curriculumItems.findIndex(item => item.id === itemIdToComplete);
        if (overallIndex === -1) return false;

        if (!completedItemIds.includes(itemIdToComplete) || isCourseCompleted) {
            try {
                await updateEmployeeProgress(currentUser.id, courseId, overallIndex);
                const updatedProgressData = await getUserCourseProgress(currentUser.id, courseId);
                setUserProgressData(updatedProgressData);
                setCompletedItemIds(updatedProgressData.completedItems || []);

                if (updatedProgressData.status === "Completed" && !isCourseCompleted && !hasShownInitialCertificate) {
                    toast({ title: "Course Complete!", description: `Congratulations on finishing ${course?.title}!`, variant: "success", duration: 7000 });
                    setShowCertificateDialog(true); 
                    setHasShownInitialCertificate(true);
                }
                return true;
            } catch (error) {
                toast({ title: "Error", description: "Could not update your progress.", variant: "destructive"});
                return false;
            }
        } else {
            return true;
        }
    }, [currentUser?.id, courseId, curriculumItems, toast, isCourseCompleted, hasShownInitialCertificate, course?.title, completedItemIds]);

    const isItemLocked = useCallback((itemIndex: number) => {
        if (isCurrentUserOnTrial) return false;
        if (isCourseCompleted) return false; 
        if (itemIndex === 0) return false;
        for (let i = 0; i < itemIndex; i++) {
            if (!completedItemIds.includes(curriculumItems[i].id)) return true;
        }
        return false;
    }, [completedItemIds, curriculumItems, isCourseCompleted, isCurrentUserOnTrial]);

    const handleContentSelection = (item: CurriculumDisplayItem, index: number) => {
        if (isItemLocked(index) && !completedItemIds.includes(item.id) && currentContentItem?.id !== item.id) {
            toast({ title: "Locked Content", description: "Please complete the previous items first.", variant: "default" });
            return;
        }
        setCurrentContentItem(item); setCurrentIndex(index); setIsSidebarOpen(false);
    };

    const advanceToNextItem = useCallback(async () => {
        if (!currentUser?.id) return;
        const nextItemIndex = currentIndex + 1;
        if (nextItemIndex < curriculumItems.length) {
            if (!isItemLocked(nextItemIndex) || isCourseCompleted) {
                setCurrentContentItem(curriculumItems[nextItemIndex]); setCurrentIndex(nextItemIndex);
            } else {
                toast({ title: "Next Item Locked", description: "Complete the current item to proceed.", variant: "default" });
            }
        } else { 
            const finalProgress = await getUserCourseProgress(currentUser.id, courseId); 
            setUserProgressData(finalProgress);
            setCompletedItemIds(finalProgress.completedItems || []);
            if (finalProgress.status === "Completed") {
                 if (!hasShownInitialCertificate) {
                     toast({ title: "Course Complete!", description: `Congratulations on finishing ${course?.title}!`, variant: "success", duration: 7000 });
                     setShowCertificateDialog(true); 
                     setHasShownInitialCertificate(true);
                 } else {
                    setShowCertificateDialog(true); 
                 }
            }
        }
    }, [currentIndex, curriculumItems, isItemLocked, toast, currentUser, courseId, course?.title, hasShownInitialCertificate, isCourseCompleted]);


    const handleMainActionClick = async () => {
        if (!currentContentItem || !currentContentItem.id || !currentUser?.id) return;

        const isCurrentItemCompleted = completedItemIds.includes(currentContentItem.id);
        const isLastItem = currentIndex === curriculumItems.length - 1;

        if (currentContentItem.type === 'lesson' || currentContentItem.type === 'brandLesson') {
            const lessonData = currentContentItem.data as (Lesson | BrandLesson);
            const hasVideo = !!lessonData.videoUrl;

            if (isCourseCompleted) { 
                if (isLastItem) { setShowCertificateDialog(true); setHasShownInitialCertificate(true); }
                else { advanceToNextItem(); }
                return;
            }

            if (!isCurrentItemCompleted) {
                if (hasVideo && !isVideoWatched && !isCurrentUserOnTrial) {
                    toast({ title: "Video Not Watched", description: "Please watch the entire video.", variant: "default"}); return;
                }
                if (await handleItemCompletion(currentContentItem.id)) {
                    if (isLastItem) { 
                        const finalProgress = await getUserCourseProgress(currentUser.id, courseId);
                        if (finalProgress.status === "Completed") { 
                           if (!hasShownInitialCertificate) { setShowCertificateDialog(true); setHasShownInitialCertificate(true); }
                        }
                    } else {
                        advanceToNextItem();
                    }
                }
            } else { 
                advanceToNextItem();
            }
        } else if (currentContentItem.type === 'quiz' || currentContentItem.type === 'brandQuiz') {
            if (isCurrentItemCompleted || isCourseCompleted) {
                if (isLastItem) { setShowCertificateDialog(true); setHasShownInitialCertificate(true); }
                else { advanceToNextItem(); }
            }
        }
    };

    const handleQuizComplete = async (quizId: string, score: number, passed: boolean) => {
        if (!currentContentItem || !currentContentItem.id || !currentUser?.id) return;
        const currentItemFullId = currentContentItem.id;
        if (passed) {
            if (!completedItemIds.includes(currentItemFullId) || isCourseCompleted) {
                if (await handleItemCompletion(currentItemFullId)) {
                    if (currentIndex < curriculumItems.length - 1 || !isCourseCompleted) {
                        advanceToNextItem();
                    }
                }
            } else { 
                advanceToNextItem();
            }
        } else {
            toast({ title: "Quiz Failed", description: "Please review the material and try the quiz again.", variant: "destructive" });
        }
    };

    const handleTimedQuizComplete = async (timedQuizId: string, score: number, passed: boolean) => {
        setShowTimedQuizModal(false);
        setCurrentTimedQuizData(null);
        if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => console.warn("Failed to auto-resume video:", err));
        }
        // Optionally, record timed quiz attempt or do something based on pass/fail
        toast({ title: passed ? "Quiz Submitted" : "Quiz Attempted", description: passed ? `You passed the pop-up quiz!` : `You attempted the pop-up quiz.`, variant: passed ? "success" : "default" });
    };


    const handlePrevious = () => {
        const prevItemIndex = currentIndex - 1;
        if (prevItemIndex >= 0) { setCurrentContentItem(curriculumItems[prevItemIndex]); setCurrentIndex(prevItemIndex); setIsSidebarOpen(false); }
    };

    const handleVideoLoadedMetadata = useCallback(() => {
        if (videoRef.current && currentContentItem && (currentContentItem.type === 'lesson' || currentContentItem.type === 'brandLesson') && userProgressData?.videoProgress) {
            const savedTime = userProgressData.videoProgress[currentContentItem.id] ?? 0;
            if (videoRef.current.readyState >= 1) { 
                if (Math.abs(videoRef.current.currentTime - savedTime) > 0.5) {
                     videoRef.current.currentTime = savedTime;
                }
            }
            setHighestWatchedTime(savedTime);
            setLastSavedVideoTime(savedTime);
        }
    }, [currentContentItem, userProgressData]);

    const handleVideoTimeUpdate = useCallback(async () => {
        if (videoRef.current && isVideoLesson && currentContentItem) {
            const currentTime = videoRef.current.currentTime;
            const duration = videoRef.current.duration;

            // Timed events logic
            const lessonData = currentContentItem.data as (Lesson | BrandLesson & { timedEvents?: Array<{ timestamp: number; type: 'quiz'; quizId: string; eventId: string }> });
            if (lessonData.timedEvents && !showTimedQuizModal) {
                for (const event of lessonData.timedEvents) {
                    if (currentTime >= event.timestamp && !triggeredEventIds.has(event.eventId)) {
                        if (videoRef.current && !videoRef.current.paused) {
                             videoRef.current.pause();
                        }
                        setTriggeredEventIds(prev => new Set(prev).add(event.eventId));
                        setIsLoadingTimedQuiz(true);
                        try {
                            let quizData: Quiz | BrandQuiz | null = null;
                            // Determine if it's a global quiz or brand quiz based on current course type
                            if (isBrandSpecificCourse || currentContentItem.type === 'brandLesson') { // Assume timed quizzes for brand lessons are brand quizzes
                                quizData = await getBrandQuizById(event.quizId);
                            } else {
                                quizData = await getQuizById(event.quizId);
                            }
                            if (quizData) {
                                setCurrentTimedQuizData(quizData);
                                setShowTimedQuizModal(true);
                            } else {
                                console.warn(`Timed quiz with ID ${event.quizId} not found.`);
                                toast({ title: "Error", description: "Could not load timed quiz.", variant: "destructive"});
                            }
                        } catch (err) {
                             console.error("Error fetching timed quiz:", err);
                             toast({ title: "Error", description: "Failed to load timed quiz.", variant: "destructive"});
                        } finally {
                            setIsLoadingTimedQuiz(false);
                        }
                        break; 
                    }
                }
            }


            if (!isNaN(duration)) {
                setHighestWatchedTime((prev) => Math.max(prev, currentTime));
                if (currentTime >= duration - 1.5 && !isVideoWatched && !completedItemIds.includes(currentContentItem.id)) {
                    setIsVideoWatched(true);
                }
            }
            if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
            saveProgressTimeoutRef.current = setTimeout(() => {
                saveCurrentVideoProgress();
            }, SAVE_PROGRESS_INTERVAL);
        }
    }, [isVideoLesson, isVideoWatched, completedItemIds, currentContentItem, saveCurrentVideoProgress, showTimedQuizModal, triggeredEventIds, isBrandSpecificCourse, toast]);

    const handleVideoSeeking = useCallback(() => {
        if (videoRef.current && isVideoLesson && !isCurrentUserOnTrial) {
            const intendedSeekTime = videoRef.current.currentTime;
            if (intendedSeekTime > highestWatchedTime + SCRUB_TOLERANCE && !isCourseCompleted) {
                videoRef.current.currentTime = highestWatchedTime;
            }
        }
    }, [isVideoLesson, highestWatchedTime, isCourseCompleted, isCurrentUserOnTrial]);

    const handleVideoEnded = useCallback(() => {
        if (currentContentItem && isVideoLesson) {
            setIsVideoWatched(true);
            if (videoRef.current) {
                const duration = videoRef.current.duration;
                if (!isNaN(duration)) {
                    setHighestWatchedTime(duration);
                    saveCurrentVideoProgress(duration); 
                }
            }
            if(!completedItemIds.includes(currentContentItem.id)) {
                toast({ title: "Video Watched", description: "You can now mark this lesson as complete.", variant: "success" });
            }
        }
    }, [currentContentItem, completedItemIds, saveCurrentVideoProgress, toast, isVideoLesson]);

    const handleVideoPause = useCallback(() => {
        saveCurrentVideoProgress();
    }, [saveCurrentVideoProgress]);

     useEffect(() => {
        const video = videoRef.current;
        if (isVideoLesson && video) {
            video.addEventListener('loadedmetadata', handleVideoLoadedMetadata);
            video.addEventListener('timeupdate', handleVideoTimeUpdate);
            video.addEventListener('seeking', handleVideoSeeking);
            video.addEventListener('ended', handleVideoEnded);
            video.addEventListener('pause', handleVideoPause);

            return () => {
                video.removeEventListener('loadedmetadata', handleVideoLoadedMetadata);
                video.removeEventListener('timeupdate', handleVideoTimeUpdate);
                video.removeEventListener('seeking', handleVideoSeeking);
                video.removeEventListener('ended', handleVideoEnded);
                video.removeEventListener('pause', handleVideoPause);
                if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
                if (!video.paused) saveCurrentVideoProgress();
            };
        }
         if (!isVideoLesson && saveProgressTimeoutRef.current) {
            clearTimeout(saveProgressTimeoutRef.current);
        }
    }, [isVideoLesson, handleVideoLoadedMetadata, handleVideoTimeUpdate, handleVideoSeeking, handleVideoEnded, handleVideoPause, saveCurrentVideoProgress]);


    const getButtonState = () => {
        if (!currentContentItem) return { text: "Loading...", disabled: true, variant: "default" as const };
        const isCurrentItemCompleted = completedItemIds.includes(currentContentItem.id);
        const isLastItem = currentIndex === curriculumItems.length - 1;
        
        if (currentContentItem.type === 'lesson' || currentContentItem.type === 'brandLesson') {
            const lessonData = currentContentItem.data as (Lesson | BrandLesson);
            const hasVideo = !!lessonData.videoUrl;
            const videoCompletionRequired = hasVideo && !isVideoWatched && !isCurrentItemCompleted && !isCourseCompleted && !isCurrentUserOnTrial;

            if (isCourseCompleted) return { text: isLastItem ? "View Certificate" : "Next Item", disabled: false, variant: "outline" as const };
            if (isCurrentItemCompleted) return { text: isLastItem ? "Finish & View Certificate" : "Next Item", disabled: false, variant: "outline" as const };
            return {
                text: isLastItem ? "Mark Complete & Finish" : "Mark Complete & Next",
                disabled: videoCompletionRequired,
                title: videoCompletionRequired ? "Please watch the video to enable completion." : undefined,
                variant: "default" as const
            };
        }
        if (currentContentItem.type === 'quiz' || currentContentItem.type === 'brandQuiz') {
            if (isCourseCompleted) return { text: isLastItem ? "View Certificate" : "Next Item", disabled: false, variant: "outline" as const };
            if (isCurrentItemCompleted) return { text: isLastItem ? "Finish Course" : "Next Item", disabled: false, variant: "outline" as const };
            return { text: "Complete Quiz Above to Proceed", disabled: true, variant: "secondary" as const };
        }
        return { text: "Next Item", disabled: false, variant: "default" as const };
    };
    const { text: buttonText, disabled: isButtonDisabled, title: buttonTitle, variant: buttonVariant } = getButtonState();

    const renderContent = () => {
        if (isLoading || !currentUser) return ( <div className="p-6 text-center"> <Skeleton className="h-8 w-1/2 mx-auto mb-4" /> <Skeleton className="aspect-video w-full my-6 rounded-lg" /> <Skeleton className="h-4 w-full my-2" /> <Skeleton className="h-4 w-5/6 my-2" /> </div> );
        if (isCourseCompleted && !currentContentItem && isMounted && curriculumItems.length > 0) return ( <div className="p-6 text-center flex flex-col items-center justify-center h-full"> <Award className="h-16 w-16 text-green-500 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Course Completed!</h2> <p className="text-muted-foreground">You've successfully finished "{course?.title}". You can review any part of the course.</p> <Button onClick={() => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);}} variant="default" className="mt-4">View Certificate</Button> <Button asChild variant="link" className="mt-2"><Link href="/courses/my-courses">Back to My Learning</Link></Button> </div> );
        if (!currentContentItem && curriculumItems.length > 0 && isMounted) return ( <div className="p-6 text-muted-foreground text-center flex flex-col items-center justify-center h-full"> <MousePointerClick className="h-12 w-12 text-primary mb-4" /> <h2 className="text-xl font-semibold mb-2">Select an Item</h2> <p>Please choose an item from the sidebar to start learning.</p> </div> );
        if (!currentContentItem && curriculumItems.length === 0 && isMounted) return <div className="p-6 text-center">This course has no content yet.</div>;
        if (!isMounted || !currentContentItem) return ( <div className="p-6 text-center"> <Skeleton className="h-8 w-1/2 mx-auto mb-4" /> <Skeleton className="aspect-video w-full my-6 rounded-lg" /> <Skeleton className="h-4 w-full my-2" /> <Skeleton className="h-4 w-5/6 my-2" /> </div> );

        const { type, data } = currentContentItem;
        const itemData = data as Lesson | BrandLesson | Quiz | BrandQuiz;
        const isCurrentItemCompletedForDisplay = completedItemIds.includes(currentContentItem.id);

        if (type === 'lesson' || type === 'brandLesson') {
            const lesson = itemData as (Lesson | BrandLesson);
            return ( <div className="p-4 md:p-6 lg:p-8 space-y-6"> {lesson.featuredImageUrl && ( <div className="relative aspect-video mb-6"> <Image src={lesson.featuredImageUrl} alt={`Featured image for ${lesson.title}`} fill style={{ objectFit: 'cover' }} className="rounded-lg shadow-md" priority data-ai-hint="lesson image"/> </div> )} <h2 className="text-2xl md:text-3xl font-bold text-primary">{lesson.title}</h2> {lesson.videoUrl && ( <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground mb-6 shadow overflow-hidden"> {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? ( <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${lesson.videoUrl.split('v=')[1]?.split('&')[0] || lesson.videoUrl.split('/').pop()}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe> ) : lesson.videoUrl.includes('vimeo.com') ? ( <iframe src={`https://player.vimeo.com/video/${lesson.videoUrl.split('/').pop()}`} width="100%" height="100%" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen></iframe> ) : ( <video ref={videoRef} controls src={lesson.videoUrl} className="w-full h-full object-contain" preload="metadata" onContextMenu={(e) => e.preventDefault()}> Your browser does not support the video tag. </video> )} </div> )} {!!lesson.videoUrl && !isVideoWatched && !isCourseCompleted && !isCurrentItemCompletedForDisplay && !isCurrentUserOnTrial && ( <div className="p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md text-sm flex items-center gap-2"> <VideoIcon className="h-5 w-5" /> Please watch the video to the end to enable completion. </div> )} <div className="prose prose-lg max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: lesson.content || '' }} /> {lesson.exerciseFilesInfo && ( <Card className="mt-6 bg-secondary"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Exercise Files</CardTitle></CardHeader> <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{lesson.exerciseFilesInfo.split('\n').map((file, index) => {const trimmedFile = file.trim(); if (!trimmedFile) return null; const isUrl = trimmedFile.startsWith('http://') || trimmedFile.startsWith('https://'); return (<li key={index}>{isUrl ? (<a href={trimmedFile} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{trimmedFile.split('/').pop() || trimmedFile}</a>) : (<span className="text-muted-foreground">{trimmedFile}</span>)}</li>);})}</ul></CardContent></Card>)} </div> );
        }
        if (type === 'quiz' || type === 'brandQuiz') {
            const quiz = itemData as (Quiz | BrandQuiz);
             return ( <div className="p-4 md:p-6 lg:p-8"> <QuizTaking quiz={quiz} onComplete={handleQuizComplete} isCompleted={isCurrentItemCompletedForDisplay || isCourseCompleted} /> </div> );
        }
        return null;
    };

    const sidebarContent = ( <div className="p-4 space-y-4"> <Link href="/courses/my-courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"> <ChevronLeft className="h-4 w-4 mr-1" /> Back to My Learning </Link> <h3 className="text-lg font-semibold">{course?.title}</h3> <div className="space-y-1"> <div className="flex justify-between text-xs text-muted-foreground mb-1"> <span>Overall Progress</span> <span>{userProgressData?.progress || 0}%</span> </div> <Progress value={userProgressData?.progress || 0} aria-label={`${course?.title || 'Course'} overall progress ${userProgressData?.progress || 0}%`} className="h-2"/> </div> {(isCourseCompleted || (userProgressData?.status === "Completed" && userProgressData.progress === 100)) && ( <Button onClick={() => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);}} variant="outline" className="w-full mt-2 flex items-center gap-2"> <Award className="h-4 w-4" /> View Certificate </Button> )} <h4 className="text-md font-semibold pt-2 border-t mt-4">Curriculum</h4> <ScrollArea className="h-[calc(100vh-320px)]"> <ul className="space-y-1 mt-2"> {curriculumItems.map((item, index) => { const Icon = (item.type === 'lesson' || item.type === 'brandLesson') ? FileText : HelpCircle; const isCompleted = completedItemIds.includes(item.id); const isCurrent = currentContentItem?.id === item.id; const locked = isItemLocked(index); const itemIsClickable = isCourseCompleted || isCompleted || isCurrent || !locked || isCurrentUserOnTrial; return ( <li key={item.id}> <Button variant={isCurrent ? "secondary" : "ghost"} className={cn( "w-full justify-start h-auto py-2 px-2 text-left", isCompleted && !isCurrent && 'text-green-600 hover:text-green-700', locked && !isCompleted && !isCurrent && !isCourseCompleted && !isCurrentUserOnTrial && 'text-muted-foreground opacity-60 cursor-not-allowed', isCurrent && 'font-semibold' )} onClick={() => itemIsClickable && handleContentSelection(item, index)} disabled={!itemIsClickable} title={locked && !isCompleted && !isCourseCompleted && !isCurrentUserOnTrial ? "Complete previous items to unlock" : item.data.title} > <div className="flex items-center w-full"> {isCompleted ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" /> : locked && !isCurrent && !isCourseCompleted && !isCurrentUserOnTrial ? <Lock className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" /> : <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" /> } <span className="flex-1 text-sm truncate">{item.data.title}</span> </div> </Button> </li> ); })} </ul> </ScrollArea> </div> );

    if (!isMounted || isLoading || !currentUser) return ( <div className="flex h-screen bg-secondary"> <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background p-4 space-y-4"><Skeleton className="h-5 w-3/4" /> <Skeleton className="h-6 w-full" /><div className="space-y-1"><div className="flex justify-between"><Skeleton className="h-3 w-1/4" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-2 w-full" /></div><Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </aside> <main className="flex-1 flex flex-col overflow-hidden"><header className="flex items-center justify-between p-4 border-b bg-background md:justify-end"><Skeleton className="h-8 w-8 rounded md:hidden mr-4" /> <Skeleton className="h-6 w-1/3 md:hidden" /> <div className="flex items-center gap-4"><Skeleton className="h-6 w-24" /> </div></header><div className="flex-1 overflow-y-auto bg-background p-6 text-center"><Skeleton className="h-8 w-1/2 mx-auto mb-4" /><Skeleton className="aspect-video w-full my-6 rounded-lg" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-5/6 my-2" /></div></main> </div>);
    if (!course) return <div className="flex h-screen items-center justify-center">Course data not found.</div>;

    return ( <> <div className="flex h-screen bg-secondary"> <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background overflow-y-auto">{sidebarContent}</aside> <main className="flex-1 flex flex-col overflow-hidden"> <header className="flex items-center justify-between p-4 border-b bg-background md:justify-end"> <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}> <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden mr-4"><Menu className="h-5 w-5" /><span className="sr-only">Toggle Course Menu</span></Button></SheetTrigger> <SheetContent side="left" className="w-72 p-0 overflow-y-auto">{sidebarContent}</SheetContent> </Sheet> <h1 className="text-lg font-semibold truncate md:hidden">{course.title}</h1> <div className="flex items-center gap-4"><span className="text-sm font-medium">Welcome, {currentUser.name}!</span></div> </header> <div className="flex-1 overflow-y-auto bg-background relative"> {renderContent()} <div className="sticky bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t p-4 flex justify-between items-center z-10"> <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}> <ChevronLeft className="mr-2 h-4 w-4" /> Previous </Button> <Button onClick={handleMainActionClick} disabled={isButtonDisabled || isLoadingTimedQuiz} className={cn(buttonVariant === 'default' ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/80 text-secondary-foreground")} title={buttonTitle} > {isLoadingTimedQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {buttonText} {!(buttonText.includes("Certificate") || (currentIndex === curriculumItems.length -1 && (completedItemIds.includes(currentContentItem?.id || '') || isCourseCompleted))) && !isLoadingTimedQuiz && <ChevronRight className="ml-2 h-4 w-4" />} </Button> </div> </div> </main> </div>
      {isMounted && showCertificateDialog && course && currentUser && userProgressData && ( <Dialog open={showCertificateDialog} onOpenChange={setShowCertificateDialog}> <DialogHeader className="p-6 print-hide"> <DialogUITitle>Course Certificate</DialogUITitle> <DialogUIDescription> Congratulations on completing {course.title}! </DialogUIDescription> </DialogHeader> <DialogContent className="max-w-3xl p-0 overflow-hidden print-content"> <CourseCertificate courseName={course.title} userName={currentUser.name} completionDate={userProgressData.lastUpdated ? (userProgressData.lastUpdated instanceof Date ? userProgressData.lastUpdated : new Date(userProgressData.lastUpdated as string)) : new Date() } brandName={certificateBrandDetails?.name} brandLogoUrl={certificateBrandDetails?.logoUrl} /> </DialogContent> </Dialog> )}
      {/* Timed Quiz Modal */}
      {isMounted && showTimedQuizModal && currentTimedQuizData && (
        <Dialog open={showTimedQuizModal} onOpenChange={(isOpen) => {
            if (!isOpen) { // Only allow closing if not forced open or if user explicitly closes
                setShowTimedQuizModal(false);
                setCurrentTimedQuizData(null);
                if (videoRef.current && videoRef.current.paused && !isLoadingTimedQuiz) {
                    videoRef.current.play().catch(err => console.warn("Failed to auto-resume video:", err));
                }
            }
        }}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogUITitle>Pop-up Quiz: {currentTimedQuizData.title}</DialogUITitle>
                    <DialogUIDescription>Please complete this short quiz before continuing the video.</DialogUIDescription>
                </DialogHeader>
                <div className="py-4">
                    <QuizTaking
                        quiz={currentTimedQuizData}
                        onComplete={(quizId, score, passed) => handleTimedQuizComplete(quizId, score, passed)}
                        // isCompleted prop for QuizTaking might need adjustment based on how you want to handle re-takes of timed quizzes
                    />
                </div>
            </DialogContent>
        </Dialog>
      )}
    </> );
}

    
