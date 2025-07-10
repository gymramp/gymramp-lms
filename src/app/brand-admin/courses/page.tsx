
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Trash2, Edit, BookOpen, Search, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Layers } from 'lucide-react'; // Added Layers
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { BrandCourse } from '@/types/course';
import type { User, Company } from '@/types/user';
import { getBrandCoursesByBrandId, deleteBrandCourse } from '@/lib/brand-content-data';
import { AddEditBrandCourseDialog } from '@/components/brand-admin/AddEditBrandCourseDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; 
import { useRouter } from 'next/navigation';

const DEFAULT_ROWS_PER_PAGE = 10;

export default function BrandAdminCoursesPage() {
  const [courses, setCourses] = useState<BrandCourse[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<BrandCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<BrandCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<BrandCourse | null>(null);
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
            toast({ title: "Access Denied", description: "You do not have permission to manage brand courses.", variant: "destructive" });
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

  const fetchBrandCourses = useCallback(async () => {
    if (!isAuthorized || !currentUser?.companyId) {
      setCourses([]);
      setFilteredCourses([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const coursesData = await getBrandCoursesByBrandId(currentUser.companyId);
      setCourses(coursesData);
      setFilteredCourses(coursesData);
    } catch (error) {
      console.error("Failed to fetch brand courses:", error);
      toast({ title: "Error", description: "Could not fetch courses.", variant: "destructive" });
      setCourses([]);
      setFilteredCourses([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, currentUser?.companyId, toast]);

  useEffect(() => {
    if (isAuthorized) {
      fetchBrandCourses();
    }
  }, [isAuthorized, fetchBrandCourses]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = courses.filter(course =>
      course.title.toLowerCase().includes(lowercasedFilter) ||
      (course.description && course.description.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredCourses(filtered);
    setCurrentPage(1);
  }, [searchTerm, courses]);

  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredCourses.length / rowsToShow);
  const paginatedCourses = useMemo(() => {
    if (!filteredCourses) return [];
    if (rowsPerPage === 'all') return filteredCourses;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredCourses.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredCourses, currentPage, rowsPerPage]);

  const handleAddCourse = () => {
    if (!isAuthorized) return;
    setEditingCourse(null);
    setIsCourseDialogOpen(true);
  };

  const handleEditCourse = (course: BrandCourse) => {
    if (!isAuthorized) return;
    setEditingCourse(course);
    setIsCourseDialogOpen(true);
  };

  const openDeleteConfirmation = (course: BrandCourse) => {
    if (!isAuthorized) return;
    setCourseToDelete(course);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!courseToDelete || !isAuthorized) return;
    setIsDeleting(true);
    try {
      const success = await deleteBrandCourse(courseToDelete.id);
      if (success) {
        await fetchBrandCourses();
        toast({ title: 'Course Deleted', description: `Course "${courseToDelete.title}" deleted.` });
      } else {
        throw new Error("Failed to delete brand course.");
      }
    } catch (error) {
      console.error("Failed to delete course:", error);
      toast({ title: 'Error', description: `Failed to delete course.`, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setCourseToDelete(null);
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
        <h1 className="text-3xl font-bold tracking-tight text-primary">My Courses</h1>
        <Button onClick={handleAddCourse} className="bg-accent text-accent-foreground hover:bg-accent/90">
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
          <CardTitle>Course Library for {currentBrand.name}</CardTitle>
          <CardDescription>Manage courses created specifically for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No courses found matching "${searchTerm}".` : "No courses created yet."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Level</TableHead><TableHead>Curriculum Items</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paginatedCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.title}</TableCell>
                      <TableCell><Badge variant="secondary">{course.level}</Badge></TableCell>
                      <TableCell>{course.curriculum?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditCourse(course)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/brand-admin/courses/manage/${course.id}`}><Layers className="mr-2 h-4 w-4" />Manage Curriculum</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(course)} disabled={isDeleting && courseToDelete?.id === course.id}>
                              {isDeleting && courseToDelete?.id === course.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete Course
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between space-x-2 py-4 mt-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">Page {currentPage} of {totalPages} ({filteredCourses.length} total courses)</div>
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
        <AddEditBrandCourseDialog
          isOpen={isCourseDialogOpen}
          setIsOpen={setIsCourseDialogOpen}
          brandId={currentUser.companyId}
          initialData={editingCourse}
          onCourseSaved={(savedCourse) => {
            fetchBrandCourses();
            setIsCourseDialogOpen(false);
            setEditingCourse(null);
          }}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the course "{courseToDelete?.title}". This may also affect any users assigned to this course through brand-specific enrollments.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
