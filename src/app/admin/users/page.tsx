
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
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers as fetchAllSystemUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { getAllCourses as getAllLibraryCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms, getProgramById } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
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
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { Course, BrandCourse } from '@/types/course';


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
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);
  const [availableCoursesForAssignment, setAvailableCoursesForAssignment] = useState<(Course | BrandCourse)[]>([]);
  const [isAssignCourseDialogOpen, setIsAssignCourseDialogOpen] = useState(false);
  const [userToAssignCourse, setUserToAssignCourse] = useState<User | null>(null);


  const [selectedBrandIdForFilter, setSelectedBrandIdForFilter] = useState<string>('');
  const [selectedLocationIdForFilter, setSelectedLocationIdForFilter] = useState<string>('all');
  const [lastGeneratedPasswordForNewUser, setLastGeneratedPasswordForNewUser] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const fetchInitialFilterData = useCallback(async (user: User) => {
    setIsLoadingFilters(true);
    console.log("[AdminUsersPage fetchInitialFilterData] Starting for user:", user.email, "Role:", user.role);
    try {
      const fetchedBrands = await fetchAllAccessibleBrandsForUser(user);
      setAccessibleBrandsForFilter(fetchedBrands);

      const allLocs = await fetchAllSystemLocations();
      let relevantSystemLocations: Location[] = [];
      if (user.role === 'Super Admin') {
          relevantSystemLocations = allLocs;
      } else if (user.companyId) {
          const accessibleBrandIds = fetchedBrands.map(b => b.id);
          relevantSystemLocations = allLocs.filter(loc => accessibleBrandIds.includes(loc.companyId));
      }
      setAllSystemLocations(relevantSystemLocations);

      let initialBrandId = '';
      const queryParams = new URLSearchParams(window.location.search);
      const companyIdFromQuery = queryParams.get('companyId');

      if (companyIdFromQuery && fetchedBrands.some(b => b.id === companyIdFromQuery)) {
        initialBrandId = companyIdFromQuery;
      } else if (user.role === 'Super Admin') {
        initialBrandId = 'all';
      } else if (user.companyId) {
        initialBrandId = user.companyId;
      }
      
      setSelectedBrandIdForFilter(initialBrandId);
      setSelectedLocationIdForFilter('all');

    } catch (error) {
      console.error("[AdminUsersPage fetchInitialFilterData] Error:", error);
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
      setAvailableCoursesForAssignment([]);
      if (!isLoadingFilters && selectedBrandIdForFilter) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLastGeneratedPasswordForNewUser(null);
    try {
      let usersData: User[] = [];
      let companyContextForCourseAssignment: Company | null = null;

      if (currentUser.role === 'Super Admin') {
        if (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) {
          usersData = await fetchAllSystemUsers();
          companyContextForCourseAssignment = null; 
        } else {
          usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
          companyContextForCourseAssignment = accessibleBrandsForFilter.find(b => b.id === selectedBrandIdForFilter) || null;
        }
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
         if (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) { 
            const usersPromises = accessibleBrandsForFilter.map(b => getUsersByCompanyId(b.id));
            usersData = (await Promise.all(usersPromises)).flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));
            companyContextForCourseAssignment = currentUser.companyId ? accessibleBrandsForFilter.find(b => b.id === currentUser.companyId) : null;
        } else if (selectedBrandIdForFilter && accessibleBrandsForFilter.some(b => b.id === selectedBrandIdForFilter)) {
            usersData = await getUsersByCompanyId(selectedBrandIdForFilter);
            companyContextForCourseAssignment = accessibleBrandsForFilter.find(b => b.id === selectedBrandIdForFilter) || null;
        }
      } else if (currentUser.role === 'Manager' && currentUser.companyId) {
         usersData = await getUsersByCompanyId(currentUser.companyId);
         companyContextForCourseAssignment = accessibleBrandsForFilter.find(b => b.id === currentUser.companyId) || null;
      }

      const usersWithProgressPromises = usersData.map(async (user) => {
        const overallProgress = await getUserOverallProgress(user.id);
        let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
        if (overallProgress === 100) overallStatus = "Completed";
        else if (overallProgress > 0) overallStatus = "In Progress";
        return { ...user, overallProgress, overallStatus };
      });
      setUsers(await Promise.all(usersWithProgressPromises));

      let assignableCourses: (Course | BrandCourse)[] = [];
      if (companyContextForCourseAssignment && companyContextForCourseAssignment.id) {
        const globalProgramCourses: Course[] = [];
        if (companyContextForCourseAssignment.assignedProgramIds && companyContextForCourseAssignment.assignedProgramIds.length > 0) {
          const allGlobalPrograms = await fetchAllGlobalPrograms();
          const relevantPrograms = allGlobalPrograms.filter(p => companyContextForCourseAssignment.assignedProgramIds!.includes(p.id));
          const courseIdSet = new Set<string>();
          relevantPrograms.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
          if (courseIdSet.size > 0) {
            const coursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
            const fetchedGlobalCourses = ((await Promise.all(coursePromises)).filter(Boolean) as Course[]).filter(c => !c.isDeleted);
            globalProgramCourses.push(...fetchedGlobalCourses);
          }
        }
        assignableCourses.push(...globalProgramCourses);
        if (companyContextForCourseAssignment.canManageCourses) {
          const brandCourses = (await getBrandCoursesByBrandId(companyContextForCourseAssignment.id)).filter(bc => !bc.isDeleted);
          assignableCourses.push(...brandCourses);
        }
      } else if (currentUser.role === 'Super Admin' && !companyContextForCourseAssignment) { 
        assignableCourses = (await getAllLibraryCourses()).filter(c => !c.isDeleted);
      }
      setAvailableCoursesForAssignment(assignableCourses.filter((course, index, self) => index === self.findIndex(c => c.id === course.id)));

    } catch (error) {
      console.error("[AdminUsersPage fetchUsersForCurrentFilters] Error fetching users/courses:", error);
      toast({ title: "Error", description: "Could not load users or assignable courses.", variant: "destructive" });
      setUsers([]); setAvailableCoursesForAssignment([]);
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
      toast({ title: currentIsActive ? "User Deactivated" : "User Reactivated", description: `${userName}'s status updated.`, variant: currentIsActive ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
  };

  const openEditUserDialog = (userToEditData: User) => {
      setUserToEdit(userToEditData); setIsEditUserDialogOpen(true);
  };
  const handleUserUpdated = () => { fetchUsersForCurrentFilters(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const openAssignCourseDialog = (employee: User) => {
    if (!currentUser) return;

    const companyForCourseAssignment =
      (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) && currentUser.role === 'Super Admin'
      ? null 
      : accessibleBrandsForFilter.find(b => b.id === employee.companyId) || 
        (currentUser.companyId ? accessibleBrandsForFilter.find(b => b.id === currentUser.companyId) : null); 

    if (availableCoursesForAssignment.length === 0) {
      let toastDescription = `No courses available for assignment for ${companyForCourseAssignment?.name || 'the current context'}.`;
      if (currentUser.role === 'Super Admin' && !companyForCourseAssignment) {
        toastDescription = "There are no courses in the global library to assign.";
      } else if (!companyForCourseAssignment) {
        toastDescription = "Cannot determine course assignment context. Please select a specific brand filter.";
      }
      toast({ title: "No Courses Available", description: toastDescription, variant: "destructive", duration: 7000 });
      return;
    }
    setUserToAssignCourse(employee);
    setIsAssignCourseDialogOpen(true);
  };

  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;
    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);
    if (updatedUser) {
      fetchUsersForCurrentFilters(); 
      const courseDetails = availableCoursesForAssignment.find(c => c.id === courseId);
      toast({ title: action === 'assign' ? "Course Assigned" : "Course Unassigned", description: `${action === 'assign' ? `"${courseDetails?.title || 'Course'}" assigned to` : `Course removed from`} ${userToAssignCourse.name}.` });
    } else { toast({ title: "Error Assigning Course", variant: "destructive" }); }
    setIsAssignCourseDialogOpen(false); setUserToAssignCourse(null);
  };

  const handleResetFilters = () => {
      let initialBrandId = '';
      if (currentUser?.role === 'Super Admin') {
        initialBrandId = 'all';
      } else if (currentUser?.companyId) {
        initialBrandId = currentUser.companyId;
      }
      setSelectedBrandIdForFilter(initialBrandId);
      setSelectedLocationIdForFilter('all');
  };

  if (isLoadingFilters && !currentUser) {
    return ( <div className="container mx-auto"> <h1 className="text-3xl font-bold tracking-tight text-primary mb-8">User Management</h1> <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm"> <Skeleton className="h-8 w-24" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-48" /> <Skeleton className="h-10 w-32" /> </div> <Card><CardHeader><Skeleton className="h-8 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div></CardContent></Card> </div> );
  }
  if (!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role)) {
     return <div className="container mx-auto text-center">Access Denied. Redirecting...</div>;
  }
  
  const managerBrandNameForDisplay = currentUser?.role === 'Manager' && currentUser.companyId 
    ? accessibleBrandsForFilter.find(b => b.id === currentUser.companyId)?.name || 'Loading brand...'
    : '';

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

        {lastGeneratedPasswordForNewUser && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPasswordForNewUser}</strong><br/> A welcome email has been sent. They will be required to change this password on their first login. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPasswordForNewUser(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

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
        <CardHeader> <CardTitle>User List</CardTitle> <CardDescription>Manage user accounts, roles, and status within the selected scope.</CardDescription> </CardHeader>
        <CardContent>
          {isLoading ? ( <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div>
           ) : (
            <EmployeeTable
                employees={filteredUsers}
                onToggleEmployeeStatus={handleToggleUserStatus}
                onAssignCourse={openAssignCourseDialog}
                onEditUser={openEditUserDialog}
                currentUser={currentUser}
                locations={allSystemLocations}
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
        locations={allSystemLocations} 
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
            locations={allSystemLocations}
         />
        )}
      {userToAssignCourse && (
          <AssignCourseDialog
            isOpen={isAssignCourseDialogOpen}
            setIsOpen={setIsAssignCourseDialogOpen}
            employee={userToAssignCourse}
            company={
                (selectedBrandIdForFilter === 'all' || !selectedBrandIdForFilter) && currentUser?.role === 'Super Admin'
                ? null 
                : accessibleBrandsForFilter.find(b => b.id === userToAssignCourse.companyId) || 
                  (currentUser?.companyId ? accessibleBrandsForFilter.find(b => b.id === currentUser.companyId) : null) 
            }
            onAssignCourse={handleAssignCourse}
          />
      )}
    </div>
  );
}
