
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, UserPlus, Activity, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog'; // Corrected: Use AddUserDialog from admin folder
import { EditUserDialog } from '@/components/admin/EditUserDialog'; // Corrected: Use EditUserDialog from admin folder
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { User, Company, Location } from '@/types/user';
import type { Course, BrandCourse } from '@/types/course'; // Added BrandCourse
import type { ActivityLog } from '@/types/activity';
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations, getAllCompanies } from '@/lib/company-data'; // Added getAllCompanies
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data';
import { getAllCourses as getAllLibraryCourses, getCourseById, getAllPrograms } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data'; // For brand-specific courses
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlusCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

const DEFAULT_ROWS_PER_PAGE = 5;

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPrimaryBrand, setUserPrimaryBrand] = useState<Company | null>(null); // User's own primary brand
  const [viewableBrandsForFilter, setViewableBrandsForFilter] = useState<Company[]>([]); // Brands for the filter dropdown
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]); // All locations user can see across all their viewable brands
  const [locationsForLocationFilter, setLocationsForLocationFilter] = useState<Location[]>([]); // Locations for the location filter, dependent on selected brand
  
  const [selectedBrandIdForDashboard, setSelectedBrandIdForDashboard] = useState<string>('all'); // 'all' or a specific brand ID
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [employees, setEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [availableCoursesForAssignment, setAvailableCoursesForAssignment] = useState<(Course | BrandCourse)[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
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
    if (!userEmail) { setIsLoading(false); setIsLoadingActivity(false); return; }
    setIsLoading(true); setIsLoadingActivity(true);
    try {
      const userDetails = await getUserByEmail(userEmail);
      setCurrentUser(userDetails);

      if (!userDetails) {
        setIsLoading(false); setIsLoadingActivity(false); return;
      }
      
      // Fetch accessible brands for the filter
      const fetchedViewableBrands = await getAllCompanies(userDetails);
      setViewableBrandsForFilter(fetchedViewableBrands);

      // Fetch user's primary brand details
      if (userDetails.companyId) {
        const primaryBrand = await getCompanyById(userDetails.companyId);
        setUserPrimaryBrand(primaryBrand);
      } else {
        setUserPrimaryBrand(null); // Or handle default brand assignment if that logic applies
      }

      // Fetch all locations the current user can potentially see
      // For Super Admin: all locations. For Brand Admin/Owner: locations of their brand and child brands. For Manager: locations they are assigned to.
      let allPotentiallyVisibleLocations: Location[] = [];
      if (userDetails.role === 'Super Admin') {
        allPotentiallyVisibleLocations = await getAllLocations();
      } else if (userDetails.role === 'Admin' || userDetails.role === 'Owner') {
        const brandIds = fetchedViewableBrands.map(b => b.id);
        const locationPromises = brandIds.map(id => getLocationsByCompanyId(id));
        allPotentiallyVisibleLocations = (await Promise.all(locationPromises)).flat();
      } else if (userDetails.role === 'Manager' && userDetails.assignedLocationIds && userDetails.assignedLocationIds.length > 0 && userDetails.companyId) {
         // Manager sees only their assigned locations within their primary brand
         const brandLocations = await getLocationsByCompanyId(userDetails.companyId);
         allPotentiallyVisibleLocations = brandLocations.filter(loc => userDetails.assignedLocationIds!.includes(loc.id));
      }
      setAllSystemLocations(allPotentiallyVisibleLocations);
      
      // Set initial filter state
      if (userDetails.role !== 'Super Admin' && userDetails.companyId) {
        setSelectedBrandIdForDashboard(userDetails.companyId);
        setLocationsForLocationFilter(allPotentiallyVisibleLocations.filter(loc => loc.companyId === userDetails.companyId));
      } else {
        setSelectedBrandIdForDashboard('all');
        setLocationsForLocationFilter(allPotentiallyVisibleLocations);
      }
      
      // Fetch employees based on the initial selectedBrandIdForDashboard
      let companyUsers: User[] = [];
      if (selectedBrandIdForDashboard === 'all' && (userDetails.role === 'Super Admin' || userDetails.role === 'Admin' || userDetails.role === 'Owner')) {
        // For Super Admin "All Brands", fetch all users.
        // For Brand Admin/Owner "All Brands", fetch users from their primary brand and child brands.
        const usersPromises = fetchedViewableBrands.map(b => getUsersByCompanyId(b.id));
        companyUsers = (await Promise.all(usersPromises)).flat();
      } else if (selectedBrandIdForDashboard !== 'all') {
        companyUsers = await getUsersByCompanyId(selectedBrandIdForDashboard);
      } else if (userDetails.companyId) { // Fallback for Manager or if a non-SA has no specific brand selected yet
        companyUsers = await getUsersByCompanyId(userDetails.companyId);
      }
      // For Manager, further filter by their assigned locations if a specific brand (their own) is selected
      if (userDetails.role === 'Manager' && selectedBrandIdForDashboard === userDetails.companyId && userDetails.assignedLocationIds) {
          companyUsers = companyUsers.filter(emp => (emp.assignedLocationIds || []).some(locId => userDetails.assignedLocationIds!.includes(locId)) || emp.id === userDetails.id);
      } else if (userDetails.role === 'Manager') { // If "All Brands" or a brand they don't manage directly is selected (should not happen for manager filter)
          companyUsers = companyUsers.filter(emp => emp.id === userDetails.id); // Only see themselves
      }


      const employeesWithProgressPromises = companyUsers.map(async (user) => {
        const overallProgress = await getUserOverallProgress(user.id);
        let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
        if (overallProgress === 100) overallStatus = "Completed";
        else if (overallProgress > 0) overallStatus = "In Progress";
        return { ...user, overallProgress, overallStatus };
      });
      const employeesWithProgress = await Promise.all(employeesWithProgressPromises);
      setEmployees(employeesWithProgress);

      // Fetch courses available for assignment
      const libraryCourses = await getAllLibraryCourses();
      const programs = await getAllPrograms();
      let brandAccessibleGlobalCourseIds = new Set<string>();

      if (userDetails.companyId) {
        const primaryBrand = fetchedViewableBrands.find(b => b.id === userDetails.companyId);
        if (primaryBrand) {
          (primaryBrand.assignedCourseIds || []).forEach(id => brandAccessibleGlobalCourseIds.add(id)); // Directly assigned to primary brand
          const purchaseRecord = await getCustomerPurchaseRecordByBrandId(primaryBrand.id);
          if (purchaseRecord?.selectedProgramId) {
            const program = programs.find(p => p.id === purchaseRecord.selectedProgramId);
            (program?.courseIds || []).forEach(id => brandAccessibleGlobalCourseIds.add(id));
          }
        }
      } else if (userDetails.role === 'Super Admin') { // Super admin can assign any library course
          libraryCourses.forEach(course => brandAccessibleGlobalCourseIds.add(course.id));
      }
      
      const globalCoursesForAssignment = libraryCourses.filter(course => brandAccessibleGlobalCourseIds.has(course.id));
      
      let brandCreatedCourses: BrandCourse[] = [];
      if (userPrimaryBrand?.canManageCourses && userPrimaryBrand.id) {
        brandCreatedCourses = await getBrandCoursesByBrandId(userPrimaryBrand.id);
      }
      // Also include brand-created courses from child brands if the current user is Admin/Owner of parent
      if ((userDetails.role === 'Admin' || userDetails.role === 'Owner') && userDetails.companyId) {
          const childBrands = fetchedViewableBrands.filter(b => b.parentBrandId === userDetails.companyId);
          for (const child of childBrands) {
              if (child.canManageCourses) {
                  const childCourses = await getBrandCoursesByBrandId(child.id);
                  brandCreatedCourses.push(...childCourses);
              }
          }
      }
      
      setAvailableCoursesForAssignment([...globalCoursesForAssignment, ...brandCreatedCourses]);


      // Simplified Activity Feed (can be expanded)
      setIsLoadingActivity(true);
      const derivedActivities: ActivityLog[] = [];
      const courseTitleCache: Record<string, string> = {};

      for (const emp of employeesWithProgress) {
          if (emp.createdAt && emp.createdAt instanceof Timestamp) {
             derivedActivities.push({ id: `user-added-${emp.id}`, timestamp: emp.createdAt.toDate(), type: 'user_added', userId: emp.id, userName: emp.name, companyId: emp.companyId, locationIds: emp.assignedLocationIds || [], details: { message: `${emp.name} was added.` } });
          }
          if (emp.courseProgress) {
             for (const courseId in emp.courseProgress) {
                 const progressData = emp.courseProgress[courseId];
                 if (progressData?.lastUpdated && progressData.lastUpdated instanceof Timestamp) {
                     if (!courseTitleCache[courseId]) {
                          let courseInfo = await getCourseById(courseId) || await getBrandCourseById(courseId);
                          courseTitleCache[courseId] = courseInfo?.title || 'Unknown Course';
                     }
                      const courseTitle = courseTitleCache[courseId];
                      derivedActivities.push({ id: `progress-${emp.id}-${courseId}-${progressData.lastUpdated.toMillis()}`, timestamp: progressData.lastUpdated.toDate(), type: 'course_progress_updated', userId: emp.id, userName: emp.name, companyId: emp.companyId, locationIds: emp.assignedLocationIds || [], details: { message: `${emp.name} updated progress on '${courseTitle}'. Status: ${progressData.status || 'N/A'}`, courseId: courseId, courseTitle: courseTitle, status: progressData.status } });
                 }
             }
          }
      }
      derivedActivities.sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime());
      setRecentActivity(derivedActivities);
      setIsLoadingActivity(false);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
    } finally {
         setIsLoading(false); setIsLoadingActivity(false);
    }
   }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            fetchInitialData(user?.email || null);
        });
        return () => unsubscribe();
    }, [fetchInitialData]);

    // Effect to update location filter when selected brand changes
    useEffect(() => {
        if (selectedBrandIdForDashboard === 'all') {
            setLocationsForLocationFilter(allSystemLocations); // Show all accessible locations if "All Brands"
        } else if (selectedBrandIdForDashboard) {
            setLocationsForLocationFilter(allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForDashboard));
        } else {
            setLocationsForLocationFilter([]);
        }
        setSelectedLocationId('all'); // Reset location selection when brand changes
    }, [selectedBrandIdForDashboard, allSystemLocations]);

    // Effect to re-fetch employees when brand or location filter changes
    useEffect(() => {
        if (!currentUser) return;
        setIsLoading(true);
        
        async function fetchAndSetEmployees() {
            let usersToProcess: User[] = [];
            if (selectedBrandIdForDashboard === 'all' && (currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
                const usersPromises = viewableBrandsForFilter.map(b => getUsersByCompanyId(b.id));
                usersToProcess = (await Promise.all(usersPromises)).flat();
            } else if (selectedBrandIdForDashboard && selectedBrandIdForDashboard !== 'all') {
                usersToProcess = await getUsersByCompanyId(selectedBrandIdForDashboard);
            } else if (currentUser.companyId && currentUser.role !== 'Super Admin') { // Fallback for non-SA if no brand selected
                usersToProcess = await getUsersByCompanyId(currentUser.companyId);
            }

            if (currentUser.role === 'Manager' && selectedBrandIdForDashboard === currentUser.companyId && currentUser.assignedLocationIds) {
                 usersToProcess = usersToProcess.filter(emp => (emp.assignedLocationIds || []).some(locId => currentUser.assignedLocationIds!.includes(locId)) || emp.id === currentUser.id);
            } else if (currentUser.role === 'Manager'){
                 usersToProcess = usersToProcess.filter(emp => emp.id === currentUser.id);
            }

            const employeesWithProgressPromises = usersToProcess.map(async (user) => {
              const overallProgress = await getUserOverallProgress(user.id);
              let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
              if (overallProgress === 100) overallStatus = "Completed";
              else if (overallProgress > 0) overallStatus = "In Progress";
              return { ...user, overallProgress, overallStatus };
            });
            const employeesWithProgress = await Promise.all(employeesWithProgressPromises);
            setEmployees(employeesWithProgress);
            setIsLoading(false);
        }

        fetchAndSetEmployees();
    }, [currentUser, selectedBrandIdForDashboard, viewableBrandsForFilter]);


    // Filter employees based on selected location
    useEffect(() => {
        setActiveCurrentPage(1); setInactiveCurrentPage(1);
        if (!selectedLocationId || selectedLocationId === 'all') {
            setFilteredEmployees(employees);
        } else {
            setFilteredEmployees(employees.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId)));
        }
    }, [employees, selectedLocationId]);


    const filteredActivity = React.useMemo(() => {
        let activity = recentActivity;
        if (selectedBrandIdForDashboard && selectedBrandIdForDashboard !== 'all') {
            activity = activity.filter(log => log.companyId === selectedBrandIdForDashboard);
        }
        if (selectedLocationId && selectedLocationId !== 'all') {
            activity = activity.filter(log => (log.locationIds || []).includes(selectedLocationId));
        }
        return activity;
    }, [recentActivity, selectedBrandIdForDashboard, selectedLocationId]);

   const refreshEmployees = () => { if (currentUser?.email) fetchInitialData(currentUser.email); };
   const handleAddEmployeeClick = () => setIsAddUserDialogOpen(true);
   const handleEditUserClick = (user: User) => { setUserToEdit(user); setIsEditUserDialogOpen(true); };
   const handleUserUpdated = () => { refreshEmployees(); setIsEditUserDialogOpen(false); setUserToEdit(null); };

  const handleToggleEmployeeStatus = async (userId: string) => {
      // Permission checks similar to AdminUsersPage
      const targetUser = employees.find(emp => emp.id === userId);
      if (!currentUser || !targetUser) return;
      if (currentUser.id === targetUser.id) { toast({ title: "Action Denied", description: "Cannot change own status.", variant: "destructive" }); return; }
      let canToggle = false;
      if (currentUser.role === 'Super Admin') canToggle = true;
      else if (currentUser.companyId) {
          const targetUserIsInViewableBrand = viewableBrandsForFilter.some(vb => vb.id === targetUser.companyId);
          if (targetUserIsInViewableBrand && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role]) {
              if (currentUser.role === 'Manager' && targetUser.role !== 'Staff') canToggle = false;
              else canToggle = true;
          }
      }
      if (!canToggle) { toast({ title: "Permission Denied", variant: "destructive" }); return; }

      const updatedUser = await toggleUserDataStatus(userId);
      if (updatedUser) { refreshEmployees(); toast({ title: updatedUser.isActive ? "User Reactivated" : "User Deactivated", description: `${updatedUser.name}'s status updated.`, variant: updatedUser.isActive ? "default" : "destructive" }); }
      else { toast({ title: "Error", description: "Failed to update user status.", variant: "destructive" }); }
  };

  const openAssignCourseDialog = (employee: User) => {
     // Permission checks
     if (!currentUser) return;
     let canAssign = false;
     if (currentUser.role === 'Super Admin') canAssign = true;
     else if (currentUser.companyId) {
         const targetUserIsInViewableBrand = viewableBrandsForFilter.some(vb => vb.id === employee.companyId);
         if (targetUserIsInViewableBrand && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[employee.role]) {
             if (currentUser.role === 'Manager' && employee.role !== 'Staff') canAssign = false;
             else canAssign = true;
         }
     }
     if (!canAssign) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
     if (availableCoursesForAssignment.length === 0) { toast({ title: "No Courses Available", description: "No courses are available for assignment to users in the selected brand scope.", variant: "destructive" }); return; }
     setUserToAssignCourse(employee); setIsAssignCourseDialogOpen(true);
  };

  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;
    // Permission check before proceeding (similar to openAssignCourseDialog)
    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);
    if (updatedUser) {
        refreshEmployees();
        const courseDetails = await getCourseById(courseId) || await getBrandCourseById(courseId);
        toast({ title: action === 'assign' ? "Course Assigned" : "Course Unassigned", description: `${action === 'assign' ? `"${courseDetails?.title || 'Course'}" assigned to` : `Course removed from`} ${userToAssignCourse.name}.` });
    } else {
        toast({ title: "Error", description: `Failed to ${action} course.`, variant: "destructive" });
    }
    setIsAssignCourseDialogOpen(false); setUserToAssignCourse(null);
  };

  const activeEmployees = useMemo(() => filteredEmployees.filter(emp => emp.isActive), [filteredEmployees]);
  const inactiveEmployees = useMemo(() => filteredEmployees.filter(emp => !emp.isActive), [filteredEmployees]);
  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalActivePages = rowsPerPage === 'all' ? (activeEmployees.length > 0 ? 1 : 0) : Math.ceil(activeEmployees.length / rowsToShow);
  const totalInactivePages = rowsPerPage === 'all' ? (inactiveEmployees.length > 0 ? 1 : 0) : Math.ceil(inactiveEmployees.length / rowsToShow);
  const paginatedActiveEmployees = useMemo(() => rowsPerPage === 'all' ? activeEmployees : activeEmployees.slice((activeCurrentPage - 1) * rowsToShow, activeCurrentPage * rowsToShow), [activeEmployees, activeCurrentPage, rowsToShow]);
  const paginatedInactiveEmployees = useMemo(() => rowsPerPage === 'all' ? inactiveEmployees : inactiveEmployees.slice((inactiveCurrentPage - 1) * rowsToShow, inactiveCurrentPage * rowsToShow), [inactiveEmployees, inactiveCurrentPage, rowsToShow]);
  const totalActiveFiltered = activeEmployees.length;
  const avgCompletion = totalActiveFiltered > 0 ? Math.round(activeEmployees.reduce((sum, emp) => sum + emp.overallProgress, 0) / totalActiveFiltered) : 0;
  const certificatesIssued = useMemo(() => activeEmployees.reduce((count, emp) => count + Object.values(emp.courseProgress || {}).filter(p => p?.status === 'Completed').length, 0), [activeEmployees]);
  const totalActiveFilteredCourses = useMemo(() => new Set(activeEmployees.flatMap(emp => emp.assignedCourseIds || []).filter(Boolean)).size, [activeEmployees]);
  const handleRowsPerPageChange = (value: string) => { if (value === 'all') setRowsPerPage('all'); else setRowsPerPage(parseInt(value, 10)); setActiveCurrentPage(1); setInactiveCurrentPage(1); };

  if (isLoading && (!currentUser || !userPrimaryBrand && viewableBrandsForFilter.length === 0)) {
      return ( <div className="flex-1 space-y-4 p-8 pt-6"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"> <Skeleton className="col-span-4 h-64" /> <Skeleton className="col-span-4 lg:col-span-3 h-64" /> </div> </div> );
  }
  if (!currentUser || (!userPrimaryBrand && currentUser.role !== 'Super Admin')) { // Check userPrimaryBrand for non-SA
       return <div className="flex-1 space-y-4 p-8 pt-6 text-center">Could not load dashboard data. User may not be assigned to a primary brand.</div>;
  }
  const displayBrandName = selectedBrandIdForDashboard === 'all' ? 'All Accessible Brands' : viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)?.name || userPrimaryBrand?.name || 'Dashboard';
  const displayLocationName = selectedLocationId === 'all' ? 'All Locations' : locationsForLocationFilter.find(l => l.id === selectedLocationId)?.name || '';

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) { case 'user_added': return <UserPlus className="h-4 w-4 text-green-500" />; case 'course_progress_updated': return <Activity className="h-4 w-4 text-blue-500" />; default: return <Activity className="h-4 w-4 text-muted-foreground" />; }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
         <div> <h1 className="text-3xl font-bold tracking-tight text-primary">{displayBrandName} Dashboard</h1> <p className="text-muted-foreground flex items-center gap-2"> <Building className="h-4 w-4" /> {displayLocationName ? `Viewing: ${displayLocationName}` : 'Overview'} </p> </div>
        <div className="flex items-center space-x-2">
           <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={!currentUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) || (viewableBrandsForFilter.length === 0 && currentUser.role === 'Super Admin') }>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
                </Button>
              </DialogTrigger>
                <AddUserDialog onUserAdded={refreshEmployees} isOpen={isAddUserDialogOpen} setIsOpen={setIsAddUserDialogOpen} companies={viewableBrandsForFilter} locations={allSystemLocations} currentUser={currentUser} />
           </Dialog>
        </div>
      </div>

       <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
           <div className="flex items-center gap-2">
             <Label htmlFor="brand-filter-dashboard">Brand:</Label>
             <Select value={selectedBrandIdForDashboard} onValueChange={setSelectedBrandIdForDashboard}
               disabled={viewableBrandsForFilter.length <= 1 && currentUser.role !== 'Super Admin'}>
               <SelectTrigger id="brand-filter-dashboard" className="w-[220px] bg-background">
                 <SelectValue placeholder="Select Brand" />
               </SelectTrigger>
               <SelectContent>
                  {(currentUser.role === 'Super Admin' || (currentUser.role === 'Admin' || currentUser.role === 'Owner')) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                 {viewableBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
               </SelectContent>
             </Select>
           </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="location-filter-dashboard">Location:</Label>
                 <Select value={selectedLocationId} onValueChange={setSelectedLocationId}
                    disabled={locationsForLocationFilter.length === 0} >
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
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Courses (Assigned)</CardTitle> <BookOpen className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalActiveFilteredCourses}</div> <p className="text-xs text-muted-foreground">unique courses in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Avg. Completion (Overall)</CardTitle> <TrendingUp className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{avgCompletion}%</div> <p className="text-xs text-muted-foreground">Across active users in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Certificates Issued (Overall)</CardTitle> <Award className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">+{certificatesIssued}</div> <p className="text-xs text-muted-foreground">By active users in view</p> </CardContent> </Card>
      </div>

      <div className="flex flex-col space-y-4">
        <Card>
           <CardHeader> <CardTitle>Team Management</CardTitle> </CardHeader>
             <CardContent>
                 <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4"> <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger> <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger> </TabsList>
                     <TabsContent value="active"> <CardDescription className="mb-4">Track your active team's overall course completion status.</CardDescription>
                         <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companyCourses={availableCoursesForAssignment} />
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active) </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.max(p - 1, 1))} disabled={activeCurrentPage === 1}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.min(p + 1, totalActivePages))} disabled={activeCurrentPage === totalActivePages}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                     <TabsContent value="inactive"> <CardDescription className="mb-4">View deactivated employees. They can be reactivated.</CardDescription>
                         <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allSystemLocations} companyCourses={availableCoursesForAssignment} />
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {inactiveCurrentPage} of {totalInactivePages} ({inactiveEmployees.length} total inactive) </div> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.max(p - 1, 1))} disabled={inactiveCurrentPage === 1}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.min(p + 1, totalInactivePages))} disabled={inactiveCurrentPage === totalInactivePages}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                 </Tabs>
                 <div className="flex items-center justify-end space-x-2 pt-4 border-t mt-4"> <Label htmlFor="rows-per-page">Rows:</Label> <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}> <SelectTrigger id="rows-per-page" className="w-[80px]"> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="5">5</SelectItem> <SelectItem value="10">10</SelectItem> <SelectItem value="15">15</SelectItem> <SelectItem value="all">All</SelectItem> </SelectContent> </Select> </div>
             </CardContent>
        </Card>

        <Card>
          <CardHeader> <CardTitle>Recent Activity</CardTitle> <CardDescription>Latest updates for the selected scope.</CardDescription> </CardHeader>
           <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
             {isLoadingActivity ? ( <div className="space-y-4 py-4"> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div> )
             : filteredActivity.length > 0 ? ( filteredActivity.slice(0, 15).map((activity) => ( <div key={activity.id} className="flex items-center gap-3 p-2 border-b last:border-b-0"> <div className="flex-shrink-0"> {getActivityIcon(activity.type)} </div> <div className="flex-1"> <p className="text-sm text-foreground">{activity.details.message}</p> <p className="text-xs text-muted-foreground"> {formatDistanceToNow(activity.timestamp as Date, { addSuffix: true })} </p> </div> </div> )) )
             : ( <p className="text-center text-muted-foreground py-10 italic">No recent activity for this scope.</p> )}
          </CardContent>
        </Card>
      </div>

       {userToAssignCourse && userPrimaryBrand && (
        <AssignCourseDialog isOpen={isAssignCourseDialogOpen} setIsOpen={setIsAssignCourseDialogOpen} employee={userToAssignCourse}
          courses={availableCoursesForAssignment.filter(c => 'brandId' in c ? c.brandId === userPrimaryBrand.id || viewableBrandsForFilter.find(vb => vb.id === c.brandId && vb.parentBrandId === userPrimaryBrand.id) : true)} // Filter brand courses for assignment
          company={userPrimaryBrand} onAssignCourse={handleAssignCourse} />
      )}
      {isEditUserDialogOpen && userToEdit && currentUser && ( <EditUserDialog isOpen={isEditUserDialogOpen} setIsOpen={setIsEditUserDialogOpen} user={userToEdit} onUserUpdated={handleUserUpdated} currentUser={currentUser} companies={viewableBrandsForFilter} locations={allSystemLocations} /> )}
    </div>
  );
}

    