
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, Users, MapPin, Loader2, Building, Search, Infinity, Gift, AlertTriangle, Layers } from 'lucide-react'; // Added Layers
import { useToast } from '@/hooks/use-toast';
import type { Company, User, CompanyFormData } from '@/types/user';
import type { Program } from '@/types/course'; // Import Program type
import { getAllCompanies, deleteCompany, addCompany, getLocationsByCompanyId } from '@/lib/company-data';
import { getAllPrograms } from '@/lib/firestore-data'; // Import getAllPrograms
import { getUserCountByCompanyId } from '@/lib/user-data';
import { AddEditCompanyDialog } from '@/components/admin/AddEditCompanyDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

type CompanyWithCounts = Company & { locationCount: number; userCount: number; assignedCourseCount: number };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true); // Retain for user/location counts if fetched separately initially
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const fetchCompanies = useCallback(async (user: User | null) => {
    if (!user) {
      setIsLoading(false);
      setIsLoadingCounts(false);
      return;
    }
    setIsLoading(true);
    setIsLoadingCounts(true); // This can be used for the initial loading of all data
    try {
      const [companiesData, allProgramsData] = await Promise.all([
        getAllCompanies(user), // Pass current user
        getAllPrograms() // Fetch all programs to calculate course counts
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
  }, [searchTerm, companies]);

  const handleAddCompanyClick = () => {
    if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin' && currentUser.role !== 'Owner')) {
      toast({ title: "Permission Denied", description: "You do not have permission to add brands.", variant: "destructive" });
      return;
    }
    setIsAddDialogOpen(true);
  };

  const openDeleteConfirmation = (company: Company) => {
     if (!currentUser) return;
     // Allow Super Admin OR (Admin/Owner if it's their own company or their child company)
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
        await fetchCompanies(currentUser); // Refetch to update the list
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

   const handleSaveNewCompany = async (companyData: CompanyFormData) => {
     if (!currentUser) {
       toast({ title: "Error", description: "Current user not found.", variant: "destructive" });
       return;
     }
     let added: Company | null = null;
     if (currentUser.role === 'Super Admin') {
       // Super Admin creates a Parent Brand
       added = await addCompany(companyData, currentUser.id, null);
     } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId) {
       // Brand Admin/Owner creates a Child Brand under their own brand
       added = await addCompany(companyData, currentUser.id, currentUser.companyId);
     } else {
       toast({ title: "Permission Denied", description: "You do not have the necessary permissions or brand association to create a new brand.", variant: "destructive" });
       setIsAddDialogOpen(false);
       return;
     }

     if (added) {
        toast({ title: "Brand Added", description: `"${added.name}" added successfully.` });
        fetchCompanies(currentUser); // Refetch companies after adding
     } else {
         toast({ title: "Error", description: "Failed to add brand.", variant: "destructive" });
     }
     setIsAddDialogOpen(false);
   };

   if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
     return <div className="container mx-auto py-12 text-center">Loading or Access Denied...</div>;
   }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Brand Management</h1>
        <Button onClick={handleAddCompanyClick} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Brand
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input type="text" placeholder="Search brands by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm"/>
      </div>
      <Card>
        <CardHeader> <CardTitle>Brand List</CardTitle> <CardDescription>Manage brands, their locations, courses, and users.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center text-muted-foreground py-8"> {searchTerm ? `No brands found matching "${searchTerm}".` : "No brands found. Add one to get started."} </div>
          ) : (
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
                {filteredCompanies.map((company) => {
                    let trialStatusDisplay;
                    if (company.isTrial && company.trialEndsAt) {
                        const endsAt = new Date(company.trialEndsAt); // Assuming trialEndsAt is ISO string
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

                    const brandType = company.parentBrandId ? "Child Brand" : "Parent Brand";

                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={company.logoUrl || undefined} alt={`${company.name} logo`} className="object-contain" /> <AvatarFallback className="text-xs"> {company.name.substring(0, 2).toUpperCase()} </AvatarFallback> </Avatar> <span>{company.name}</span> </div> </TableCell>
                        <TableCell className="text-center"><Badge variant={company.parentBrandId ? "outline" : "default"}>{brandType}</Badge></TableCell>
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
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Brand & Settings
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
          )}
        </CardContent>
      </Card>
      <AddEditCompanyDialog isOpen={isAddDialogOpen} setIsOpen={setIsAddDialogOpen} initialData={null} onSave={handleSaveNewCompany}/>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader> <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently mark the brand "{companyToDelete?.name}" as deleted. Associated users and locations will also be marked as deleted. Child brands (if any) will NOT be automatically deleted but will become orphaned. </AlertDialogDescription> </AlertDialogHeader>
          <AlertDialogFooter> <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={confirmDeleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}> {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : 'Yes, delete brand'} </AlertDialogAction> </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    