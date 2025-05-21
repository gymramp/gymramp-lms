
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, BookOpen, PlusCircle, Trash2, GripVertical, FileText, HelpCircle, Loader2, Layers, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BrandCourse, BrandLesson, BrandQuiz, Course } from '@/types/course'; // Added Course for global
import type { User, Company } from '@/types/user';
import { getBrandCourseById, getBrandLessonsByBrandId, getBrandQuizzesByBrandId, updateBrandCourseCurriculum, getCompanyById } from '@/lib/brand-content-data'; // getCompanyById is actually from user-data
import { getAllCourses as getAllGlobalCourses } from '@/lib/firestore-data'; // To get global courses for program

import { AddBrandLessonToCurriculumDialog } from '@/components/brand-admin/AddBrandLessonToCurriculumDialog';
// import { AddBrandQuizToCurriculumDialog } from '@/components/brand-admin/AddBrandQuizToCurriculumDialog'; // Placeholder
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getProgramById } from '@/lib/firestore-data'; // To get program details

type BrandCurriculumItem = {
    id: string;
    type: 'brandLesson' | 'brandQuiz' | 'globalCourse'; // Added globalCourse
    data: BrandLesson | BrandQuiz | Course; // Can also be global Course
};

export default function ManageBrandCourseCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const brandCourseId = params.brandCourseId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBrandDetails, setCurrentBrandDetails] = useState<Company | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [brandCourse, setBrandCourse] = useState<BrandCourse | null>(null);
  const [curriculumItems, setCurriculumItems] = useState<BrandCurriculumItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  // const [isAddQuizDialogOpen, setIsAddQuizDialogOpen] = useState(false); // Placeholder

  const [availableBrandLessonsForDialog, setAvailableBrandLessonsForDialog] = useState<BrandLesson[]>([]);
  // const [availableBrandQuizzesForDialog, setAvailableBrandQuizzesForDialog] = useState<BrandQuiz[]>([]); // Placeholder

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (userDetails && (userDetails.role === 'Admin' || userDetails.role === 'Owner') && userDetails.companyId) {
            const brand = await getCompanyById(userDetails.companyId); // Fetch company details
            setCurrentBrandDetails(brand);
            if (brand?.canManageCourses) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
              toast({ title: "Access Denied", description: "Your brand does not have course management enabled.", variant: "destructive" });
              router.push('/dashboard');
            }
          } else {
            setIsAuthorized(false);
            toast({ title: "Access Denied", description: "You do not have permission to manage brand course curriculum.", variant: "destructive" });
            router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
          }
        } catch (error) {
          setIsAuthorized(false);
          toast({ title: "Error", description: "Could not verify your permissions.", variant: "destructive" });
          router.push('/');
        }
      } else {
        setCurrentUser(null);
        setCurrentBrandDetails(null);
        setIsAuthorized(false);
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchBrandCourseAndData = useCallback(async () => {
    if (!isAuthorized || !brandCourseId || !currentUser?.companyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedBrandCourse = await getBrandCourseById(brandCourseId);
      if (!fetchedBrandCourse || fetchedBrandCourse.brandId !== currentUser.companyId) {
        toast({ title: "Error", description: "Brand Course not found or not owned by your brand.", variant: "destructive" });
        router.push('/brand-admin/courses');
        return;
      }
      setBrandCourse(fetchedBrandCourse);

      const [brandLessons, brandQuizzes] = await Promise.all([
        getBrandLessonsByBrandId(currentUser.companyId),
        getBrandQuizzesByBrandId(currentUser.companyId) // Placeholder, will return [] for now
      ]);

      const allItemsMap = new Map<string, BrandCurriculumItem>();
      brandLessons.forEach(lesson => allItemsMap.set(`brandLesson-${lesson.id}`, { id: `brandLesson-${lesson.id}`, type: 'brandLesson', data: lesson }));
      brandQuizzes.forEach(quiz => allItemsMap.set(`brandQuiz-${quiz.id}`, { id: `brandQuiz-${quiz.id}`, type: 'brandQuiz', data: quiz }));
      
      // For global courses (if they can be added to brand course curriculum) - This part is complex and might be a future feature
      // For now, curriculum only contains brandLesson and brandQuiz prefixed IDs

      const orderedCurriculumItems = (fetchedBrandCourse.curriculum || [])
        .map(itemId => allItemsMap.get(itemId))
        .filter(Boolean) as BrandCurriculumItem[];
      setCurriculumItems(orderedCurriculumItems);

      const currentCurriculumIds = new Set(fetchedBrandCourse.curriculum || []);
      setAvailableBrandLessonsForDialog(brandLessons.filter(lesson => !currentCurriculumIds.has(`brandLesson-${lesson.id}`)));
      // setAvailableBrandQuizzesForDialog(brandQuizzes.filter(quiz => !currentCurriculumIds.has(`brandQuiz-${quiz.id}`)));

    } catch (error) {
      console.error("Error fetching brand course/data:", error);
      toast({ title: "Error", description: "Could not load brand course data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, brandCourseId, currentUser?.companyId, router, toast]);

  useEffect(() => {
    if (isAuthorized) {
      fetchBrandCourseAndData();
    }
  }, [isAuthorized, fetchBrandCourseAndData]);

  const handleAddLessonToCurriculum = async (lessonId: string) => {
    const lessonToAdd = availableBrandLessonsForDialog.find(l => l.id === lessonId);
    if (lessonToAdd && brandCourse) {
      const prefixedId = `brandLesson-${lessonId}`;
      const newItem: BrandCurriculumItem = { id: prefixedId, type: 'brandLesson', data: lessonToAdd };
      setCurriculumItems(prev => [...prev, newItem]);
      const newCurriculumIds = [...curriculumItems.map(item => item.id), prefixedId];
      await saveCurriculum(newCurriculumIds);
      fetchBrandCourseAndData(); // Refresh available items
    }
    setIsAddLessonDialogOpen(false);
  };

  // const handleAddQuizToCurriculum = async (quizId: string) => { /* Placeholder */ };

  const handleRemoveItem = async (itemIdToRemove: string) => {
    const newCurriculumItems = curriculumItems.filter(item => item.id !== itemIdToRemove);
    setCurriculumItems(newCurriculumItems);
    const newCurriculumIds = newCurriculumItems.map(item => item.id);
    await saveCurriculum(newCurriculumIds);
    fetchBrandCourseAndData(); // Refresh available items
  };

  const saveCurriculum = async (newCurriculumIds: string[]) => {
    if (!brandCourseId || !brandCourse) return;
    setIsSaving(true);
    try {
      const success = await updateBrandCourseCurriculum(brandCourseId, newCurriculumIds);
      if (success) {
        toast({ title: "Curriculum Updated", description: "Brand course curriculum saved." });
        setBrandCourse(prev => prev ? { ...prev, curriculum: newCurriculumIds } : null);
      } else {
        throw new Error("Failed to update brand course curriculum in Firestore.");
      }
    } catch (error) {
      console.error("Error saving curriculum:", error);
      toast({ title: "Save Error", description: "Could not save curriculum.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
    const newOrderedItems = Array.from(curriculumItems);
    const [movedItem] = newOrderedItems.splice(source.index, 1);
    newOrderedItems.splice(destination.index, 0, movedItem);
    setCurriculumItems(newOrderedItems);
    const newCurriculumIds = newOrderedItems.map(item => item.id);
    saveCurriculum(newCurriculumIds);
  };

  const renderCurriculumItemRow = (item: BrandCurriculumItem, index: number) => (
    <Draggable key={item.id} draggableId={item.id} index={index}>
      {(provided) => (
        <TableRow ref={provided.innerRef} {...provided.draggableProps} className="bg-card hover:bg-muted/50">
          <TableCell {...provided.dragHandleProps} className="cursor-move py-3 w-[50px] pl-4"><GripVertical className="h-5 w-5 text-muted-foreground" /></TableCell>
          <TableCell className="py-3 w-[120px]">
            <Badge variant={item.type === 'brandLesson' ? "secondary" : "outline"} className="capitalize">
              {item.type === 'brandLesson' ? <FileText className="mr-1 h-3 w-3" /> : <HelpCircle className="mr-1 h-3 w-3" />}
              {item.type === 'brandLesson' ? 'Brand Lesson' : 'Brand Quiz'}
            </Badge>
          </TableCell>
          <TableCell className="font-medium py-3">{(item.data as BrandLesson | BrandQuiz).title}</TableCell>
          <TableCell className="text-sm text-muted-foreground py-3 w-[150px]">
            {item.type === 'brandLesson' ? ((item.data as BrandLesson).playbackTime || 'N/A') : `${(item.data as BrandQuiz).questions?.length || 0} Questions`}
          </TableCell>
          <TableCell className="text-right py-3 w-[80px] pr-4">
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleRemoveItem(item.id)} disabled={isSaving} aria-label={`Remove ${item.data.title}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      )}
    </Draggable>
  );

  if (!currentUser || !currentBrandDetails || !isAuthorized) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2">Verifying access and loading data...</p>
      </div>
    );
  }
  if (isLoading) {
    return (<div className="container mx-auto py-12 md:py-16 lg:py-20 space-y-8"><Skeleton className="h-8 w-1/4" /><div className="flex items-center justify-between"><Skeleton className="h-10 w-64" /><div className="flex space-x-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></div></div><Skeleton className="h-64 w-full" /></div>);
  }
  if (!brandCourse) return <div className="container mx-auto py-12 text-center">Brand Course not found.</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <Button variant="outline" onClick={() => router.push('/brand-admin/courses')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Brand's Courses
        </Button>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">{brandCourse.title}</h1>
            <p className="text-muted-foreground">Manage Your Brand Course Curriculum</p>
          </div>
          <div className="space-x-2">
            <Button onClick={() => setIsAddLessonDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Brand Lesson
            </Button>
            <Button variant="outline" disabled> {/* Placeholder for Add Brand Quiz */}
              <PlusCircle className="mr-2 h-4 w-4" /> Add Brand Quiz (Soon)
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Brand Course Curriculum ({curriculumItems.length}) {isSaving && <Loader2 className="h-4 w-4 animate-spin"/>}</CardTitle>
            <CardDescription>Drag and drop lessons to reorder the curriculum.</CardDescription>
          </CardHeader>
          <CardContent>
            <Droppable droppableId="brandCourseCurriculum">
              {(provided, snapshot) => (
                <Table className={cn("border border-dashed rounded-md min-h-[100px]", curriculumItems.length === 0 && "text-center text-muted-foreground italic", snapshot.isDraggingOver && "bg-accent/20 border-accent")}>
                  <TableHeader className={cn(curriculumItems.length === 0 && "sr-only")}><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                    {curriculumItems.length === 0 ? (<TableRow><TableCell colSpan={5} className="h-24 text-center">This brand course curriculum is empty. Add lessons or quizzes.</TableCell></TableRow>)
                                                : (curriculumItems.map((item, index) => renderCurriculumItemRow(item, index)))}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              )}
            </Droppable>
          </CardContent>
        </Card>

        <AddBrandLessonToCurriculumDialog
          isOpen={isAddLessonDialogOpen}
          setIsOpen={setIsAddLessonDialogOpen}
          availableLessons={availableBrandLessonsForDialog}
          onAddLesson={handleAddLessonToCurriculum}
        />
        {/* <AddBrandQuizToCurriculumDialog /> Placeholder */}
      </div>
    </DragDropContext>
  );
}
