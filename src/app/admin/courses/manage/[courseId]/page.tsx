
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, BookOpen, PlusCircle, Trash2, GripVertical, Eye, EyeOff, HelpCircle, FileText, ListChecks, ChevronDown, ChevronsUpDown, Loader2, Edit } from 'lucide-react'; // Added Edit icon
import { useToast } from '@/hooks/use-toast';
import type { Course, Lesson, Quiz } from '@/types/course';
import { getCourseById, getAllLessons, updateCourseCurriculum, updateCourseModules, getLessonById, getAllQuizzes, getQuizById, updateQuestion } from '@/lib/firestore-data'; // Updated imports
import { AddLessonToCurriculumDialog } from '@/components/admin/AddLessonToCurriculumDialog';
import { AddQuizToCurriculumDialog } from '@/components/admin/AddQuizToCurriculumDialog';
import { EditModuleTitleDialog } from '@/components/admin/EditModuleTitleDialog'; // Import the new dialog
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Define a type for combined curriculum items
type CurriculumItem = {
    id: string; // Prefixed ID like 'lesson-abc' or 'quiz-xyz'
    type: 'lesson' | 'quiz';
    data: Lesson | Quiz;
};

// Basic Drag and Drop context/hooks
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';


export default function ManageCourseCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [availableItems, setAvailableItems] = useState<CurriculumItem[]>([]); // Items in curriculum but not in any module yet
  const [moduleItems, setModuleItems] = useState<Record<string, CurriculumItem[]>>({}); // Items organized by module title
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [isAddQuizDialogOpen, setIsAddQuizDialogOpen] = useState(false);
  const [isEditModuleDialogOpen, setIsEditModuleDialogOpen] = useState(false); // State for edit module dialog
  const [editingModuleIndex, setEditingModuleIndex] = useState<number | null>(null); // Track which module is being edited
  const [editingModuleTitle, setEditingModuleTitle] = useState<string>(''); // Title being edited
  const [openModuleIndices, setOpenModuleIndices] = useState<number[]>([]); // Track open modules
  const [availableLessonsForDialog, setAvailableLessonsForDialog] = useState<Lesson[]>([]); // Lessons NOT in curriculum
  const [availableQuizzesForDialog, setAvailableQuizzesForDialog] = useState<Quiz[]>([]); // Quizzes NOT in curriculum


  const fetchCourseAndData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!courseId) throw new Error("Course ID missing");

      const fetchedCourse = await getCourseById(courseId);
      if (!fetchedCourse) {
        toast({ title: "Error", description: "Course not found.", variant: "destructive" });
        router.push('/admin/courses');
        return;
      }
      setCourse(fetchedCourse);

      const allLessons = await getAllLessons();
      const allQuizzes = await getAllQuizzes(); // Fetch quizzes

      // Fetch full details for all potential items
      const allItemPromises = [
        ...allLessons.map(async (lesson) => ({ id: `lesson-${lesson.id}`, type: 'lesson', data: lesson } as CurriculumItem)),
        ...allQuizzes.map(async (quiz) => ({ id: `quiz-${quiz.id}`, type: 'quiz', data: quiz } as CurriculumItem))
      ];
      const allPossibleItems = (await Promise.all(allItemPromises)).filter(Boolean) as CurriculumItem[];
      const allItemsMap = new Map(allPossibleItems.map(item => [item.id, item]));

      const currentCurriculumIds = new Set(fetchedCourse.curriculum || []);
      const assignedItems = new Set<string>(); // Track items assigned to modules

      // Organize items into modules based on moduleAssignments
      const newModuleItems: Record<string, CurriculumItem[]> = {};
      (fetchedCourse.modules || []).forEach(moduleTitle => {
          const itemIdsForModule = fetchedCourse.moduleAssignments?.[moduleTitle] || [];
          newModuleItems[moduleTitle] = itemIdsForModule
              .map(itemId => {
                  const item = allItemsMap.get(itemId);
                  if (item) assignedItems.add(itemId); // Mark as assigned
                  return item;
              })
              .filter(Boolean) as CurriculumItem[];
      });
      setModuleItems(newModuleItems);

      // Determine available items (in curriculum but not assigned to a module)
      const newAvailableItems = (fetchedCourse.curriculum || [])
          .filter(itemId => !assignedItems.has(itemId)) // Filter out items already assigned
          .map(itemId => allItemsMap.get(itemId))
          .filter(Boolean) as CurriculumItem[];
      setAvailableItems(newAvailableItems);


       // Initialize open modules state: Open ALL modules by default
       if (fetchedCourse.modules && fetchedCourse.modules.length > 0) {
           setOpenModuleIndices(Array.from(Array(fetchedCourse.modules.length).keys())); // Generate array [0, 1, ..., n-1]
       } else {
           setOpenModuleIndices([]); // No modules, empty array
       }

        // Filter lessons/quizzes for the Add dialogs (those NOT in the overall curriculum)
        const lessonsNotInCurriculum = allLessons.filter(lesson => !currentCurriculumIds.has(`lesson-${lesson.id}`));
        const quizzesNotInCurriculum = allQuizzes.filter(quiz => !currentCurriculumIds.has(`quiz-${quiz.id}`));
        setAvailableLessonsForDialog(lessonsNotInCurriculum);
        setAvailableQuizzesForDialog(quizzesNotInCurriculum);


    } catch (error) {
      console.error("Error fetching course/data:", error);
      toast({ title: "Error", description: "Could not load course data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [courseId, router, toast]); // Removed openModuleIndices.length as it's now set within the effect

  useEffect(() => {
    fetchCourseAndData();
  }, [fetchCourseAndData]);


  const handleAddLessonToCurriculum = async (lessonId: string) => {
    // Find the lesson in the full library list, not just the dialog list
    const allLessons = await getAllLessons(); // Re-fetch or use cached if possible
    const lessonToAdd = allLessons.find(l => l.id === lessonId);
    if (lessonToAdd && course) {
       const prefixedId = `lesson-${lessonId}`;
       const newItem: CurriculumItem = { id: prefixedId, type: 'lesson', data: lessonToAdd };
        // Add to the unassigned 'availableItems' list first
        setAvailableItems(prev => [...prev, newItem]);
        // Update the course's overall curriculum array
        const newCurriculum = [...(course.curriculum || []), prefixedId];
        saveCurriculum(newCurriculum, moduleItems); // Save updated curriculum and existing module assignments
        // Refetch data to update dialog lists
        fetchCourseAndData();
    }
    setIsAddLessonDialogOpen(false);
  };

   const handleAddQuizToCurriculum = async (quizId: string) => {
     // Find the quiz in the full library list
     const allQuizzes = await getAllQuizzes(); // Re-fetch or use cached if possible
     const quizToAdd = allQuizzes.find(q => q.id === quizId);
     if (quizToAdd && course) {
        const prefixedId = `quiz-${quizId}`;
        const newItem: CurriculumItem = { id: prefixedId, type: 'quiz', data: quizToAdd };
         // Add to the unassigned 'availableItems' list first
         setAvailableItems(prev => [...prev, newItem]);
         // Update the course's overall curriculum array
         const newCurriculum = [...(course.curriculum || []), prefixedId];
         saveCurriculum(newCurriculum, moduleItems); // Save updated curriculum and existing module assignments
         // Refetch data to update dialog lists
         fetchCourseAndData();
     }
     setIsAddQuizDialogOpen(false);
   };

  const handleRemoveItem = (itemId: string, sourceId: string, sourceIndex: number) => {
    let itemToRemove: CurriculumItem | undefined;
    let newAvailableItems = [...availableItems];
    let newModuleItems = { ...moduleItems };
    let newCurriculum = [...(course?.curriculum || [])];

    if (sourceId === 'available') {
        itemToRemove = newAvailableItems.splice(sourceIndex, 1)[0];
    } else { // Removing from a module
        const moduleTitle = sourceId.replace('module-', '');
        if (newModuleItems[moduleTitle]) {
            itemToRemove = newModuleItems[moduleTitle].splice(sourceIndex, 1)[0];
        }
    }

    if (itemToRemove) {
        // Remove from overall curriculum
        newCurriculum = newCurriculum.filter(id => id !== itemToRemove!.id);

        setAvailableItems(newAvailableItems);
        setModuleItems(newModuleItems);
        saveCurriculum(newCurriculum, newModuleItems);
        // Refetch data to update dialog lists after removing
        fetchCourseAndData();
    }
};


   // Save the current order of curriculum IDs and module assignments
   const saveCurriculum = async (newCurriculum: string[], newModuleItems: Record<string, CurriculumItem[]>) => {
     if (!courseId || !course) return; // Ensure course exists
     setIsSaving(true);
     try {
         // Create the moduleAssignments object for saving using the current course.modules order
         const newModuleAssignments: Record<string, string[]> = {};
         (course.modules || []).forEach(moduleTitle => { // Use course.modules to maintain order
             newModuleAssignments[moduleTitle] = newModuleItems[moduleTitle]?.map(item => item.id) || []; // Get IDs or default to empty array
         });

       const success = await updateCourseCurriculum(courseId, newCurriculum, newModuleAssignments);
       if (success) {
         toast({ title: "Curriculum Updated", description: "Curriculum and module assignments saved." });
         // Update local course state
         setCourse(prev => prev ? { ...prev, curriculum: newCurriculum, moduleAssignments: newModuleAssignments } : null);
       } else {
         throw new Error("Failed to update curriculum in Firestore.");
       }
     } catch (error) {
       console.error("Error saving curriculum:", error);
       toast({ title: "Save Error", description: "Could not save curriculum changes.", variant: "destructive" });
       // Optionally revert local state changes on save failure
       // fetchCourseAndData();
     } finally {
       setIsSaving(false);
     }
   };

    // Function to handle saving the edited module title
    const handleSaveModuleTitle = async (index: number, newTitle: string) => {
        if (!course || !course.modules) return;

        const oldTitle = course.modules[index];
        if (oldTitle === newTitle) return; // No change

        setIsSaving(true); // Use saving state
        try {
            // Update the modules array locally first
            const updatedModules = [...course.modules];
            updatedModules[index] = newTitle;

            // Update the moduleItems keys locally
            const updatedModuleItems = { ...moduleItems };
            if (updatedModuleItems[oldTitle]) {
                updatedModuleItems[newTitle] = updatedModuleItems[oldTitle];
                delete updatedModuleItems[oldTitle];
            } else {
                updatedModuleItems[newTitle] = []; // Ensure new title exists as key
            }

            // Save the updated modules array to Firestore
            const success = await updateCourseModules(courseId, updatedModules);

            if (success) {
                 // Update local state after successful save
                 setCourse(prev => prev ? { ...prev, modules: updatedModules } : null);
                 setModuleItems(updatedModuleItems); // Update module items with new key

                 // Also update the module assignments in Firestore
                 const updatedAssignments = { ...(course.moduleAssignments || {}) };
                 if (updatedAssignments[oldTitle]) {
                     updatedAssignments[newTitle] = updatedAssignments[oldTitle];
                     delete updatedAssignments[oldTitle];
                 }
                 await updateCourseCurriculum(courseId, course.curriculum || [], updatedAssignments); // Resave curriculum with updated assignments

                 toast({ title: "Module Title Updated", description: `Module "${oldTitle}" renamed to "${newTitle}".` });
                 setIsEditModuleDialogOpen(false); // Close dialog
            } else {
                throw new Error("Failed to update module titles in Firestore.");
            }
        } catch (error) {
            console.error("Error saving module title:", error);
            toast({ title: "Save Error", description: "Could not save module title change.", variant: "destructive" });
        } finally {
             setIsSaving(false);
        }
    };

    // Function to open the edit module dialog
    const handleEditModuleClick = (title: string, index: number) => {
        setEditingModuleTitle(title);
        setEditingModuleIndex(index);
        setIsEditModuleDialogOpen(true);
    };


   // Drag and Drop Handler
   const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside the list
    if (!destination) return;

    const sourceId = source.droppableId;
    const destinationId = destination.droppableId;

    // If dropped in the same place, do nothing
    if (sourceId === destinationId && source.index === destination.index) return;

    let newAvailableItems = [...availableItems];
    let newModuleItems = { ...moduleItems };
    let movedItem: CurriculumItem;

    // Remove item from source
    if (sourceId === 'available') {
        movedItem = newAvailableItems.splice(source.index, 1)[0];
    } else { // Removing from a module
        const moduleTitle = sourceId.replace('module-', '');
        if (!newModuleItems[moduleTitle]) return; // Should not happen
        movedItem = newModuleItems[moduleTitle].splice(source.index, 1)[0];
    }

    // Add item to destination
    if (destinationId === 'available') {
        newAvailableItems.splice(destination.index, 0, movedItem);
    } else { // Adding to a module
        const moduleTitle = destinationId.replace('module-', '');
        if (!newModuleItems[moduleTitle]) newModuleItems[moduleTitle] = []; // Initialize if empty
        newModuleItems[moduleTitle].splice(destination.index, 0, movedItem);
    }

    setAvailableItems(newAvailableItems);
    setModuleItems(newModuleItems);

    // Update the overall curriculum order based on the visual order (modules first, then available)
    let updatedCurriculumOrder: string[] = [];
    (course?.modules || []).forEach(moduleTitle => {
        updatedCurriculumOrder = [...updatedCurriculumOrder, ...(newModuleItems[moduleTitle]?.map(item => item.id) || [])];
    });
    updatedCurriculumOrder = [...updatedCurriculumOrder, ...newAvailableItems.map(item => item.id)];


    saveCurriculum(updatedCurriculumOrder, newModuleItems);
};

   const renderCurriculumItem = (item: CurriculumItem, index: number, droppableId: string) => (
       <Draggable key={item.id} draggableId={item.id} index={index}>
           {(provided) => (
               <TableRow
                   ref={provided.innerRef}
                   {...provided.draggableProps}
                   className="bg-card hover:bg-muted/50 transition-colors"
               >
                   <TableCell {...provided.dragHandleProps} className="cursor-move py-3 w-[50px] pl-4">
                       <GripVertical className="h-5 w-5 text-muted-foreground" />
                   </TableCell>
                   <TableCell className="py-3 w-[80px]">
                       <Badge variant={item.type === 'lesson' ? "secondary" : "outline"} className="capitalize">
                           {item.type === 'lesson' ? <FileText className="mr-1 h-3 w-3" /> : <HelpCircle className="mr-1 h-3 w-3" />}
                           {item.type}
                       </Badge>
                   </TableCell>
                   <TableCell className="font-medium py-3">{item.data.title}</TableCell>
                   <TableCell className="text-sm text-muted-foreground py-3 w-[150px]">
                       {item.type === 'lesson' ? (
                           <Badge variant={(item.data as Lesson).isPreviewAvailable ? "default" : "secondary"} className={cn("text-xs", (item.data as Lesson).isPreviewAvailable ? 'bg-green-100 text-green-800' : '')}>
                               {(item.data as Lesson).isPreviewAvailable ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                               Preview: {(item.data as Lesson).isPreviewAvailable ? 'Yes' : 'No'}
                           </Badge>
                       ) : (
                           <span className="text-xs">{(item.data as Quiz).questions?.length ?? 0} Questions</span>
                       )}
                   </TableCell>
                   <TableCell className="text-right py-3 w-[80px] pr-4">
                       <Button
                           variant="ghost"
                           size="icon"
                           className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                           onClick={() => handleRemoveItem(item.id, droppableId, index)}
                           disabled={isSaving}
                           aria-label={`Remove ${item.data.title}`}
                       >
                           <Trash2 className="h-4 w-4" />
                       </Button>
                   </TableCell>
               </TableRow>
           )}
       </Draggable>
   );


  if (isLoading) {
    return (
         <div className="container mx-auto py-12 md:py-16 lg:py-20 space-y-8">
            <Skeleton className="h-8 w-1/4" /> {/* Back button */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-10 w-64" /> {/* Title */}
                    <Skeleton className="h-4 w-48 mt-2" /> {/* Description */}
                </div>
                <div className="flex space-x-2">
                    <Skeleton className="h-10 w-32" /> {/* Add buttons */}
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
             <Skeleton className="h-16 w-full" /> {/* Module Header skeleton */}
             <Skeleton className="h-64 w-full" /> {/* Curriculum table skeleton */}
         </div>
    );
  }

  if (!course) {
      return <div className="container mx-auto py-12 text-center">Course not found.</div>;
  }

  return (
   <DragDropContext onDragEnd={onDragEnd}>
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{course.title}</h1>
          <p className="text-muted-foreground">Manage Course Curriculum & Modules</p>
        </div>
         <div className="space-x-2">
             <Button onClick={() => setIsAddLessonDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Lesson
             </Button>
              <Button onClick={() => setIsAddQuizDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Quiz
             </Button>
              {/* Links to manage the libraries */}
              <Button variant="outline" asChild>
                 <Link href="/admin/lessons">
                   <FileText className="mr-2 h-4 w-4" /> Lesson Library
                 </Link>
               </Button>
                <Button variant="outline" asChild>
                 <Link href="/admin/quizzes">
                    <ListChecks className="mr-2 h-4 w-4" /> Quiz Library
                 </Link>
               </Button>
         </div>
      </div>

       {/* Module Sections - Display Headers */}
        <div className="space-y-4 mb-8">
             <h2 className="text-2xl font-semibold text-primary border-b pb-2 mb-4">Modules</h2>
             {course.modules?.length > 0 ? (
                 course.modules.map((moduleTitle, index) => (
                    <Droppable key={moduleTitle} droppableId={`module-${moduleTitle}`}>
                      {(provided, snapshot) => (
                         <Collapsible
                           open={openModuleIndices.includes(index)}
                           onOpenChange={(isOpen) => {
                             setOpenModuleIndices((prev) =>
                               isOpen ? [...prev, index] : prev.filter((i) => i !== index)
                             );
                           }}
                           className={cn(
                               "w-full space-y-2 border rounded-lg p-4 bg-card transition-colors",
                               snapshot.isDraggingOver && "bg-accent/20 border-accent" // Highlight when dragging over
                            )}
                         >
                           <div className="flex items-center justify-between space-x-4">
                             <h3 className="text-lg font-semibold flex items-center gap-2">
                               <BookOpen className="h-5 w-5 text-muted-foreground" />
                               <span>{moduleTitle}</span>
                                {/* Edit Module Title Button */}
                               <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-6 w-6 text-muted-foreground hover:text-primary"
                                   onClick={() => handleEditModuleClick(moduleTitle, index)}
                                   disabled={isSaving}
                                   aria-label={`Edit title for ${moduleTitle}`}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                             </h3>
                             <CollapsibleTrigger asChild>
                               <Button variant="ghost" size="sm" className="w-9 p-0">
                                 <ChevronsUpDown className="h-4 w-4" />
                                 <span className="sr-only">Toggle {moduleTitle}</span>
                               </Button>
                             </CollapsibleTrigger>
                           </div>
                            <CollapsibleContent className="space-y-2 pt-2">
                                {/* Use TableBody directly here for the Droppable area */}
                                <Table className="bg-transparent border border-dashed rounded-md">
                                    <TableBody
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="min-h-[50px]"
                                    >
                                      {moduleItems[moduleTitle]?.length > 0 ? (
                                         moduleItems[moduleTitle].map((item, itemIndex) =>
                                                renderCurriculumItem(item, itemIndex, `module-${moduleTitle}`)
                                            )
                                      ) : (
                                        // Placeholder Row when empty
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                                                Drag items here to assign them to this module.
                                            </TableCell>
                                        </TableRow>
                                      )}
                                    {provided.placeholder}
                                    </TableBody>
                                 </Table>
                            </CollapsibleContent>
                         </Collapsible>
                      )}
                     </Droppable>
                 ))
             ) : (
                 <p className="text-muted-foreground italic">No modules defined for this course. Edit the course details to set the number of modules.</p>
             )}
        </div>


      {/* Available / Unassigned Items */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             Available Items ({availableItems.length}) {isSaving && <Loader2 className="h-4 w-4 animate-spin"/>}
          </CardTitle>
          <CardDescription>Items added to the curriculum but not yet assigned to a module. Drag items into modules above.</CardDescription>
        </CardHeader>
        <CardContent>
           <Droppable droppableId="available">
             {(provided, snapshot) => (
                 // Use Table directly for consistency
                 <Table
                    className={cn(
                         "border border-dashed rounded-md min-h-[100px]",
                         availableItems.length === 0 && "text-center text-muted-foreground italic", // Style placeholder text
                         snapshot.isDraggingOver && "bg-accent/20 border-accent" // Highlight when dragging over
                      )}
                 >
                   <TableHeader className={cn(availableItems.length === 0 && "sr-only")}> {/* Hide header if empty */}
                     <TableRow>
                       <TableHead className="w-[50px]"></TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Title</TableHead>
                       <TableHead>Details</TableHead>
                       <TableHead className="text-right">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   {/* Apply ref and droppableProps to TableBody */}
                   <TableBody
                       ref={provided.innerRef}
                       {...provided.droppableProps}
                   >
                      {availableItems.length === 0 ? (
                          <TableRow>
                             <TableCell colSpan={5} className="h-24 text-center">
                                 All curriculum items are assigned to modules. Add new lessons/quizzes or drag items out of modules to make them available here.
                             </TableCell>
                          </TableRow>
                      ) : (
                         availableItems.map((item, index) => renderCurriculumItem(item, index, 'available'))
                      )}
                       {provided.placeholder}
                   </TableBody>
                 </Table>
             )}
           </Droppable>
        </CardContent>
      </Card>


       {/* Add Lesson to Curriculum Dialog */}
       <AddLessonToCurriculumDialog
            isOpen={isAddLessonDialogOpen}
            setIsOpen={setIsAddLessonDialogOpen}
            availableLessons={availableLessonsForDialog} // Pass lessons NOT already in the curriculum
            onAddLesson={handleAddLessonToCurriculum}
        />

        {/* Add Quiz to Curriculum Dialog */}
        <AddQuizToCurriculumDialog
            isOpen={isAddQuizDialogOpen}
            setIsOpen={setIsAddQuizDialogOpen}
            availableQuizzes={availableQuizzesForDialog} // Pass quizzes NOT already in the curriculum
            onAddQuiz={handleAddQuizToCurriculum}
        />

         {/* Edit Module Title Dialog */}
         {editingModuleIndex !== null && (
            <EditModuleTitleDialog
                isOpen={isEditModuleDialogOpen}
                setIsOpen={setIsEditModuleDialogOpen}
                currentTitle={editingModuleTitle}
                moduleIndex={editingModuleIndex}
                onSave={handleSaveModuleTitle}
            />
         )}

    </div>
    </DragDropContext>
  );
}
