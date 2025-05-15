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
import { PlusCircle, MoreHorizontal, Trash2, Edit, HelpCircle, ListChecks, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'; 
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
import type { Quiz } from '@/types/course';
import { getAllQuizzes, deleteQuizAndCleanUp as deleteQuiz, getQuizById } from '@/lib/firestore-data';
import { AddEditQuizDialog } from '@/components/admin/AddEditQuizDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Label } from "@/components/ui/label"; 

const DEFAULT_ROWS_PER_PAGE = 5; 

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  const fetchQuizzes = async () => {
    setIsLoading(true);
    try {
        const quizzesData = await getAllQuizzes();
        const quizzesWithQuestionCount = await Promise.all(quizzesData.map(async (quiz) => {
            const fetchedQuiz = await getQuizById(quiz.id);
            return { ...quiz, questionCount: fetchedQuiz?.questions?.length || 0 };
        }));
        setQuizzes(quizzesWithQuestionCount);
        setFilteredQuizzes(quizzesWithQuestionCount);
    } catch (error) {
        console.error("Failed to fetch quizzes:", error);
        toast({ title: "Error", description: "Could not fetch quizzes.", variant: "destructive" });
        setQuizzes([]);
        setFilteredQuizzes([]);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = quizzes.filter(quiz =>
      quiz.title.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredQuizzes(filtered);
    setCurrentPage(1); 
  }, [searchTerm, quizzes]);

  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredQuizzes.length / rowsToShow);
  const paginatedQuizzes = useMemo(() => {
      if (rowsPerPage === 'all') return filteredQuizzes;
      const startIndex = (currentPage - 1) * rowsPerPage;
      return filteredQuizzes.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredQuizzes, currentPage, rowsPerPage]);


  const handleAddQuiz = () => {
    setEditingQuiz(null);
    setIsQuizDialogOpen(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setIsQuizDialogOpen(true);
  };

   const openDeleteConfirmation = (quiz: Quiz) => {
    setQuizToDelete(quiz);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!quizToDelete) return;
    setIsDeleting(true);
    try {
        const success = await deleteQuiz(quizToDelete.id);
        if (success) {
            await fetchQuizzes();
            toast({
                title: 'Quiz Deleted',
                description: `Quiz "${quizToDelete.title}" deleted successfully.`,
            });
        } else {
             toast({
                 title: 'Deletion Failed',
                 description: `Quiz "${quizToDelete.title}" is currently used in one or more course curriculums and cannot be deleted.`,
                 variant: 'destructive',
             });
        }
    } catch (error) {
         console.error("Failed to delete quiz:", error);
         toast({
            title: 'Error',
            description: `Failed to delete quiz "${quizToDelete.title}".`,
            variant: 'destructive',
         });
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setQuizToDelete(null);
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
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Quiz Management</h1>
        <Button onClick={handleAddQuiz} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Quiz
        </Button>
      </div>

       <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search quizzes by title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Library</CardTitle>
          <CardDescription>Manage reusable quizzes for your courses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4 py-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredQuizzes.length === 0 ? (
             <div className="text-center text-muted-foreground py-8">
                {searchTerm ? `No quizzes found matching "${searchTerm}".` : "No quizzes created yet. Add one to get started!"}
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuizzes.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell className="font-medium">{quiz.title}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant="secondary">{quiz.questionCount ?? 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <>
                              <span className="sr-only">Open menu for {quiz.title}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                           <DropdownMenuItem onClick={() => handleEditQuiz(quiz)}>
                             <>
                               <Edit className="mr-2 h-4 w-4" />
                               <span>Edit Title</span>
                             </>
                           </DropdownMenuItem>
                           <DropdownMenuItem asChild>
                             <Link href={`/admin/quizzes/manage/${quiz.id}`}>
                               <ListChecks className="mr-2 h-4 w-4" />
                               <span>Manage Questions</span>
                             </Link>
                           </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => openDeleteConfirmation(quiz)}
                          >
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Quiz</span>
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
                    Page {currentPage} of {totalPages} ({filteredQuizzes.length} total quizzes)
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
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="15">15</SelectItem>
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

       <AddEditQuizDialog
            isOpen={isQuizDialogOpen}
            setIsOpen={setIsQuizDialogOpen}
            initialData={editingQuiz}
            onQuizSaved={(savedQuiz) => {
                fetchQuizzes();
                setIsQuizDialogOpen(false);
            }}
       />

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the quiz titled "{quizToDelete?.title}" and all its associated questions. This quiz will also be removed from any course curriculums it belongs to.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setQuizToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                 {isDeleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : 'Yes, delete quiz'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
