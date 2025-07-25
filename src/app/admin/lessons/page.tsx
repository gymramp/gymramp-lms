
'use client';

import React, { useState, useEffect, useMemo } from 'react'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, PlaySquare, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Loader2, ChevronsUpDown, ArrowDown, ArrowUp } from 'lucide-react'; 
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
import type { Lesson } from '@/types/course';
import { getAllLessons, deleteLessonAndCleanUp as deleteLesson } from '@/lib/firestore-data';
import { AddEditLessonDialog } from '@/components/admin/AddEditLessonDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Label } from "@/components/ui/label"; 
import { cn } from '@/lib/utils';

const DEFAULT_ROWS_PER_PAGE = 10; 
type SortKey = keyof Lesson | 'videoUrl' | 'isPreviewAvailable';
type SortDirection = 'asc' | 'desc';

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // General deleting state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'title', direction: 'asc' });

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
        const lessonsData = await getAllLessons();
        setLessons(lessonsData);
        setFilteredLessons(lessonsData);
    } catch (error) {
        console.error("Failed to fetch lessons:", error);
        toast({ title: "Error", description: "Could not fetch lessons.", variant: "destructive" });
        setLessons([]);
        setFilteredLessons([]);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = lessons.filter(lesson =>
      lesson.title.toLowerCase().includes(lowercasedFilter) ||
      (lesson.content && lesson.content.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredLessons(filtered);
    setCurrentPage(1); 
  }, [searchTerm, lessons]);

  const sortedAndPaginatedLessons = useMemo(() => {
      let sortableItems = [...filteredLessons];
      if (sortConfig !== null) {
          sortableItems.sort((a, b) => {
              const aValue = a[sortConfig.key];
              const bValue = b[sortConfig.key];
              let comparison = 0;
              if (typeof aValue === 'string' && typeof bValue === 'string') {
                  comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
              } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                  comparison = aValue === bValue ? 0 : aValue ? -1 : 1;
              } else if (sortConfig.key === 'videoUrl') {
                  const aHasVideo = !!a.videoUrl;
                  const bHasVideo = !!b.videoUrl;
                  comparison = aHasVideo === bHasVideo ? 0 : aHasVideo ? -1 : 1;
              }
              return sortConfig.direction === 'asc' ? comparison : -comparison;
          });
      }
      
      if (rowsPerPage === 'all') return sortableItems;
      const startIndex = (currentPage - 1) * rowsPerPage;
      return sortableItems.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLessons, sortConfig, currentPage, rowsPerPage]);


  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="ml-2 h-4 w-4" />;
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalPages = rowsPerPage === 'all' ? (filteredLessons.length > 0 ? 1 : 0) : Math.ceil(filteredLessons.length / rowsToShow);


  const handleAddLesson = () => {
    setEditingLesson(null);
    setIsLessonDialogOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsLessonDialogOpen(true);
  };

   const openDeleteConfirmation = (lesson: Lesson) => {
    setLessonToDelete(lesson);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!lessonToDelete) return;

    setIsDeleting(true);
    try {
        const success = await deleteLesson(lessonToDelete.id);
        if (success) {
            await fetchLessons();
            toast({
                title: 'Lesson Deleted',
                description: `Lesson "${lessonToDelete.title}" deleted successfully.`,
            });
        } else {
             toast({
                title: 'Deletion Failed',
                description: `Lesson "${lessonToDelete.title}" is currently used in one or more course curriculums and cannot be deleted.`,
                variant: 'destructive',
             });
        }
    } catch (error) {
         console.error("Failed to delete lesson:", error);
         toast({
            title: 'Error',
            description: `Failed to delete lesson "${lessonToDelete.title}".`,
            variant: 'destructive',
         });
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setLessonToDelete(null);
    }
  };

   const handleRowsPerPageChange = (value: string) => {
        if (value === 'all') {
            setRowsPerPage('all');
        } else {
            setRowsPerPage(parseInt(value, 10));
        }
        setCurrentPage(1); 
    };

  return (
    <div className="container mx-auto">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Lesson Management</h1>
        <Button onClick={handleAddLesson} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Lesson
        </Button>
      </div>

       <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search lessons by title or content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Library</CardTitle>
          <CardDescription>Manage reusable lessons for your courses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4 py-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
             </div>
          ) : filteredLessons.length === 0 ? (
             <div className="text-center text-muted-foreground py-8">
                {searchTerm ? `No lessons found matching "${searchTerm}".` : "No lessons created yet. Add one to get started!"}
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                      <Button variant="ghost" onClick={() => requestSort('title')} className="px-1">
                        Title {getSortIcon('title')}
                      </Button>
                  </TableHead>
                  <TableHead>
                       <Button variant="ghost" onClick={() => requestSort('videoUrl')} className="px-1">
                        Has Video? {getSortIcon('videoUrl')}
                      </Button>
                  </TableHead>
                  <TableHead>
                       <Button variant="ghost" onClick={() => requestSort('isPreviewAvailable')} className="px-1">
                        Preview Enabled? {getSortIcon('isPreviewAvailable')}
                       </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndPaginatedLessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell>{lesson.videoUrl ? 'Yes' : 'No'}</TableCell>
                     <TableCell>
                        <Badge variant={lesson.isPreviewAvailable ? "default" : "secondary"} className={cn(lesson.isPreviewAvailable ? 'bg-green-100 text-green-800' : '', 'w-fit')}>
                            {lesson.isPreviewAvailable ? <Eye className="mr-1 h-3 w-3"/> : <EyeOff className="mr-1 h-3 w-3"/>}
                            {lesson.isPreviewAvailable ? 'Yes' : 'No'}
                        </Badge>
                     </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <>
                              <span className="sr-only">Open menu for {lesson.title}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditLesson(lesson)}>
                            <>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit Details</span>
                            </>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => openDeleteConfirmation(lesson)}
                          >
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Lesson</span>
                            </>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

             <div className="flex items-center justify-between space-x-2 py-4 mt-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredLessons.length} total lessons)
                </div>
                <div className="flex items-center space-x-2">
                    <Label htmlFor="rows-per-page" className="text-sm">Rows per page:</Label>
                     <Select
                        value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)}
                        onValueChange={handleRowsPerPageChange}
                     >
                        <SelectTrigger id="rows-per-page" className="w-[80px] h-9">
                             <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1 || totalPages === 0}
                    >
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
             </div>
             </>
          )}
        </CardContent>
      </Card>

       <AddEditLessonDialog
            isOpen={isLessonDialogOpen}
            setIsOpen={setIsLessonDialogOpen}
            initialData={editingLesson}
            onLessonSaved={(savedLesson) => {
                fetchLessons();
                setIsLessonDialogOpen(false);
            }}
        />

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the lesson titled "{lessonToDelete?.title}". This lesson will also be removed from any course curriculums it belongs to.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLessonToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                {isDeleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : 'Yes, delete lesson'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
