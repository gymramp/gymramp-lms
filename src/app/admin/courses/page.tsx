
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, BookOpen, CreditCard, Search, Loader2, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';
import { getAllCourses, deleteCourse } from '@/lib/firestore-data';
import { AddEditCourseDialog } from '@/components/admin/AddEditCourseDialog';
import { Skeleton } from '@/components/ui/skeleton';


export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const coursesData = await getAllCourses();
      setCourses(coursesData);
      setFilteredCourses(coursesData);
    } catch (error:any) {
      console.error("Failed to fetch courses:", error);
      toast({ title: "Error", description: error.message || "Could not load courses.", variant: "destructive" });
      setCourses([]);
      setFilteredCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = courses.filter(course =>
      course.title.toLowerCase().includes(lowercasedFilter) ||
      course.description.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredCourses(filtered);
  }, [searchTerm, courses]);


  const handleAddCourseClick = () => {
    setEditingCourse(null);
    setIsDialogOpen(true);
  };

  const handleEditCourseClick = (course: Course) => {
    setEditingCourse(course);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (course: Course) => {
      setCourseToDelete(course);
      setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(courseToDelete.id);
    try {
        const success = await deleteCourse(courseToDelete.id);
        if (success) {
            await fetchCourses();
            toast({
                title: 'Course Deleted',
                description: `"${courseToDelete.title}" has been successfully deleted.`,
                variant: 'default',
            });
        } else {
             throw new Error('Delete operation returned false.');
        }
    } catch (error) {
         console.error("Failed to delete course:", error);
         toast({
            title: 'Error Deleting Course',
            description: `Could not delete "${courseToDelete.title}".`,
            variant: 'destructive',
         });
    } finally {
        setIsDeleting(null);
        setIsDeleteDialogOpen(false);
        setCourseToDelete(null);
    }
  };

   const handleSaveCourse = (savedCourse: Course) => {
       fetchCourses();
       setEditingCourse(null);
       setIsDialogOpen(false);
   };


  return (
    <div className="container mx-auto">
       <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Management</h1>
          <p className="text-muted-foreground">Create and manage your course catalog</p>
        </div>
        <Button onClick={handleAddCourseClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Create Course
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Courses ({filteredCourses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredCourses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        {searchTerm ? `No courses found matching "${searchTerm}".` : "No courses available. Add one to get started!"}
                      </TableCell>
                    </TableRow>
                  ) : filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Image
                            src={course.featuredImageUrl || course.imageUrl || 'https://placehold.co/80x45.png'}
                            alt={course.title}
                            width={80}
                            height={45}
                            className="rounded-md object-cover w-20 h-[45px]"
                            data-ai-hint="course thumbnail"
                        />
                        <div>
                            <p className="font-semibold">{course.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{course.level}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{course.category || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{course.duration || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="success">Published</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                         <Button variant="ghost" size="icon" asChild title="Manage Curriculum">
                            <Link href={`/admin/courses/manage/${course.id}`}>
                              <Settings className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditCourseClick(course)} title="Edit Course">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(course)} disabled={isDeleting === course.id} title="Delete Course">
                             {isDeleting === course.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

       <AddEditCourseDialog
         isOpen={isDialogOpen}
         setIsOpen={setIsDialogOpen}
         onSave={handleSaveCourse}
         initialData={editingCourse}
       />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the course
                        "{courseToDelete?.title}". This does not delete the lessons or quizzes
                        within the course from the library, only the course structure itself.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmDeleteCourse}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={!!isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Yes, delete course'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
