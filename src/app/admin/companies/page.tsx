
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, Users, MapPin, Loader2, BookOpen, Search, Infinity, Gift, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, User } from '@/types/user';
import { getAllCompanies, deleteCompany, addCompany, getLocationsByCompanyId } from '@/lib/company-data';
import { getUsersByCompanyId, getUserCountByCompanyId } from '@/lib/user-data';
import { AddEditCompanyDialog } from '@/components/admin/AddEditCompanyDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
import { Badge } from '@/components/ui/badge'; // Import Badge

type CompanyWithCounts = Company & { locationCount: number; userCount: number; assignedCourseCount: number };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push('/');
        } else {
          fetchCompanies();
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingCounts(true);
    try {
      const companiesData = await getAllCompanies();
      const companiesWithCountsPromises = companiesData.map(async (company) => {
          const locations = await getLocationsByCompanyId(company.id);
          const userCount = await getUserCountByCompanyId(company.id); 
          const assignedCourseCount = company.assignedCourseIds?.length || 0;
          return { ...company, locationCount: locations.length, userCount: userCount, assignedCourseCount };
      });
      const companiesWithCounts = await Promise.all(companiesWithCountsPromises);
      setCompanies(companiesWithCounts);
      setFilteredCompanies(companiesWithCounts);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
      toast({ title: "Error", description: "Could not load brands.", variant: "destructive" });
      setCompanies([]);
      setFilteredCompanies([]);
    } finally {
      setIsLoading(false);
      setIsLoadingCounts(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchCompanies();
    }
  }, [currentUser, fetchCompanies]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredCompanies(filtered);
  }, [searchTerm, companies]);

  const handleAddCompanyClick = () => {
    setIsAddDialogOpen(true);
  };

  const openDeleteConfirmation = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsLoading(true);
    try {
      const success = await deleteCompany(companyToDelete.id);
      if (success) {
        await fetchCompanies();
        toast({
          title: 'Brand Deleted',
          description: `Brand "${companyToDelete.name}" and all associated locations/users have been deleted.`,
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
       const added = await addCompany(companyData);
       if (added) {
          toast({ title: "Brand Added", description: `"${added.name}" added successfully.` });
          fetchCompanies();
       } else {
           toast({ title: "Error", description: "Failed to add brand.", variant: "destructive" });
       }
     setIsAddDialogOpen(false);
   };

   if (currentUser === null || currentUser?.role !== 'Super Admin') {
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
        <CardHeader> <CardTitle>Brand List</CardTitle> <CardDescription>Manage brands, locations, courses, and users.</CardDescription> </CardHeader>
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
                  <TableHead className="text-center">Locations</TableHead>
                  <TableHead className="text-center">Users (Active)</TableHead>
                  <TableHead className="text-center">Max Users</TableHead>
                  <TableHead className="text-center">Courses Assigned</TableHead>
                  <TableHead className="text-center">Trial Status</TableHead> {}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => {
                    let trialStatusDisplay;
                    if (company.isTrial) {
                        const endsAt = company.trialEndsAt instanceof Timestamp ? company.trialEndsAt.toDate() : null;
                        if (endsAt && endsAt < new Date()) {
                            trialStatusDisplay = <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Ended: {endsAt.toLocaleDateString()}</Badge>;
                        } else if (endsAt) {
                            trialStatusDisplay = <Badge variant="default" className="bg-green-100 text-green-700 flex items-center gap-1"><Gift className="h-3 w-3" />Active: Ends {endsAt.toLocaleDateString()}</Badge>;
                        } else {
                             trialStatusDisplay = <Badge variant="secondary">Trial (No End Date)</Badge>;
                        }
                    } else {
                        trialStatusDisplay = <span className="text-xs text-muted-foreground">Not a Trial</span>;
                    }

                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={company.logoUrl || undefined} alt={`${company.name} logo`} className="object-contain" /> <AvatarFallback className="text-xs"> {company.name.substring(0, 2).toUpperCase()} </AvatarFallback> </Avatar> <span>{company.name}</span> </div> </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.locationCount} </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.userCount} </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.maxUsers === null || company.maxUsers === undefined ? <Infinity className="h-4 w-4 mx-auto text-muted-foreground" title="Unlimited"/> : company.maxUsers} </TableCell>
                        <TableCell className="text-center"> {isLoadingCounts ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : company.assignedCourseCount} </TableCell>
                        <TableCell className="text-center">{trialStatusDisplay}</TableCell> {}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button variant="ghost" className="h-8 w-8 p-0">
                                <>
                                  <span className="sr-only">Open menu for {company.name}</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Manage</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/companies/${company.id}/edit`}>
                                  <span className="flex items-center gap-2">
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Edit Brand &amp; Settings</span>
                                  </span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/companies/${company.id}/locations`}>
                                  <span className="flex items-center gap-2">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    <span>Manage Locations</span>
                                  </span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users?companyId=${company.id}`}>
                                  <span className="flex items-center gap-2">
                                    <Users className="mr-2 h-4 w-4" />
                                    <span>Manage Users</span>
                                  </span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(company)}>
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" /> <span>Delete Brand</span>
                                </>
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
          <AlertDialogHeader> <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently delete the brand "{companyToDelete?.name}", all its locations, and all associated user accounts. </AlertDialogDescription> </AlertDialogHeader>
          <AlertDialogFooter> <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={confirmDeleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}> {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : 'Yes, delete brand'} </AlertDialogAction> </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

