
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, UserPlus, Activity, ChevronLeft, ChevronRight, Loader2, Layers, Save } from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { User, Company, Location, UserRole } from '@/types/user';
import type { Course, BrandCourse, Program } from '@/types/course';
import type { ActivityLog } from '@/types/activity';
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers as fetchAllSystemUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { getAllCourses as getAllLibraryCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlusCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

const DEFAULT_ROWS_PER_PAGE = 5;

// Define ROLE_HIERARCHY here
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPrimaryBrand, setUserPrimaryBrand] = useState<Company | null>(null);
  const [viewableBrandsForFilter, setViewableBrandsForFilter] = useState<Company[]>([]);
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);
  
  const [selectedBrandIdForDashboard, setSelectedBrandIdForDashboard] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [employees, setEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [availableCoursesForAssignment, setAvailableCoursesForAssignment] = useState<(Course | BrandCourse)[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  const [isAssignCourseDialogOpen, setIsAssignCourseDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToAssignCourse, setUserToAssignCourse] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  const fetchInitialData = useCallback(async (userEmail: string | null) => {
    if (!userEmail) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const userDetails = await getUserByEmail(userEmail);
      setCurrentUser(userDetails);
      if (!userDetails) { 
        toast({ title: "Error", description: "Could not load user profile.", variant: "destructive" });
        setIsLoading(false); 
        router.push('/'); // Redirect if no user details
        return; 
      }
      
      const fetchedViewableBrands = await fetchAllAccessibleBrandsForUser(userDetails);
      setViewableBrandsForFilter(fetchedViewableBrands);

      let primaryBrandDetails: Company | null = null;
      if (userDetails.companyId) {
        primaryBrandDetails = await getCompanyById(userDetails.companyId);
        setUserPrimaryBrand(primaryBrandDetails);
      } else {
        setUserPrimaryBrand(null);
      }
      
      let allVisibleLocs: Location[] = [];
      if (userDetails.role === 'Super Admin') {
        allVisibleLocs = await fetchAllSystemLocations();
      } else if ((userDetails.role === 'Admin' || userDetails.role === 'Owner') && fetchedViewableBrands.length > 0) {
        const locPromises = fetchedViewableBrands.map(b => getLocationsByCompanyId(b.id));
        allVisibleLocs = (await Promise.all(locPromises)).flat();
      } else if (userDetails.role === 'Manager' && userDetails.companyId && userDetails.assignedLocationIds) {
         const brandLocs = await getLocationsByCompanyId(userDetails.companyId);
         allVisibleLocs = brandLocs.filter(loc => userDetails.assignedLocationIds!.includes(loc.id));
      }
      setAllSystemLocations(allVisibleLocs);
      
      if (userDetails.role !== 'Super Admin' && userDetails.companyId) {
        setSelectedBrandIdForDashboard(userDetails.companyId);
        setLocationsForLocationFilter(allVisibleLocs.filter(loc => loc.companyId === userDetails.companyId));
      } else {
        setSelectedBrandIdForDashboard('all'); // Super Admin defaults to all
        setLocationsForLocationFilter(allVisibleLocs);
      }
    } catch (error) {
      console.error("[DashboardPage] Error fetching initial data:", error);
      toast({ title: "Error Initializing Dashboard", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && user.email) {
            fetchInitialData(user.email);
        } else {
            setIsLoading(false); // No user, stop loading
            router.push('/'); // Redirect if not logged in
        }
    });
    return () => unsubscribe();
  }, [fetchInitialData, router]);

  useEffect(() => {
    if (!currentUser || isLoading) return;
    
    const fetchEmployeesAndRelatedData = async () => {
      setIsLoading(true);
      try {
        let usersToProcess: User[] = [];
        let companyForCourseAssignmentContext: Company | null = null;

        if (selectedBrandIdForDashboard === 'all') {
          if (currentUser.role === 'Super Admin') {
            usersToProcess = await fetchAllSystemUsers();
          } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
            const usersPromises = viewableBrandsForFilter.map(b => getUsersByCompanyId(b.id));
            usersToProcess = (await Promise.all(usersPromises)).flat();
          }
          // For "All Brands", course assignment context might be tricky. Default to user's primary brand or none if Super Admin.
          companyForCourseAssignmentContext = userPrimaryBrand; 
        } else {
          // Specific brand selected
          if (viewableBrandsForFilter.some(b => b.id === selectedBrandIdForDashboard)) {
             usersToProcess = await getUsersByCompanyId(selectedBrandIdForDashboard);
             companyForCourseAssignmentContext = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) || null;
          } else {
             usersToProcess = []; // User selected a brand they shouldn't have access to (should not happen)
             companyForCourseAssignmentContext = null;
          }
        }

        // Managers: further restrict usersToProcess to their own brand
        if (currentUser.role === 'Manager' && currentUser.companyId) {
          usersToProcess = usersToProcess.filter(emp => emp.companyId === currentUser.companyId);
          if (!companyForCourseAssignmentContext || companyForCourseAssignmentContext.id !== currentUser.companyId) {
            companyForCourseAssignmentContext = userPrimaryBrand; // Ensure context is manager's brand
          }
        }
        
        const employeesWithProgressPromises = usersToProcess.map(async (user) => {
          const overallProgress = await getUserOverallProgress(user.id);
          let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
          if (overallProgress === 100) overallStatus = "Completed";
          else if (overallProgress > 0) overallStatus = "In Progress";
          return { ...user, overallProgress, overallStatus };
        });
        setEmployees(await Promise.all(employeesWithProgressPromises));

        // Fetch courses available for assignment
        let assignableCourses: (Course | BrandCourse)[] = [];
        if (companyForCourseAssignmentContext) {
            const globalProgramCourses: Course[] = [];
            if (companyForCourseAssignmentContext.assignedProgramIds && companyForCourseAssignmentContext.assignedProgramIds.length > 0) {
                const allPrograms = await fetchAllGlobalPrograms();
                const relevantPrograms = allPrograms.filter(p => companyForCourseAssignmentContext.assignedProgramIds!.includes(p.id));
                const courseIdSet = new Set<string>();
                relevantPrograms.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
                const coursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
                const fetchedGlobalCourses = ((await Promise.all(coursePromises)).filter(Boolean) as Course[]).filter(c => !c.isDeleted);
                globalProgramCourses.push(...fetchedGlobalCourses);
            }
            assignableCourses.push(...globalProgramCourses);

            if (companyForCourseAssignmentContext.canManageCourses && companyForCourseAssignmentContext.id) {
                const brandCourses = (await getBrandCoursesByBrandId(companyForCourseAssignmentContext.id)).filter(bc => !bc.isDeleted);
                assignableCourses.push(...brandCourses);
            }
        } else if (currentUser.role === 'Super Admin' && selectedBrandIdForDashboard === 'all') { // Super Admin + All Brands selected
            assignableCourses = (await getAllLibraryCourses()).filter(c => !c.isDeleted);
        }
        setAvailableCoursesForAssignment(assignableCourses);

      } catch (error) {
        console.error("[DashboardPage] Error fetching employees/courses:", error);
        toast({ title: "Error Fetching Data", description: "Could not load employees or courses.", variant: "destructive" });
        setEmployees([]);
        setAvailableCoursesForAssignment([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployeesAndRelatedData();
  }, [currentUser, selectedBrandIdForDashboard, viewableBrandsForFilter, userPrimaryBrand, toast]);


  useEffect(() => {
    if (selectedBrandIdForDashboard === 'all') {
      setLocationsForLocationFilter(allSystemLocations);
    } else if (selectedBrandIdForDashboard) {
      setLocationsForLocationFilter(allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForDashboard));
    } else {
      setLocationsForLocationFilter([]);
    }
    setSelectedLocationId('all'); // Reset location filter when brand changes
  }, [selectedBrandIdForDashboard, allSystemLocations]);

  useEffect(() => {
    setActiveCurrentPage(1); setInactiveCurrentPage(1); // Reset pagination on filter change
    let tempUsers = employees;
    if (selectedLocationId && selectedLocationId !== 'all') {
      tempUsers = tempUsers.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId));
    }
    // Additional manager filtering if "All Locations" for their brand is selected
    if (currentUser?.role === 'Manager' && selectedBrandIdForDashboard === currentUser.companyId && selectedLocationId === 'all' && currentUser.assignedLocationIds) {
        tempUsers = tempUsers.filter(emp => (emp.assignedLocationIds || []).some(locId => currentUser.assignedLocationIds!.includes(locId)) || emp.id === currentUser.id);
    }
    setFilteredEmployees(tempUsers);
  }, [employees, selectedLocationId, currentUser, selectedBrandIdForDashboard]);

  const refreshDashboardData = () => { if (currentUser?.email) fetchInitialData(currentUser.email); };
  const handleAddEmployeeClick = () => setIsAddUserDialogOpen(true);
  const handleEditUserClick = (user: User) => { setUserToEdit(user); setIsEditUserDialogOpen(true); };
  const handleUserUpdated = () => { refreshDashboardData(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const handleToggleEmployeeStatus = async (userId: string) => {
      const targetUser = employees.find(emp => emp.id === userId);
      if (!currentUser || !targetUser) return;
      if (currentUser.id === targetUser.id) { toast({ title: "Action Denied", description: "Cannot change own status.", variant: "destructive" }); return; }
      let canToggle = false;
      if (currentUser.role === 'Super Admin') canToggle = true;
      else if (currentUser.companyId) {
          const targetUserIsAccessible = viewableBrandsForFilter.some(vb => vb.id === targetUser.companyId);
          if (targetUserIsAccessible && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role]) {
              if (currentUser.role === 'Manager' && targetUser.role !== 'Staff') canToggle = false;
              else canToggle = true;
          }
      }
      if (!canToggle) { toast({ title: "Permission Denied", variant: "destructive" }); return; }

      const updatedUser = await toggleUserDataStatus(userId);
      if (updatedUser) { refreshDashboardData(); toast({ title: updatedUser.isActive ? "User Reactivated" : "User Deactivated" }); }
      else { toast({ title: "Error", variant: "destructive" }); }
  };

  const openAssignCourseDialog = (employee: User) => {
     if (!currentUser) return;
     let canAssign = false;
     if (currentUser.role === 'Super Admin') canAssign = true;
     else if (currentUser.companyId) { // Admin, Owner, Manager
         const targetUserIsAccessible = viewableBrandsForFilter.some(vb => vb.id === employee.companyId);
         // Check if target user is within the current admin's hierarchy and accessible brands
         if (targetUserIsAccessible && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[employee.role]) {
             if (currentUser.role === 'Manager' && employee.role !== 'Staff') canAssign = false; // Manager can only assign to Staff
             else canAssign = true;
         }
     }
     if (!canAssign) { toast({ title: "Permission Denied", description: "You do not have permission to assign courses to this user.", variant: "destructive" }); return; }
     
     // Determine the correct company context for fetching assignable courses
     let companyContextForDialog = userPrimaryBrand; // Default for Admins/Owners/Managers
     if (currentUser.role === 'Super Admin') {
         if (selectedBrandIdForDashboard !== 'all') {
             companyContextForDialog = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) || null;
         } else {
            // Super Admin viewing "All Brands" - assignable courses might be all global courses, or this needs specific UI
            // For now, let's assume this means all global courses are assignable by Super Admin here.
            // The availableCoursesForAssignment state should be populated accordingly.
            // If employee has a brand, use that for more specific context.
            if(employee.companyId) companyContextForDialog = viewableBrandsForFilter.find(b => b.id === employee.companyId) || null;
            else companyContextForDialog = null; // Or perhaps all global?
         }
     }
     
     if (availableCoursesForAssignment.length === 0) { 
         toast({ title: "No Courses Available", description: "No courses are available for assignment in the current brand context.", variant: "destructive" }); 
         return; 
     }
     setUserToAssignCourse(employee); 
     setIsAssignCourseDialogOpen(true);
  };

  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;
    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);
    if (updatedUser) {
        refreshDashboardData();
        const courseDetails = availableCoursesForAssignment.find(c => c.id === courseId);
        toast({ title: action === 'assign' ? "Course Assigned" : "Course Unassigned", description: `${action === 'assign' ? `"${courseDetails?.title || 'Course'}" assigned to` : `Course removed from`} ${userToAssignCourse.name}.` });
    } else { toast({ title: "Error", variant: "destructive" }); }
    setIsAssignCourseDialogOpen(false); setUserToAssignCourse(null);
  };

  const activeEmployees = useMemo(() => filteredEmployees.filter(emp => emp.isActive), [filteredEmployees]);
  const inactiveEmployees = useMemo(() => filteredEmployees.filter(emp => !emp.isActive), [filteredEmployees]);
  
  const currentRowsPerPage = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  
  const totalActivePages = rowsPerPage === 'all' ? (activeEmployees.length > 0 ? 1: 0) : Math.ceil(activeEmployees.length / currentRowsPerPage);
  const totalInactivePages = rowsPerPage === 'all' ? (inactiveEmployees.length > 0 ? 1: 0) : Math.ceil(inactiveEmployees.length / currentRowsPerPage);
  
  const paginatedActiveEmployees = useMemo(() => rowsPerPage === 'all' ? activeEmployees : activeEmployees.slice((activeCurrentPage - 1) * currentRowsPerPage, activeCurrentPage * currentRowsPerPage), [activeEmployees, activeCurrentPage, currentRowsPerPage]);
  const paginatedInactiveEmployees = useMemo(() => rowsPerPage === 'all' ? inactiveEmployees : inactiveEmployees.slice((inactiveCurrentPage - 1) * currentRowsPerPage, inactiveCurrentPage * currentRowsPerPage), [inactiveEmployees, inactiveCurrentPage, currentRowsPerPage]);
  
  const totalActiveFiltered = activeEmployees.length;
  const avgCompletion = totalActiveFiltered > 0 ? Math.round(activeEmployees.reduce((sum, emp) => sum + emp.overallProgress, 0) / totalActiveFiltered) : 0;
  
  const certificatesIssued = useMemo(() => activeEmployees.reduce((count, emp) => {
    const userProgressMap = emp.courseProgress || {};
    return count + Object.values(userProgressMap).filter(p => p?.status === 'Completed').length;
  }, 0), [activeEmployees]);
  
  const totalActiveFilteredCourses = useMemo(() => new Set(activeEmployees.flatMap(emp => emp.assignedCourseIds || []).filter(Boolean)).size, [activeEmployees]);
  
  const handleRowsPerPageChange = (value: string) => { 
    if (value === 'all') setRowsPerPage('all'); 
    else setRowsPerPage(parseInt(value, 10)); 
    setActiveCurrentPage(1); 
    setInactiveCurrentPage(1); 
  };

  const displayBrandName = selectedBrandIdForDashboard === 'all' ? 'All Accessible Brands' : viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)?.name || userPrimaryBrand?.name || 'Dashboard';
  const displayLocationName = selectedLocationId === 'all' ? 'All Locations' : locationsForLocationFilter.find(l => l.id === selectedLocationId)?.name || '';

  if (isLoading && !currentUser) { // Show main loader only if user data isn't even starting to load
    return ( <div className="flex-1 space-y-4 p-8 pt-6"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"> <Skeleton className="col-span-4 h-64" /> <Skeleton className="col-span-4 lg:col-span-3 h-64" /> </div> </div> );
  }
  if (!currentUser || (!userPrimaryBrand && currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin' && currentUser.role !== 'Owner' )) { // Admin/Owner can exist without a specific brand if they manage children
    return <div className="flex-1 space-y-4 p-8 pt-6 text-center">Could not load dashboard data. User may not be assigned to a primary brand or access is denied.</div>;
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
         <div> 
            <h1 className="text-3xl font-bold tracking-tight text-primary">{displayBrandName} Dashboard</h1> 
            <p className="text-muted-foreground flex items-center gap-2"> 
                <Building className="h-4 w-4" /> 
                {displayLocationName ? `Viewing: ${displayLocationName}` : (selectedBrandIdForDashboard === 'all' && currentUser?.role !== 'Super Admin' ? 'Overview of Your Brands' : 'Overview')} 
            </p> 
         </div>
        <div className="flex items-center space-x-2">
          {currentUser && ['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) && (
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-accent text-accent-foreground hover:bg-accent/90" 
                  disabled={isLoading || (currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && selectedBrandIdForDashboard === 'all')}
                  title={(currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && selectedBrandIdForDashboard === 'all') ? "Add a brand first" : ""}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
                </Button>
              </DialogTrigger>
              {currentUser && (
                <AddUserDialog 
                    onUserAdded={(user, pwd) => refreshDashboardData()} 
                    isOpen={isAddUserDialogOpen} 
                    setIsOpen={setIsAddUserDialogOpen} 
                    companies={viewableBrandsForFilter} 
                    locations={allSystemLocations} 
                    currentUser={currentUser} 
                />
              )}
            </Dialog>
          )}
        </div>
      </div>

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
           <div className="flex items-center gap-2">
             <Label htmlFor="brand-filter-dashboard">Brand:</Label>
             <Select value={selectedBrandIdForDashboard} onValueChange={setSelectedBrandIdForDashboard}
               disabled={isLoading || (viewableBrandsForFilter.length <= 1 && !(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Owner'))}>
               <SelectTrigger id="brand-filter-dashboard" className="w-[220px] bg-background">
                 <SelectValue placeholder="Select Brand" />
               </SelectTrigger>
               <SelectContent>
                  {(currentUser?.role === 'Super Admin' || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length > 1 )) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                 {viewableBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                 {viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && <SelectItem value="no-brands" disabled>No Brands Found</SelectItem>}
                 {/* If Admin/Owner and only their primary brand is available, show it (likely disabled if only one) */}
                 {(currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length === 1 && 
                    <SelectItem value={viewableBrandsForFilter[0].id}>{viewableBrandsForFilter[0].name}</SelectItem>
                 }
                 {currentUser?.role === 'Manager' && userPrimaryBrand &&
                    <SelectItem value={userPrimaryBrand.id}>{userPrimaryBrand.name}</SelectItem>
                 }
               </SelectContent>
             </Select>
           </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="location-filter-dashboard">Location:</Label>
                 <Select value={selectedLocationId} onValueChange={setSelectedLocationId}
                    disabled={isLoading || locationsForLocationFilter.length === 0} >
                    <SelectTrigger id="location-filter-dashboard" className="w-[220px] bg-background">
                        <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locationsForLocationFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                         {selectedBrandIdForDashboard !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="none" disabled>No locations in this brand</SelectItem> )}
                    </SelectContent>
                </Select>
            </div>
        </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Employees</CardTitle> <UserCheck className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalActiveFiltered}</div> <p className="text-xs text-muted-foreground">{inactiveEmployees.length} inactive in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Assigned Courses (Unique)</CardTitle> <BookOpen className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalActiveFilteredCourses}</div> <p className="text-xs text-muted-foreground">in view for active users</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Avg. Completion (Overall)</CardTitle> <TrendingUp className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{avgCompletion}%</div> <p className="text-xs text-muted-foreground">Across active users in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Certificates Issued (Overall)</CardTitle> <Award className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">+{certificatesIssued}</div> <p className="text-xs text-muted-foreground">By active users in view</p> </CardContent> </Card>
      </div>

      <div className="flex flex-col space-y-4 pt-6">
        <Card>
           <CardHeader> <CardTitle>Team Management</CardTitle> </CardHeader>
             <CardContent>
                 <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4"> <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger> <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger> </TabsList>
                     <TabsContent value="active"> <CardDescription className="mb-4">Track your active team's overall course completion status.</CardDescription>
                        {isLoading ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
                         <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companyCourses={availableCoursesForAssignment} />
                        }
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active) </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.max(p - 1, 1))} disabled={activeCurrentPage === 1 || isLoading}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.min(p + 1, totalActivePages))} disabled={activeCurrentPage === totalActivePages || isLoading}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                     <TabsContent value="inactive"> <CardDescription className="mb-4">View deactivated employees. They can be reactivated.</CardDescription>
                        {isLoading ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
                         <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companyCourses={availableCoursesForAssignment} />
                        }
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {inactiveCurrentPage} of {totalInactivePages} ({inactiveEmployees.length} total inactive) </div> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.max(p - 1, 1))} disabled={inactiveCurrentPage === 1 || isLoading}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.min(p + 1, totalInactivePages))} disabled={inactiveCurrentPage === totalInactivePages || isLoading}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                 </Tabs>
                 <div className="flex items-center justify-end space-x-2 pt-4 border-t mt-4"> <Label htmlFor="rows-per-page">Rows:</Label> <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}> <SelectTrigger id="rows-per-page" className="w-[80px]"> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="5">5</SelectItem> <SelectItem value="10">10</SelectItem> <SelectItem value="15">15</SelectItem> <SelectItem value="all">All</SelectItem> </SelectContent> </Select> </div>
             </CardContent>
        </Card>
      </div>

       {userToAssignCourse && (
        <AssignCourseDialog 
            isOpen={isAssignCourseDialogOpen} 
            setIsOpen={setIsAssignCourseDialogOpen} 
            employee={userToAssignCourse}
            company={viewableBrandsForFilter.find(b => b.id === userToAssignCourse.companyId) || userPrimaryBrand }
            onAssignCourse={handleAssignCourse} />
      )}
      {isEditUserDialogOpen && userToEdit && currentUser && ( 
        <EditUserDialog 
            isOpen={isEditUserDialogOpen} 
            setIsOpen={setIsEditUserDialogOpen} 
            user={userToEdit} 
            onUserUpdated={handleUserUpdated} 
            currentUser={currentUser} 
            companies={viewableBrandsForFilter} 
            locations={allSystemLocations} 
        /> 
      )}
    </div>
  );
}
