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
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole, Company, Location } from '@/types/user';
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
  const [allLocationsForSystem, setAllLocationsForSystem] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);

  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('');
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all');
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();

  const fetchInitialFilterData = useCallback(async (user: User) => {
    setIsLoadingFilters(true);
    try {
      const [fetchedBrands, fetchedLocations] = await Promise.all([
        fetchAllAccessibleBrandsForUser(user),
        fetchAllSystemLocations()
      ]);
      setAccessibleBrandsForFilter(fetchedBrands);

      if (user.role === 'Manager' && user.assignedLocationIds) {
        setAllLocationsForSystem(fetchedLocations.filter(loc => user.assignedLocationIds!.includes(loc.id)));
      } else {
        setAllLocationsForSystem(fetchedLocations);
      }
      
      let initialBrandId = '';
      if (user.role === 'Super Admin') {
        initialBrandId = 'all';
      } else if (user.companyId) {
        initialBrandId = user.companyId;
      }
      setSelectedBrandIdForFilter(initialBrandId);

    } catch (error) {
      console.error("Error fetching initial filter data:", error);
      toast({ title: "Error", description: "Could not load filter data.", variant: "destructive" });
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
          toast({ title: "Access Denied", description: "You do not have permission.", variant: "destructive" });
          router.push('/');
          setIsLoadingFilters(false);
        }
      } else {
        router.push('/');
        setIsLoadingFilters(false);
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchInitialFilterData]);

  useEffect(() => {
    if (isLoadingFilters || !currentUser) {
      setLocationsForLocationFilter([]);
      setSelectedLocationIdForFilter('all');
      return;
    }
    
    let currentBrandLocations: Location[] = [];
    if (selectedBrandIdForFilter === 'all') {
      if (currentUser.role === 'Super Admin') {
        currentBrandLocations = allLocationsForSystem;
      } else { 
        const brandIds = accessibleBrandsForFilter.map(b => b.id);
        currentBrandLocations = allLocationsForSystem.filter(loc => brandIds.includes(loc.companyId));
      }
    } else if (selectedBrandIdForFilter) {
      currentBrandLocations = allLocationsForSystem.filter(loc => loc.companyId === selectedBrandIdForFilter);
    }
    
    if (currentUser.role === 'Manager' && currentUser.assignedLocationIds) {
        setLocationsForLocationFilter(currentBrandLocations.filter(loc => currentUser.assignedLocationIds!.includes(loc.id)));
    } else {
        setLocationsForLocationFilter(currentBrandLocations);
    }
    setSelectedLocationIdForFilter('all');
  }, [selectedBrandIdForFilter, allLocationsForSystem, currentUser, accessibleBrandsForFilter, isLoadingFilters]);

  const fetchUsersForCurrentFilters = useCallback(async () => {
    if (!currentUser || isLoadingFilters) {
        setUsers([]);
        if (!isLoadingFilters) setIsLoading(false);
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
            if (selectedBrandIdForFilter === 'all') {
                const usersPromises = accessibleBrandsForFilter.map(brand => getUsersByCompanyId(brand.id));
                const usersByBrand = await Promise.all(usersPromises);
                usersData = usersByBrand.flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));
            } else if (selectedBrandIdForFilter && accessibleBrandsForFilter.some(b => b.id === selectedBrandIdForFilter)) {
                usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
            }
        } else if (currentUser.role === 'Manager' && currentUser.companyId) {
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
        console.error("Error fetching users:", error);
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
    if (isLoading || !currentUser) { setFilteredUsers([]); return; }
    
    let tempUsers = [...users];

    if (selectedLocationIdForFilter && selectedLocationIdForFilter !== 'all') {
         tempUsers = tempUsers.filter(user => (user.assignedLocationIds || []).includes(selectedLocationIdForFilter));
    } else if (currentUser.role === 'Manager' && selectedLocationIdForFilter === 'all') {
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
  }, [users, selectedLocationIdForFilter, currentUser, isLoading]);

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
     if (currentUser.role === 'Super Admin' && accessibleBrandsForFilter.length === 0 && selectedBrandIdForFilter === 'all') {
        toast({ title: "No Brands Exist", description: "Please add a brand first.", variant: "destructive"}); return;
     }
     if (currentUser.role !== 'Super Admin' && !currentUser.companyId) {
        toast({ title: "Brand Required", description: "You must be associated with a brand to add users.", variant: "destructive"}); return;
     }
    setLastGeneratedPasswordForNewUser(null);
    setIsAddUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const success = await deleteUser(userId);
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

    if (!currentUserBrandId || !targetUserBrandId) return false;

    const isTargetBrandAccessible = accessibleBrandsForFilter.some(b => b.id === targetUserBrandId);
    if (!isTargetBrandAccessible) return false;

    if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
        return ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role];
    }
    if (currentUser.role === 'Manager') {
        return targetUserBrandId === currentUserBrandId && (targetUser.role === 'Staff' || targetUser.role === 'Manager');
    }
    return false;
  };

  const canEditUser = (targetUser: User): boolean => {
     if (!currentUser) return false;
     if (currentUser.id === targetUser.id) return true; 
     if (currentUser.role === 'Super Admin') return true;

     const currentUserBrandId = currentUser.companyId;
     const targetUserBrandId = targetUser.companyId;
     if (!currentUserBrandId || !targetUserBrandId) return false;
     
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
      const initialBrandId = currentUser?.role === 'Super Admin' ? 'all' : currentUser?.companyId || '';
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
            <AddUserDialog 
                onUserAdded={refreshUsersAndShowPassword} 
                isOpen={isAddUserDialogOpen} 
                setIsOpen={setIsAddUserDialogOpen}
                companies={accessibleBrandsForFilter}
                locations={allLocationsForSystem}
                currentUser={currentUser} 
            />
            <Button onClick={handleAddUserClick} className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoadingFilters || !currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || (accessibleBrandsForFilter.length === 0 && currentUser.role === 'Super Admin' && selectedBrandIdForFilter === 'all')}
                title={ (accessibleBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && selectedBrandIdForFilter === 'all') ? "Add a brand first" : (!['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser?.role || 'Staff') ? "Permission Denied" : "")} >
                <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
         </div>
        </div>

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong><br/> A welcome email has been sent. They will be required to change this password on their first login. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4 self-center">Filters:</h2>
           <div className="flex flex-col space-y-1">
             <Label htmlFor="brand-filter">Brand:</Label>
             <Select value={selectedBrandIdForFilter}
               onValueChange={(value) => setSelectedBrandIdForFilter(value)}
               disabled={isLoadingFilters || (accessibleBrandsForFilter.length === 0 && currentUser.role === 'Super Admin') || currentUser.role === 'Manager'}
              >
               <SelectTrigger id="brand-filter" className="w-[220px] bg-background h-10">
                 <SelectValue placeholder="Select Brand" />
               </SelectTrigger>
               <SelectContent>
                 {(currentUser.role === 'Super Admin' || ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && accessibleBrandsForFilter.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                 {accessibleBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                 {accessibleBrandsForFilter.length === 1 && (currentUser.role === 'Admin' || currentUser.role === 'Owner' || currentUser.role === 'Manager') &&
                     <SelectItem value={accessibleBrandsForFilter[0].id}>{accessibleBrandsForFilter[0].name}</SelectItem>
                 }
                 {accessibleBrandsForFilter.length === 0 && currentUser.role === 'Super Admin' && (
                    <SelectItem value="no-brands" disabled>No Brands Found</SelectItem>
                 )}
               </SelectContent>
             </Select>
           </div>
           <div className="flex flex-col space-y-1">
                <Label htmlFor="location-filter">Location:</Label>
                 <Select value={selectedLocationIdForFilter} onValueChange={(value) => setSelectedLocationIdForFilter(value)}
                    disabled={isLoadingFilters || locationsForLocationFilter.length === 0} >
                    <SelectTrigger id="location-filter" className="w-[220px] bg-background h-10">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locationsForLocationFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                         {selectedBrandIdForFilter && selectedBrandIdForFilter !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="no-locs" disabled>No locations in this brand</SelectItem> )}
                    </SelectContent>
                </Select>
            </div>
         <Button variant="outline" onClick={handleResetFilters} className="h-10 self-end" disabled={isLoadingFilters}>Reset Filters</Button>
        </div>

      <Card>
        <CardHeader> <CardTitle>User List</CardTitle> <CardDescription>Manage user accounts, roles, and status within the selected scope.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div>
           ) : filteredUsers.length === 0 ? ( <div className="text-center text-muted-foreground py-8">No users found matching the current filters.</div>
           ) : (
            <Table>
              <TableHeader> <TableRow> <TableHead>Name</TableHead> <TableHead>Email</TableHead> <TableHead>Brand</TableHead> <TableHead>Locations</TableHead> <TableHead>Role</TableHead> <TableHead>Status</TableHead> <TableHead className="text-right">Actions</TableHead> </TableRow> </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                    const brandForUser = accessibleBrandsForFilter.find(c => c.id === user.companyId);
                    const brandName = brandForUser?.name || (user.companyId ? "Brand (Filtered Out)" : "N/A");
                    const brandIsChild = !!(brandForUser && brandForUser.parentBrandId);

                    const userLocations = user.assignedLocationIds || [];
                    return (
                        <TableRow key={user.id} className={cn(!user.isActive && "opacity-60")}>
                            <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={user.profileImageUrl || undefined} alt={user.name || 'User'} /> <AvatarFallback>{getInitials(user.name)}</AvatarFallback> </Avatar> <span>{user.name}</span> </div> </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell> <span className="flex items-center gap-1 text-sm text-muted-foreground"> <Building className="h-4 w-4 opacity-70" /> {brandName} {brandIsChild && <Badge variant="outline" className="text-xs">Child</Badge>} {!user.companyId && user.role !== 'Super Admin' && <AlertCircle className="h-4 w-4 text-yellow-500" title="Brand Missing"/>} </span> </TableCell>
                            <TableCell> <div className="flex flex-wrap gap-1 max-w-xs"> {userLocations.length > 0 ? ( userLocations.map(locId => { const location = allLocationsForSystem.find(l => l.id === locId); return location ? ( <Badge key={locId} variant="outline" className="text-xs"> <MapPin className="h-3 w-3 mr-1"/> {location.name} </Badge> ) : ( <Badge key={locId} variant="outline" className="text-xs text-muted-foreground italic"> <MapPin className="h-3 w-3 mr-1"/> Unknown </Badge> ); }) ) : ( <span className="text-xs text-muted-foreground italic">None Assigned</span> )} </div> </TableCell>
                            <TableCell> <Badge variant={['Super Admin', 'Admin'].includes(user.role) ? 'default' : 'secondary'}> <ShieldCheck className="mr-1 h-3 w-3 opacity-70" /> {user.role} </Badge> </TableCell>
                            <TableCell> <Button variant="ghost" size="sm" className={cn('p-1 h-auto text-xs rounded-full', user.isActive ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700 hover:dark:bg-green-800' : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700 hover:dark:bg-red-800', !canPerformAction(user) || currentUser?.id === user.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer' )} onClick={() => { if (canPerformAction(user) && currentUser?.id !== user.id) { handleToggleUserStatus(user.id, user.name, user.isActive); } else { toast({ title: "Permission Denied", description: "You cannot change this user's status.", variant: "destructive" }); } }} disabled={!canPerformAction(user) || currentUser?.id === user.id} title={!canPerformAction(user) || currentUser?.id === user.id ? "Cannot change status" : `Click to ${user.isActive ? 'Deactivate' : 'Reactivate'}`} > {user.isActive ? "Active" : "Inactive"} </Button> </TableCell>
                            <TableCell className="text-right space-x-1">
                              {currentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" >
                                      <span> 
                                        <span className="sr-only">Open menu for {user.name}</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions for {user.name}</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => openEditUserDialog(user)} disabled={!canEditUser(user)}>
                                       <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit Details</span>
                                    </DropdownMenuItem>
                                    {user.id !== currentUser.id && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                          onClick={() => handleDeleteUser(user.id, user.name)}
                                          disabled={!canPerformAction(user)}
                                        >
                                           <Trash2 className="mr-2 h-4 w-4" />
                                          <span>Deactivate User</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                        </TableRow>
                     );
                    })}
              </TableBody>
            </Table>
          )}
       </CardContent>
      </Card>

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
