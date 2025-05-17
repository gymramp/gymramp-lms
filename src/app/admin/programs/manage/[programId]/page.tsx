
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Program, Course } from '@/types/course';
import type { User } from '@/types/user';
import { getProgramById, updateProgramCourseAssignments, getAllCourses } from '@/lib/firestore-data';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, BookCheck, Layers, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const manageCoursesFormSchema = z.object({
  assignedCourseIds: z.array(z.string()).optional(),
});

type ManageCoursesFormValues = z.infer<typeof manageCoursesFormSchema>;

export default function ManageProgramCoursesPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [allLibraryCourses, setAllLibraryCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const form = useForm<ManageCoursesFormValues>({
    resolver: zodResolver(manageCoursesFormSchema),
    defaultValues: {
      assignedCourseIds: [],
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to manage programs.", variant: "destructive" });
          router.push('/admin/programs');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchProgramAndCourses = useCallback(async () => {
    if (!programId || !currentUser || currentUser.role !== 'Super Admin') return;
    setIsLoading(true);
    try {
      const [programData, coursesData] = await Promise.all([
        getProgramById(programId),
        getAllCourses(),
      ]);

      if (!programData) {
        toast({ title: "Error", description: "Program not found.", variant: "destructive" });
        router.push('/admin/programs');
        return;
      }
      setProgram(programData);
      setAllLibraryCourses(coursesData);
      form.reset({
        assignedCourseIds: programData.courseIds || [],
      });
    } catch (error) {
      console.error("Failed to fetch program or courses:", error);
      toast({ title: "Error", description: "Could not load program or course data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [programId, router, toast, form, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchProgramAndCourses();
    }
  }, [fetchProgramAndCourses, currentUser]);

  const onSubmit = async (data: ManageCoursesFormValues) => {
    if (!programId) return;
    setIsSaving(true);
    try {
      const success = await updateProgramCourseAssignments(programId, data.assignedCourseIds || []);
      if (success) {
        toast({ title: "Courses Updated", description: `Courses for "${program?.title}" updated successfully.` });
        fetchProgramAndCourses(); // Re-fetch to show updated state
      } else {
        throw new Error("Failed to update program course assignments.");
      }
    } catch (error: any) {
      toast({ title: "Error Updating Courses", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20 space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-1/2" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          <CardContent><Skeleton className="h-10 w-1/4 ml-auto" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!program) {
    return <div className="container mx-auto py-12 text-center">Program not found.</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push('/admin/programs')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Programs
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2 flex items-center gap-2">
        <Layers className="h-7 w-7" /> Manage Courses for: {program.title}
      </h1>
      <p className="text-muted-foreground mb-8">{program.description}</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Courses to Program</CardTitle>
              <CardDescription>Select the courses from the library to include in this program.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="assignedCourseIds"
                render={() => (
                  <FormItem>
                    {allLibraryCourses.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No courses available in the library.</p>
                    ) : (
                      <ScrollArea className="h-96 w-full rounded-md border p-4">
                        <div className="space-y-2">
                          {allLibraryCourses.map((course) => (
                            <FormField
                              key={course.id}
                              control={form.control}
                              name="assignedCourseIds"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-md">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(course.id)}
                                      onCheckedChange={(checked) => {
                                        const currentIds = field.value || [];
                                        const newIds = checked
                                          ? [...currentIds, course.id]
                                          : currentIds.filter((value) => value !== course.id);
                                        field.onChange(newIds);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2 cursor-pointer flex-1">
                                    <BookCheck className="h-4 w-4 text-muted-foreground" />
                                    {course.title}
                                    <span className="text-xs text-muted-foreground">({course.level})</span>
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Course Assignments
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
