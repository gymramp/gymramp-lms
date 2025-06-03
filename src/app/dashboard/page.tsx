
// src/app/dashboard/page.tsx
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
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers as fetchAllSystemUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { getAllCourses as getAllLibraryCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms, getProgramById } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
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

  // State for filters
  const [selectedBrandIdForDashboard, setSelectedBrandIdForDashboard] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');


  const { toast } = useToast();
  const router = useRouter();

  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  const fetchInitialDashboardData = useCallback(async (user: User) => {
    console.log("[DashboardPage fetchInitialDashboardData] Starting for user:", user.email, "Role:", user.role);
    setIsLoadingBrandDataForFilters(true);
    setUserPrimaryBrand(null);
    try {
      const fetchedAccessibleBrands = await fetchAllAccessibleBrandsForUser(user);
      console.log("[DashboardPage fetchInitialDashboardData] Fetched accessible brands:", JSON.stringify(fetchedAccessibleBrands, null, 2));
      setViewableBrandsForFilter(fetchedAccessibleBrands);

      let primaryBrandForState: Company | null = null;
      if (user.companyId) {
        primaryBrandForState = fetchedAccessibleBrands.find(b => b.id === user.companyId);
        if (!primaryBrandForState && user.role !== 'Super Admin') {
          console.warn(`[DashboardPage] Primary brand ${user.companyId} for ${user.role} not in accessible list, direct fetching.`);
          primaryBrandForState = await getCompanyById(user.companyId);
        }
      }
      setUserPrimaryBrand(primaryBrandForState);
      console.log("[DashboardPage fetchInitialDashboardData] User's primary brand set to:", JSON.stringify(primaryBrandForState, null, 2));


      let initialSelectedBrandId = '';
      let allVisibleSystemLocationsForUser: Location[] = await fetchAllSystemLocations();

      if (user.role === 'Super Admin') {
        initialSelectedBrandId = 'all';
      } else if ((user.role === 'Admin' || user.role === 'Owner') && user.companyId) {
        initialSelectedBrandId = user.companyId;
        const accessibleBrandIds = fetchedAccessibleBrands.map(b => b.id);
        allVisibleSystemLocationsForUser = allVisibleSystemLocationsForUser.filter(loc => accessibleBrandIds.includes(loc.companyId));
      } else if (user.role === 'Manager' && user.companyId) {
        initialSelectedBrandId = user.companyId;
        if (user.assignedLocationIds && user.assignedLocationIds.length > 0) {
            allVisibleSystemLocationsForUser = allVisibleSystemLocationsForUser.filter(loc => loc.companyId === user.companyId && user.assignedLocationIds!.includes(loc.id));
        } else {
            allVisibleSystemLocationsForUser = [];
        }
      } else {
        initialSelectedBrandId = user.companyId || '';
      }

      setAllSystemLocations(allVisibleSystemLocationsForUser);
      setSelectedBrandIdForDashboard(initialSelectedBrandId);
      setSelectedLocationId('all');
      console.log(`[DashboardPage fetchInitialDashboardData] Initial Brand Filter: ${initialSelectedBrandId}, Initial Location Scope: ${allVisibleSystemLocationsForUser.length} locations.`);

    } catch (error) {
      console.error("[DashboardPage] Error fetching initial filter data:", error);
      toast({ title: "Error Initializing Dashboard Filters", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoadingBrandDataForFilters(false);
      console.log("[DashboardPage fetchInitialDashboardData] Finished.");
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
      console.log("[DashboardPage fetchEmployees] Skipped: No current user, auth loading, filter data loading, or no brand selected.");
      return;
    }
    setIsLoadingEmployees(true); setIsLoadingCoursesForAssignment(true);
    setLastGeneratedPassword(null);
    console.log(`[DashboardPage fetchEmployees] Fetching for brand filter: ${selectedBrandIdForDashboard}, User Role: ${currentUser.role}`);

    try {
      let usersToProcess: User[] = [];
      let companyContextForCourseAssignment: Company | null = null;

      if (currentUser.role === 'Super Admin') {
        if (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) {
          usersToProcess = await fetchAllSystemUsers();
          companyContextForCourseAssignment = null;
        } else {
          usersToProcess = await getUsersByCompanyId(selectedBrandIdForDashboard);
          companyContextForCourseAssignment = viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard) || null;
        }
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
         if (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) {
            const usersPromises = viewableBrandsForFilter.map(b => getUsersByCompanyId(b.id));
            usersToProcess = (await Promise.all(usersPromises)).flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));
            companyContextForCourseAssignment = userPrimaryBrand;
        } else {
            usersToProcess = viewableBrandsForFilter.some(b => b.id === selectedBrandIdForDashboard)
                ? await getUsersByCompanyId(selectedBrandIdForDashboard)
                : [];
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
      console.log(`[DashboardPage fetchEmployees] Fetched ${usersToProcess.length} base users. Calculated progress for ${employees.length}.`);


      let assignableCourses: (Course | BrandCourse)[] = [];
      const brandForCourseContext = companyContextForCourseAssignment ||
                                    (selectedBrandIdForDashboard !== 'all'
                                        ? viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)
                                        : null) ||
                                    userPrimaryBrand;


      if (brandForCourseContext && brandForCourseContext.id) {
        console.log(`[DashboardPage fetchAssignableCourses] Context brand for courses: ${brandForCourseContext.name} (ID: ${brandForCourseContext.id})`);
        const globalProgramCourses: Course[] = [];
        if (brandForCourseContext.assignedProgramIds && brandForCourseContext.assignedProgramIds.length > 0) {
          const allGlobalPrograms = await fetchAllGlobalPrograms();
          const relevantPrograms = allGlobalPrograms.filter(p => brandForCourseContext.assignedProgramIds!.includes(p.id));
          const courseIdSet = new Set<string>();
          relevantPrograms.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
          if (courseIdSet.size > 0) {
            const coursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
            const fetchedGlobalCourses = ((await Promise.all(coursePromises)).filter(Boolean) as Course[]).filter(c => !c.isDeleted);
            globalProgramCourses.push(...fetchedGlobalCourses);
          }
        }
        assignableCourses.push(...globalProgramCourses);
        if (brandForCourseContext.canManageCourses) {
          const brandCourses = (await getBrandCoursesByBrandId(brandForCourseContext.id)).filter(bc => !bc.isDeleted);
          assignableCourses.push(...brandCourses);
        }
      } else if (currentUser.role === 'Super Admin' && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard)) {
        console.log("[DashboardPage fetchAssignableCourses] Super Admin, 'All Brands' selected. Fetching all library courses.");
        assignableCourses = (await getAllLibraryCourses()).filter(c => !c.isDeleted);
      } else {
         console.log("[DashboardPage fetchAssignableCourses] No specific brand context for courses or SA not selected 'All'. Assignable courses will be empty unless global error.");
      }
      setAvailableCoursesForAssignment(assignableCourses.filter((course, index, self) => index === self.findIndex(c => c.id === course.id))); // Deduplicate
      console.log(`[DashboardPage fetchAssignableCourses] Total assignable courses found: ${availableCoursesForAssignment.length}`);

    } catch (error) {
      console.error("[DashboardPage] Error fetching employees/assignable courses:", error);
      toast({ title: "Error Fetching Dashboard Data", description: "Could not load employees or assignable courses.", variant: "destructive" });
      setEmployees([]); setAvailableCoursesForAssignment([]);
    } finally {
      setIsLoadingEmployees(false); setIsLoadingCoursesForAssignment(false);
      console.log("[DashboardPage fetchEmployees] Finished fetching employees and courses.");
    }
  }, [currentUser, selectedBrandIdForDashboard, viewableBrandsForFilter, userPrimaryBrand, toast, isAuthLoading, isLoadingBrandDataForFilters]);

  useEffect(() => {
    if (!isAuthLoading && currentUser && !isLoadingBrandDataForFilters && selectedBrandIdForDashboard) {
        fetchEmployeesAndAssignableCourses();
    }
  }, [fetchEmployeesAndAssignableCourses, isAuthLoading, currentUser, isLoadingBrandDataForFilters, selectedBrandIdForDashboard]);


 useEffect(() => {
    if (isLoadingBrandDataForFilters || !currentUser) {
      setLocationsForLocationFilter([]);
      return;
    }
    let currentBrandLocations: Location[] = [];

    if (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) {
      currentBrandLocations = allSystemLocations;
    } else if (selectedBrandIdForDashboard) {
      currentBrandLocations = allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForDashboard);
    }

    setLocationsForLocationFilter(currentBrandLocations);
    console.log(`[DashboardPage useEffect locationsForLocationFilter] For brand ${selectedBrandIdForDashboard}, available locations set to: ${currentBrandLocations.length}`);

    if (!currentBrandLocations.some(loc => loc.id === selectedLocationId) && selectedLocationId !== 'all') {
        setSelectedLocationId('all');
    }
  }, [selectedBrandIdForDashboard, allSystemLocations, currentUser, isLoadingBrandDataForFilters, selectedLocationId]);

 useEffect(() => {
      setSelectedLocationId('all');
  }, [selectedBrandIdForDashboard]);


  useEffect(() => {
    if (isLoadingEmployees || !currentUser) { setFilteredEmployees([]); return; }
    let tempUsers = [...employees];

    if (selectedLocationId && selectedLocationId !== 'all') {
      tempUsers = tempUsers.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId));
    } else if (currentUser.role === 'Manager' && selectedBrandIdForDashboard === currentUser.companyId && selectedLocationId === 'all') {
      const managerAssignedLocationIds = allSystemLocations.map(loc => loc.id);
      console.log(`[DashboardPage Manager Filter] Manager's assigned locations for filter:`, managerAssignedLocationIds);
      console.log(`[DashboardPage Manager Filter] Employees before location filter (${tempUsers.length}):`, tempUsers.map(e => ({email: e.email, locs: e.assignedLocationIds})));
      if (managerAssignedLocationIds.length > 0) {
        tempUsers = tempUsers.filter(emp =>
          emp.id === currentUser.id ||
          (emp.assignedLocationIds || []).some(empLocId => managerAssignedLocationIds.includes(empLocId))
        );
      } else {
        tempUsers = tempUsers.filter(emp => emp.id === currentUser.id);
      }
       console.log(`[DashboardPage Manager Filter] Employees AFTER location filter (${tempUsers.length}):`, tempUsers.map(e => e.email));
    }
    setFilteredEmployees(tempUsers);
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
    console.log(`[DashboardPage setFilteredEmployees] Final filter by location '${selectedLocationId}', ${tempUsers.length} users shown.`);
  }, [employees, selectedLocationId, currentUser, isLoadingEmployees, selectedBrandIdForDashboard, allSystemLocations]);


  const refreshDashboardData = (newUser?: User, tempPassword?: string) => {
    if (tempPassword) { setLastGeneratedPassword(tempPassword); }
    else { setLastGeneratedPassword(null); }
    if (currentUser) fetchEmployeesAndAssignableCourses();
  };

  const handleAddEmployeeClick = () => {
    if (!currentUser) return;
    if ((currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard ))) {
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

    const companyForCourseAssignment =
      (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) && currentUser.role === 'Super Admin'
      ? null
      : viewableBrandsForFilter.find(b => b.id === employee.companyId) ||
        (currentUser.companyId ? viewableBrandsForFilter.find(b => b.id === currentUser.companyId) : null);

    if (availableCoursesForAssignment.length === 0) {
        let toastDescription = `No courses available for assignment for ${companyForCourseAssignment?.name || 'the current brand context'}.`;
        if (currentUser.role === 'Super Admin' && !companyForCourseAssignment) {
            toastDescription = "There are no courses in the global library to assign.";
        } else if (!companyForCourseAssignment && currentUser.role !== 'Super Admin') {
            toastDescription = "Cannot determine course assignment context. Please select a specific brand filter or ensure the target user belongs to an accessible brand.";
        }
        toast({ title: "No Courses Available", description: toastDescription, variant: "destructive", duration: 7000 });
        return;
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

  const handleToggleUserStatus = async (userId: string, userName: string, currentIsActive: boolean) => {
    if (!currentUser || currentUser.id === userId) {
        toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive"}); return;
    }
    const targetUser = employees.find(u => u.id === userId);
    if (!targetUser) {
         toast({ title: "Error", description: "User not found.", variant: "destructive"}); return;
    }
    let canToggle = false;
    if (currentUser.role === 'Super Admin') {
        canToggle = true;
    } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId && viewableBrandsForFilter.some(b => b.id === targetUser.companyId)) {
        canToggle = ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role];
    } else if (currentUser.role === 'Manager' && currentUser.companyId === targetUser.companyId) {
        canToggle = (targetUser.role === 'Staff' || targetUser.role === 'Manager');
    }

    if (!canToggle) {
        toast({ title: "Permission Denied", description: "You cannot modify this user's status.", variant: "destructive" });
        return;
    }

    const updatedUser = await toggleUserDataStatus(userId);
    if (updatedUser) {
      fetchEmployeesAndAssignableCourses();
      toast({ title: currentIsActive ? "User Deactivated" : "User Reactivated", description: `${userName}'s status updated.`, variant: currentIsActive ? "destructive" : "default" });
    } else {
        toast({ title: "Error", description: `Failed to update status for ${userName}.`, variant: "destructive" });
    }
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

  const displayBrandNameForManager = userPrimaryBrand?.name || (isLoadingBrandDataForFilters ? 'Loading brand...' : 'Brand Not Found');

  const displayBrandNameForTitle = selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard
    ? (currentUser?.role === 'Super Admin' ? 'All System Brands' : (viewableBrandsForFilter.length > 1 || (viewableBrandsForFilter.length === 0 && !userPrimaryBrand) ? 'All Accessible Brands' : (userPrimaryBrand?.name || 'Your Brand')))
    : (viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)?.name || userPrimaryBrand?.name || 'Selected Brand');
  const displayLocationName = selectedLocationId === 'all' ? 'All Locations' : allSystemLocations.find(l => l.id === selectedLocationId)?.name || '';
  const pageIsLoading = isAuthLoading || isLoadingBrandDataForFilters;

  if (pageIsLoading || !currentUser) {
    return ( <div className="container mx-auto flex-1 space-y-4"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"> <Skeleton className="col-span-4 h-64" /> <Skeleton className="col-span-4 lg:col-span-3 h-64" /> </div> </div> );
  }
  if (!userPrimaryBrand && currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto flex-1 space-y-4 text-center">Error: User not associated with a primary brand. Please contact support.</div>;
  }

  return (
    <div className="container mx-auto flex-1 space-y-4 pb-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{displayBrandNameForTitle} Dashboard</h1>
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
              disabled={isLoadingEmployees || isLoadingBrandDataForFilters || (currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard))}
              title={(currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard)) ? "Add a brand first" : ""}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          )}
        </div>
      </div>

      {lastGeneratedPassword && ( <Alert variant="success" className="mb-6 border-green-300 bg-green-50 dark:bg-green-900/30"> <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" /> <AlertTitle className="text-green-800 dark:text-green-300">New User Added!</AlertTitle> <AlertDescription className="text-green-700 dark:text-green-400"> The temporary password for the new user is: <strong className="font-bold">{lastGeneratedPassword}</strong><br/> A welcome email has been sent. They will be required to change this password on their first login. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPassword(null)} className="ml-4 text-green-700 hover:text-green-800">Dismiss</Button> </AlertDescription> </Alert> )}

      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold mr-4 self-center text-foreground">Filters:</h2>
          <div className="flex flex-col space-y-1">
            <Label htmlFor="brand-filter-dashboard" className="text-sm text-muted-foreground">Brand</Label>
            {currentUser?.role === 'Manager' ? (
                <Input
                    id="brand-filter-dashboard-manager"
                    value={displayBrandNameForManager}
                    readOnly
                    disabled
                    className="w-[220px] bg-background/50 h-10"
                />
            ) : (
                <Select
                  value={selectedBrandIdForDashboard || 'placeholder-brand'}
                  onValueChange={(value) => setSelectedBrandIdForDashboard(value === 'placeholder-brand' ? '' : value)}
                  disabled={isLoadingEmployees || isLoadingBrandDataForFilters || (viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin')}
                >
                  <SelectTrigger id="brand-filter-dashboard" className="w-[220px] bg-background h-10">
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder-brand" disabled>Select a brand...</SelectItem>
                    {(currentUser?.role === 'Super Admin' || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                    {viewableBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                    {viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && <SelectItem value="no-brands" disabled>No Brands Found</SelectItem>}
                  </SelectContent>
                </Select>
            )}
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
                      {selectedBrandIdForDashboard && selectedBrandIdForDashboard !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="none" disabled>No locations in this brand</SelectItem> )}
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
                  <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={handleToggleUserStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companies={viewableBrandsForFilter} />
                }
                <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active) </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.max(p - 1, 1))} disabled={activeCurrentPage === 1 || isLoadingEmployees || totalActivePages === 0}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.min(p + 1, totalActivePages))} disabled={activeCurrentPage === totalActivePages || isLoadingEmployees || totalActivePages === 0}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
              </TabsContent>
              <TabsContent value="inactive"> <CardDescription className="mb-4 text-foreground">View deactivated employees. They can be reactivated.</CardDescription>
                {isLoadingEmployees ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
                  <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={handleToggleUserStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companies={viewableBrandsForFilter}/>
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
            (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) && currentUser?.role === 'Super Admin'
            ? null
            : viewableBrandsForFilter.find(b => b.id === userToAssignCourse.companyId) ||
              (currentUser?.companyId ? viewableBrandsForFilter.find(b => b.id === currentUser.companyId) : null)
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
