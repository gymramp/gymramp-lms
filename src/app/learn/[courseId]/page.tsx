
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Lock, PlayCircle, FileText, HelpCircle, ChevronLeft, ChevronRight, Menu, Award, MousePointerClick, Video as VideoIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getCourseById, getLessonById, getQuizById } from '@/lib/firestore-data';
import type { Course, Lesson, Quiz } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail, getUserCourseProgress, updateEmployeeProgress } from '@/lib/user-data';
import type { User, UserCourseProgressData } from '@/types/user';
import { QuizTaking } from '@/components/learn/QuizTaking';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type CurriculumItem = {
    id: string;
    type: 'lesson' | 'quiz';
    data: Lesson | Quiz;
};

export default function LearnCoursePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([]);
    const [currentContentItem, setCurrentContentItem] = useState<CurriculumItem | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userProgressData, setUserProgressData] = useState<UserCourseProgressData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [completedItemIds, setCompletedItemIds] = useState<string[]>([]);
    const [isVideoWatched, setIsVideoWatched] = useState(false); // New state for video completion
    const videoRef = useRef<HTMLVideoElement>(null); // Ref for HTML5 video

    const isCourseCompleted = userProgressData?.status === "Completed";

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    if (userDetails && userDetails.id) {
                        setCurrentUser(userDetails);
                    } else {
                        setCurrentUser(null);
                        router.push('/login');
                        setIsLoading(false);
                    }
                } catch (error) {
                    setCurrentUser(null);
                    router.push('/login');
                    setIsLoading(false);
                }
            } else {
                setCurrentUser(null);
                router.push('/login');
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const loadCourseData = useCallback(async (userId: string) => {
        if (!courseId) return;
        setIsLoading(true);
        try {
            const fetchedCourse = await getCourseById(courseId);
            if (fetchedCourse) {
                setCourse(fetchedCourse);

                const allItemsMap = new Map<string, CurriculumItem>();
                for (const prefixedId of (fetchedCourse.curriculum || [])) {
                    const [type, id] = prefixedId.split('-');
                    let itemData: Lesson | Quiz | null = null;
                    if (type === 'lesson') itemData = await getLessonById(id);
                    else if (type === 'quiz') itemData = await getQuizById(id);
                    
                    if (itemData) allItemsMap.set(prefixedId, { id: prefixedId, type: type as 'lesson' | 'quiz', data: itemData });
                }

                const orderedItems = (fetchedCourse.curriculum || [])
                    .map(prefixedId => allItemsMap.get(prefixedId))
                    .filter(Boolean) as CurriculumItem[];
                setCurriculumItems(orderedItems);

                const progressData = await getUserCourseProgress(userId, courseId);
                setUserProgressData(progressData);
                const localCompletedIds = progressData.completedItems || [];
                setCompletedItemIds(localCompletedIds);

                let initialItem: CurriculumItem | null = null;
                let initialItemIndex = 0;

                if (orderedItems.length > 0) {
                    if (progressData.status !== 'Completed') {
                        const firstUncompletedIndex = orderedItems.findIndex(item => !localCompletedIds.includes(item.id));
                        initialItemIndex = firstUncompletedIndex !== -1 ? firstUncompletedIndex : 0; 
                    } else {
                        initialItemIndex = 0;
                    }
                    initialItem = orderedItems[initialItemIndex];
                }
                
                setCurrentContentItem(initialItem);
                setCurrentIndex(initialItemIndex);

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
    }, [courseId, router, toast]);

    useEffect(() => {
        if (currentUser?.id) {
            loadCourseData(currentUser.id);
        }
     }, [currentUser?.id, loadCourseData]);

    // Effect to reset video watched state when content item changes
    useEffect(() => {
        if (currentContentItem?.type === 'lesson' && (currentContentItem.data as Lesson).videoUrl) {
            setIsVideoWatched(false); // Reset for new video lessons
            // If the lesson is already completed, mark video as "watched" for UI purposes
            if (completedItemIds.includes(currentContentItem.id)) {
                setIsVideoWatched(true);
            }
        } else {
            setIsVideoWatched(true); // No video or not a lesson, so "watched" is true by default for gating
        }
    }, [currentContentItem, completedItemIds]);


    const handleItemCompletion = useCallback(async (itemIdToComplete: string) => {
        if (isCourseCompleted || !currentUser?.id || !courseId || !itemIdToComplete || completedItemIds.includes(itemIdToComplete)) {
            return false;
        }
        const overallIndex = curriculumItems.findIndex(item => item.id === itemIdToComplete);
        if (overallIndex === -1) return false;

        try {
            await updateEmployeeProgress(currentUser.id, courseId, overallIndex);
            const updatedProgressData = await getUserCourseProgress(currentUser.id, courseId);
            setUserProgressData(updatedProgressData);
            setCompletedItemIds(updatedProgressData.completedItems || []);
            return true;
        } catch (error) {
            console.error("Failed to update progress:", error);
            toast({ title: "Error", description: "Could not update your progress.", variant: "destructive"});
            return false;
        }
    }, [currentUser?.id, courseId, curriculumItems, completedItemIds, isCourseCompleted, toast]);


    const isItemLocked = useCallback((itemIndex: number) => {
        if (itemIndex === 0) return false;
        for (let i = 0; i < itemIndex; i++) {
            if (!completedItemIds.includes(curriculumItems[i].id)) {
                return true;
            }
        }
        return false;
    }, [completedItemIds, curriculumItems]);

    const handleContentSelection = (item: CurriculumItem, index: number) => {
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
            if (!isItemLocked(nextItemIndex)) {
                setCurrentContentItem(curriculumItems[nextItemIndex]);
                setCurrentIndex(nextItemIndex);
            } else {
                toast({ title: "Next Item Locked", description: "Complete current item to proceed.", variant: "default" });
            }
        } else {
            const finalProgress = await getUserCourseProgress(currentUser!.id, courseId);
            setUserProgressData(finalProgress);
            setCompletedItemIds(finalProgress.completedItems || []);
             if(finalProgress.status === "Completed") {
                toast({ title: "Course Complete!", description: `Congratulations on finishing ${course?.title}!`, variant: "success" });
            }
        }
    }, [currentIndex, curriculumItems, isItemLocked, toast, currentUser, courseId, course?.title]);

    const handleQuizComplete = async (quizId: string, score: number, passed: boolean) => {
        if (currentContentItem?.id !== `quiz-${quizId}`) return;

        if (passed) {
            const completionSuccessful = await handleItemCompletion(currentContentItem.id);
            if (completionSuccessful) {
                advanceToNextItem();
            }
        } else {
            toast({ title: "Quiz Failed", description: "Please try the quiz again to proceed.", variant: "destructive" });
        }
    };

    const handleMarkLessonComplete = async () => {
       if (!currentContentItem || currentContentItem.type !== 'lesson' || isCourseCompleted) return;
       
       const lessonData = currentContentItem.data as Lesson;
       // If already completed, just advance. Otherwise, check video.
       if (!completedItemIds.includes(currentContentItem.id) && lessonData.videoUrl && !isVideoWatched) {
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
             return (
                 <div className="p-6 text-center">
                     <Skeleton className="h-8 w-1/2 mx-auto mb-4" />
                     <Skeleton className="aspect-video w-full my-6 rounded-lg" />
                     <Skeleton className="h-4 w-full my-2" /> <Skeleton className="h-4 w-5/6 my-2" />
                 </div>
             );
        }
        if (isCourseCompleted && !currentContentItem) {
            return (
                 <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                    <Award className="h-16 w-16 text-green-500 mb-4" />
                    <h2 className="text-2xl font-semibold mb-2">Course Complete!</h2>
                    <p className="text-muted-foreground">Congratulations on completing "{course?.title}".</p>
                    <Button asChild variant="link" className="mt-4">
                        <Link href="/courses/my-courses">Back to My Learning</Link>
                    </Button>
                 </div>
            );
        }
         if (!currentContentItem && curriculumItems.length > 0) {
            return (
                <div className="p-6 text-muted-foreground text-center flex flex-col items-center justify-center h-full">
                    <MousePointerClick className="h-12 w-12 text-primary mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Select an Item</h2>
                    <p>Please choose an item from the sidebar to start learning.</p>
                </div>
            );
        }
        if (!currentContentItem && curriculumItems.length === 0) {
            return <div className="p-6 text-center">This course has no content yet.</div>;
        }


        const { type, data } = currentContentItem!;
        const isItemCompleted = completedItemIds.includes(currentContentItem!.id);
        const isLastItemInCourse = currentIndex === curriculumItems.length - 1;

        if (type === 'lesson') {
            const lesson = data as Lesson;
            const hasVideo = !!lesson.videoUrl;
            // Button is disabled if:
            // 1. It's the last item AND the course is already marked completed OR the item itself is completed.
            // 2. OR, it has a video, the video hasn't been watched, AND the item isn't already completed.
            const isMarkCompleteButtonDisabled =
                (isLastItemInCourse && (isCourseCompleted || isItemCompleted)) ||
                (hasVideo && !isVideoWatched && !isItemCompleted);

            let buttonText = "Mark Complete & Next";
            if (isItemCompleted && !isLastItemInCourse) buttonText = "Next Item";
            else if (isLastItemInCourse) buttonText = (isItemCompleted || isCourseCompleted) ? "Course Finished" : "Mark Complete & Finish Course";


            return (
                <div className="p-4 md:p-6 lg:p-8 space-y-6">
                     {lesson.featuredImageUrl && (
                        <div className="relative aspect-video mb-6">
                            <Image src={lesson.featuredImageUrl} alt={`Featured image for ${lesson.title}`} fill style={{ objectFit: 'cover' }} className="rounded-lg shadow-md" priority />
                        </div>
                    )}
                    <h2 className="text-2xl md:text-3xl font-bold text-primary">{lesson.title}</h2>
                    {lesson.videoUrl && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground mb-6 shadow overflow-hidden">
                            {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? (
                                <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${lesson.videoUrl.split('v=')[1]?.split('&')[0] || lesson.videoUrl.split('/').pop()}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
                            ) : lesson.videoUrl.includes('vimeo.com') ? (
                                <iframe src={`https://player.vimeo.com/video/${lesson.videoUrl.split('/').pop()}`} width="100%" height="100%" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen></iframe>
                             ) : ( 
                                <video 
                                    ref={videoRef}
                                    controls 
                                    src={lesson.videoUrl} 
                                    onEnded={handleVideoEnded} 
                                    className="w-full h-full object-contain"
                                >
                                    Your browser does not support the video tag.
                                </video> 
                            )}
                        </div>
                    )}
                    {hasVideo && !isVideoWatched && !isItemCompleted && (
                        <div className="p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md text-sm flex items-center gap-2">
                           <VideoIcon className="h-5 w-5" /> Please watch the video to the end to enable completion.
                        </div>
                    )}
                    <div className="prose prose-lg max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                     {lesson.exerciseFilesInfo && (
                        <Card className="mt-6 bg-secondary"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Exercise Files</CardTitle></CardHeader>
                             <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{lesson.exerciseFilesInfo.split('\n').map((file, index) => {const trimmedFile = file.trim(); if (!trimmedFile) return null; const isUrl = trimmedFile.startsWith('http://') || trimmedFile.startsWith('https://'); return (<li key={index}>{isUrl ? (<a href={trimmedFile} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{trimmedFile.split('/').pop() || trimmedFile}</a>) : (<span className="text-muted-foreground">{trimmedFile}</span>)}</li>);})}</ul></CardContent></Card>)}
                    <div className="flex justify-between pt-6 border-t">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                         <Button
                            onClick={handleMarkLessonComplete}
                            disabled={isMarkCompleteButtonDisabled}
                            className={cn(isItemCompleted && !isLastItemInCourse ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-primary hover:bg-primary/90")}
                            title={(hasVideo && !isVideoWatched && !isItemCompleted) ? "Watch video to enable" : ""}
                            >
                                {buttonText}
                                {(!isLastItemInCourse || (isLastItemInCourse && !isItemCompleted && !isCourseCompleted)) && <ChevronRight className="ml-2 h-4 w-4" />}
                            </Button>
                    </div>
                </div>
            );
        }

        if (type === 'quiz') {
            const quiz = data as Quiz;
             return (
                 <div className="p-4 md:p-6 lg:p-8">
                     <QuizTaking quiz={quiz} onComplete={handleQuizComplete} isCompleted={isItemCompleted || isCourseCompleted} />
                     <div className="flex justify-between pt-6 border-t mt-8">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                         <Button 
                            disabled={!isItemCompleted || (isLastItemInCourse && isCourseCompleted)}
                            onClick={advanceToNextItem}
                            className={cn((isCourseCompleted && isLastItemInCourse) && "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
                          >
                             {(isCourseCompleted && isLastItemInCourse) ? 'Course Finished' : 'Next Item'} 
                             {!(isCourseCompleted && isLastItemInCourse) && <ChevronRight className="ml-2 h-4 w-4" />}
                         </Button>
                     </div>
                 </div>
             );
        }
        return null;
    };

    const sidebarContent = (
        <div className="p-4 space-y-4">
             <Link href="/courses/my-courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
                 <ChevronLeft className="h-4 w-4 mr-1" /> Back to My Learning
             </Link>
            <h3 className="text-lg font-semibold">{course?.title}</h3>
             <div className="space-y-1">
                 <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Overall Progress</span>
                    <span>{userProgressData?.progress || 0}%</span>
                 </div>
                 <Progress value={userProgressData?.progress || 0} aria-label={`${course?.title} overall progress ${userProgressData?.progress || 0}%`} className="h-2"/>
             </div>
             {isCourseCompleted && (
                 <div className="flex items-center gap-2 text-green-600 border border-green-200 bg-green-50 rounded-md p-2 mt-2">
                    <Award className="h-5 w-5" /> <span className="text-sm font-medium">Course Completed!</span>
                 </div>
             )}
            <h4 className="text-md font-semibold pt-2 border-t mt-4">Curriculum</h4>
             <ScrollArea className="h-[calc(100vh-280px)]">
              <ul className="space-y-1 mt-2">
                  {curriculumItems.map((item, index) => {
                      const Icon = item.type === 'lesson' ? FileText : HelpCircle;
                      const isCompleted = completedItemIds.includes(item.id);
                      const isCurrent = currentContentItem?.id === item.id;
                      const locked = isItemLocked(index);
                      const itemIsClickable = isCompleted || isCurrent || !locked;

                      return (
                           <li key={item.id}>
                              <Button
                                  variant={isCurrent ? "secondary" : "ghost"}
                                  className={cn(
                                      "w-full justify-start h-auto py-2 px-2 text-left",
                                       isCompleted && !isCurrent && 'text-green-600 hover:text-green-700',
                                       locked && !isCompleted && !isCurrent && 'text-muted-foreground opacity-60 cursor-not-allowed',
                                       isCurrent && 'font-semibold'
                                  )}
                                   onClick={() => itemIsClickable && handleContentSelection(item, index)}
                                   disabled={!itemIsClickable}
                                   title={locked && !isCompleted ? "Complete previous items to unlock" : item.data.title}
                              >
                                   <div className="flex items-center w-full">
                                        {isCompleted ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" /> :
                                         locked && !isCurrent ? <Lock className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" /> :
                                         <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" />
                                         }
                                      <span className="flex-1 text-sm truncate">{item.data.title}</span>
                                   </div>
                              </Button>
                          </li>
                      );
                  })}
              </ul>
            </ScrollArea>
        </div>
    );

    if (isLoading || !currentUser) { 
        return ( <div className="flex h-screen bg-secondary">
                <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background p-4 space-y-4"><Skeleton className="h-5 w-3/4" /> <Skeleton className="h-6 w-full" /><div className="space-y-1"><div className="flex justify-between"><Skeleton className="h-3 w-1/4" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-2 w-full" /></div><Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </aside>
                <main className="flex-1 flex flex-col overflow-hidden"><header className="flex items-center justify-between p-4 border-b bg-background md:justify-end"><Skeleton className="h-8 w-8 rounded md:hidden mr-4" /> <Skeleton className="h-6 w-1/3 md:hidden" /> <div className="flex items-center gap-4"><Skeleton className="h-6 w-24" /> </div></header><div className="flex-1 overflow-y-auto bg-background p-6 text-center"><Skeleton className="h-8 w-1/2 mx-auto mb-4" /><Skeleton className="aspect-video w-full my-6 rounded-lg" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-full my-2" /><Skeleton className="h-4 w-5/6 my-2" /></div></main>
            </div>);
    }
    if (!course) { return <div className="flex h-screen items-center justify-center">Course data not found.</div>; }

    return (
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
    );
}

