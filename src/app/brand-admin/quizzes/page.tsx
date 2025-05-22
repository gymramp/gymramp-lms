
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, HelpCircle, ListChecks, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz } from '@/types/course';
import type { User, Company } from '@/types/user';
import { getBrandQuizzesByBrandId, deleteBrandQuizAndCleanUp } from '@/lib/brand-content-data';
import { AddEditBrandQuizDialog } from '@/components/brand-admin/AddEditBrandQuizDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; // Corrected import path
import { useRouter } from 'next/navigation';

const DEFAULT_ROWS_PER_PAGE = 10;

export default function BrandAdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<BrandQuiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<BrandQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<BrandQuiz | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<BrandQuiz | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBrand, setCurrentBrand] = useState<Company | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (userDetails && (userDetails.role === 'Admin' || userDetails.role === 'Owner') && userDetails.companyId) {
            const brandDetails = await getCompanyById(userDetails.companyId);
            setCurrentBrand(brandDetails);
            if (brandDetails?.canManageCourses) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
              toast({ title: "Access Denied", description: "Your brand does not have course management enabled.", variant: "destructive" });
              router.push('/dashboard');
            }
          } else {
            setIsAuthorized(false);
            toast({ title: "Access Denied", description: "You do not have permission to manage brand quizzes.", variant: "destructive" });
            router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
          }
        } catch (error) {
          setIsAuthorized(false);
          toast({ title: "Error", description: "Could not verify permissions.", variant: "destructive" });
          router.push('/');
        }
      } else {
        setCurrentUser(null); setCurrentBrand(null); setIsAuthorized(false); router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchBrandQuizzes = useCallback(async () => {
    if (!isAuthorized || !currentUser?.companyId) {
      setQuizzes([]); setFilteredQuizzes([]); setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const quizzesData = await getBrandQuizzesByBrandId(currentUser.companyId);
      setQuizzes(quizzesData);
      setFilteredQuizzes(quizzesData);
    } catch (error) {
      console.error("Failed to fetch brand quizzes:", error);
      toast({ title: "Error", description: "Could not fetch brand quizzes.", variant: "destructive" });
      setQuizzes([]); setFilteredQuizzes([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, currentUser?.companyId, toast]);

  useEffect(() => { if (isAuthorized) fetchBrandQuizzes(); }, [isAuthorized, fetchBrandQuizzes]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = quizzes.filter(quiz => quiz.title.toLowerCase().includes(lowercasedFilter));
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

  const handleAddQuiz = () => { if (!isAuthorized) return; setEditingQuiz(null); setIsQuizDialogOpen(true); };
  const handleEditQuiz = (quiz: BrandQuiz) => { if (!isAuthorized) return; setEditingQuiz(quiz); setIsQuizDialogOpen(true); };
  const openDeleteConfirmation = (quiz: BrandQuiz) => { if (!isAuthorized) return; setQuizToDelete(quiz); setIsDeleteDialogOpen(true); };

  const confirmDelete = async () => {
    if (!quizToDelete || !isAuthorized || !currentUser?.companyId) return;
    setIsDeleting(true);
    try {
      await deleteBrandQuizAndCleanUp(quizToDelete.id, currentUser.companyId);
      await fetchBrandQuizzes();
      toast({ title: 'Brand Quiz Deleted', description: `Quiz "${quizToDelete.title}" deleted.` });
    } catch (error) {
      toast({ title: 'Error', description: `Failed to delete quiz.`, variant: 'destructive' });
    } finally {
      setIsDeleting(false); setIsDeleteDialogOpen(false); setQuizToDelete(null);
    }
  };

  const handleRowsPerPageChange = (value: string) => {
    if (value === 'all') setRowsPerPage('all'); else setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  if (!currentUser || !currentBrand || !isAuthorized) {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="mt-2">Verifying access...</p></div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">My Brand's Quizzes</h1>
        <Button onClick={handleAddQuiz} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Brand Quiz
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input type="text" placeholder="Search quizzes by title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Library for {currentBrand.name}</CardTitle>
          <CardDescription>Manage quizzes created specifically for your brand.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">{searchTerm ? `No brand quizzes found for "${searchTerm}".` : "No brand quizzes created yet."}</div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead className="text-center">Questions</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedQuizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{quiz.questionCount ?? 0}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditQuiz(quiz)}><Edit className="mr-2 h-4 w-4" />Edit Title</DropdownMenuItem>
                            <DropdownMenuItem asChild><Link href={`/brand-admin/quizzes/manage/${quiz.id}`}><ListChecks className="mr-2 h-4 w-4" />Manage Questions</Link></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(quiz)} disabled={isDeleting && quizToDelete?.id === quiz.id}>
                              {isDeleting && quizToDelete?.id === quiz.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />} Delete Quiz
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between space-x-2 py-4 mt-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">Page {currentPage} of {totalPages} ({filteredQuizzes.length} total quizzes)</div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="rows-per-page" className="text-sm">Rows:</Label>
                  <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                    <SelectTrigger id="rows-per-page" className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="15">15</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {currentUser?.companyId && (
        <AddEditBrandQuizDialog
          isOpen={isQuizDialogOpen}
          setIsOpen={setIsQuizDialogOpen}
          brandId={currentUser.companyId}
          initialData={editingQuiz}
          onQuizSaved={(savedQuiz) => { fetchBrandQuizzes(); setIsQuizDialogOpen(false); setEditingQuiz(null); }}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the brand quiz "{quizToDelete?.title}" and all its questions. It will also be removed from any brand course curriculums.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuizToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
