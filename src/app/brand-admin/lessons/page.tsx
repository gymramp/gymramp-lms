
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, FileText, Search, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { BrandLesson } from '@/types/course';
import type { User, Company } from '@/types/user';
import { getBrandLessonsByBrandId, deleteBrandLessonAndCleanUp } from '@/lib/brand-content-data';
import { AddEditBrandLessonDialog } from '@/components/brand-admin/AddEditBrandLessonDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; 
import { useRouter } from 'next/navigation';

const DEFAULT_ROWS_PER_PAGE = 10;

export default function BrandAdminLessonsPage() {
  const [lessons, setLessons] = useState<BrandLesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<BrandLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<BrandLesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<BrandLesson | null>(null);
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
            toast({ title: "Access Denied", description: "You do not have permission to manage brand lessons.", variant: "destructive" });
            router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
          }
        } catch (error) {
          console.error("Auth or data fetch error:", error);
          setIsAuthorized(false);
          toast({ title: "Error", description: "Could not verify your permissions.", variant: "destructive" });
          router.push('/');
        }
      } else {
        setCurrentUser(null);
        setCurrentBrand(null);
        setIsAuthorized(false);
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchBrandLessons = useCallback(async () => {
    if (!isAuthorized || !currentUser?.companyId) {
      setLessons([]);
      setFilteredLessons([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const lessonsData = await getBrandLessonsByBrandId(currentUser.companyId);
      setLessons(lessonsData);
      setFilteredLessons(lessonsData);
    } catch (error) {
      console.error("Failed to fetch brand lessons:", error);
      toast({ title: "Error", description: "Could not fetch lessons.", variant: "destructive" });
      setLessons([]);
      setFilteredLessons([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, currentUser?.companyId, toast]);

  useEffect(() => {
    if (isAuthorized) {
      fetchBrandLessons();
    }
  }, [isAuthorized, fetchBrandLessons]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = lessons.filter(lesson =>
      lesson.title.toLowerCase().includes(lowercasedFilter) ||
      (lesson.content && lesson.content.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredLessons(filtered);
    setCurrentPage(1);
  }, [searchTerm, lessons]);

  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredLessons.length / rowsToShow);
  const paginatedLessons = useMemo(() => {
    if (!filteredLessons) return [];
    if (rowsPerPage === 'all') return filteredLessons;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredLessons.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLessons, currentPage, rowsPerPage]);

  const handleAddLesson = () => {
    if (!isAuthorized) return;
    setEditingLesson(null);
    setIsLessonDialogOpen(true);
  };

  const handleEditLesson = (lesson: BrandLesson) => {
    if (!isAuthorized) return;
    setEditingLesson(lesson);
    setIsLessonDialogOpen(true);
  };

  const openDeleteConfirmation = (lesson: BrandLesson) => {
    if (!isAuthorized) return;
    setLessonToDelete(lesson);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!lessonToDelete || !isAuthorized || !currentUser?.companyId) return;
    setIsDeleting(true);
    try {
      const success = await deleteBrandLessonAndCleanUp(lessonToDelete.id, currentUser.companyId);
      if (success) {
        await fetchBrandLessons();
        toast({ title: 'Lesson Deleted', description: `Lesson "${lessonToDelete.title}" deleted.` });
      } else {
        throw new Error("Failed to delete brand lesson.");
      }
    } catch (error) {
      console.error("Failed to delete lesson:", error);
      toast({ title: 'Error', description: `Failed to delete lesson.`, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setLessonToDelete(null);
    }
  };

  const handleRowsPerPageChange = (value: string) => {
    if (value === 'all') setRowsPerPage('all');
    else setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  if (!currentUser || !currentBrand || !isAuthorized) {
    return (
      <div className="container mx-auto text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">My Lessons</h1>
        <Button onClick={handleAddLesson} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Lesson
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
          <CardTitle>Lesson Library for {currentBrand.name}</CardTitle>
          <CardDescription>Manage lessons created specifically for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filteredLessons.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No lessons found matching "${searchTerm}".` : "No lessons created yet."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Has Video?</TableHead><TableHead>Playback Time</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedLessons.map((lesson) => (
                    <TableRow key={lesson.id}>
                      <TableCell className="font-medium">{lesson.title}</TableCell>
                      <TableCell>{lesson.videoUrl ? <Badge variant="secondary">Yes</Badge> : 'No'}</TableCell>
                      <TableCell>{lesson.playbackTime || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditLesson(lesson)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(lesson)} disabled={isDeleting && lessonToDelete?.id === lesson.id}>
                              {isDeleting && lessonToDelete?.id === lesson.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />} Delete Lesson
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between space-x-2 py-4 mt-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">Page {currentPage} of {totalPages} ({filteredLessons.length} total lessons)</div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="rows-per-page" className="text-sm">Rows per page:</Label>
                  <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                    <SelectTrigger id="rows-per-page" className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || totalPages === 0}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {currentUser?.companyId && (
        <AddEditBrandLessonDialog
          isOpen={isLessonDialogOpen}
          setIsOpen={setIsLessonDialogOpen}
          brandId={currentUser.companyId}
          initialData={editingLesson}
          onLessonSaved={(savedLesson) => {
            fetchBrandLessons();
            setIsLessonDialogOpen(false);
            setEditingLesson(null);
          }}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the lesson "{lessonToDelete?.title}". It will also be removed from any course curriculums it belongs to.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLessonToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
