
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, ShieldCheck, Users, Archive, Undo, Building, MapPin, AlertCircle, Loader2, Info } from 'lucide-react'; // Added Info
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
import { getAllUsers, toggleUserStatus, deleteUser, updateUser, getUserByEmail, assignMissingCompanyToUsers, getUsersByCompanyId, getUserOverallProgress } from '@/lib/user-data';
import { getAllCompanies, getAllLocations, getLocationsByCompanyId, getCompanyById } from '@/lib/company-data';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
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
  
  const [accessibleBrands, setAccessibleBrands] = useState<Company[]>([]);
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForFilter, setLocationsForFilter] = useState<Location[]>([]);

  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('');
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all');
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsLoadingFilters(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (!userDetails || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
            toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
            router.push('/');
            setIsLoadingFilters(false);
            return;
          }

          const [fetchedAccessibleBrands, fetchedAllSystemLocations] = await Promise.all([
            getAllCompanies(userDetails),
            getAllLocations(),
          ]);
          setAccessibleBrands(fetchedAccessibleBrands);
          setAllSystemLocations(fetchedAllSystemLocations);

          if (userDetails.role === 'Super Admin') {
            setSelectedBrandIdForFilter('all');
          } else if (userDetails.companyId) {
            setSelectedBrandIdForFilter(userDetails.companyId);
          } else {
             setSelectedBrandIdForFilter('');
          }
        } catch (error) {
          console.error("Error fetching initial filter data:", error);
          toast({ title: "Error", description: "Could not load filter data.", variant: "destructive" });
          setCurrentUser(null);
        } finally {
          setIsLoadingFilters(false);
        }
      } else {
        setCurrentUser(null);
        router.push('/');
        setIsLoadingFilters(false);
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  useEffect(() => {
    if (selectedBrandIdForFilter === 'all') {
      if (currentUser?.role === 'Super Admin') {
        setLocationsForFilter(allSystemLocations);
      } else if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
        const brandIdsUserCanAccess = new Set(accessibleBrands.map(b => b.id));
        setLocationsForFilter(allSystemLocations.filter(loc => brandIdsUserCanAccess.has(loc.companyId)));
      } else {
         setLocationsForFilter([]);
      }
    } else if (selectedBrandIdForFilter) {
      setLocationsForFilter(allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForFilter));
    } else {
      setLocationsForFilter([]);
    }
    setSelectedLocationIdForFilter('all');
  }, [selectedBrandIdForFilter, allSystemLocations, accessibleBrands, currentUser]);

  const fetchUsersForCurrentFilters = useCallback(async () => {
    if (!currentUser || isLoadingFilters || !selectedBrandIdForFilter) {
        setUsers([]);
        if (!isLoadingFilters) setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setLastGeneratedPasswordForNewUser(null); // Clear password when filters change
    try {
        let usersData: User[] = [];
        if (currentUser.role === 'Super Admin') {
            if (selectedBrandIdForFilter === 'all') {
                usersData = await getAllUsers();
            } else {
                usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
            }
        } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId) {
            if (selectedBrandIdForFilter === 'all') {
                const usersPromises = accessibleBrands.map(brand => getUsersByCompanyId(brand.id));
                usersData = (await Promise.all(usersPromises)).flat();
            } else {
                if (accessibleBrands.some(b => b.id === selectedBrandIdForFilter)) {
                    usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
                } else {
                    usersData = [];
                }
            }
        } else if (currentUser.role === 'Manager' && currentUser.companyId) {
            if (selectedBrandIdForFilter === currentUser.companyId) {
                usersData = await getUsersByCompanyId(currentUser.companyId);
            } else {
                usersData = [];
            }
        }
        
        const usersWithProgressPromises = usersData.map(async (user) => {
            const overallProgress = await getUserOverallProgress(user.id);
            let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
            if (overallProgress === 100) overallStatus = "Completed";
            else if (overallProgress > 0) overallStatus = "In Progress";
            return { ...user, overallProgress, overallStatus };
        });
        const usersWithProgress = await Promise.all(usersWithProgressPromises);
        setUsers(usersWithProgress);

    } catch (error) {
        console.error("Error fetching users:", error);
        toast({ title: "Error", description: "Could not load users.", variant: "destructive" });
        setUsers([]);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, selectedBrandIdForFilter, accessibleBrands, toast, isLoadingFilters]);

  useEffect(() => {
    fetchUsersForCurrentFilters();
  }, [fetchUsersForCurrentFilters]);

  useEffect(() => {
    let tempUsers = users;
    if (selectedLocationIdForFilter && selectedLocationIdForFilter !== 'all') {
         tempUsers = tempUsers.filter(user => 
            Array.isArray(user.assignedLocationIds) && 
            user.assignedLocationIds.includes(selectedLocationIdForFilter)
         );
    }
    if (currentUser?.role === 'Manager' && currentUser.companyId === selectedBrandIdForFilter) {
        if (selectedLocationIdForFilter === 'all') {
             tempUsers = tempUsers.filter(user => 
                (user.assignedLocationIds || []).some(locId => (currentUser.assignedLocationIds || []).includes(locId)) || user.id === currentUser.id
            );
        }
    }
    setFilteredUsers(tempUsers);
  }, [users, selectedLocationIdForFilter, currentUser, selectedBrandIdForFilter]);

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
     if (accessibleBrands.length === 0 && currentUser.role === 'Super Admin') {
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
        toast({ title: 'User Deleted', description: `"${userName}" has been removed.` });
    } else {
         toast({ title: 'Error', description: `Failed to delete user "${userName}".`, variant: 'destructive' });
    }
  };

  const handleToggleUserStatus = async (userId: string, userName: string, currentStatus: boolean) => {
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
      toast({ title: currentStatus ? "User Deactivated" : "User Reactivated", description: `${userName}'s status updated.`, variant: currentStatus ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const openEditUserDialog = (userToEdit: User) => {
      if (!canEditUser(userToEdit)) {
          toast({ title: "Permission Denied", description: "You cannot edit this user's details.", variant: "destructive"}); return;
      }
      setUserToEdit(userToEdit); setIsEditUserDialogOpen(true);
  };

  const handleUserUpdated = () => { fetchUsersForCurrentFilters(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const canPerformAction = (targetUser: User): boolean => {
    if (!currentUser) return false; if (currentUser.role === 'Super Admin') return true;
    if (currentUser.id === targetUser.id) return false;
    const currentUserBrandId = currentUser.companyId;
    const targetUserBrandId = targetUser.companyId;
    if (!currentUserBrandId) return false;
    const isTargetInManagedScope = accessibleBrands.some(b => b.id === targetUserBrandId);
    if (!isTargetInManagedScope) return false;
    if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role]) return true;
    if (currentUser.role === 'Manager' && targetUser.role === 'Staff' && targetUserBrandId === currentUserBrandId) return true;
    return false;
  };

  const canEditUser = (targetUser: User): boolean => {
     if (!currentUser) return false;
     if (currentUser.id === targetUser.id) return true;
     if (currentUser.role === 'Super Admin') return true;
     const currentUserBrandId = currentUser.companyId;
     const targetUserBrandId = targetUser.companyId;
     if (!currentUserBrandId) return false;
     const isTargetInManagedScope = accessibleBrands.some(b => b.id === targetUserBrandId);
     if (!isTargetInManagedScope) return false;
     if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[targetUser.role]) return true;
     if (currentUser.role === 'Manager' && targetUser.role === 'Staff' && targetUserBrandId === currentUserBrandId) return true;
     return false;
  };

  const handleResetFilters = () => {
      setSelectedBrandIdForFilter(currentUser?.role === 'Super Admin' ? 'all' : currentUser?.companyId || '');
      setSelectedLocationIdForFilter('all');
  };

  const getInitials = (name?: string | null): string => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';

  if (isLoadingFilters && !currentUser) {
    return ( <div className="container mx-auto py-12 md:py-16 lg:py-20"> <Skeleton className="h-10 w-1/3 mb-8" /> <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm"> <Skeleton className="h-8 w-24" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-32" /> </div> <Card><CardHeader><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div></CardContent></Card> </div> );
  }
  if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
     return <div className="container mx-auto py-12 text-center">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
         <div className="flex items-center gap-2">
            <AddUserDialog onUserAdded={refreshUsersAndShowPassword} isOpen={isAddUserDialogOpen} setIsOpen={setIsAddUserDialogOpen}
                companies={accessibleBrands} locations={allSystemLocations} currentUser={currentUser} />
            <Button onClick={handleAddUserClick} className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoadingFilters || !currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || (accessibleBrands.length === 0 && currentUser.role === 'Super Admin')}
                title={ (accessibleBrands.length === 0 && currentUser?.role === 'Super Admin') ? "Add a brand first" : (!['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser?.role || 'Staff') ? "Permission Denied" : "")} >
                <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
         </div>
        </div>

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong><br/> They will be required to change this on their first login. A welcome email has also been sent. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4 self-center">Filters:</h2>
           <div className="flex flex-col space-y-1">
             <Label htmlFor="brand-filter">Brand:</Label>
             <Select value={selectedBrandIdForFilter}
               onValueChange={(value) => setSelectedBrandIdForFilter(value)}
               disabled={isLoadingFilters || (accessibleBrands.length <= 1 && currentUser.role !== 'Super Admin')}
              >
               <SelectTrigger id="brand-filter" className="w-[220px] bg-background h-10">
                 <SelectValue placeholder="Select Brand" />
               </SelectTrigger>
               <SelectContent>
                 {(currentUser.role === 'Super Admin' || ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && accessibleBrands.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                 {accessibleBrands.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                 {accessibleBrands.length === 0 && currentUser.role !== 'Super Admin' && currentUser.companyId && (
                    <SelectItem value={currentUser.companyId} disabled>{accessibleBrands.find(b => b.id === currentUser.companyId)?.name || "Your Brand"}</SelectItem>
                 )}
               </SelectContent>
             </Select>
           </div>
           <div className="flex flex-col space-y-1">
                <Label htmlFor="location-filter">Location:</Label>
                 <Select value={selectedLocationIdForFilter} onValueChange={(value) => setSelectedLocationIdForFilter(value)}
                    disabled={isLoadingFilters || locationsForFilter.length === 0} >
                    <SelectTrigger id="location-filter" className="w-[220px] bg-background h-10">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locationsForFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                         {selectedBrandIdForFilter && selectedBrandIdForFilter !== 'all' && locationsForFilter.length === 0 && ( <SelectItem value="no-locs" disabled>No locations in this brand</SelectItem> )}
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
                    const brandForUser = accessibleBrands.find(c => c.id === user.companyId);
                    const brandName = brandForUser?.name;
                    const brandIsChild = brandForUser?.parentBrandId;
                    const userLocations = user.assignedLocationIds || [];
                    return (
                        <TableRow key={user.id} className={cn(!user.isActive && "opacity-60")}>
                            <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={user.profileImageUrl || undefined} alt={user.name} /> <AvatarFallback>{getInitials(user.name)}</AvatarFallback> </Avatar> <span>{user.name}</span> </div> </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell> <span className="flex items-center gap-1 text-sm text-muted-foreground"> <Building className="h-4 w-4 opacity-70" /> {brandName || 'Missing/Not Accessible'} {brandIsChild && <Badge variant="outline" className="text-xs">Child</Badge>} {!user.companyId && user.role !== 'Super Admin' && <AlertTriangle className="h-4 w-4 text-yellow-500" title="Brand Missing"/>} </span> </TableCell>
                            <TableCell> <div className="flex flex-wrap gap-1 max-w-xs"> {userLocations.length > 0 ? ( userLocations.map(locId => { const location = allSystemLocations.find(l => l.id === locId); return location ? ( <Badge key={locId} variant="outline" className="text-xs"> <MapPin className="h-3 w-3 mr-1"/> {location.name} </Badge> ) : ( <Badge key={locId} variant="outline" className="text-xs text-muted-foreground italic"> <MapPin className="h-3 w-3 mr-1"/> Unknown </Badge> ); }) ) : ( <span className="text-xs text-muted-foreground italic">None Assigned</span> )} </div> </TableCell>
                            <TableCell> <Badge variant={['Super Admin', 'Admin'].includes(user.role) ? 'default' : 'secondary'}> <ShieldCheck className="mr-1 h-3 w-3 opacity-70" /> {user.role} </Badge> </TableCell>
                            <TableCell> <Button variant="ghost" size="sm" className={cn('p-1 h-auto text-xs rounded-full', user.isActive ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700 hover:dark:bg-green-800' : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700 hover:dark:bg-red-800', !canPerformAction(user) || currentUser?.id === user.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer' )} onClick={() => { if (canPerformAction(user) && currentUser?.id !== user.id) { handleToggleUserStatus(user.id, user.name, user.isActive); } else { toast({ title: "Permission Denied", description: "You cannot change this user's status.", variant: "destructive" }); } }} disabled={!canPerformAction(user) || currentUser?.id === user.id} title={!canPerformAction(user) || currentUser?.id === user.id ? "Cannot change status" : `Click to ${user.isActive ? 'Deactivate' : 'Reactivate'}`} > {user.isActive ? "Active" : "Inactive"} </Button> </TableCell>
                            <TableCell className="text-right space-x-1">
                              {currentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
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
                                          <span>Delete User</span>
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

       {isEditUserDialogOpen && userToEdit && currentUser && ( <EditUserDialog isOpen={isEditUserDialogOpen} setIsOpen={setIsEditUserDialogOpen} user={userToEdit} onUserUpdated={handleUserUpdated} currentUser={currentUser} companies={accessibleBrands} locations={allSystemLocations} /> )}
    </div>
  );
}
