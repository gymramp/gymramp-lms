
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Users, MapPin, Loader2, Building, Search, Infinity, Gift, AlertTriangle, Layers, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, User, CompanyFormData } from '@/types/user';
import type { Program } from '@/types/course';
import { getAllCompanies, deleteCompany, getLocationsByCompanyId } from '@/lib/company-data';
import { getAllPrograms } from '@/lib/firestore-data';
import { getUserCountByCompanyId } from '@/lib/user-data';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Label } from "@/components/ui/label"; 

type CompanyWithCounts = Company & { locationCount: number; userCount: number; assignedCourseCount: number };
const DEFAULT_ROWS_PER_PAGE = 10; 

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);
  const { toast } = useToast();
  const router = useRouter();

  const fetchCompanies = useCallback(async (user: User | null) => {
    if (!user) {
      setIsLoading(false);
      setIsLoadingCounts(false);
      return;
    }
    setIsLoading(true);
    setIsLoadingCounts(true); 
    try {
      const [companiesData, allProgramsData] = await Promise.all([
        getAllCompanies(user), 
        getAllPrograms() 
      ]);

      const programsMap = new Map(allProgramsData.map(p => [p.id, p]));

      const companiesWithCountsPromises = companiesData.map(async (company) => {
        const locations = await getLocationsByCompanyId(company.id);
        const userCount = await getUserCountByCompanyId(company.id);
        
        let globalCourseIds = new Set<string>();
        if (company.assignedProgramIds && company.assignedProgramIds.length > 0) {
          company.assignedProgramIds.forEach(programId => {
            const program = programsMap.get(programId);
            if (program && program.courseIds) {
              program.courseIds.forEach(courseId => globalCourseIds.add(courseId));
            }
          });
        }
        const assignedCourseCount = globalCourseIds.size;

        return { 
          ...company, 
          locationCount: locations.length, 
          userCount: userCount, 
          assignedCourseCount: assignedCourseCount 
        };
      });
      const companiesWithCounts = await Promise.all(companiesWithCountsPromises);
      setCompanies(companiesWithCounts);
      setFilteredCompanies(companiesWithCounts);
    } catch (error) {
      console.error("Failed to fetch brands or programs:", error);
      toast({ title: "Error", description: "Could not load brands or program data.", variant: "destructive" });
      setCompanies([]);
      setFilteredCompanies([]);
    } finally {
      setIsLoading(false);
      setIsLoadingCounts(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails && (userDetails.role === 'Super Admin' || userDetails.role === 'Admin' || userDetails.role === 'Owner')) {
          fetchCompanies(userDetails);
        } else {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchCompanies]);


  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredCompanies(filtered);
    setCurrentPage(1); 
  }, [searchTerm, companies]);

  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredCompanies.length / rowsToShow);
  const paginatedCompanies = useMemo(() => {
      if (!filteredCompanies) return [];
      if (rowsPerPage === 'all') return filteredCompanies;
      const startIndex = (currentPage - 1) * rowsPerPage;
      return filteredCompanies.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredCompanies, currentPage, rowsPerPage]);

  const openDeleteConfirmation = (company: Company) => {
     if (!currentUser) return;
     let canDelete = false;
     if (currentUser.role === 'Super Admin') {
         canDelete = true;
     } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId) {
         if (company.id === currentUser.companyId || company.parentBrandId === currentUser.companyId) {
             canDelete = true;
         }
     }

     if (canDelete) {
        setCompanyToDelete(company);
        setIsDeleteDialogOpen(true);
     } else {
        toast({ title: "Permission Denied", description: "You cannot delete this brand.", variant: "destructive" });
     }
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsLoading(true);
    try {
      const success = await deleteCompany(companyToDelete.id);
      if (success) {
        await fetchCompanies(currentUser); 
        toast({
          title: 'Brand Deleted',
          description: `Brand "${companyToDelete.name}" and its direct associations (users, locations) have been marked as deleted. Child brands are not automatically deleted.`,
        });
      } else {
        throw new Error('Delete operation returned false.');
      }
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast({ title: 'Error Deleting Brand', description: `Could not delete brand "${companyToDelete.name}".`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
      setCompanyToDelete(null);
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


   if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
     return <div className="container mx-auto text-center">Loading or Access Denied...</div>;
   }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Brand Management</h1>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/admin/companies/new">
            <span className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Brand
            </span>
          </Link>
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input type="text" placeholder="Search brands by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm"/>
      </div>
      <Card>
        <CardHeader> <CardTitle>Brand List</CardTitle> <CardDescription>Manage customer brands, their locations, courses, and users.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center text-muted-foreground py-8"> {searchTerm ? `No brands found matching "${searchTerm}".` : "No brands found. Add one to get started."} </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand Name</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Locations</TableHead>
                  <TableHead className="text-center">Users (Active)</TableHead>
                  <TableHead className="text-center">Max Users</TableHead>
                  <TableHead className="text-center">Courses Assigned (Global)</TableHead>
                  <TableHead className="text-center">Trial Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCompanies.map((company) => {
                    let trialStatusDisplay;
                    if (company.isTrial && company.trialEndsAt) {
                        const endsAt = new Date(company.trialEndsAt as string); 
                        if (endsAt < new Date()) {
                            trialStatusDisplay = <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Ended: {endsAt.toLocaleDateString()}</Badge>;
                        } else {
                            trialStatusDisplay = <Badge variant="default" className="bg-green-100 text-green-700 flex items-center gap-1"><Gift className="h-3 w-3" />Active: Ends {endsAt.toLocaleDateString()}</Badge>;
                        }
                    } else if (company.isTrial) {
                         trialStatusDisplay = <Badge variant="secondary">Trial (No End Date)</Badge>;
                    } else {
                        trialStatusDisplay = <span className="text-xs text-muted-foreground">Not a Trial</span>;
                    }

                    const accountType = company.parentBrandId ? "Child Brand" : "Parent Account";

                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={company.logoUrl || undefined} alt={`${company.name} logo`} className="object-contain" /> <AvatarFallback className="text-xs"> {company.name.substring(0, 2).toUpperCase()} </AvatarFallback> </Avatar> <span>{company.name}</span> </div> </TableCell>
                        <TableCell className="text-center"><Badge variant={company.parentBrandId ? "outline" : "default"}>{accountType}</Badge></TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.locationCount} </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.userCount} </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.maxUsers === null || company.maxUsers === undefined ? <Infinity className="h-4 w-4 mx-auto text-muted-foreground" title="Unlimited"/> : company.maxUsers} </TableCell>
                        <TableCell className="text-center">
                            {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 
                             <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                                 <Layers className="h-3 w-3" /> {company.assignedCourseCount}
                             </Badge>
                            }
                        </TableCell>
                        <TableCell className="text-center">{trialStatusDisplay}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu for {company.name}</span>
                                  <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Manage {company.name}</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/companies/${company.id}/edit`}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Details & Settings
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/companies/${company.id}/locations`}>
                                  <MapPin className="mr-2 h-4 w-4" />
                                  Manage Locations
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users?companyId=${company.id}`}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Manage Users
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(company)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Brand
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between space-x-2 py-4 mt-4 border-t">
                <div className="flex-1 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredCompanies.length} total brands)
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader> <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently mark the brand "{companyToDelete?.name}" as deleted. Associated users and locations will also be marked as deleted. Child brands (if any) will NOT be automatically deleted but will become orphaned. </AlertDialogDescription> </AlertDialogHeader>
          <AlertDialogFooter> <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={confirmDeleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}> {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : 'Yes, delete brand'} </AlertDialogAction> </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
