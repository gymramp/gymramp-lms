'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; 
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, BookOpen, CreditCard, Search, Loader2 } from 'lucide-react'; 
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
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Course Management</h1>
        <Button onClick={handleAddCourseClick} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Course
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search courses by title or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course List</CardTitle>
          <CardDescription>Manage the available courses in the library.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredCourses.length === 0 ? (
             <div className="text-center text-muted-foreground py-8">
               {searchTerm ? `No courses found matching "${searchTerm}".` : "No courses available. Add one to get started!"}
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Modules</TableHead>
                   <TableHead>Curriculum Items</TableHead> 
                    <TableHead>Quizzes (In Curriculum)</TableHead> 
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{course.level}</Badge>
                    </TableCell>
                    <TableCell>{course.modules?.length || 0}</TableCell>
                     <TableCell>{course.curriculum?.length || 0}</TableCell> 
                      <TableCell>{course.curriculum?.filter(id => id.startsWith('quiz-')).length || 0}</TableCell>
                    <TableCell>{course.price}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting === course.id}>
                            <>
                              <span className="sr-only">Open menu for {course.title}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditCourseClick(course)}>
                            <>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit Details</span>
                            </>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/courses/manage/${course.id}`}>
                              <BookOpen className="mr-2 h-4 w-4" />
                              <span>Manage Curriculum</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => openDeleteDialog(course)}
                             disabled={isDeleting === course.id}
                          >
                             {isDeleting === course.id ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                    Deleting...
                                </span>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete Course</span>
                                </>
                             )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
