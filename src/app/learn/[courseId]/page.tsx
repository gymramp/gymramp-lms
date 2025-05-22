
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { getUserByEmail, getUserCourseProgress, updateEmployeeProgress } from '@/lib/user-data';
import { getCompanyById as getBrandDetailsForCertificate } from '@/lib/company-data';
import type { User, UserCourseProgressData, Company } from '@/types/user';
import { QuizTaking } from '@/components/learn/QuizTaking';
import { CourseCertificate } from '@/components/learn/CourseCertificate';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type CurriculumDisplayItem = {
    id: string;
    type: 'lesson' | 'quiz' | 'brandLesson' | 'brandQuiz';
    data: Lesson | Quiz | BrandLesson | BrandQuiz;
};

export default function LearnCoursePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | BrandCourse | null>(null);
    const [certificateBrandDetails, setCertificateBrandDetails] = useState<Company | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
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

    const isCourseCompleted = userProgressData?.status === "Completed";

     useEffect(() => {
        setIsMounted(true);
        setIsLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    if (userDetails && userDetails.id) {
                        setCurrentUser(userDetails);
                    } else {
                        setCurrentUser(null); router.push('/login'); setIsLoading(false);
                    }
                } catch (error) {
                    setCurrentUser(null); router.push('/login'); setIsLoading(false);
                }
            } else {
                setCurrentUser(null); router.push('/login'); setIsLoading(false);
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
                    router.push('/courses/my-courses');
                    setIsLoading(false); return;
                }

                let brandIdForCertificate: string | null = null;
                if (isBrandCourse && (fetchedCourseData as BrandCourse).brandId) {
                    brandIdForCertificate = (fetchedCourseData as BrandCourse).brandId;
                } else if (userCompanyId) {
                    brandIdForCertificate = userCompanyId;
                }

                if (brandIdForCertificate) {
                    const brandData = await getBrandDetailsForCertificate(brandIdForCertificate);
                    setCertificateBrandDetails(brandData);
                }

                const allItemsMap = new Map<string, CurriculumDisplayItem>();
                for (const prefixedId of (fetchedCourseData.curriculum || [])) {
                    const [typePrefix, id] = prefixedId.split('-');
                    let itemData: Lesson | Quiz | BrandLesson | BrandQuiz | null = null;
                    let itemType: CurriculumDisplayItem['type'] = typePrefix as CurriculumDisplayItem['type'];

                    if (isBrandCourse) {
                        if (typePrefix === 'brandLesson') itemData = await getBrandLessonById(id);
                        else if (typePrefix === 'brandQuiz') itemData = await getBrandQuizById(id);
                        else { 
                            if(typePrefix === 'lesson') itemData = await getLessonById(id);
                            else if(typePrefix === 'quiz') itemData = await getQuizById(id);
                            itemType = typePrefix as 'lesson' | 'quiz';
                        }
                    } else { 
                        if (typePrefix === 'lesson') itemData = await getLessonById(id);
                        else if (typePrefix === 'quiz') itemData = await getQuizById(id);
                        itemType = typePrefix as 'lesson' | 'quiz';
                    }

                    if (itemData) allItemsMap.set(prefixedId, { id: prefixedId, type: itemType, data: itemData });
                }

                const orderedItems = (fetchedCourseData.curriculum || [])
                    .map(prefixedId => allItemsMap.get(prefixedId))
                    .filter(Boolean) as CurriculumDisplayItem[];
                setCurriculumItems(orderedItems);

                const progressData = await getUserCourseProgress(userId, courseId);
                setUserProgressData(progressData);
                const localCompletedIds = progressData.completedItems || [];
                setCompletedItemIds(localCompletedIds);

                let initialItem: CurriculumDisplayItem | null = null;
                let initialItemIndex = 0;

                if (orderedItems.length > 0) {
                    if (progressData.status !== 'Completed') {
                        const firstUncompletedIndex = orderedItems.findIndex(item => !localCompletedIds.includes(item.id));
                        initialItemIndex = firstUncompletedIndex !== -1 ? firstUncompletedIndex : (orderedItems.length > 0 ? orderedItems.length -1 : 0) ;
                    } else { // Course is already completed, start at the beginning for review
                        initialItemIndex = 0;
                    }
                    initialItem = orderedItems[initialItemIndex];
                }

                setCurrentContentItem(initialItem);
                setCurrentIndex(initialItemIndex);

                 if (progressData.status === "Completed" && orderedItems.length > 0 && !hasShownInitialCertificate) {
                    // Potentially show certificate automatically if it's a fresh load of a completed course
                    // but we might want to only show it when it transitions to complete.
                    // For now, rely on the explicit "View Certificate" button.
                    // setShowCertificateDialog(true);
                    // setHasShownInitialCertificate(true);
                }
            } else {
                toast({ title: "Error", description: "Course not found.", variant: "destructive" });
                router.push('/courses/my-courses');
            }
        } catch (error) {
            console.error("Error fetching course data:", error);
            toast({ title: "Error", description: "Could not load course data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, router, toast]); // Removed hasShownInitialCertificate as direct dependency here

    useEffect(() => {
        if (currentUser?.id) {
            loadCourseData(currentUser.id, currentUser.companyId);
        }
     }, [currentUser, loadCourseData]); 

    useEffect(() => {
        if (!currentContentItem) return;

        let hasVideo = false;
        if (currentContentItem.type === 'lesson' && (currentContentItem.data as Lesson).videoUrl) {
            hasVideo = true;
        } else if (currentContentItem.type === 'brandLesson' && (currentContentItem.data as BrandLesson).videoUrl) {
            hasVideo = true;
        }

        if (hasVideo) {
            setIsVideoWatched(false);
            if (completedItemIds.includes(currentContentItem.id)) {
                setIsVideoWatched(true);
            }
        } else {
            setIsVideoWatched(true); 
        }
    }, [currentContentItem, completedItemIds]);


    const handleItemCompletion = useCallback(async (itemIdToComplete: string): Promise<boolean> => {
        // Allow re-marking complete for lastUpdated timestamp, but don't change core progress if already done.
        if (!currentUser?.id || !courseId || !itemIdToComplete) {
            return false;
        }
        const overallIndex = curriculumItems.findIndex(item => item.id === itemIdToComplete);
        if (overallIndex === -1) return false;

        try {
            await updateEmployeeProgress(currentUser.id, courseId, overallIndex);
            const updatedProgressData = await getUserCourseProgress(currentUser.id, courseId);
            setUserProgressData(updatedProgressData);
            setCompletedItemIds(updatedProgressData.completedItems || []);

            // Only auto-show certificate if it transitions to complete AND hasn't been shown for this "session"
            if (updatedProgressData.status === "Completed" && updatedProgressData.progress === 100 && !isCourseCompleted && !hasShownInitialCertificate) {
                setShowCertificateDialog(true);
                setHasShownInitialCertificate(true);
            }
            return true;
        } catch (error) {
            console.error("Failed to update progress:", error);
            toast({ title: "Error", description: "Could not update your progress.", variant: "destructive"});
            return false;
        }
    }, [currentUser?.id, courseId, curriculumItems, toast, isCourseCompleted, hasShownInitialCertificate]);


    const isItemLocked = useCallback((itemIndex: number) => {
        if (isCourseCompleted) return false; // If course is complete, nothing is locked
        if (itemIndex === 0) return false; 
        for (let i = 0; i < itemIndex; i++) {
            if (!completedItemIds.includes(curriculumItems[i].id)) {
                return true; 
            }
        }
        return false; 
    }, [completedItemIds, curriculumItems, isCourseCompleted]);

    const handleContentSelection = (item: CurriculumDisplayItem, index: number) => {
        if (isItemLocked(index) && !completedItemIds.includes(item.id) && currentContentItem?.id !== item.id) {
            toast({ title: "Locked Content", description: "Please complete the previous items first.", variant: "default" });
            return;
        }
        setCurrentContentItem(item);
        setCurrentIndex(index);
        setIsSidebarOpen(false); 
    };

    const advanceToNextItem = useCallback(async () => {
        const nextItemIndex = currentIndex + 1;
        if (nextItemIndex < curriculumItems.length) {
            if (!isItemLocked(nextItemIndex) || isCourseCompleted) { 
                setCurrentContentItem(curriculumItems[nextItemIndex]);
                setCurrentIndex(nextItemIndex);
            } else {
                // This case should ideally not be reached if "Mark Complete" properly unlocks the next item.
                toast({ title: "Next Item Locked", description: "Complete the current item to proceed.", variant: "default" });
            }
        } else if (currentUser?.id) { 
            // Reached the end of the course
            const finalProgress = await getUserCourseProgress(currentUser.id, courseId);
            setUserProgressData(finalProgress);
            setCompletedItemIds(finalProgress.completedItems || []);
            if(finalProgress.status === "Completed" && !hasShownInitialCertificate) {
                toast({ title: "Course Complete!", description: `Congratulations on finishing ${course?.title}!`, variant: "success" });
                setShowCertificateDialog(true);
                setHasShownInitialCertificate(true);
            } else if (finalProgress.status === "Completed") {
                 // If already completed and just navigating to the end.
                toast({ title: "End of Course", description: `You have reviewed all items in ${course?.title}.`, variant: "default" });
                // Optionally show certificate again if user wants to see it from here
            }
        }
    }, [currentIndex, curriculumItems, isItemLocked, toast, currentUser, courseId, course?.title, hasShownInitialCertificate, isCourseCompleted]);

    const handleQuizComplete = async (quizId: string, score: number, passed: boolean) => {
        if (!currentContentItem || !currentContentItem.id) {
            console.error("Current content item or its ID is undefined in handleQuizComplete.");
            return;
        }
    
        const currentItemFullId = currentContentItem.id;
        const expectedPrefix = isBrandSpecificCourse ? `brandQuiz-` : `quiz-`;
        if (!currentItemFullId.startsWith(expectedPrefix) || !currentItemFullId.endsWith(quizId)) {
            console.warn(`Quiz ID mismatch or type mismatch: currentItemFullId is ${currentItemFullId}, expected to handle quiz ${quizId}`);
            return; 
        }
    
        if (passed) {
            const completionSuccessful = await handleItemCompletion(currentItemFullId);
            if (completionSuccessful) {
                advanceToNextItem();
            }
        } else {
            toast({ title: "Quiz Failed", description: "Please try the quiz again to proceed.", variant: "destructive" });
        }
    };

    const handleMarkLessonComplete = async () => {
       if (!currentContentItem || !currentContentItem.id) {
        console.error("Current content item or its ID is undefined in handleMarkLessonComplete.");
        return;
       }
       if (!(currentContentItem.type === 'lesson' || currentContentItem.type === 'brandLesson')) return;

       const lessonData = currentContentItem.data as (Lesson | BrandLesson);
       const hasVideo = !!lessonData.videoUrl;
       const isCurrentItemCompleted = completedItemIds.includes(currentContentItem.id);

       if (isCourseCompleted) { // If course is already complete, just advance
           advanceToNextItem();
           return;
       }

       if (isCurrentItemCompleted) { // If item is complete but course isn't, just advance
            advanceToNextItem();
            return;
       }

       // If item is not complete, check video watch requirement
       if (hasVideo && !isVideoWatched) {
           toast({ title: "Video Not Watched", description: "Please watch the entire video before marking complete.", variant: "default"});
           return;
       }

       const completionSuccessful = await handleItemCompletion(currentContentItem.id);
       if (completionSuccessful) {
           advanceToNextItem();
       }
    };

    const handlePrevious = () => {
        const prevItemIndex = currentIndex - 1;
        if (prevItemIndex >= 0) {
             setCurrentContentItem(curriculumItems[prevItemIndex]);
             setCurrentIndex(prevItemIndex);
             setIsSidebarOpen(false); 
        }
    };

    const handleVideoEnded = () => {
        if (currentContentItem && !completedItemIds.includes(currentContentItem.id)) {
            setIsVideoWatched(true);
            toast({ title: "Video Watched", description: "You can now mark this lesson as complete.", variant: "success" });
        }
    };

    const renderContent = () => {
        if (isLoading || !currentUser) {
             return ( <div className="p-6 text-center"> <Skeleton className="h-8 w-1/2 mx-auto mb-4" /> <Skeleton className="aspect-video w-full my-6 rounded-lg" /> <Skeleton className="h-4 w-full my-2" /> <Skeleton className="h-4 w-5/6 my-2" /> </div> );
        }
        if (isCourseCompleted && showCertificateDialog && isMounted && hasShownInitialCertificate) { 
            return null; 
        }
        // If course is completed AND user is trying to view content (dialog closed or wasn't auto-shown)
        if (isCourseCompleted && currentContentItem && isMounted) {
            // Fall through to render logic below, as user is reviewing
        } else if (isCourseCompleted && !currentContentItem && isMounted) { // Course completed but no item selected (e.g. fresh load)
             return ( <div className="p-6 text-center flex flex-col items-center justify-center h-full"> <Award className="h-16 w-16 text-green-500 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Course Completed!</h2> <p className="text-muted-foreground">You've successfully finished "{course?.title}". You can review any part of the course.</p> <Button onClick={() => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);}} variant="default" className="mt-4">View Certificate</Button> <Button asChild variant="link" className="mt-2"><Link href="/courses/my-courses">Back to My Learning</Link></Button> </div> );
        }

         if (!currentContentItem && curriculumItems.length > 0 && isMounted) {
            return ( <div className="p-6 text-muted-foreground text-center flex flex-col items-center justify-center h-full"> <MousePointerClick className="h-12 w-12 text-primary mb-4" /> <h2 className="text-xl font-semibold mb-2">Select an Item</h2> <p>Please choose an item from the sidebar to start learning.</p> </div> );
        }
        if (!currentContentItem && curriculumItems.length === 0 && isMounted) {
            return <div className="p-6 text-center">This course has no content yet.</div>;
        }
        if (!isMounted || !currentContentItem) { 
             return ( <div className="p-6 text-center"> <Skeleton className="h-8 w-1/2 mx-auto mb-4" /> <Skeleton className="aspect-video w-full my-6 rounded-lg" /> <Skeleton className="h-4 w-full my-2" /> <Skeleton className="h-4 w-5/6 my-2" /> </div> );
        }

        const { type, data } = currentContentItem!;
        const itemData = data as Lesson | BrandLesson | Quiz | BrandQuiz; 
        const isCurrentItemCompleted = completedItemIds.includes(currentContentItem!.id);
        const isLastItemInCourse = currentIndex === curriculumItems.length - 1;

        if (type === 'lesson' || type === 'brandLesson') {
            const lesson = itemData as (Lesson | BrandLesson);
            const hasVideo = !!lesson.videoUrl;
            
            let buttonText = "Mark Complete & Next";
            if (isCourseCompleted) { // Course is fully done
                buttonText = isLastItemInCourse ? "View Certificate" : "Next Item";
            } else { // Course is not yet complete
                if (isCurrentItemCompleted) { // Item is done, but course isn't
                     buttonText = isLastItemInCourse ? "Finish Course & View Certificate" : "Next Item";
                } else { // Item is not done, course isn't done
                     buttonText = isLastItemInCourse ? "Mark Complete & Finish" : "Mark Complete & Next";
                }
            }
            
            const isMarkButtonDisabled = (!isCourseCompleted && !isCurrentItemCompleted && hasVideo && !isVideoWatched);

            return (
                <div className="p-4 md:p-6 lg:p-8 space-y-6">
                     {lesson.featuredImageUrl && ( <div className="relative aspect-video mb-6"> <Image src={lesson.featuredImageUrl} alt={`Featured image for ${lesson.title}`} fill style={{ objectFit: 'cover' }} className="rounded-lg shadow-md" priority /> </div> )}
                    <h2 className="text-2xl md:text-3xl font-bold text-primary">{lesson.title}</h2>
                    {lesson.videoUrl && ( <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground mb-6 shadow overflow-hidden"> {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? ( <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${lesson.videoUrl.split('v=')[1]?.split('&')[0] || lesson.videoUrl.split('/').pop()}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe> ) : lesson.videoUrl.includes('vimeo.com') ? ( <iframe src={`https://player.vimeo.com/video/${lesson.videoUrl.split('/').pop()}`} width="100%" height="100%" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen></iframe> ) : ( <video ref={videoRef} controls src={lesson.videoUrl} onEnded={handleVideoEnded} className="w-full h-full object-contain"> Your browser does not support the video tag. </video> )} </div> )}
                    {hasVideo && !isVideoWatched && !isCourseCompleted && !isCurrentItemCompleted && ( <div className="p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md text-sm flex items-center gap-2"> <VideoIcon className="h-5 w-5" /> Please watch the video to the end to enable completion. </div> )}
                    <div className="prose prose-lg max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                     {lesson.exerciseFilesInfo && ( <Card className="mt-6 bg-secondary"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Exercise Files</CardTitle></CardHeader> <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{lesson.exerciseFilesInfo.split('\n').map((file, index) => {const trimmedFile = file.trim(); if (!trimmedFile) return null; const isUrl = trimmedFile.startsWith('http://') || trimmedFile.startsWith('https://'); return (<li key={index}>{isUrl ? (<a href={trimmedFile} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{trimmedFile.split('/').pop() || trimmedFile}</a>) : (<span className="text-muted-foreground">{trimmedFile}</span>)}</li>);})}</ul></CardContent></Card>)}
                    <div className="flex justify-between pt-6 border-t">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                         <Button
                            onClick={buttonText.includes("Certificate") ? () => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);} : handleMarkLessonComplete}
                            disabled={isMarkButtonDisabled}
                            className={cn((isCurrentItemCompleted || isCourseCompleted) && !buttonText.includes("Certificate") && !isLastItemInCourse ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-primary hover:bg-primary/90")}
                            title={isMarkButtonDisabled ? "Watch video to enable" : ""}
                            >
                                {buttonText}
                                {!(buttonText.includes("Certificate") || (isLastItemInCourse && (isCurrentItemCompleted || isCourseCompleted))) && <ChevronRight className="ml-2 h-4 w-4" />}
                            </Button>
                    </div>
                </div>
            );
        }

        if (type === 'quiz' || type === 'brandQuiz') {
            const quiz = itemData as (Quiz | BrandQuiz);
             return (
                 <div className="p-4 md:p-6 lg:p-8">
                     <QuizTaking quiz={quiz} onComplete={handleQuizComplete} isCompleted={isCurrentItemCompleted || isCourseCompleted} />
                     <div className="flex justify-between pt-6 border-t mt-8">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                         <Button
                            disabled={!isCurrentItemCompleted || (isLastItemInCourse && isCourseCompleted && !showCertificateDialog)} // Keep enabled if it's to view certificate
                            onClick={(isLastItemInCourse && (isCurrentItemCompleted || isCourseCompleted)) ? () => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);} : advanceToNextItem}
                            className={cn((isCourseCompleted && isLastItemInCourse) && "bg-green-600 hover:bg-green-700 text-white")}
                          >
                             {(isLastItemInCourse && (isCurrentItemCompleted || isCourseCompleted)) ? 'View Certificate' : 'Next Item'}
                             {!(isLastItemInCourse && (isCurrentItemCompleted || isCourseCompleted)) && <ChevronRight className="ml-2 h-4 w-4" />}
                         </Button>
                     </div>
                 </div>
             );
        }
        return null;
    };

    const sidebarContent = (
        <div className="p-4 space-y-4">
             <Link href="/courses/my-courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"> <ChevronLeft className="h-4 w-4 mr-1" /> Back to My Learning </Link>
            <h3 className="text-lg font-semibold">{course?.title}</h3>
             <div className="space-y-1"> <div className="flex justify-between text-xs text-muted-foreground mb-1"> <span>Overall Progress</span> <span>{userProgressData?.progress || 0}%</span> </div> <Progress value={userProgressData?.progress || 0} aria-label={`${course?.title || 'Course'} overall progress ${userProgressData?.progress || 0}%`} className="h-2"/> </div>
             {(isCourseCompleted || (userProgressData?.status === "Completed" && userProgressData.progress === 100)) && ( <Button onClick={() => {setShowCertificateDialog(true); setHasShownInitialCertificate(true);}} variant="outline" className="w-full mt-2 flex items-center gap-2"> <Award className="h-4 w-4" /> View Certificate </Button> )}
            <h4 className="text-md font-semibold pt-2 border-t mt-4">Curriculum</h4>
             <ScrollArea className="h-[calc(100vh-320px)]">
              <ul className="space-y-1 mt-2">
                  {curriculumItems.map((item, index) => {
                      const Icon = (item.type === 'lesson' || item.type === 'brandLesson') ? FileText : HelpCircle;
                      const isCompleted = completedItemIds.includes(item.id);
                      const isCurrent = currentContentItem?.id === item.id;
                      const locked = isItemLocked(index); // Gating logic applies here
                      const itemIsClickable = isCourseCompleted || isCompleted || isCurrent || !locked;


                      return ( <li key={item.id}> <Button variant={isCurrent ? "secondary" : "ghost"} className={cn( "w-full justify-start h-auto py-2 px-2 text-left", isCompleted && !isCurrent && 'text-green-600 hover:text-green-700', locked && !isCompleted && !isCurrent && !isCourseCompleted && 'text-muted-foreground opacity-60 cursor-not-allowed', isCurrent && 'font-semibold' )} onClick={() => itemIsClickable && handleContentSelection(item, index)} disabled={!itemIsClickable} title={locked && !isCompleted && !isCourseCompleted ? "Complete previous items to unlock" : item.data.title} > <div className="flex items-center w-full"> {isCompleted ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" /> : locked && !isCurrent && !isCourseCompleted ? <Lock className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" /> : <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" /> } <span className="flex-1 text-sm truncate">{item.data.title}</span> </div> </Button> </li> );
                  })}
              </ul>
            </ScrollArea>
        </div>
    );

    if (!isMounted || isLoading || !currentUser) {
        return ( <div className="flex h-screen bg-secondary"> <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background p-4 space-y-4"><Skeleton className="h-5 w-3/4" /> <Skeleton className="h-6 w-full" /><div className="space-y-1"><div className="flex justify-between"><Skeleton className="h-3 w-1/4" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-2 w-full" /></div><Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </aside> <main className="flex-1 flex flex-col overflow-hidden"><header className="flex items-center justify-between p-4 border-b bg-background md:justify-end"><Skeleton className="h-8 w-8 rounded md:hidden mr-4" /> <Skeleton className="h-6 w-1/3 md:hidden" /> <div className="flex items-center gap-4"><Skeleton className="h-6 w-24" /> </div></header><div className="flex-1 overflow-y-auto bg-background p-6 text-center"><Skeleton className="h-8 w-1/2 mx-auto mb-4" /><Skeleton className="aspect-video w-full my-6 rounded-lg" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-5/6 my-2" /></div></main> </div>);
    }
    if (!course) { return <div className="flex h-screen items-center justify-center">Course data not found.</div>; }

    return (
        <>
            <div className="flex h-screen bg-secondary">
                <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background overflow-y-auto">{sidebarContent}</aside>
                 <main className="flex-1 flex flex-col overflow-hidden">
                     <header className="flex items-center justify-between p-4 border-b bg-background md:justify-end">
                         <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                           <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden mr-4"><Menu className="h-5 w-5" /><span className="sr-only">Toggle Course Menu</span></Button></SheetTrigger>
                            <SheetContent side="left" className="w-72 p-0 overflow-y-auto">{sidebarContent}</SheetContent>
                         </Sheet>
                          <h1 className="text-lg font-semibold truncate md:hidden">{course.title}</h1>
                         <div className="flex items-center gap-4"><span className="text-sm font-medium">Welcome, {currentUser.name}!</span></div>
                     </header>
                     <div className="flex-1 overflow-y-auto bg-background">{renderContent()}</div>
                 </main>
            </div>
             {isMounted && showCertificateDialog && hasShownInitialCertificate && course && currentUser && userProgressData && (
                <Dialog open={showCertificateDialog} onOpenChange={setShowCertificateDialog}>
                    <DialogHeader className="p-6 print-hide">
                        <DialogTitle>Course Certificate</DialogTitle>
                        <DialogDescription>
                            Congratulations on completing {course.title}!
                        </DialogDescription>
                    </DialogHeader>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden print-content">
                        <CourseCertificate
                            courseName={course.title}
                            userName={currentUser.name}
                            completionDate={userProgressData.lastUpdated instanceof Timestamp ? userProgressData.lastUpdated.toDate() : new Date(userProgressData.lastUpdated || Date.now())}
                            brandName={certificateBrandDetails?.name}
                            brandLogoUrl={certificateBrandDetails?.logoUrl}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}


    