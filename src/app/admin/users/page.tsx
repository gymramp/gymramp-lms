
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, ShieldCheck, Users, Archive, Undo, Building, MapPin, AlertCircle, Loader2, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { UserRole, User, Company, Location } from '@/types/user';
import { getAllUsers as fetchAllSystemUsers, toggleUserStatus, deleteUser, updateUser, getUserByEmail, assignMissingCompanyToUsers, getUsersByCompanyId, getUserOverallProgress } from '@/lib/user-data';
import { getAllCompanies as fetchAllAccessibleBrandsForUser, getAllLocations as fetchAllSystemLocations, getLocationsByCompanyId, getCompanyById } from '@/lib/company-data';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';


const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<EmployeeWithOverallProgress[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [accessibleBrandsForFilter, setAccessibleBrandsForFilter] = useState<Company[]>([]);
  const [userPrimaryBrandForManager, setUserPrimaryBrandForManager] = useState<Company | null>(null);
  const [allLocationsForSystem, setAllLocationsForSystem] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);

  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('');
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all');
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const fetchInitialFilterData = useCallback(async (user: User) => {
    setIsLoadingFilters(true);
    setUserPrimaryBrandForManager(null);
    try {
      const fetchedBrands = await fetchAllAccessibleBrandsForUser(user);
      const fetchedLocations = await fetchAllSystemLocations(); 
      
      setAccessibleBrandsForFilter(fetchedBrands);

      if (user.role === 'Manager' && user.companyId) {
        const managerCompany = fetchedBrands.find(b => b.id === user.companyId);
        setUserPrimaryBrandForManager(managerCompany || null);
        // For managers, allSystemLocations should only contain locations they are assigned to within their brand
        setAllLocationsForSystem(fetchedLocations.filter(loc => user.assignedLocationIds?.includes(loc.id) && loc.companyId === user.companyId));
      } else if (user.role === 'Admin' || user.role === 'Owner') {
        const accessibleBrandIds = fetchedBrands.map(b => b.id);
        setAllLocationsForSystem(fetchedLocations.filter(loc => accessibleBrandIds.includes(loc.companyId)));
      } else if (user.role === 'Super Admin') {
        setAllLocationsForSystem(fetchedLocations);
      }

      let initialBrandId = '';
      if (user.role === 'Super Admin') {
        initialBrandId = 'all';
      } else if (user.companyId) {
        initialBrandId = user.companyId;
      }
      setSelectedBrandIdForFilter(initialBrandId);
      setSelectedLocationIdForFilter('all');

    } catch (error) {
      console.error("[AdminUsersPage] Error fetching initial filter data:", error);
      toast({ title: "Error", description: "Could not load filter selection data.", variant: "destructive" });
    } finally {
      setIsLoadingFilters(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails && ['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
          await fetchInitialFilterData(userDetails);
        } else {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
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
        if (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) {
          usersData = await fetchAllSystemUsers();
        } else {
          usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
        }
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
        if (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) {
          const usersPromises = accessibleBrandsForFilter.map(brand => getUsersByCompanyId(brand.id));
          usersData = (await Promise.all(usersPromises)).flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));
        } else if (selectedBrandIdForFilter && accessibleBrandsForFilter.some(b => b.id === selectedBrandIdForFilter)) {
          usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
        }
      } else if (currentUser.role === 'Manager' && currentUser.companyId === selectedBrandIdForFilter) {
         usersData = await getUsersByCompanyId(currentUser.companyId);
      }

      const usersWithProgressPromises = usersData.map(async (user) => {
        const overallProgress = await getUserOverallProgress(user.id);
        let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
        if (overallProgress === 100) overallStatus = "Completed";
        else if (overallProgress > 0) overallStatus = "In Progress";
        return { ...user, overallProgress, overallStatus };
      });
      setUsers(await Promise.all(usersWithProgressPromises));
    } catch (error) {
      console.error("[AdminUsersPage] Error fetching users:", error);
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
      if (currentUser.role === 'Super Admin') {
        currentBrandLocations = allLocationsForSystem;
      } else { 
        const brandIds = accessibleBrandsForFilter.map(b => b.id);
        currentBrandLocations = allLocationsForSystem.filter(loc => brandIds.includes(loc.companyId));
      }
    } else if (selectedBrandIdForFilter) {
      currentBrandLocations = allLocationsForSystem.filter(loc => loc.companyId === selectedBrandIdForFilter);
    }
    
    if (currentUser.role === 'Manager' && currentUser.assignedLocationIds && selectedBrandIdForFilter === currentUser.companyId) {
        setLocationsForLocationFilter(currentBrandLocations.filter(loc => currentUser.assignedLocationIds!.includes(loc.id)));
    } else {
        setLocationsForLocationFilter(currentBrandLocations);
    }

    if (!currentBrandLocations.some(loc => loc.id === selectedLocationIdForFilter) && selectedLocationIdForFilter !== 'all') {
        setSelectedLocationIdForFilter('all');
    }
  }, [selectedBrandIdForFilter, allLocationsForSystem, currentUser, accessibleBrandsForFilter, isLoadingFilters, selectedLocationIdForFilter]);

  useEffect(() => {
    if (isLoading || !currentUser) { setFilteredUsers([]); return; }
    let tempUsers = [...users];
    if (selectedLocationIdForFilter && selectedLocationIdForFilter !== 'all') {
         tempUsers = tempUsers.filter(user => (user.assignedLocationIds || []).includes(selectedLocationIdForFilter));
    } else if (currentUser.role === 'Manager' && selectedBrandIdForFilter === currentUser.companyId && selectedLocationIdForFilter === 'all') {
        const managerLocations = currentUser.assignedLocationIds || [];
        if (managerLocations.length > 0) {
            tempUsers = tempUsers.filter(emp =>
                emp.id === currentUser.id || 
                (emp.assignedLocationIds || []).some(locId => managerLocations.includes(locId))
            );
        } else { 
            tempUsers = tempUsers.filter(emp => emp.id === currentUser.id);
        }
    }
    setFilteredUsers(tempUsers);
  }, [users, selectedLocationIdForFilter, currentUser, isLoading, selectedBrandIdForFilter]);

  const refreshUsersAndShowPassword = (user: User, tempPassword?: string) => {
     fetchUsersForCurrentFilters();
     if (tempPassword) {
         setLastGeneratedPasswordForNewUser(tempPassword);
     }
 };

  const handleAddUserClick = () => {
     if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
       toast({ title: "Permission Denied", variant: "destructive"}); return;
     }
     if (currentUser.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter)) {
        toast({ title: "No Brands Exist", description: "Please add a brand first or select a specific brand for user creation context.", variant: "destructive"}); return;
     }
     if (currentUser.role !== 'Super Admin' && !currentUser.companyId) {
        toast({ title: "Brand Required", description: "You must be associated with a brand to add users.", variant: "destructive"}); return;
     }
    setLastGeneratedPasswordForNewUser(null);
    setIsAddUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const success = await toggleUserStatus(userId);
    if (success) {
        fetchUsersForCurrentFilters();
        toast({ title: 'User Deactivated', description: `"${userName}" has been deactivated.` });
    } else {
         toast({ title: 'Error', description: `Failed to deactivate user "${userName}".`, variant: 'destructive' });
    }
  };

  const handleToggleUserStatus = async (userId: string, userName: string, currentIsActive: boolean) => {
    if (!currentUser || currentUser.id === userId) {
        toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive"}); return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
         toast({ title: "Error", description: "User not found.", variant: "destructive"}); return;
    }
    if (!canPerformAction(targetUser)) {
        toast({ title: "Permission Denied", description: "You do not have permission to change this user's status.", variant: "destructive"}); return;
    }
    const updatedUser = await toggleUserStatus(userId);
    if (updatedUser) {
      fetchUsersForCurrentFilters();
      toast({ title: currentIsActive ? "User Deactivated" : "User Reactivated", description: `${userName}'s status updated.`, variant: currentIsActive ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const openEditUserDialog = (userToEditData: User) => {
      if (!canEditUser(userToEditData)) {
          toast({ title: "Permission Denied", description: "You cannot edit this user's details.", variant: "destructive"}); return;
      }
      setUserToEdit(userToEditData); setIsEditUserDialogOpen(true);
  };

  const handleUserUpdated = () => { fetchUsersForCurrentFilters(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const canPerformAction = (targetUser: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin') return currentUser.id !== targetUser.id; 
    if (currentUser.id === targetUser.id) return false; 

    const currentUserBrandId = currentUser.companyId;
    const targetUserBrandId = targetUser.companyId;

    if (!currentUserBrandId) return false; 

    const isTargetBrandAccessible = accessibleBrandsForFilter.some(b => b.id === targetUserBrandId);
    if (!isTargetBrandAccessible) return false;

    if (currentUser.role === 'Manager') {
        return targetUserBrandId === currentUserBrandId && (targetUser.role === 'Staff' || targetUser.role === 'Manager');
    }
    if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
        return ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role];
    }
    return false;
  };

  const canEditUser = (targetUser: User): boolean => {
     if (!currentUser) return false;
     if (currentUser.id === targetUser.id) return true; 
     if (currentUser.role === 'Super Admin') return true;

     const currentUserBrandId = currentUser.companyId;
     const targetUserBrandId = targetUser.companyId;
     if (!currentUserBrandId) return false;

     const isTargetBrandAccessible = accessibleBrandsForFilter.some(b => b.id === targetUserBrandId);
     if (!isTargetBrandAccessible) return false;

     if ((currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
         return ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[targetUser.role];
     }
     if (currentUser.role === 'Manager') {
         return targetUserBrandId === currentUserBrandId && (targetUser.role === 'Staff' || targetUser.role === 'Manager');
     }
     return false;
  };

  const handleResetFilters = () => {
      const initialBrandId = currentUser?.role === 'Super Admin' ? 'all' : (currentUser?.companyId || '');
      setSelectedBrandIdForFilter(initialBrandId);
      setSelectedLocationIdForFilter('all');
  };

  const getInitials = (name?: string | null): string => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';

  if (isLoadingFilters && !currentUser) {
    return ( <div className="container mx-auto"> <Skeleton className="h-10 w-1/3 mb-8" /> <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm"> <Skeleton className="h-8 w-24" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-32" /> </div> <Card><CardHeader><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div></CardContent></Card> </div> );
  }
  if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
     return <div className="container mx-auto text-center">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="container mx-auto">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
         <div className="flex items-center gap-2">
            <Button onClick={handleAddUserClick} className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoadingFilters || !currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || (currentUser.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter))}
                title={ (currentUser?.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter)) ? "Add a brand first or select a specific brand" : ""} >
                <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
         </div>
        </div>

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> A welcome email with a temporary password has been sent to the user. The temporary password is: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong><br/> They will be required to change this password on their first login. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4 self-center text-foreground">Filters:</h2>
           <div className="flex flex-col space-y-1">
             <Label htmlFor="brand-filter-users">Brand:</Label>
             {currentUser?.role === 'Manager' ? (
                <Input
                    id="brand-filter-users-manager"
                    value={isLoadingFilters ? 'Loading brand...' : userPrimaryBrandForManager?.name || 'Brand Not Found'}
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
                  <SelectContent>
                    <SelectItem value="placeholder-brand" disabled>Select a brand...</SelectItem>
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
                    </SelectContent>
                </Select>
            </div>
         <Button variant="outline" onClick={handleResetFilters} className="h-10 self-end" disabled={isLoadingFilters}>Reset Filters</Button>
        </div>

      <Card>
        <CardHeader> <CardTitle>User List</CardTitle> <CardDescription>Manage user accounts, roles, and status within the selected scope.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div>
           ) : (
            <EmployeeTable
                employees={filteredUsers}
                onToggleEmployeeStatus={handleToggleUserStatus}
                onAssignCourse={() => { /* Placeholder or handled by parent */ }}
                onEditUser={openEditUserDialog}
                currentUser={currentUser}
                locations={allLocationsForSystem} 
                companies={accessibleBrandsForFilter} 
            />
           )}
       </CardContent>
      </Card>

      <AddUserDialog
        onUserAdded={refreshUsersAndShowPassword}
        isOpen={isAddUserDialogOpen}
        setIsOpen={setIsAddUserDialogOpen}
        companies={accessibleBrandsForFilter}
        locations={allLocationsForSystem} 
        currentUser={currentUser}
      />
      {isEditUserDialogOpen && userToEdit && currentUser && (
         <EditUserDialog
            isOpen={isEditUserDialogOpen}
            setIsOpen={setIsEditUserDialogOpen}
            user={userToEdit}
            onUserUpdated={handleUserUpdated}
            currentUser={currentUser}
            companies={accessibleBrandsForFilter} 
            locations={allLocationsForSystem} 
         />
        )}
    </div>
  );
}
    
      

