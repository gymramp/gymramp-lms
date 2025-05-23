
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, MoreHorizontal, Trash2, Edit, ShieldCheck, Users, Archive, Undo, KeyRound, Building, MapPin, AlertCircle, Loader2, Info } from 'lucide-react';
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
import { getAllUsers, toggleUserStatus, deleteUser, updateUser, getUserByEmail, assignMissingCompanyToUsers, getUsersByCompanyId } from '@/lib/user-data';
import { getAllCompanies, getAllLocations, getLocationsByCompanyId, getCompanyById, createDefaultCompany } from '@/lib/company-data';
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
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessibleBrands, setAccessibleBrands] = useState<Company[]>([]); // Renamed from companies
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]); // To store all locations for dialogs
  const [locationsForFilter, setLocationsForFilter] = useState<Location[]>([]); // Locations for the filter dropdown
  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('all'); // Renamed
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all'); // Renamed
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchCoreData = useCallback(async () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);

        if (!userDetails || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
           toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
           router.push('/');
           setIsLoading(false);
           return;
        }
        
        setIsLoading(true);
        try {
          const fetchedBrands = await getAllCompanies(userDetails); // Fetches accessible brands
          setAccessibleBrands(fetchedBrands);

          const fetchedAllLocations = await getAllLocations(); // Get all locations for dialogs
          setAllSystemLocations(fetchedAllLocations);

          if (userDetails.role !== 'Super Admin' && userDetails.companyId) {
            setSelectedBrandIdForFilter(userDetails.companyId);
            setLocationsForFilter(fetchedAllLocations.filter(loc => loc.companyId === userDetails.companyId));
          } else if (fetchedBrands.length > 0 && userDetails.role === 'Super Admin') {
            // setSelectedBrandIdForFilter('all'); // Default for Super Admin
            // setLocationsForFilter(fetchedAllLocations);
             // If Super Admin and 'all' is selected, populate with all locations, or based on first brand initially
            if (selectedBrandIdForFilter === 'all') {
              setLocationsForFilter(fetchedAllLocations);
            } else if (selectedBrandIdForFilter) {
              setLocationsForFilter(fetchedAllLocations.filter(loc => loc.companyId === selectedBrandIdForFilter));
            } else {
              setLocationsForFilter(fetchedAllLocations); // Fallback for Super Admin if no brand selected yet
            }
          } else {
            setLocationsForFilter([]);
          }

        } catch (error) {
            console.error("Error fetching initial data for User Management:", error);
            toast({ title: "Error", description: "Could not load initial brand/location data.", variant: "destructive" });
        } finally {
            setIsLoading(false); // Moved initial setIsLoading(false) here
        }

      } else {
        setCurrentUser(null);
        router.push('/');
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, toast]); // Removed selectedBrandIdForFilter from deps

  useEffect(() => {
    fetchCoreData();
  }, [fetchCoreData]);

  const fetchUsersForSelectedBrand = useCallback(async () => {
    if (!currentUser) return;
    if (selectedBrandIdForFilter === 'all' && currentUser.role === 'Super Admin') {
        setIsLoading(true);
        getAllUsers().then(setUsers).finally(() => setIsLoading(false));
    } else if (selectedBrandIdForFilter && selectedBrandIdForFilter !== 'all') {
        setIsLoading(true);
        getUsersByCompanyId(selectedBrandIdForFilter).then(setUsers).finally(() => setIsLoading(false));
    } else if (currentUser.role !== 'Super Admin' && currentUser.companyId) {
        // For non-SuperAdmins, if no specific brand is selected (shouldn't happen if filter defaults to their brand),
        // fetch users for their own brand.
        setIsLoading(true);
        getUsersByCompanyId(currentUser.companyId).then(setUsers).finally(() => setIsLoading(false));
    } else {
        setUsers([]); // No brand selected, or user has no default brand (shouldn't happen for non-SA)
    }
  }, [currentUser, selectedBrandIdForFilter]);

  useEffect(() => {
    fetchUsersForSelectedBrand();
  }, [fetchUsersForSelectedBrand]);

  useEffect(() => {
    let tempUsers = users;
    // Filtering by brand is now handled by fetchUsersForSelectedBrand
    if (selectedLocationIdForFilter && selectedLocationIdForFilter !== 'all') {
         tempUsers = tempUsers.filter(user => Array.isArray(user.assignedLocationIds) && user.assignedLocationIds.includes(selectedLocationIdForFilter));
    }
    if (currentUser?.role === 'Manager') {
        tempUsers = tempUsers.filter(user => user.role === 'Staff' || user.id === currentUser.id);
    }
    setFilteredUsers(tempUsers);
  }, [users, selectedLocationIdForFilter, currentUser]);


  useEffect(() => {
    if (selectedBrandIdForFilter === 'all') {
      setLocationsForFilter(currentUser?.role === 'Super Admin' ? allSystemLocations : allSystemLocations.filter(loc => loc.companyId === currentUser?.companyId));
    } else {
      setLocationsForFilter(allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForFilter));
    }
    setSelectedLocationIdForFilter('all'); // Reset location filter when brand changes
  }, [selectedBrandIdForFilter, allSystemLocations, currentUser]);

  const refreshUsersAndShowPassword = (user: User, tempPassword?: string) => {
     fetchUsersForSelectedBrand(); // Re-fetch users based on current brand filter
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
        fetchUsersForSelectedBrand();
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
      fetchUsersForSelectedBrand();
      toast({ title: currentStatus ? "User Deactivated" : "User Reactivated", description: `${userName}'s status updated.`, variant: currentStatus ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const openEditUserDialog = (user: User) => {
      if (!canEditUser(user)) {
          toast({ title: "Permission Denied", description: "You cannot edit this user's details.", variant: "destructive"}); return;
      }
      setUserToEdit(user); setIsEditUserDialogOpen(true);
  };

  const handleUserUpdated = () => { fetchUsersForSelectedBrand(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const canPerformAction = (targetUser: User): boolean => {
    if (!currentUser) return false; if (currentUser.role === 'Super Admin') return true;
    if (currentUser.id === targetUser.id) return false;
    if (!currentUser.companyId || currentUser.companyId !== targetUser.companyId) {
        // Check if current user is Admin/Owner of parent brand and target user is in a child brand
        const parentBrandOfTarget = accessibleBrands.find(b => b.id === targetUser.companyId && b.parentBrandId === currentUser.companyId);
        if (!parentBrandOfTarget && currentUser.companyId !== targetUser.companyId) return false; // Not own brand, not child brand
    }
    if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role]) return true;
    if (currentUser.role === 'Manager' && targetUser.role === 'Staff') return true;
    return false;
  };

  const canEditUser = (targetUser: User): boolean => {
     if (!currentUser) return false; if (currentUser.role === 'Super Admin') return true;
     if (currentUser.id === targetUser.id) return true;
     if (!currentUser.companyId || currentUser.companyId !== targetUser.companyId) {
        const parentBrandOfTarget = accessibleBrands.find(b => b.id === targetUser.companyId && b.parentBrandId === currentUser.companyId);
        if (!parentBrandOfTarget && currentUser.companyId !== targetUser.companyId) return false;
     }
     if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[targetUser.role]) return true;
     if (currentUser.role === 'Manager' && targetUser.role === 'Staff') return true;
     return false;
  };

  const handleResetFilters = () => {
      setSelectedBrandIdForFilter(currentUser?.role === 'Super Admin' ? 'all' : currentUser?.companyId || 'all');
      setSelectedLocationIdForFilter('all');
  };

  const getInitials = (name?: string | null): string => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';

  if (isLoading && !currentUser) {
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
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} >
                  <Button onClick={handleAddUserClick} className="bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || isLoading || (accessibleBrands.length === 0 && currentUser.role === 'Super Admin')}
                    title={ (accessibleBrands.length === 0 && currentUser?.role === 'Super Admin') ? "Add a brand first" : (!['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser?.role || 'Staff') ? "Permission Denied" : "")} >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                  </Button>
                 <AddUserDialog onUserAdded={refreshUsersAndShowPassword} isOpen={isAddUserDialogOpen} setIsOpen={setIsAddUserDialogOpen}
                    companies={accessibleBrands} locations={allSystemLocations} currentUser={currentUser} />
            </Dialog>
         </div>
        </div>

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong><br/> They will be required to change this on their first login. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

       <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4">Filters:</h2>
           <div className="flex items-center gap-2">
             <Label htmlFor="brand-filter">Brand:</Label>
             <Select value={selectedBrandIdForFilter}
               onValueChange={(value) => setSelectedBrandIdForFilter(value === 'all-brands' ? 'all' : value)}
               disabled={currentUser?.role !== 'Super Admin' && !!currentUser?.companyId && accessibleBrands.length <= 1}>
               <SelectTrigger id="brand-filter" className="w-[200px] bg-background">
                 <SelectValue placeholder="All Brands" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all-brands">All Accessible Brands</SelectItem>
                 {accessibleBrands.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : "(Parent)"}</SelectItem> ))}
               </SelectContent>
             </Select>
           </div>
           <div className="flex items-center gap-2">
                <Label htmlFor="location-filter">Location:</Label>
                 <Select value={selectedLocationIdForFilter} onValueChange={(value) => setSelectedLocationIdForFilter(value === 'all-locations' ? 'all' : value)}
                    disabled={locationsForFilter.length === 0} >
                    <SelectTrigger id="location-filter" className="w-[200px] bg-background">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-locations">All Locations</SelectItem>
                        {locationsForFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                         {selectedBrandIdForFilter !== 'all' && locationsForFilter.length === 0 && ( <SelectItem value="none" disabled>No locations for this brand</SelectItem> )}
                    </SelectContent>
                </Select>
            </div>
         <Button variant="outline" onClick={handleResetFilters}>Reset Filters</Button>
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
                    const brandName = user.companyId ? accessibleBrands.find(c => c.id === user.companyId)?.name : 'N/A';
                    const brandIsChild = user.companyId ? accessibleBrands.find(c => c.id === user.companyId)?.parentBrandId : false;
                    const userLocations = user.assignedLocationIds || [];
                    return (
                        <TableRow key={user.id} className={cn(!user.isActive && "opacity-60")}>
                            <TableCell className="font-medium"> <div className="flex items-center gap-3"> <Avatar className="h-8 w-8 border"> <AvatarImage src={user.profileImageUrl || undefined} alt={user.name} /> <AvatarFallback>{getInitials(user.name)}</AvatarFallback> </Avatar> <span>{user.name}</span> </div> </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell> <span className="flex items-center gap-1 text-sm text-muted-foreground"> <Building className="h-4 w-4 opacity-70" /> {brandName || 'Missing'} {brandIsChild && <Badge variant="outline" className="text-xs">Child</Badge>} {!user.companyId && <AlertTriangle className="h-4 w-4 text-yellow-500" title="Brand Missing"/>} </span> </TableCell>
                            <TableCell> <div className="flex flex-wrap gap-1 max-w-xs"> {userLocations.length > 0 ? ( userLocations.map(locId => { const location = allSystemLocations.find(l => l.id === locId); return location ? ( <Badge key={locId} variant="outline" className="text-xs"> <MapPin className="h-3 w-3 mr-1"/> {location.name} </Badge> ) : ( <Badge key={locId} variant="outline" className="text-xs text-muted-foreground italic"> <MapPin className="h-3 w-3 mr-1"/> Unknown </Badge> ); }) ) : ( <span className="text-xs text-muted-foreground italic">None Assigned</span> )} </div> </TableCell>
                            <TableCell> <Badge variant={['Super Admin', 'Admin'].includes(user.role) ? 'default' : 'secondary'}> <ShieldCheck className="mr-1 h-3 w-3 opacity-70" /> {user.role} </Badge> </TableCell>
                            <TableCell> <Button variant="ghost" size="sm" className={cn('p-1 h-auto text-xs rounded-full', user.isActive ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700 hover:dark:bg-green-800' : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700 hover:dark:bg-red-800', !canPerformAction(user) || currentUser?.id === user.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer' )} onClick={() => { if (canPerformAction(user) && currentUser?.id !== user.id) { handleToggleUserStatus(user.id, user.name, user.isActive); } else { toast({ title: "Permission Denied", description: "You cannot change this user's status.", variant: "destructive" }); } }} disabled={!canPerformAction(user) || currentUser?.id === user.id} title={!canPerformAction(user) || currentUser?.id === user.id ? "Cannot change status" : `Click to ${user.isActive ? 'Deactivate' : 'Reactivate'}`} > {user.isActive ? "Active" : "Inactive"} </Button> </TableCell>
                            <TableCell className="text-right space-x-1"> {currentUser && ( <DropdownMenu> <DropdownMenuTrigger asChild> <Button variant="ghost" className="h-8 w-8 p-0" > <> <span className="sr-only">Open menu for {user.name}</span> <MoreHorizontal className="h-4 w-4" /> </> </Button> </DropdownMenuTrigger> <DropdownMenuContent align="end"> <DropdownMenuLabel>Actions for {user.name}</DropdownMenuLabel> <DropdownMenuItem onClick={() => openEditUserDialog(user)} disabled={!canEditUser(user)}> <> <Edit className="mr-2 h-4 w-4" /> <span>Edit Details</span> </> </DropdownMenuItem> {user.id !== currentUser.id && ( <> <DropdownMenuSeparator /> <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteUser(user.id, user.name)} disabled={!canPerformAction(user)} > <> <Trash2 className="mr-2 h-4 w-4" /> <span>Delete User</span> </> </DropdownMenuItem> </> )} </DropdownMenuContent> </DropdownMenu> )} </TableCell>
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

    