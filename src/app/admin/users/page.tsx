
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, ShieldCheck, Users, Archive, Undo, KeyRound, Building, MapPin, AlertCircle, Loader2 } from 'lucide-react';
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
import { useRouter } from 'next/navigation'; // Import useRouter
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const router = useRouter();


  const { toast } = useToast();

  const fetchCurrentUser = useCallback(async () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // --- DEVELOPMENT ONLY: Simulate Super Admin for /admin/users page if not logged in ---
      // SET THIS TO false TO DISABLE THE SIMULATION
      const SIMULATE_SUPER_ADMIN_FOR_DEV = process.env.NODE_ENV === 'development';

      if (SIMULATE_SUPER_ADMIN_FOR_DEV && !firebaseUser) {
        console.warn(
          "DEVELOPMENT ONLY: No user logged in. Simulating Super Admin for /admin/users page. This is a temporary workaround. Disable by setting SIMULATE_SUPER_ADMIN_FOR_DEV to false or when not in development."
        );
        const mockSuperAdmin: User = {
          id: 'dev-super-admin-id-001',
          name: 'Dev Super Admin (Simulated)',
          email: 'dev-super-admin@example.com',
          role: 'Super Admin',
          companyId: '', // Super Admins might not have a company, or use a mock one
          assignedLocationIds: [],
          isActive: true,
          isDeleted: false,
          createdAt: new Date(), // Or Timestamp.now() if using Firestore Timestamp
        };
        setCurrentUser(mockSuperAdmin);
        setCurrentUserName(mockSuperAdmin.name);
        // No redirect, allow page to load.
        // fetchDataBasedOnRole will be called due to currentUser changing.
        return; // Skip further auth logic for this dev-only case
      }
      // --- END DEVELOPMENT ONLY SECTION ---

      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        setCurrentUserName(userDetails?.name || 'User');

        // Authorization: Super Admin, Admin, Owner, or Manager can access
        if (!userDetails || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
           toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
           router.push('/'); // Redirect if not authorized
           return;
        }

        if (userDetails && userDetails.role !== 'Super Admin') {
           setSelectedCompanyId(userDetails.companyId || 'all');
           setSelectedLocationId('all');
        } else {
           setSelectedCompanyId('all');
           setSelectedLocationId('all');
        }
      } else {
        // Normal case: No user logged in and not in dev simulation mode
        setCurrentUser(null);
        setCurrentUserName('');
        setSelectedCompanyId('all');
        setSelectedLocationId('all');
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]); // Ensure all dependencies of the original useCallback are present

   const fetchDataBasedOnRole = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            let fetchedCompanies: Company[] = [];
            let fetchedLocations: Location[] = [];
            let fetchedUsers: User[] = [];

            const defaultCompany = await createDefaultCompany();

            if (currentUser.role === 'Super Admin') {
                fetchedCompanies = await getAllCompanies();
                fetchedLocations = await getAllLocations();
                fetchedUsers = await getAllUsers();
            } else if (currentUser.companyId) {
                const userCompany = await getCompanyById(currentUser.companyId);
                fetchedCompanies = userCompany ? [userCompany] : [];
                fetchedLocations = await getLocationsByCompanyId(currentUser.companyId);
                const companyUsers = await getUsersByCompanyId(currentUser.companyId);
                 if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
                    fetchedUsers = companyUsers;
                } else if (currentUser.role === 'Manager') {
                    // Managers see Staff in their company. Specific location filtering for display is done client-side.
                    fetchedUsers = companyUsers.filter((emp) => emp.role === 'Staff' || emp.id === currentUser.id);
                } else { // Should not happen due to page access check, but as a fallback
                    fetchedUsers = companyUsers.filter(emp => emp.id === currentUser.id);
                }
            } else {
                 if (defaultCompany) {
                    await updateUser(currentUser.id, { companyId: defaultCompany.id });
                    fetchedCompanies = [defaultCompany];
                    fetchedUsers = currentUser ? [{...currentUser, companyId: defaultCompany.id}] : [];
                    setSelectedCompanyId(defaultCompany.id);
                    setCurrentUser(prev => prev ? {...prev, companyId: defaultCompany.id} : null);
                 } else {
                     toast({ title: "Error", description: "Could not assign default company.", variant: "destructive" });
                     fetchedCompanies = [];
                     fetchedUsers = currentUser ? [currentUser] : [];
                     setSelectedCompanyId('all');
                 }
                 fetchedLocations = [];
            }

            setCompanies(fetchedCompanies);
            setAllLocations(fetchedLocations);
            setUsers(fetchedUsers);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "Could not load companies, locations, or users.", variant: "destructive" });
        } finally {
             setIsLoading(false);
        }
   }, [currentUser, toast]);

   useEffect(() => {
     fetchCurrentUser();
   }, [fetchCurrentUser]);

   useEffect(() => {
      fetchDataBasedOnRole();
   }, [fetchDataBasedOnRole]);


    const filterUsers = useCallback(() => {
        let tempUsers = users;
        if (selectedCompanyId && selectedCompanyId !== 'all') {
            tempUsers = tempUsers.filter(user => user.companyId === selectedCompanyId);
        }
        if (selectedLocationId && selectedLocationId !== 'all') {
             tempUsers = tempUsers.filter(user => Array.isArray(user.assignedLocationIds) && user.assignedLocationIds.includes(selectedLocationId));
        }
        // Further filter for Manager role if needed (e.g., only show Staff)
        if (currentUser?.role === 'Manager') {
            tempUsers = tempUsers.filter(user => user.role === 'Staff' || user.id === currentUser.id);
        }
        setFilteredUsers(tempUsers);
    }, [users, selectedCompanyId, selectedLocationId, currentUser]);

    useEffect(() => {
        filterUsers();
    }, [filterUsers]);

    useEffect(() => {
        if (selectedCompanyId === 'all') {
            if (currentUser?.role === 'Super Admin') {
                setFilteredLocations(allLocations);
            } else if (currentUser?.companyId) {
                // For non-SuperAdmins, if 'all' company means all locations in *their* company
                setFilteredLocations(allLocations.filter(loc => loc.companyId === currentUser.companyId));
            } else {
                setFilteredLocations([]);
            }
        } else {
            // Filter by selected company, but also by manager's assigned locations if manager
            let companySpecificLocations = allLocations.filter(loc => loc.companyId === selectedCompanyId);
            if (currentUser?.role === 'Manager') {
                 companySpecificLocations = companySpecificLocations.filter(loc =>
                    (currentUser.assignedLocationIds || []).includes(loc.id)
                );
            }
            setFilteredLocations(companySpecificLocations);
        }
        setSelectedLocationId('all'); // Reset location filter when company changes
    }, [selectedCompanyId, allLocations, currentUser]);


   const refreshUsers = () => {
       fetchDataBasedOnRole();
   };


  const handleAddUserClick = () => {
     if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
       toast({ title: "Permission Denied", description: "You do not have permission to add users.", variant: "destructive"});
       return;
     }
     if (currentUser.role !== 'Super Admin' && !currentUser.companyId) {
        toast({ title: "Company Required", description: "You must be associated with a company to add users.", variant: "destructive"});
        return;
     }
     if (companies.length === 0 && currentUser.role === 'Super Admin') {
        toast({ title: "No Companies Exist", description: "Please add a company before adding users.", variant: "destructive"});
        return;
     }
    setIsAddUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const success = await deleteUser(userId);
    if (success) {
        refreshUsers();
        toast({ title: 'User Deleted', description: `"${userName}" has been removed.`, });
    } else {
         toast({ title: 'Error', description: `Failed to delete user "${userName}".`, variant: 'destructive' });
    }
  };

  const handleToggleUserStatus = async (userId: string, userName: string, currentStatus: boolean) => {
    if (!currentUser || currentUser.id === userId) {
        toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive"});
        return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
         toast({ title: "Error", description: "User not found.", variant: "destructive"});
        return;
    }

    if (!canPerformAction(targetUser)) {
        toast({ title: "Permission Denied", description: "You do not have permission to change this user's status.", variant: "destructive"});
        return;
    }

    const updatedUser = await toggleUserStatus(userId);
    if (updatedUser) {
      refreshUsers();
      toast({
          title: currentStatus ? "User Deactivated" : "User Reactivated",
          description: `${userName}'s status has been updated.`,
          variant: currentStatus ? "destructive" : "default",
      });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const openEditUserDialog = (user: User) => {
      if (!canEditUser(user)) {
          toast({ title: "Permission Denied", description: "You cannot edit this user's details.", variant: "destructive"});
          return;
      }
      setUserToEdit(user);
      setIsEditUserDialogOpen(true);
  };

  const handleUserUpdated = () => {
    refreshUsers();
    setIsEditUserDialogOpen(false);
  };


  const canPerformAction = (targetUser: User): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin') return true; // Super Admin can do anything to anyone (except demote other Super Admins perhaps)
    if (currentUser.id === targetUser.id) return false; // Cannot act on self
    if (!currentUser.companyId || currentUser.companyId !== targetUser.companyId) return false; // Must be in same company

    // Admin/Owner can act on roles lower than theirs in their company
    if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role]) {
        return true;
    }
    // Manager can only act on Staff in their company
    if (currentUser.role === 'Manager' && targetUser.role === 'Staff') {
        return true;
    }
    return false;
  };

  const canEditUser = (targetUser: User): boolean => {
     if (!currentUser) return false;
     if (currentUser.role === 'Super Admin') return true;
     if (currentUser.id === targetUser.id) return true; // Can edit self
     if (!currentUser.companyId || currentUser.companyId !== targetUser.companyId) return false; // Must be in same company

     // Admin/Owner can edit roles lower than or equal to theirs in their company (but not higher)
     if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[targetUser.role]) {
        return true;
     }
     // Manager can only edit Staff in their company
     if (currentUser.role === 'Manager' && targetUser.role === 'Staff') {
         return true;
     }
     return false;
  };

  const handleResetFilters = () => {
      setSelectedCompanyId(currentUser?.role === 'Super Admin' ? 'all' : currentUser?.companyId || 'all');
      setSelectedLocationId('all');
  };

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading && !currentUser) { // Show loading skeleton only if currentUser is not yet determined
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent><div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div></CardContent>
        </Card>
      </div>
    );
  }
  if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
     // This case should be handled by the redirect in fetchCurrentUser, but as a safeguard
     return <div className="container mx-auto py-12 text-center">Access Denied. Redirecting...</div>;
  }


  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
       <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">User Management</h1>
         <div className="flex items-center gap-2">
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen} >
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                 <DialogDescription>
                    Enter the details of the new user. They will be added to the selected company and locations.
                 </DialogDescription>
               </DialogHeader>
                  <Button
                    onClick={handleAddUserClick}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || isLoading || (companies.length === 0 && currentUser.role === 'Super Admin')}
                    title={ (companies.length === 0 && currentUser?.role === 'Super Admin') ? "Add a company before adding users" : (!['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser?.role || 'Staff') ? "You do not have permission to add users" : "")}
                   >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                  </Button>
                 <AddUserDialog
                    isOpen={isAddUserDialogOpen}
                    setIsOpen={setIsAddUserDialogOpen}
                    onUserAdded={refreshUsers}
                    companies={companies}
                    locations={allLocations} // Pass all locations, AddUserDialog will filter by selected company
                    currentUser={currentUser}
                 />
            </Dialog>
         </div>
          </div>

       <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
         <h2 className="text-lg font-semibold mr-4">Filters:</h2>
         {currentUser?.role === 'Super Admin' && (
           <div className="flex items-center gap-2">
             <Label htmlFor="company-filter">Company:</Label>
             <Select value={selectedCompanyId} onValueChange={(value) => {setSelectedCompanyId(value === 'all-companies' ? 'all' : value); setSelectedLocationId('all');}}>
               <SelectTrigger id="company-filter" className="w-[200px] bg-background">
                 <SelectValue placeholder="All Companies" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all-companies">All Companies</SelectItem>
                 {companies.map(company => (
                   <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         )}

          {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Owner' || currentUser?.role === 'Manager') && (
             <div className="flex items-center gap-2">
                <Label htmlFor="location-filter">Location:</Label>
                 <Select
                    value={selectedLocationId}
                    onValueChange={(value) => setSelectedLocationId(value === 'all-locations' ? 'all' : value)}
                    disabled={!selectedCompanyId || (selectedCompanyId === 'all' && !['Super Admin', 'Admin', 'Owner'].includes(currentUser?.role || 'Staff')) || filteredLocations.length === 0}
                    >
                    <SelectTrigger id="location-filter" className="w-[200px] bg-background">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-locations">All Locations</SelectItem>
                        {filteredLocations.map(location => (
                            <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                        ))}
                         {selectedCompanyId !== 'all' && filteredLocations.length === 0 && (
                           <SelectItem value="none" disabled>No locations for this company</SelectItem>
                         )}
                    </SelectContent>
                </Select>
            </div>
         )}
         <Button variant="outline" onClick={handleResetFilters}>Reset Filters</Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>Manage user accounts, roles, and status within the selected scope.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
           ) : filteredUsers.length === 0 ? (
             <div className="text-center text-muted-foreground py-8">No users found matching the current filters.</div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                    const companyName = user.companyId ? companies.find(c => c.id === user.companyId)?.name : 'N/A';
                    const userLocations = user.assignedLocationIds || [];
                    return (
                        <TableRow key={user.id} className={cn(!user.isActive && "opacity-60")}>
                            <TableCell className="font-medium">
                               <div className="flex items-center gap-3">
                                   <Avatar className="h-8 w-8 border">
                                     <AvatarImage src={user.profileImageUrl || undefined} alt={user.name} />
                                     <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                   </Avatar>
                                   <span>{user.name}</span>
                               </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building className="h-4 w-4 opacity-70" />
                                {companyName || 'Missing'}
                                {!user.companyId && <AlertTriangle className="h-4 w-4 text-yellow-500" title="Company Missing"/>}
                            </span>
                            </TableCell>
                            <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                                {userLocations.length > 0 ? (
                                userLocations.map(locId => {
                                    const location = allLocations.find(l => l.id === locId);
                                    return location ? (
                                        <Badge key={locId} variant="outline" className="text-xs">
                                            <MapPin className="h-3 w-3 mr-1"/>
                                            {location.name}
                                        </Badge>
                                    ) : (
                                         <Badge key={locId} variant="outline" className="text-xs text-muted-foreground italic">
                                             <MapPin className="h-3 w-3 mr-1"/>
                                             Unknown ({locId.substring(0, 6)})
                                         </Badge>
                                    );
                                })
                                ) : (
                                <span className="text-xs text-muted-foreground italic">None Assigned</span>
                                )}
                            </div>
                            </TableCell>
                            <TableCell>
                            <Badge variant={['Super Admin', 'Admin'].includes(user.role) ? 'default' : 'secondary'}>
                                <ShieldCheck className="mr-1 h-3 w-3 opacity-70" /> {user.role}
                            </Badge>
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        'p-1 h-auto text-xs rounded-full',
                                        user.isActive
                                            ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700 hover:dark:bg-green-800'
                                            : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700 hover:dark:bg-red-800',
                                        !canPerformAction(user) || currentUser?.id === user.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    )}
                                    onClick={() => {
                                        if (canPerformAction(user) && currentUser?.id !== user.id) {
                                            handleToggleUserStatus(user.id, user.name, user.isActive);
                                        } else {
                                             toast({
                                                title: "Permission Denied",
                                                description: "You cannot change this user's status.",
                                                variant: "destructive"
                                            });
                                        }
                                    }}
                                    disabled={!canPerformAction(user) || currentUser?.id === user.id}
                                    title={!canPerformAction(user) || currentUser?.id === user.id ? "You cannot change this user's status" : `Click to ${user.isActive ? 'Deactivate' : 'Reactivate'}`}
                                >
                                    {user.isActive ? "Active" : "Inactive"}
                                </Button>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                            {currentUser && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" >
                                      <>
                                        <span className="sr-only">Open menu for {user.name}</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </>
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions for {user.name}</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => openEditUserDialog(user)} disabled={!canEditUser(user)}>
                                      <>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Edit Details</span>
                                      </>
                                    </DropdownMenuItem>
                                    {user.id !== currentUser.id && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                            onClick={() => handleDeleteUser(user.id, user.name)}
                                            disabled={!canPerformAction(user)}
                                        >
                                          <>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Delete User</span>
                                          </>
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
            companies={companies}
            locations={allLocations} // Pass all locations, EditUserDialog will filter
         />
       )}
    </div>
  );
}
