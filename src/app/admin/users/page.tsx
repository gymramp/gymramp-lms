
// src/app/admin/users/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Users, Archive, Undo, Building, MapPin, AlertCircle, Loader2, Info, PlusCircle } from 'lucide-react';
// DropdownMenu related imports removed as they are no longer used for edit/assign
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input'; // Keep Input if used for search, etc.
import { useToast } from '@/hooks/use-toast';
import type { UserRole, User, Company, Location } from '@/types/user';
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers as fetchAllSystemUsers, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';
import Link from 'next/link';
// AssignCourseDialog and EditUserDialog are removed as their functionality moves to a new page

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<EmployeeWithOverallProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessibleBrandsForFilter, setAccessibleBrandsForFilter] = useState<Company[]>([]);
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);
  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('');
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all');
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const fetchInitialFilterData = useCallback(async (user: User) => {
    setIsLoadingFilters(true);
    try {
      const fetchedBrands = await fetchAllAccessibleBrandsForUser(user);
      setAccessibleBrandsForFilter(fetchedBrands);
      const relevantSystemLocations = await fetchAllSystemLocations();
      setAllSystemLocations(relevantSystemLocations);
      setSelectedBrandIdForFilter(user.role === 'Super Admin' ? 'all' : user.companyId || 'all');
      setSelectedLocationIdForFilter('all');
    } catch (error) {
      toast({ title: "Error", description: "Could not load filter data.", variant: "destructive" });
    } finally {
      setIsLoadingFilters(false);
    }
  }, [toast]);

  useEffect(() => {
    setIsLoadingFilters(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails && (userDetails.role === 'Super Admin' || userDetails.role === 'Admin' || userDetails.role === 'Owner' || userDetails.role === 'Manager')) {
          await fetchInitialFilterData(userDetails);
        } else {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/');
          setIsLoadingFilters(false); setIsLoading(false);
        }
      } else {
        router.push('/');
        setCurrentUser(null);
        setIsLoadingFilters(false); setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchInitialFilterData]);

  const fetchUsersForCurrentFilters = useCallback(async () => {
    if (!currentUser || isLoadingFilters || !selectedBrandIdForFilter) {
      setUsers([]);
      if (!isLoadingFilters && selectedBrandIdForFilter) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLastGeneratedPasswordForNewUser(null);
    try {
      let usersData: User[] = [];
      if (currentUser.role === 'Super Admin') {
        usersData = (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter)
          ? await fetchAllSystemUsers()
          : await getUsersByCompanyId(selectedBrandIdForFilter);
      } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId) {
         usersData = (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter || selectedBrandIdForFilter === currentUser.companyId)
            ? await getUsersByCompanyId(currentUser.companyId) // Admins/Owners see their own company by default or if 'all' is selected in their context
            : (accessibleBrandsForFilter.some(b => b.id === selectedBrandIdForFilter) // Check if selected brand is one they can manage
                ? await getUsersByCompanyId(selectedBrandIdForFilter)
                : []);
      } else if (currentUser.role === 'Manager' && currentUser.companyId) {
         usersData = await getUsersByCompanyId(currentUser.companyId);
      }

      const usersWithProgressPromises = usersData.map(async (user) => ({
        ...user, overallProgress: 0, overallStatus: "Not Started" as const // Placeholder for progress
      }));
      setUsers(await Promise.all(usersWithProgressPromises));
    } catch (error) {
      toast({ title: "Error", description: "Could not load users.", variant: "destructive" });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, selectedBrandIdForFilter, accessibleBrandsForFilter, toast, isLoadingFilters]);

  useEffect(() => {
    fetchUsersForCurrentFilters();
  }, [fetchUsersForCurrentFilters]);

 useEffect(() => {
    if (isLoadingFilters || !currentUser) {
      setLocationsForLocationFilter([]);
      return;
    }
    let currentBrandLocations: Location[] = [];
    if (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) {
      currentBrandLocations = allSystemLocations;
    } else if (selectedBrandIdForFilter) {
      currentBrandLocations = allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForFilter);
    }
    setLocationsForLocationFilter(currentBrandLocations);
    if (!currentBrandLocations.some(loc => loc.id === selectedLocationIdForFilter) && selectedLocationIdForFilter !== 'all') {
        setSelectedLocationIdForFilter('all');
    }
  }, [selectedBrandIdForFilter, allSystemLocations, currentUser, isLoadingFilters, selectedLocationIdForFilter]);

 useEffect(() => {
    if (isLoading || !currentUser) { setFilteredUsers([]); return; }
    let tempUsers = [...users];
    if (selectedLocationIdForFilter && selectedLocationIdForFilter !== 'all') {
         tempUsers = tempUsers.filter(user => (user.assignedLocationIds || []).includes(selectedLocationIdForFilter));
    }
    setFilteredUsers(tempUsers);
  }, [users, selectedLocationIdForFilter, currentUser, isLoading]);

  const handleToggleUserStatus = async (userId: string, userName: string, currentIsActive: boolean) => {
    if (!currentUser || currentUser.id === userId) {
        toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive"}); return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
         toast({ title: "Error", description: "User not found.", variant: "destructive"}); return;
    }
    const updatedUser = await toggleUserDataStatus(userId);
    if (updatedUser) {
      fetchUsersForCurrentFilters();
      toast({ title: currentIsActive ? "User Deactivated" : "User Reactivated", variant: currentIsActive ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const handleResetFilters = () => {
      let initialBrandId = '';
      if (currentUser?.role === 'Super Admin') initialBrandId = 'all';
      else if (currentUser?.companyId) initialBrandId = currentUser.companyId;
      setSelectedBrandIdForFilter(initialBrandId);
      setSelectedLocationIdForFilter('all');
  };

  if (isLoadingFilters && !currentUser) {
    return ( <div className="container mx-auto"> <h1 className="text-3xl font-bold mb-8">User Management</h1> <div className="flex flex-wrap items-center gap-4 mb-6 p-4"> <Skeleton className="h-8 w-24" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-32" /> </div> <Card><CardHeader><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> </div></CardContent></Card> </div> );
  }
  if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
     return <div className="container mx-auto text-center">Access Denied.</div>;
  }

  const managerBrandNameForDisplay = currentUser?.role === 'Manager' && currentUser.companyId 
    ? accessibleBrandsForFilter.find(b => b.id === currentUser.companyId)?.name || 'Loading brand...'
    : '';

  return (
    <div className="container mx-auto">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
         <div className="flex items-center gap-2">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoadingFilters || !currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || (currentUser.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter))}
                title={ (currentUser?.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter)) ? "Add a brand first" : ""} >
                <Link href="/admin/users/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                </Link>
            </Button>
         </div>
        </div>

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6"> <ShieldCheck className="h-4 w-4" /> <AlertTitle>New User Added!</AlertTitle> <AlertDescription> Temporary password: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong>. Welcome email sent. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4">Dismiss</Button> </AlertDescription> </Alert> )}

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4 self-center text-foreground">Filters:</h2>
           <div className="flex flex-col space-y-1">
             <Label htmlFor="brand-filter-users">Brand:</Label>
             {currentUser?.role === 'Manager' ? (
                <Input
                    id="brand-filter-users-manager"
                    value={managerBrandNameForDisplay}
                    readOnly
                    disabled
                    className="w-[220px] bg-background/50 h-10"
                />
             ) : (
                <Select
                  value={selectedBrandIdForFilter || 'placeholder-brand'}
                  onValueChange={(value) => setSelectedBrandIdForFilter(value === 'placeholder-brand' ? '' : value)}
                  disabled={isLoadingFilters || (currentUser?.role === 'Super Admin' && accessibleBrandsForFilter.length === 0)}
                >
                    <SelectTrigger id="brand-filter-users" className="w-[220px] bg-background h-10">
                        <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                  <SelectContent> <SelectItem value="placeholder-company" disabled>Select a brand...</SelectItem>
                    {(currentUser?.role === 'Super Admin' || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && accessibleBrandsForFilter.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                    {accessibleBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                    {accessibleBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && (
                        <SelectItem value="no-brands" disabled>No Brands Found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
             )}
           </div>
           <div className="flex flex-col space-y-1">
                <Label htmlFor="location-filter-users">Location:</Label>
                 <Select value={selectedLocationIdForFilter} onValueChange={(value) => setSelectedLocationIdForFilter(value)}
                    disabled={isLoadingFilters || locationsForLocationFilter.length === 0} >
                    <SelectTrigger id="location-filter-users" className="w-[220px] bg-background h-10">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locationsForLocationFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                         {selectedBrandIdForFilter && selectedBrandIdForFilter !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="no-locs" disabled>No locations in this brand</SelectItem> )}
                         {(selectedBrandIdForFilter === 'all' && currentUser?.role !== 'Super Admin' && locationsForLocationFilter.length === 0) && (<SelectItem value="no-locs-all" disabled>No locations in accessible brands</SelectItem>)}
                         {(selectedBrandIdForFilter === 'all' && currentUser?.role === 'Super Admin' && allSystemLocations.length === 0) && (<SelectItem value="no-locs-sys" disabled>No locations in system</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
         <Button variant="outline" onClick={handleResetFilters} className="h-10 self-end" disabled={isLoadingFilters}>Reset Filters</Button>
        </div>

      <Card>
        <CardHeader> <CardTitle>User List</CardTitle> <CardDescription>Manage user accounts, roles, and status.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> </div>
           ) : (
            <EmployeeTable
                employees={filteredUsers}
                onToggleEmployeeStatus={handleToggleUserStatus}
                currentUser={currentUser}
                locations={allSystemLocations}
                companies={accessibleBrandsForFilter}
                baseEditPath="/admin/users" // Set base path for Super Admin context
            />
           )}
       </CardContent>
      </Card>
    </div>
  );
}
