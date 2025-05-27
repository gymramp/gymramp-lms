
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, Activity, ChevronLeft, ChevronRight, Loader2, Layers, Info, ShieldCheck, PlusCircle } from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { User, Company, Location, UserRole } from '@/types/user';
import type { Course, BrandCourse, Program } from '@/types/course';
import type { ActivityLog } from '@/types/activity';
import { getUserByEmail, getAllUsers as fetchAllSystemUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser, getUsersByCompanyId, toggleUserStatus as toggleUserDataStatus } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { getAllCourses as getAllLibraryCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms, getProgramById } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const DEFAULT_ROWS_PER_PAGE = 5;

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};


export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPrimaryBrand, setUserPrimaryBrand] = useState<Company | null>(null);
  const [viewableBrandsForFilter, setViewableBrandsForFilter] = useState<Company[]>([]);
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]);

  const [selectedBrandIdForDashboard, setSelectedBrandIdForDashboard] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [employees, setEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [availableCoursesForAssignment, setAvailableCoursesForAssignment] = useState<(Course | BrandCourse)[]>([]);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoadingBrandDataForFilters, setIsLoadingBrandDataForFilters] = useState(true);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingCoursesForAssignment, setIsLoadingCoursesForAssignment] = useState(false);

  const [isAssignCourseDialogOpen, setIsAssignCourseDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToAssignCourse, setUserToAssignCourse] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  const { toast } = useToast();
  const router = useRouter();

  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  const fetchInitialDashboardData = useCallback(async (user: User) => {
    console.log("[Dashboard] Fetching initial dashboard data. User Role:", user.role, "User Brand ID:", user.companyId);
    setIsLoadingBrandDataForFilters(true);
    try {
      const fetchedAccessibleBrands = await fetchAllAccessibleBrandsForUser(user);
      setViewableBrandsForFilter(fetchedAccessibleBrands);
      console.log("[Dashboard] Accessible Brands for Filter:", fetchedAccessibleBrands.map(b => ({ id: b.id, name: b.name, parent: b.parentBrandId })));

      let primaryBrand: Company | null = null;
      if (user.companyId) {
        primaryBrand = fetchedAccessibleBrands.find(b => b.id === user.companyId) || await getCompanyById(user.companyId);
      }
      setUserPrimaryBrand(primaryBrand);
      console.log("[Dashboard] User Primary Brand:", primaryBrand ? primaryBrand.name : 'None');

      let initialSelectedBrandId = '';
      let allVisibleSystemLocationsForUser: Location[] = [];

      if (user.role === 'Super Admin') {
        allVisibleSystemLocationsForUser = await fetchAllSystemLocations();
        initialSelectedBrandId = 'all';
      } else if ((user.role === 'Admin' || user.role === 'Owner') && user.companyId) {
        const locPromises = fetchedAccessibleBrands.map(b => getLocationsByCompanyId(b.id));
        allVisibleSystemLocationsForUser = (await Promise.all(locPromises)).flat().filter((loc, index, self) => index === self.findIndex(l => l.id === loc.id));
        initialSelectedBrandId = user.companyId;
      } else if (user.role === 'Manager' && user.companyId && user.assignedLocationIds) {
        const brandLocs = await getLocationsByCompanyId(user.companyId);
        allVisibleSystemLocationsForUser = brandLocs.filter(loc => user.assignedLocationIds!.includes(loc.id));
        initialSelectedBrandId = user.companyId;
      } else {
        initialSelectedBrandId = user.companyId || '';
      }

      setAllSystemLocations(allVisibleSystemLocationsForUser);
      setSelectedBrandIdForDashboard(initialSelectedBrandId);
      setSelectedLocationId('all');
      console.log(`[Dashboard] Initial brand selected: ${initialSelectedBrandId}`);

    } catch (error) {
      console.error("[DashboardPage] Error fetching initial filter data:", error);
      toast({ title: "Error Initializing Dashboard Filters", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoadingBrandDataForFilters(false);
    }
  }, [toast]);

  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (!userDetails) {
            toast({ title: "Error", description: "Could not load user profile.", variant: "destructive" });
            router.push('/');
          } else if (!['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
            toast({ title: "Access Denied", description: "Your role does not have dashboard access.", variant: "destructive" });
            router.push('/courses/my-courses');
          } else {
            await fetchInitialDashboardData(userDetails);
          }
        } catch (error) {
          toast({ title: "Authentication Error", description: "Failed to verify user.", variant: "destructive" });
          router.push('/');
        }
      } else {
        setCurrentUser(null);
        router.push('/');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [fetchInitialDashboardData, router, toast]);

  const fetchEmployeesAndAssignableCourses = useCallback(async () => {
    if (!currentUser || isAuthLoading || isLoadingBrandDataForFilters || !selectedBrandIdForDashboard) {
      setEmployees([]); setAvailableCoursesForAssignment([]);
      setIsLoadingEmployees(false); setIsLoadingCoursesForAssignment(false);
      return;
    }
    setIsLoadingEmployees(true); setIsLoadingCoursesForAssignment(true);
    setLastGeneratedPassword(null);
    console.log(`[Dashboard] Fetching employees for dashboard. User Role: ${currentUser.role}, Selected Brand ID: ${selectedBrandIdForDashboard}`);

    try {
      let usersToProcess: User[] = [];
      let companyContextForCourseAssignment: Company | null = null;

      if (currentUser.role === 'Super Admin') {
        if (selectedBrandIdForDashboard === 'all') {
          usersToProcess = await fetchAllSystemUsers();
          companyContextForCourseAssignment = null;
        } else {
          usersToProcess = await getUsersByCompanyId(selectedBrandIdForDashboard);
          companyContextForCourseAssignment = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) || null;
        }
      } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
        if (selectedBrandIdForDashboard === 'all') {
          const usersPromises = viewableBrandsForFilter.map(b => getUsersByCompanyId(b.id));
          usersToProcess = (await Promise.all(usersPromises)).flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));
          companyContextForCourseAssignment = userPrimaryBrand;
        } else {
          usersToProcess = viewableBrandsForFilter.some(b => b.id === selectedBrandIdForDashboard) ? await getUsersByCompanyId(selectedBrandIdForDashboard) : [];
          companyContextForCourseAssignment = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) || null;
        }
      } else if (currentUser.role === 'Manager' && currentUser.companyId) {
        usersToProcess = await getUsersByCompanyId(currentUser.companyId);
        companyContextForCourseAssignment = userPrimaryBrand;
      }
      
      const employeesWithProgressPromises = usersToProcess.map(async (user) => {
        const overallProgress = await getUserOverallProgress(user.id);
        let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
        if (overallProgress === 100) overallStatus = "Completed";
        else if (overallProgress > 0) overallStatus = "In Progress";
        return { ...user, overallProgress, overallStatus };
      });
      setEmployees(await Promise.all(employeesWithProgressPromises));
      setIsLoadingEmployees(false);

      let assignableCourses: (Course | BrandCourse)[] = [];
      if (companyContextForCourseAssignment) {
        const brandContext = companyContextForCourseAssignment;
        const globalProgramCourses: Course[] = [];
        if (brandContext.assignedProgramIds && brandContext.assignedProgramIds.length > 0) {
          const allGlobalPrograms = await fetchAllGlobalPrograms();
          const relevantPrograms = allGlobalPrograms.filter(p => brandContext.assignedProgramIds!.includes(p.id));
          const courseIdSet = new Set<string>();
          relevantPrograms.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
          if (courseIdSet.size > 0) {
            const coursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
            const fetchedGlobalCourses = ((await Promise.all(coursePromises)).filter(Boolean) as Course[]).filter(c => !c.isDeleted);
            globalProgramCourses.push(...fetchedGlobalCourses);
          }
        }
        assignableCourses.push(...globalProgramCourses);
        if (brandContext.canManageCourses && brandContext.id) {
          const brandCourses = (await getBrandCoursesByBrandId(brandContext.id)).filter(bc => !bc.isDeleted);
          assignableCourses.push(...brandCourses);
        }
      } else if (currentUser.role === 'Super Admin' && selectedBrandIdForDashboard === 'all') {
        assignableCourses = (await getAllLibraryCourses()).filter(c => !c.isDeleted);
      }
      setAvailableCoursesForAssignment(assignableCourses.filter((course, index, self) => index === self.findIndex(c => c.id === course.id)));

    } catch (error) {
      console.error("[DashboardPage] Error fetching employees/assignable courses:", error);
      toast({ title: "Error Fetching Dashboard Data", description: "Could not load employees or assignable courses.", variant: "destructive" });
      setEmployees([]); setAvailableCoursesForAssignment([]);
    } finally {
      setIsLoadingEmployees(false); setIsLoadingCoursesForAssignment(false);
    }
  }, [currentUser, selectedBrandIdForDashboard, viewableBrandsForFilter, userPrimaryBrand, toast, isAuthLoading, isLoadingBrandDataForFilters]);

  useEffect(() => {
    if (!isAuthLoading && currentUser && !isLoadingBrandDataForFilters) {
      fetchEmployeesAndAssignableCourses();
    }
  }, [fetchEmployeesAndAssignableCourses]); // Removed selectedBrandIdForDashboard to avoid re-fetching on every brand filter change if already covered


  useEffect(() => {
    if (isAuthLoading || isLoadingBrandDataForFilters || !currentUser) {
      setLocationsForLocationFilter([]); setSelectedLocationId('all'); return;
    }
    console.log("[Dashboard] Location filter effect running. Selected Brand:", selectedBrandIdForDashboard);
    let currentBrandLocations: Location[] = [];
    if (selectedBrandIdForDashboard === 'all') {
      currentBrandLocations = allSystemLocations;
    } else if (selectedBrandIdForDashboard) {
      currentBrandLocations = allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForDashboard);
    }
    setLocationsForLocationFilter(currentBrandLocations);
    setSelectedLocationId('all');
    console.log(`[Dashboard] Locations for Location Filter updated for brand ${selectedBrandIdForDashboard}: ${currentBrandLocations.length} locations.`);
  }, [selectedBrandIdForDashboard, allSystemLocations, currentUser, viewableBrandsForFilter, isAuthLoading, isLoadingBrandDataForFilters]);

  useEffect(() => {
    if (isLoadingEmployees || !currentUser) { setFilteredEmployees([]); return; }
    console.log(`[Dashboard Filter] Applying location filter. Role: ${currentUser.role}, Selected Brand: ${selectedBrandIdForDashboard}, Selected Location: ${selectedLocationId}`);
    console.log(`[Dashboard Filter] Employees before location filter: ${employees.length}, Manager assigned locations: ${JSON.stringify(currentUser.assignedLocationIds)}`);

    let tempUsers = [...employees];
    if (selectedLocationId && selectedLocationId !== 'all') {
      tempUsers = tempUsers.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId));
      console.log(`[Dashboard Filter] After specific location filter '${selectedLocationId}': ${tempUsers.length}`);
    } else if (currentUser.role === 'Manager' && selectedLocationId === 'all') {
      const managerAssignedLocationIds = currentUser.assignedLocationIds || [];
      if (managerAssignedLocationIds.length > 0) {
        tempUsers = tempUsers.filter(emp => emp.id === currentUser.id || (emp.assignedLocationIds || []).some(locId => managerAssignedLocationIds.includes(locId)));
      } else {
        tempUsers = tempUsers.filter(emp => emp.id === currentUser.id);
      }
      console.log(`[Dashboard Filter] Manager 'All Locations' view. After filter: ${tempUsers.length}`);
    }
    setFilteredEmployees(tempUsers);
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
  }, [employees, selectedLocationId, currentUser, isLoadingEmployees, selectedBrandIdForDashboard]);

  const refreshDashboardData = (newUser?: User, tempPassword?: string) => {
    if (tempPassword) { setLastGeneratedPassword(tempPassword); }
    else { setLastGeneratedPassword(null); }
    if (currentUser) fetchEmployeesAndAssignableCourses();
  };

  const handleAddEmployeeClick = () => {
    if (!currentUser) return;
    if ((currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && selectedBrandIdForDashboard === 'all')) {
      toast({ title: "Cannot Add User", description: "Please create a brand first or select a specific brand.", variant: "destructive" }); return;
    }
    if (currentUser.role !== 'Super Admin' && !currentUser.companyId) {
      toast({ title: "Cannot Add User", description: "You must be associated with a brand.", variant: "destructive" }); return;
    }
    setLastGeneratedPassword(null); setIsAddUserDialogOpen(true);
  };

  const handleEditUserClick = (user: User) => { setUserToEdit(user); setIsEditUserDialogOpen(true); };
  const handleUserUpdated = () => { refreshDashboardData(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const openAssignCourseDialog = (employee: User) => {
    if (!currentUser) return;
    console.log(`[Dashboard openAssignCourseDialog] CurrentUser: ${currentUser.role} (Brand: ${currentUser.companyId}), TargetUser: ${employee.role} (Brand: ${employee.companyId})`);

    let canAssign = false;
    if (currentUser.role === 'Super Admin') {
      canAssign = true;
      console.log(`[Dashboard openAssignCourseDialog] Super Admin: true`);
    } else if (currentUser.companyId) { // Admin, Owner, Manager
      if (currentUser.role === 'Manager') {
        canAssign = (employee.role === 'Staff' || employee.role === 'Manager') && employee.companyId === currentUser.companyId;
        console.log(`[Dashboard openAssignCourseDialog] Manager check: target Staff/Manager (${employee.role}) AND same company (${employee.companyId} === ${currentUser.companyId}): ${canAssign}`);
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
        // Admins/Owners can assign to users in their primary brand or child brands
        const targetUserIsAccessibleByBrand = viewableBrandsForFilter.some(vb => vb.id === employee.companyId);
        if (targetUserIsAccessibleByBrand) {
          canAssign = ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[employee.role];
          console.log(`[Dashboard openAssignCourseDialog] Admin/Owner check: target brand accessible AND role hierarchy valid (${ROLE_HIERARCHY[currentUser.role]} > ${ROLE_HIERARCHY[employee.role]}): ${canAssign}`);
        } else {
            console.log(`[Dashboard openAssignCourseDialog] Admin/Owner check: target user brand ${employee.companyId} not in viewable brands.`);
        }
      }
    } else {
         console.log(`[Dashboard openAssignCourseDialog] Current user ${currentUser.role} has no companyId.`);
    }
    
    if (!canAssign) {
      toast({ title: "Permission Denied", description: "You do not have permission to assign courses to this user.", variant: "destructive" }); return;
    }
    
    let companyContextForDialog: Company | null = null;
    if (selectedBrandIdForDashboard === 'all') {
        companyContextForDialog = employee.companyId ? (viewableBrandsForFilter.find(b => b.id === employee.companyId) ?? userPrimaryBrand) : userPrimaryBrand;
    } else {
        companyContextForDialog = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) ?? userPrimaryBrand;
    }

    if (!companyContextForDialog && currentUser.role !== 'Super Admin') {
         toast({ title: "Brand Context Missing", description: "Select a brand to determine available courses.", variant: "destructive" }); return;
    }
    if (availableCoursesForAssignment.length === 0) {
       const brandContextName = companyContextForDialog?.name || (selectedBrandIdForDashboard === 'all' && currentUser.role === 'Super Admin' ? 'the global library' : 'the current brand filter');
       toast({ title: "No Courses Available", description: `No courses available for assignment within ${brandContextName}. Ensure programs are assigned or brand courses created.`, variant: "destructive", duration: 10000 }); return;
    }
    setUserToAssignCourse(employee); setIsAssignCourseDialogOpen(true);
  };

  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;
    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);
    if (updatedUser) {
      refreshDashboardData();
      const courseDetails = availableCoursesForAssignment.find(c => c.id === courseId);
      toast({ title: action === 'assign' ? "Course Assigned" : "Course Unassigned", description: `${action === 'assign' ? `"${courseDetails?.title || 'Course'}" assigned to` : `Course removed from`} ${userToAssignCourse.name}.` });
    } else { toast({ title: "Error Assigning Course", variant: "destructive" }); }
    setIsAssignCourseDialogOpen(false); setUserToAssignCourse(null);
  };

  const activeEmployees = useMemo(() => filteredEmployees.filter(emp => emp.isActive), [filteredEmployees]);
  const inactiveEmployees = useMemo(() => filteredEmployees.filter(emp => !emp.isActive), [filteredEmployees]);
  const currentRowsPerPage = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalActivePages = rowsPerPage === 'all' ? (activeEmployees.length > 0 ? 1 : 0) : Math.ceil(activeEmployees.length / currentRowsPerPage);
  const totalInactivePages = rowsPerPage === 'all' ? (inactiveEmployees.length > 0 ? 1 : 0) : Math.ceil(inactiveEmployees.length / currentRowsPerPage);
  const paginatedActiveEmployees = useMemo(() => rowsPerPage === 'all' ? activeEmployees : activeEmployees.slice((activeCurrentPage - 1) * currentRowsPerPage, activeCurrentPage * currentRowsPerPage), [activeEmployees, activeCurrentPage, currentRowsPerPage]);
  const paginatedInactiveEmployees = useMemo(() => rowsPerPage === 'all' ? inactiveEmployees : inactiveEmployees.slice((inactiveCurrentPage - 1) * currentRowsPerPage, inactiveCurrentPage * currentRowsPerPage), [inactiveEmployees, inactiveCurrentPage, currentRowsPerPage]);
  const totalActiveFiltered = activeEmployees.length;
  const avgCompletion = totalActiveFiltered > 0 ? Math.round(activeEmployees.reduce((sum, emp) => sum + emp.overallProgress, 0) / totalActiveFiltered) : 0;
  const certificatesIssued = useMemo(() => activeEmployees.reduce((count, emp) => count + Object.values(emp.courseProgress || {}).filter(p => p?.status === 'Completed').length, 0), [activeEmployees]);
  const totalAssignableContextCourses = useMemo(() => isLoadingCoursesForAssignment ? <Loader2 className="h-4 w-4 animate-spin" /> : availableCoursesForAssignment.length, [availableCoursesForAssignment, isLoadingCoursesForAssignment]);

  const handleRowsPerPageChange = (value: string) => {
    if (value === 'all') setRowsPerPage('all');
    else setRowsPerPage(parseInt(value, 10));
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
  };

  const displayBrandName = selectedBrandIdForDashboard === 'all'
    ? (currentUser?.role === 'Super Admin' ? 'All System Brands' : (viewableBrandsForFilter.length > 1 || (viewableBrandsForFilter.length === 0 && !userPrimaryBrand) ? 'All Accessible Brands' : (userPrimaryBrand?.name || 'Your Brand')))
    : (viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)?.name || userPrimaryBrand?.name || 'Selected Brand');
  const displayLocationName = selectedLocationId === 'all' ? 'All Locations' : allSystemLocations.find(l => l.id === selectedLocationId)?.name || '';
  const pageIsLoading = isAuthLoading || isLoadingBrandDataForFilters;

  if (pageIsLoading || !currentUser) {
    return ( <div className="flex-1 space-y-4 p-8 pt-6"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"> <Skeleton className="col-span-4 h-64" /> <Skeleton className="col-span-4 lg:col-span-3 h-64" /> </div> </div> );
  }
  if (!userPrimaryBrand && currentUser.role !== 'Super Admin') {
    return <div className="flex-1 space-y-4 p-8 pt-6 text-center">Error: User not associated with a primary brand. Please contact support.</div>;
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{displayBrandName} Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {displayLocationName ? `Viewing: ${displayLocationName}` : (selectedBrandIdForDashboard === 'all' && currentUser?.role !== 'Super Admin' ? 'Overview of Your Brands' : 'Overview')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {currentUser && ['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) && (
            <Button
              onClick={handleAddEmployeeClick}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isLoadingEmployees || (currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && selectedBrandIdForDashboard === 'all')}
              title={(currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && selectedBrandIdForDashboard === 'all') ? "Add a brand first" : ""}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          )}
        </div>
      </div>

      {lastGeneratedPassword && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPassword}</strong><br/> They will be required to change this on their first login. A welcome email has also been sent. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPassword(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold mr-4 self-center text-foreground">Filters:</h2>
          <div className="flex flex-col space-y-1">
            <Label htmlFor="brand-filter-dashboard" className="text-sm text-muted-foreground">Brand</Label>
            <Select value={selectedBrandIdForDashboard} onValueChange={setSelectedBrandIdForDashboard}
              disabled={isLoadingEmployees || isLoadingBrandDataForFilters || (viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin') || (currentUser?.role === 'Manager' && viewableBrandsForFilter.length <=1 ) || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length <= 1 && selectedBrandIdForDashboard !== 'all')}>
              <SelectTrigger id="brand-filter-dashboard" className="w-[220px] bg-background h-10">
                <SelectValue placeholder="Select Brand" />
              </SelectTrigger>
              <SelectContent>
                {(currentUser?.role === 'Super Admin' || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                {viewableBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                {viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && <SelectItem value="no-brands" disabled>No Brands Found</SelectItem>}
                {viewableBrandsForFilter.length === 1 && (currentUser?.role === 'Manager' || currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && selectedBrandIdForDashboard !== 'all' &&
                  <SelectItem value={viewableBrandsForFilter[0].id}>{viewableBrandsForFilter[0].name}</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col space-y-1">
              <Label htmlFor="location-filter-dashboard" className="text-sm text-muted-foreground">Location</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}
                  disabled={isLoadingEmployees || isLoadingBrandDataForFilters || locationsForLocationFilter.length === 0} >
                  <SelectTrigger id="location-filter-dashboard" className="w-[220px] bg-background h-10">
                      <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locationsForLocationFilter.map(location => ( <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem> ))}
                      {selectedBrandIdForDashboard !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="none" disabled>No locations in this brand</SelectItem> )}
                  </SelectContent>
              </Select>
          </div>
        <Button variant="outline" onClick={() => { setSelectedBrandIdForDashboard(userPrimaryBrand?.id || (currentUser?.role === 'Super Admin' ? 'all' : '')); setSelectedLocationId('all');}} className="h-10 self-end" disabled={isLoadingBrandDataForFilters}>Reset Filters</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Employees</CardTitle> <UserCheck className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : totalActiveFiltered}</div> <p className="text-xs text-muted-foreground">{isLoadingEmployees ? '...' : `${inactiveEmployees.length} inactive in view`}</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Assignable Courses (Context)</CardTitle> <BookOpen className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalAssignableContextCourses}</div> <p className="text-xs text-muted-foreground">for selected brand context</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Avg. Completion (Overall)</CardTitle> <TrendingUp className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : `${avgCompletion}%`}</div> <p className="text-xs text-muted-foreground">Across active users in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Certificates Issued (Overall)</CardTitle> <Award className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : `+${certificatesIssued}`}</div> <p className="text-xs text-muted-foreground">By active users in view</p> </CardContent> </Card>
      </div>

      <div className="flex flex-col space-y-4 pt-6">
        <Card>
          <CardHeader> <CardTitle>Team Management</CardTitle> </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4"> <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger> <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger> </TabsList>
              <TabsContent value="active"> <CardDescription className="mb-4 text-foreground">Track your active team's overall course completion status.</CardDescription>
                {isLoadingEmployees ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
                  <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={toggleUserDataStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} />
                }
                <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active) </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.max(p - 1, 1))} disabled={activeCurrentPage === 1 || isLoadingEmployees || totalActivePages === 0}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.min(p + 1, totalActivePages))} disabled={activeCurrentPage === totalActivePages || isLoadingEmployees || totalActivePages === 0}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
              </TabsContent>
              <TabsContent value="inactive"> <CardDescription className="mb-4 text-foreground">View deactivated employees. They can be reactivated.</CardDescription>
                {isLoadingEmployees ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
                  <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={toggleUserDataStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} />
                }
                <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {inactiveCurrentPage} of {totalInactivePages} ({inactiveEmployees.length} total inactive) </div> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.max(p - 1, 1))} disabled={inactiveCurrentPage === 1 || isLoadingEmployees || totalInactivePages === 0}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.min(p + 1, totalInactivePages))} disabled={inactiveCurrentPage === totalInactivePages || isLoadingEmployees || totalInactivePages === 0}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center justify-end space-x-2 pt-4 border-t mt-4"> <Label htmlFor="rows-per-page" className="text-sm text-muted-foreground">Rows:</Label> <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}> <SelectTrigger id="rows-per-page" className="w-[80px]"> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="5">5</SelectItem> <SelectItem value="10">10</SelectItem> <SelectItem value="15">15</SelectItem> <SelectItem value="all">All</SelectItem> </SelectContent> </Select> </div>
          </CardContent>
        </Card>
      </div>

      {userToAssignCourse && (
        <AssignCourseDialog
          isOpen={isAssignCourseDialogOpen}
          setIsOpen={setIsAssignCourseDialogOpen}
          employee={userToAssignCourse}
          company={
            selectedBrandIdForDashboard === 'all' 
                ? (userToAssignCourse.companyId ? viewableBrandsForFilter.find(b => b.id === userToAssignCourse.companyId) ?? userPrimaryBrand : userPrimaryBrand) 
                : viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) ?? userPrimaryBrand
          }
          onAssignCourse={handleAssignCourse}
        />
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
      {isAddUserDialogOpen && currentUser && (
        <AddUserDialog
            onUserAdded={refreshDashboardData}
            isOpen={isAddUserDialogOpen}
            setIsOpen={setIsAddUserDialogOpen}
            companies={viewableBrandsForFilter}
            locations={allSystemLocations}
            currentUser={currentUser}
        />
      )}
    </div>
  );
}
