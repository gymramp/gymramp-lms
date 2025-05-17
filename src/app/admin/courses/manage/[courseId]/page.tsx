
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
import { ArrowLeft, BookOpen, PlusCircle, Trash2, GripVertical, Eye, EyeOff, HelpCircle, FileText, ListChecks, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course, Lesson, Quiz } from '@/types/course';
import { getCourseById, getAllLessons, updateCourseCurriculum, getLessonById, getAllQuizzes, getQuizById } from '@/lib/firestore-data';
import { AddLessonToCurriculumDialog } from '@/components/admin/AddLessonToCurriculumDialog';
import { AddQuizToCurriculumDialog } from '@/components/admin/AddQuizToCurriculumDialog';
// import { EditModuleTitleDialog } from '@/components/admin/EditModuleTitleDialog'; // REMOVED
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'; // REMOVED
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';


type CurriculumItem = {
    id: string; 
    type: 'lesson' | 'quiz';
    data: Lesson | Quiz;
};


export default function ManageCourseCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [curriculumItems, setCurriculumItems] = useState<CurriculumItem[]>([]); // Single list for all items
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [isAddQuizDialogOpen, setIsAddQuizDialogOpen] = useState(false);
  // const [isEditModuleDialogOpen, setIsEditModuleDialogOpen] = useState(false); // REMOVED
  // const [editingModuleIndex, setEditingModuleIndex] = useState<number | null>(null); // REMOVED
  // const [editingModuleTitle, setEditingModuleTitle] = useState<string>(''); // REMOVED
  const [availableLessonsForDialog, setAvailableLessonsForDialog] = useState<Lesson[]>([]); 
  const [availableQuizzesForDialog, setAvailableQuizzesForDialog] = useState<Quiz[]>([]); 


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
      const allQuizzes = await getAllQuizzes();

      const allItemsMap = new Map<string, CurriculumItem>();
      const allPossibleItemsPromises = [
        ...allLessons.map(async (lesson) => ({ id: `lesson-${lesson.id}`, type: 'lesson', data: lesson } as CurriculumItem)),
        ...allQuizzes.map(async (quiz) => ({ id: `quiz-${quiz.id}`, type: 'quiz', data: quiz } as CurriculumItem))
      ];
      const allPossibleItems = (await Promise.all(allPossibleItemsPromises)).filter(Boolean) as CurriculumItem[];
      allPossibleItems.forEach(item => allItemsMap.set(item.id, item));
      
      const orderedCurriculumItems = (fetchedCourse.curriculum || [])
        .map(itemId => allItemsMap.get(itemId))
        .filter(Boolean) as CurriculumItem[];
      setCurriculumItems(orderedCurriculumItems);

      const currentCurriculumIds = new Set(fetchedCourse.curriculum || []);
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
  }, [courseId, router, toast]);

  useEffect(() => {
    fetchCourseAndData();
  }, [fetchCourseAndData]);


  const handleAddLessonToCurriculum = async (lessonId: string) => {
    const allLessons = await getAllLessons(); 
    const lessonToAdd = allLessons.find(l => l.id === lessonId);
    if (lessonToAdd && course) {
       const prefixedId = `lesson-${lessonId}`;
       const newItem: CurriculumItem = { id: prefixedId, type: 'lesson', data: lessonToAdd };
        setCurriculumItems(prev => [...prev, newItem]);
        const newCurriculumIds = [...(course.curriculum || []), prefixedId];
        await saveCurriculum(newCurriculumIds); 
        fetchCourseAndData(); 
    }
    setIsAddLessonDialogOpen(false);
  };

   const handleAddQuizToCurriculum = async (quizId: string) => {
     const allQuizzes = await getAllQuizzes(); 
     const quizToAdd = allQuizzes.find(q => q.id === quizId);
     if (quizToAdd && course) {
        const prefixedId = `quiz-${quizId}`;
        const newItem: CurriculumItem = { id: prefixedId, type: 'quiz', data: quizToAdd };
        setCurriculumItems(prev => [...prev, newItem]);
        const newCurriculumIds = [...(course.curriculum || []), prefixedId];
        await saveCurriculum(newCurriculumIds); 
        fetchCourseAndData(); 
     }
     setIsAddQuizDialogOpen(false);
   };

  const handleRemoveItem = async (itemId: string, sourceIndex: number) => { // Simplified sourceId
    let newCurriculumItems = [...curriculumItems];
    newCurriculumItems.splice(sourceIndex, 1);

    setCurriculumItems(newCurriculumItems);
    const newCurriculumIds = newCurriculumItems.map(item => item.id);
    await saveCurriculum(newCurriculumIds);
    fetchCourseAndData();
};

   const saveCurriculum = async (newCurriculumIds: string[]) => {
     if (!courseId || !course) return; 
     setIsSaving(true);
     try {
       const success = await updateCourseCurriculum(courseId, newCurriculumIds); // Pass only curriculum IDs
       if (success) {
         toast({ title: "Curriculum Updated", description: "Curriculum saved." });
         setCourse(prev => prev ? { ...prev, curriculum: newCurriculumIds } : null);
       } else {
         throw new Error("Failed to update curriculum in Firestore.");
       }
     } catch (error) {
       console.error("Error saving curriculum:", error);
       toast({ title: "Save Error", description: "Could not save curriculum changes.", variant: "destructive" });
     } finally {
       setIsSaving(false);
     }
   };

   const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
        return;
    }

    const newOrderedItems = Array.from(curriculumItems);
    const [movedItem] = newOrderedItems.splice(source.index, 1);
    newOrderedItems.splice(destination.index, 0, movedItem);

    setCurriculumItems(newOrderedItems);
    const newCurriculumIds = newOrderedItems.map(item => item.id);
    saveCurriculum(newCurriculumIds);
};

   const renderCurriculumItemRow = (item: CurriculumItem, index: number) => ( // Simplified parameters
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
                           onClick={() => handleRemoveItem(item.id, index)} // Pass index directly
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
            <Skeleton className="h-8 w-1/4" /> 
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-10 w-64" /> 
                    <Skeleton className="h-4 w-48 mt-2" /> 
                </div>
                <div className="flex space-x-2">
                    <Skeleton className="h-10 w-32" /> 
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
             <Skeleton className="h-64 w-full" /> 
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
          <p className="text-muted-foreground">Manage Course Curriculum</p>
        </div>
         <div className="space-x-2">
             <Button onClick={() => setIsAddLessonDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Lesson
             </Button>
              <Button onClick={() => setIsAddQuizDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Quiz
             </Button>
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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             Course Curriculum ({curriculumItems.length}) {isSaving && <Loader2 className="h-4 w-4 animate-spin"/>}
          </CardTitle>
          <CardDescription>Drag and drop lessons and quizzes to reorder the curriculum.</CardDescription>
        </CardHeader>
        <CardContent>
           <Droppable droppableId="courseCurriculum">
             {(provided, snapshot) => (
                 <Table
                    className={cn(
                         "border border-dashed rounded-md min-h-[100px]",
                         curriculumItems.length === 0 && "text-center text-muted-foreground italic", 
                         snapshot.isDraggingOver && "bg-accent/20 border-accent" 
                      )}
                 >
                   <TableHeader className={cn(curriculumItems.length === 0 && "sr-only")}> 
                     <TableRow>
                       <TableHead className="w-[50px]"></TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Title</TableHead>
                       <TableHead>Details</TableHead>
                       <TableHead className="text-right">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody
                       ref={provided.innerRef}
                       {...provided.droppableProps}
                   >
                      {curriculumItems.length === 0 ? (
                          <TableRow>
                             <TableCell colSpan={5} className="h-24 text-center">
                                 This course curriculum is empty. Add lessons or quizzes.
                             </TableCell>
                          </TableRow>
                      ) : (
                         curriculumItems.map((item, index) => renderCurriculumItemRow(item, index))
                      )}
                       {provided.placeholder}
                   </TableBody>
                 </Table>
             )}
           </Droppable>
        </CardContent>
      </Card>


       <AddLessonToCurriculumDialog
            isOpen={isAddLessonDialogOpen}
            setIsOpen={setIsAddLessonDialogOpen}
            availableLessons={availableLessonsForDialog} 
            onAddLesson={handleAddLessonToCurriculum}
        />

        <AddQuizToCurriculumDialog
            isOpen={isAddQuizDialogOpen}
            setIsOpen={setIsAddQuizDialogOpen}
            availableQuizzes={availableQuizzesForDialog} 
            onAddQuiz={handleAddQuizToCurriculum}
        />
        {/* EditModuleTitleDialog REMOVED */}
    </div>
    </DragDropContext>
  );
}

