
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Lock, PlayCircle, FileText, HelpCircle, ChevronLeft, ChevronRight, Menu, GripVertical, Eye, EyeOff, BookOpen, MousePointerClick, Award } from 'lucide-react'; // Kept Award icon
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getCourseById, getLessonById, getQuizById } from '@/lib/firestore-data'; // Updated imports
import type { Course, Lesson, Quiz } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { auth } from '@/lib/firebase'; // Import Firebase auth
import { onAuthStateChanged } from 'firebase/auth'; // Import auth state functions
import { getUserByEmail, getUserCourseProgress, updateEmployeeProgress } from '@/lib/user-data'; // Import function to get user details and progress functions
import type { User, UserCourseProgressData } from '@/types/user'; // Import User type
import { QuizTaking } from '@/components/learn/QuizTaking'; // Import the new QuizTaking component
// import { CourseCertificate } from '@/components/learn/CourseCertificate'; // Removed Certificate import from here
import { cn } from '@/lib/utils'; // Import cn utility
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Define a type for combined curriculum items
type CurriculumItem = {
    id: string; // Prefixed ID like 'lesson-abc' or 'quiz-xyz'
    type: 'lesson' | 'quiz';
    data: Lesson | Quiz;
};

export default function LearnCoursePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null); // Store current user details
    const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([]);
    const [moduleItemsMap, setModuleItemsMap] = useState<Record<string, CurriculumItem[]>>({}); // Map module title to its items
    const [selectedModuleTitle, setSelectedModuleTitle] = useState<string | null>(null); // Track selected module
    const [currentContentItem, setCurrentContentItem] = useState<CurriculumItem | null>(null); // Current item being viewed
    const [currentIndexInModule, setCurrentIndexInModule] = useState(0); // Index within the *selected* module
    const [userProgressData, setUserProgressData] = useState<UserCourseProgressData | null>(null); // Store full progress object
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [completedItemIds, setCompletedItemIds] = useState<string[]>([]); // Track completed item IDs locally

    // Determine if course is completed based on fetched progress data
    const isCourseCompleted = userProgressData?.status === "Completed";

    // Effect 1: Handle Auth State Change and Set User
    useEffect(() => {
        setIsLoading(true); // Start loading when checking auth
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    if (userDetails && userDetails.id) {
                        setCurrentUser(userDetails);
                    } else {
                        console.error("Could not find user details or ID for logged-in user:", firebaseUser.email);
                        setCurrentUser(null);
                        router.push('/login');
                        setIsLoading(false);
                    }
                } catch (error) {
                    console.error("Error fetching user details:", error);
                    setCurrentUser(null);
                    router.push('/login');
                    setIsLoading(false);
                }
            } else {
                // No user logged in, redirect
                setCurrentUser(null);
                router.push('/login');
                setIsLoading(false);
            }
        });
        return () => unsubscribe(); // Cleanup subscription
    }, [router]); // Dependency: router (stable)


    // Effect 2: Load Course Data when User ID is available
    const loadCourseData = useCallback(async (userId: string) => {
        if (!courseId) return;
        // Don't reset loading here, wait for fetch to complete
        try {
            const fetchedCourse = await getCourseById(courseId);
            if (fetchedCourse) {
                setCourse(fetchedCourse);

                const allItemsMap = new Map<string, CurriculumItem>();
                const fetchedItemDetails: { [key: string]: Lesson | Quiz } = {};

                // Fetch details for all items in the curriculum array
                for (const prefixedId of (fetchedCourse.curriculum || [])) {
                    const [type, id] = prefixedId.split('-');
                    let itemData: Lesson | Quiz | null = fetchedItemDetails[prefixedId];

                    if (!itemData) {
                        if (type === 'lesson') {
                            itemData = await getLessonById(id);
                        } else if (type === 'quiz') {
                            itemData = await getQuizById(id);
                        }
                        if (itemData) {
                            fetchedItemDetails[prefixedId] = itemData;
                        }
                    }
                    if (itemData) {
                        allItemsMap.set(prefixedId, { id: prefixedId, type: type as 'lesson' | 'quiz', data: itemData });
                    } else {
                        console.warn(`Data for curriculum item ${prefixedId} not found.`);
                    }
                }

                // Order the items according to the curriculum array
                const orderedItems = (fetchedCourse.curriculum || [])
                    .map(prefixedId => allItemsMap.get(prefixedId))
                    .filter(Boolean) as CurriculumItem[];
                setCurriculumItems(orderedItems); // Store all items in order

                // Create a map of module title to its items
                const newModuleItemsMap: Record<string, CurriculumItem[]> = {};
                (fetchedCourse.modules || []).forEach(moduleTitle => {
                    const itemIdsForModule = fetchedCourse.moduleAssignments?.[moduleTitle] || [];
                    newModuleItemsMap[moduleTitle] = itemIdsForModule
                        .map(itemId => allItemsMap.get(itemId))
                        .filter(Boolean) as CurriculumItem[];
                });
                setModuleItemsMap(newModuleItemsMap);

                // Fetch user progress for this course using the actual user ID
                const progressData = await getUserCourseProgress(userId, courseId);
                setUserProgressData(progressData); // Store the full progress object
                setCompletedItemIds(progressData.completedItems || []);

                // Set initial module/item selection (even if completed, allow viewing)
                 let firstModule: string | null = null;
                 let initialContentItem: CurriculumItem | null = null;
                 let initialIndexInModule = 0;

                if (fetchedCourse.modules && fetchedCourse.modules.length > 0) {
                    firstModule = fetchedCourse.modules[0]; // Default to the first module
                    const firstModuleItems = newModuleItemsMap[firstModule] || [];
                    if (firstModuleItems.length > 0) {
                        initialContentItem = firstModuleItems[0]; // Default to the first item in the first module
                        initialIndexInModule = 0;
                    }
                }

                // If not completed, try to find the first uncompleted item
                 if (progressData.status !== 'Completed') {
                    for (const moduleTitle of (fetchedCourse.modules || [])) {
                        const itemsInModule = newModuleItemsMap[moduleTitle] || [];
                        const firstUncompletedIndex = itemsInModule.findIndex(item => !progressData.completedItems?.includes(item.id));
                        if (firstUncompletedIndex !== -1) {
                            firstModule = moduleTitle;
                            initialContentItem = itemsInModule[firstUncompletedIndex];
                            initialIndexInModule = firstUncompletedIndex;
                            break; // Found the starting point
                        }
                    }
                 }

                 setSelectedModuleTitle(firstModule);
                 setCurrentContentItem(initialContentItem);
                 setCurrentIndexInModule(initialIndexInModule);

            } else {
                router.push('/courses/my-courses'); // Redirect if course not found
            }
        } catch (error) {
            console.error("Error fetching course data:", error);
            // Handle error (e.g., show toast)
        } finally {
            setIsLoading(false); // Stop loading after fetch attempt completes
        }
    }, [courseId, router]); // Dependency on courseId and router

    // Trigger data fetching when currentUser ID becomes available
    useEffect(() => {
        if (currentUser?.id) {
            loadCourseData(currentUser.id); // Load course data once user is confirmed
        } else if (!currentUser && !isLoading) {
             // Handle case where user is definitively null (logged out or failed fetch)
             // and loading is already false
             setCurriculumItems([]);
             setModuleItemsMap({});
             setUserProgressData(null);
             setCompletedItemIds([]);
             setSelectedModuleTitle(null);
             setCurrentContentItem(null);
             setCurrentIndexInModule(0);
        }
     }, [currentUser?.id, isLoading, loadCourseData]); // Depend on user ID and isLoading flag

    // Function to update progress locally and in Firestore
    const handleItemCompletion = useCallback(async (itemIdToComplete: string) => {
        // **Add check: Don't update progress if course is already completed**
        if (isCourseCompleted || !currentUser?.id || !courseId || !itemIdToComplete || completedItemIds.includes(itemIdToComplete)) {
            console.log("Skipping progress update: Course completed or invalid state", { isCourseCompleted, userId: currentUser?.id, courseId, itemIdToComplete });
            return;
        }

        // Find the overall index of the item in the main curriculumItems array
        const overallIndex = curriculumItems.findIndex(item => item.id === itemIdToComplete);
         if (overallIndex === -1) {
             console.error(`Could not find item ${itemIdToComplete} in the main curriculum.`);
             return;
         }

        try {
             // Call the function to update Firestore using the overall index
             await updateEmployeeProgress(currentUser.id, courseId, overallIndex);

            // Update local state optimistically or after confirmation
            const newCompletedItems = [...completedItemIds, itemIdToComplete];
            setCompletedItemIds(newCompletedItems);

             // Re-fetch progress data to get updated status and lastUpdated time
            const updatedProgressData = await getUserCourseProgress(currentUser.id, courseId);
            setUserProgressData(updatedProgressData);

        } catch (error) {
            console.error("Failed to update progress:", error);
            // Optionally revert local state or show error toast
        }

    }, [currentUser?.id, courseId, curriculumItems, completedItemIds, isCourseCompleted]); // Added isCourseCompleted dependency


    const handleModuleSelection = (moduleTitle: string) => {
        // Allow selection even if course is completed
        setSelectedModuleTitle(moduleTitle);
        const itemsInModule = moduleItemsMap[moduleTitle] || [];

        // Always select the first item in the clicked module for viewing
        let firstItemIndexInModule = 0;
        let firstItem: CurriculumItem | null = null;
        if (itemsInModule.length > 0) {
            firstItem = itemsInModule[0];
        }

        setCurrentContentItem(firstItem);
        setCurrentIndexInModule(firstItemIndexInModule);
        setIsSidebarOpen(false); // Close sidebar on mobile
    };

     const handleContentSelection = (item: CurriculumItem, moduleTitle: string) => {
         // Allow selection even if course is completed
         const itemsInSelectedModule = moduleItemsMap[moduleTitle] || [];
         const itemIndexInModule = itemsInSelectedModule.findIndex(i => i.id === item.id);

         // Always allow clicking items for viewing purposes
         setCurrentContentItem(item);
         setCurrentIndexInModule(itemIndexInModule); // Set index within the module
         setIsSidebarOpen(false); // Close sidebar on mobile
    };


    // Function to advance to the next item *within the current module*
    const advanceToNextItem = useCallback(async () => {
        if (!currentUser?.id || !currentContentItem || !selectedModuleTitle) return;

        // Mark the *current* item as complete before advancing (only if not already completed)
        if (!isCourseCompleted) {
             await handleItemCompletion(currentContentItem.id);
        }


        const itemsInModule = moduleItemsMap[selectedModuleTitle] || [];
        const nextIndex = currentIndexInModule + 1;

        if (nextIndex < itemsInModule.length) {
            const nextItem = itemsInModule[nextIndex];
            setCurrentContentItem(nextItem);
            setCurrentIndexInModule(nextIndex);
        } else {
            // Reached the end of the *current module*
            console.log(`Finished module: ${selectedModuleTitle}`);
             // Check if ALL items in the ENTIRE course are now complete (even if already marked completed)
             const allItemsCompleted = curriculumItems.every(item =>
                 completedItemIds.includes(item.id) || item.id === currentContentItem.id // Include the one just processed
             );

             // If all items are complete and the course wasn't already marked as such, refresh progress
             if (allItemsCompleted && !isCourseCompleted) {
                 console.log("Course should now be marked as complete!");
                 // Re-fetch progress one last time to update the main status
                 const updatedProgressData = await getUserCourseProgress(currentUser.id, courseId);
                 setUserProgressData(updatedProgressData);
             }
             // Set content to null to show the "Module Complete" or "Select Module" message
             setCurrentContentItem(null);

        }
    }, [currentIndexInModule, currentContentItem, selectedModuleTitle, moduleItemsMap, handleItemCompletion, currentUser?.id, courseId, isCourseCompleted, curriculumItems, completedItemIds]); // Added curriculumItems and completedItemIds


     // Updated handler for when the QuizTaking component reports completion
     const handleQuizComplete = (quizId: string, score: number, passed: boolean) => {
        console.log(`Quiz ${quizId} completed with score: ${score}, Passed: ${passed}`);
        // Advance only if the quiz was passed, even if course is completed (allow navigation)
        if (passed && currentContentItem?.id === `quiz-${quizId}`) {
            advanceToNextItem();
        } else {
            // Quiz failed - user needs to retry. Stay on the current item.
            // (The QuizTaking component handles the retry UI)
        }
     };

    const handleMarkLessonComplete = () => {
       advanceToNextItem(); // Treat completing the lesson as completing the current step within the module
    };

    const handlePrevious = () => {
        if (!selectedModuleTitle) return; // Allow navigation even if completed
        const itemsInModule = moduleItemsMap[selectedModuleTitle] || [];
        const prevIndex = currentIndexInModule - 1;
        if (prevIndex >= 0) {
             const prevItem = itemsInModule[prevIndex];
             setCurrentContentItem(prevItem);
             setCurrentIndexInModule(prevIndex);
             setIsSidebarOpen(false); // Close sidebar on mobile
        }
    };


    const renderContent = () => {
        // **Removed Certificate Display Logic from here**

        // If not completed and no module is selected, show prompt
        if (!selectedModuleTitle && !isLoading) { // Only show prompt if not loading
            return (
                <div className="p-6 text-muted-foreground text-center flex flex-col items-center justify-center h-full">
                    <MousePointerClick className="h-12 w-12 text-primary mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Select a Module</h2>
                    <p>Please choose a module from the sidebar to start learning.</p>
                </div>
            );
        }

        // If module selected, but no current item (e.g., module finished or first load)
        if (selectedModuleTitle && !currentContentItem && !isLoading) { // Check loading flag
            const itemsInSelectedModule = moduleItemsMap[selectedModuleTitle] || [];
             // Check if all items in the selected module are marked as complete in the *user's progress*
             const allCompletedInModule = itemsInSelectedModule.length > 0 && itemsInSelectedModule.every(item => completedItemIds.includes(item.id));

            if (allCompletedInModule) {
                 return (
                     <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                         <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                         <h2 className="text-xl font-semibold mb-2">Module Complete!</h2>
                         <p className="text-muted-foreground">You have completed all items in "{selectedModuleTitle}".</p>
                          <p className="text-muted-foreground mt-2">Select another module from the sidebar to continue or review.</p>
                     </div>
                 );
            }
            // If no content item and not all completed, show default 'Select an Item' message
            return (
                <div className="p-6 text-muted-foreground text-center flex flex-col items-center justify-center h-full">
                   <MousePointerClick className="h-12 w-12 text-primary mb-4" />
                   <h2 className="text-xl font-semibold mb-2">Select an Item</h2>
                   <p>Please choose an item from the selected module to start learning.</p>
                </div>
            );
        }

        // If still loading or no item, show nothing or a spinner
        if (isLoading || !currentContentItem) {
             return ( // Example loading state within content area
                 <div className="p-6 text-center">
                     <Skeleton className="h-8 w-1/2 mx-auto mb-4" />
                     <Skeleton className="aspect-video w-full my-6 rounded-lg" />
                     <Skeleton className="h-4 w-full my-2" />
                     <Skeleton className="h-4 w-5/6 my-2" />
                 </div>
             );
        }


        // Render the current lesson or quiz
        const { type, data } = currentContentItem;
        const itemsInCurrentModule = moduleItemsMap[selectedModuleTitle || ''] || []; // Ensure selectedModuleTitle is not null
        const isLastItemInModule = currentIndexInModule === itemsInCurrentModule.length - 1;
         // Determine if the *specific item* being viewed is marked as completed in the user's progress
         const isItemCompletedInUserProgress = completedItemIds.includes(currentContentItem.id);
        const isNextItemInModuleAvailable = currentIndexInModule + 1 < itemsInCurrentModule.length;


        if (type === 'lesson') {
            const lesson = data as Lesson;
            return (
                <div className="p-4 md:p-6 lg:p-8 space-y-6">
                     {lesson.featuredImageUrl && (
                        <div className="relative aspect-video mb-6">
                            <Image
                                src={lesson.featuredImageUrl}
                                alt={`Featured image for ${lesson.title}`}
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-lg shadow-md"
                                priority // Prioritize loading the current lesson's image
                            />
                        </div>
                    )}
                    <h2 className="text-2xl md:text-3xl font-bold text-primary">{lesson.title}</h2>

                    {lesson.videoUrl && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground mb-6 shadow overflow-hidden">
                            {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${lesson.videoUrl.split('v=')[1]?.split('&')[0] || lesson.videoUrl.split('/').pop()}`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen>
                                </iframe>
                            ) : lesson.videoUrl.includes('vimeo.com') ? (
                                <iframe
                                     src={`https://player.vimeo.com/video/${lesson.videoUrl.split('/').pop()}`}
                                     width="100%"
                                     height="100%"
                                     frameBorder="0"
                                     allow="autoplay; fullscreen; picture-in-picture"
                                     allowFullScreen>
                                </iframe>
                             ) : (
                                 <video controls src={lesson.videoUrl} className="w-full h-full object-contain">
                                     Your browser does not support the video tag.
                                 </video>
                            )}
                        </div>
                    )}

                    {/* Render lesson content */}
                    <div
                        className="prose prose-lg max-w-none text-foreground dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: lesson.content }} // SANITIZE THIS IF USER GENERATED
                    />

                     {lesson.exerciseFilesInfo && (
                        <Card className="mt-6 bg-secondary">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="h-5 w-5" /> Exercise Files
                                </CardTitle>
                             </CardHeader>
                             <CardContent>
                                 <ul className="list-disc pl-5 space-y-1 text-sm">
                                     {lesson.exerciseFilesInfo.split('\n').map((file, index) => {
                                         const trimmedFile = file.trim();
                                         if (!trimmedFile) return null;
                                         const isUrl = trimmedFile.startsWith('http://') || trimmedFile.startsWith('https://');
                                         return (
                                             <li key={index}>
                                                 {isUrl ? (
                                                     <a href={trimmedFile} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                         {trimmedFile.split('/').pop() || trimmedFile}
                                                     </a>
                                                 ) : (
                                                     <span className="text-muted-foreground">{trimmedFile}</span>
                                                 )}
                                             </li>
                                         );
                                     })}
                                 </ul>
                             </CardContent>
                         </Card>
                     )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-6 border-t">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndexInModule === 0}>
                             <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                         </Button>
                         {/* Logic for the completion/next button */}
                         <Button
                            onClick={handleMarkLessonComplete}
                            // Disable if it's the last item and already completed OR if course is complete and it's the last item
                            disabled={(isLastItemInModule && isItemCompletedInUserProgress) || (isCourseCompleted && !isNextItemInModuleAvailable)}
                            className={isItemCompletedInUserProgress && !isLastItemInModule ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-primary hover:bg-primary/90"}
                            >
                                {isLastItemInModule && isItemCompletedInUserProgress ? 'Module Complete' : // Shows if last item AND completed
                                isItemCompletedInUserProgress ? 'Next (Already Completed)' : // Shows if completed but not last
                                isLastItemInModule ? 'Mark Complete & Finish Module' : // Shows if last item, not yet complete
                                'Mark Complete & Next'} {/* Default for non-last, non-complete items */}
                                {/* Add icon only if there's a next item or it's the last to be completed */}
                                {isNextItemInModuleAvailable || (isLastItemInModule && !isItemCompletedInUserProgress) ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
                            </Button>
                    </div>
                </div>
            );
        }

        if (type === 'quiz') {
            const quiz = data as Quiz;
             // Render the QuizTaking component
             return (
                 <div className="p-4 md:p-6 lg:p-8">
                      {/* Pass isCourseCompleted to prevent quiz submission if course is done */}
                     <QuizTaking quiz={quiz} onComplete={handleQuizComplete} isCompleted={isItemCompletedInUserProgress || isCourseCompleted} />
                     {/* Navigation Buttons for Quiz (only Previous is relevant here) */}
                     <div className="flex justify-between pt-6 border-t mt-8">
                         <Button variant="outline" onClick={handlePrevious} disabled={currentIndexInModule === 0}>
                             <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                         </Button>
                         {/* Next button is handled by the QuizTaking component's onComplete */}
                          <Button disabled>Complete Quiz Above</Button>
                     </div>
                 </div>
             );
        }

        return null; // Should not happen if currentContentItem is set
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

              {/* Add Award icon if course is completed */}
             {isCourseCompleted && (
                 <div className="flex items-center gap-2 text-green-600 border border-green-200 bg-green-50 rounded-md p-2 mt-2">
                    <Award className="h-5 w-5" />
                    <span className="text-sm font-medium">Course Completed!</span>
                 </div>
             )}


             <Accordion type="multiple" className="w-full space-y-2">
                  {(course?.modules || []).map((moduleTitle, moduleIndex) => {
                      const itemsInModule = moduleItemsMap[moduleTitle] || [];
                      const completedInModule = itemsInModule.filter(item => completedItemIds.includes(item.id)).length;
                      const totalInModule = itemsInModule.length;
                      const moduleProgress = totalInModule > 0 ? Math.round((completedInModule / totalInModule) * 100) : 0;
                       const isModuleSelected = selectedModuleTitle === moduleTitle;
                       // Module is considered "locked" only in the sense of preventing progress updates if course is complete.
                       // Navigation should still be allowed.


                       return (
                          <AccordionItem value={moduleTitle} key={moduleTitle} className="border rounded-lg overflow-hidden bg-card">
                              <AccordionTrigger
                                  className={cn(
                                      "px-4 py-3 text-left hover:no-underline hover:bg-muted/50",
                                       isModuleSelected && "bg-primary/10", // Highlight selected module
                                  )}
                                   onClick={() => handleModuleSelection(moduleTitle)} // Select module on trigger click
                                   // Trigger is always enabled for selection
                                >
                                   <div className="flex-1 text-left">
                                        <span className="font-medium flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-muted-foreground"/>
                                            {moduleTitle}
                                        </span>
                                        <span className="text-xs text-muted-foreground block mt-1">
                                            {completedInModule} / {totalInModule} items completed ({moduleProgress}%)
                                         </span>
                                    </div>
                              </AccordionTrigger>
                               <AccordionContent className="pl-8 pr-4 pb-2 pt-0">
                                  <ul className="space-y-1 mt-2">
                                      {itemsInModule.map((item, itemIndex) => {
                                          const Icon = item.type === 'lesson' ? FileText : HelpCircle;
                                          const isCompleted = completedItemIds.includes(item.id);
                                          const isCurrent = currentContentItem?.id === item.id && isModuleSelected;
                                           // Items are always clickable for viewing
                                          const isClickable = true;

                                          return (
                                               <li key={item.id}>
                                                  <Button
                                                      variant={isCurrent ? "secondary" : "ghost"}
                                                      className={cn(
                                                          "w-full justify-start h-auto py-2 px-2 text-left",
                                                           // Style for completed items
                                                           isCompleted && 'text-muted-foreground',
                                                           // Style for current item
                                                           isCurrent && 'font-semibold'
                                                      )}
                                                       onClick={() => handleContentSelection(item, moduleTitle)} // Handle selection within module
                                                       disabled={!isClickable} // Button is always clickable now
                                                       title={!isClickable ? "Complete previous items or select this module" : ""}
                                                  >
                                                       <div className="flex items-center w-full">
                                                            {isCompleted ? <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" /> :
                                                              <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" />
                                                             }
                                                          <span className="flex-1 text-sm truncate">{item.data.title}</span>
                                                       </div>
                                                  </Button>
                                              </li>
                                          );
                                      })}
                                  </ul>
                               </AccordionContent>
                          </AccordionItem>
                       );
                  })}
             </Accordion>
        </div>
    );


    if (isLoading) {
        return (
            <div className="flex h-screen bg-secondary">
                {/* Sidebar Skeleton */}
                <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background p-4 space-y-4">
                     <Skeleton className="h-5 w-3/4" />
                     <Skeleton className="h-6 w-full" />
                     <div className="space-y-1">
                        <div className="flex justify-between"><Skeleton className="h-3 w-1/4" /><Skeleton className="h-3 w-1/4" /></div>
                        <Skeleton className="h-2 w-full" />
                     </div>
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                </aside>
                {/* Main Content Skeleton */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <header className="flex items-center justify-between p-4 border-b bg-background md:justify-end">
                         <Skeleton className="h-8 w-8 rounded md:hidden mr-4" />
                         <Skeleton className="h-6 w-1/3 md:hidden" />
                         <div className="flex items-center gap-4">
                            <Skeleton className="h-6 w-24" />
                         </div>
                    </header>
                    <div className="flex-1 overflow-y-auto bg-background p-6 text-center">
                        <Skeleton className="h-8 w-1/2 mx-auto mb-4" />
                        <Skeleton className="h-4 w-3/4 mx-auto" />
                        <Skeleton className="aspect-video w-full my-6 rounded-lg" />
                        <Skeleton className="h-4 w-full my-2" />
                        <Skeleton className="h-4 w-full my-2" />
                         <Skeleton className="h-4 w-5/6 my-2" />
                    </div>
                </main>
            </div>
        );
    }

    if (!course || !currentUser) {
        return <div className="flex h-screen items-center justify-center">Course not found or user data unavailable.</div>;
    }

     // Standard learning layout (handles both in-progress and completed states via renderContent)
    return (
        <div className="flex h-screen bg-secondary">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex md:flex-col w-72 lg:w-80 border-r bg-background overflow-y-auto">
                {sidebarContent}
            </aside>

            {/* Main Content Area */}
             <main className="flex-1 flex flex-col overflow-hidden">
                 {/* Header */}
                 <header className="flex items-center justify-between p-4 border-b bg-background md:justify-end">
                     {/* Mobile Sidebar Toggle */}
                     <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                       <SheetTrigger asChild>
                         <Button variant="outline" size="icon" className="md:hidden mr-4">
                           <Menu className="h-5 w-5" />
                           <span className="sr-only">Toggle Course Menu</span>
                         </Button>
                       </SheetTrigger>
                        <SheetContent side="left" className="w-72 p-0">
                           {sidebarContent}
                         </SheetContent>
                     </Sheet>

                      {/* Course Title (Mobile) */}
                      <h1 className="text-lg font-semibold truncate md:hidden">{course.title}</h1>

                     {/* Actions/User Info */}
                     <div className="flex items-center gap-4">
                        {/* Placeholder for user avatar/menu */}
                        <span className="text-sm font-medium">Welcome, {currentUser.name}!</span>
                     </div>
                 </header>

                 {/* Content Body */}
                 <div className="flex-1 overflow-y-auto bg-background">
                    {renderContent()}
                 </div>
             </main>
        </div>
    );
}
