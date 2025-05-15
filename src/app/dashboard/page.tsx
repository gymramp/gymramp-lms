
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, UserPlus, Activity, ChevronLeft, ChevronRight } from "lucide-react"; // Added Chevron icons
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog'; // Corrected path
import { EditUserDialog } from '@/components/admin/EditUserDialog'; // Import EditUserDialog
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { User, Company, Location } from '@/types/user'; // Import new types
import type { Course } from '@/types/course';
import type { ActivityLog } from '@/types/activity'; // Import ActivityLog type
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser } from '@/lib/user-data'; // Use user-data functions and corrected import
import { getCompanyById, getLocationsByCompanyId, getAllLocations } from '@/lib/company-data';
import { getAllCourses, getCourseById } from '@/lib/firestore-data'; // Import getCourseById
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; // Import Label
import { PlusCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp
import { formatDistanceToNow } from 'date-fns'; // For formatting time ago
import { cn } from '@/lib/utils'; // Import cn

// Define combined type for employee with progress
type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

const DEFAULT_ROWS_PER_PAGE = 5; // Default rows per page

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanyLocations, setAllCompanyLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [employees, setEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]); // State for recent activity
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true); // Loading state for activity
  const [isAssignCourseDialogOpen, setIsAssignCourseDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false); // State for EditUserDialog
  const [userToAssignCourse, setUserToAssignCourse] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null); // State for user being edited
  const { toast } = useToast();

  // Pagination State
  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE); // Can be number or 'all'

  // Fetch current user and their company/location data
   const fetchInitialData = useCallback(async (userEmail: string | null) => {
        if (!userEmail) {
             console.log("No user email, cannot fetch dashboard data.");
            setIsLoading(false);
            setIsLoadingActivity(false);
             return;
        }
        setIsLoading(true);
        setIsLoadingActivity(true); // Start loading activity
        try {
            const userDetails = await getUserByEmail(userEmail);
            setCurrentUser(userDetails);

            if (!userDetails || !userDetails.companyId) {
                 console.error("Logged in user not found or not associated with a company.");
                 setCompany(null);
                 setAllCompanyLocations([]);
                 setEmployees([]);
                 setCourses([]);
                 setRecentActivity([]); // Clear activity
                 setIsLoading(false);
                 setIsLoadingActivity(false);
                 return;
            }

            // Fetch Company Details
            const companyDetails = await getCompanyById(userDetails.companyId);
            setCompany(companyDetails);

            // Fetch Locations
            let accessibleLocations: Location[] = [];
            if (userDetails.role === 'Admin' || userDetails.role === 'Owner' || userDetails.role === 'Super Admin') {
                accessibleLocations = await getLocationsByCompanyId(userDetails.companyId);
            } else if (userDetails.role === 'Manager') {
                 const allLocations = await getLocationsByCompanyId(userDetails.companyId);
                 accessibleLocations = allLocations.filter(loc => (userDetails.assignedLocationIds || []).includes(loc.id));
            }
            setAllCompanyLocations(accessibleLocations);
            if (accessibleLocations.length > 0 && userDetails.role === 'Manager') {
               setSelectedLocationId(accessibleLocations[0].id);
            } else {
                setSelectedLocationId('all');
            }

            // Fetch Users
             let companyUsers: User[] = [];
             if (userDetails.role === 'Admin' || userDetails.role === 'Owner' || userDetails.role === 'Super Admin') {
                 companyUsers = (await getAllUsers()).filter(u => u.companyId === userDetails.companyId);
             } else if (userDetails.role === 'Manager') {
                  const allCompanyUsers = (await getAllUsers()).filter(u => u.companyId === userDetails.companyId);
                  companyUsers = allCompanyUsers.filter((emp) =>
                      (emp.assignedLocationIds || []).some(locId => (userDetails.assignedLocationIds || []).includes(locId)) || emp.role === 'Manager'
                  );
             }

              // Fetch overall progress for each user
              const employeesWithProgressPromises = companyUsers.map(async (user) => {
                const overallProgress = await getUserOverallProgress(user.id);
                let overallStatus: EmployeeWithOverallProgress['overallStatus'] = "Not Started";
                if (overallProgress === 100) {
                    overallStatus = "Completed";
                } else if (overallProgress > 0) {
                    overallStatus = "In Progress";
                }
                return { ...user, overallProgress, overallStatus };
              });
              const employeesWithProgress = await Promise.all(employeesWithProgressPromises);
              setEmployees(employeesWithProgress);


            // Fetch Courses available to the Company
            let companyCourses: Course[] = [];
            if (companyDetails && companyDetails.assignedCourseIds && companyDetails.assignedCourseIds.length > 0) {
                 const allLibCourses = await getAllCourses();
                 companyCourses = allLibCourses.filter(course => companyDetails.assignedCourseIds?.includes(course.id));
                 setCourses(companyCourses);
            } else {
                 setCourses([]);
            }

            // --- Derive Recent Activity ---
            setIsLoadingActivity(true);
            const derivedActivities: ActivityLog[] = [];
            const courseTitleCache: Record<string, string> = {}; // Cache course titles

            for (const emp of employeesWithProgress) {
                // User Added Activity (only if createdAt exists and is a Timestamp)
                if (emp.createdAt && emp.createdAt instanceof Timestamp) {
                   derivedActivities.push({
                       id: `user-added-${emp.id}`,
                       timestamp: emp.createdAt.toDate(), // Convert Timestamp to Date
                       type: 'user_added',
                       userId: emp.id,
                       userName: emp.name,
                       companyId: emp.companyId,
                       locationIds: emp.assignedLocationIds || [],
                       details: { message: `${emp.name} was added.` }
                   });
                }

                // Course Progress Activity
                if (emp.courseProgress) {
                   for (const courseId in emp.courseProgress) {
                       const progressData = emp.courseProgress[courseId];
                       if (progressData?.lastUpdated && progressData.lastUpdated instanceof Timestamp) {
                            // Fetch course title if not cached
                           if (!courseTitleCache[courseId]) {
                                const course = await getCourseById(courseId);
                                courseTitleCache[courseId] = course?.title || 'Unknown Course';
                            }
                            const courseTitle = courseTitleCache[courseId];

                            derivedActivities.push({
                                id: `progress-${emp.id}-${courseId}-${progressData.lastUpdated.toMillis()}`,
                                timestamp: progressData.lastUpdated.toDate(),
                                type: 'course_progress_updated',
                                userId: emp.id,
                                userName: emp.name,
                                companyId: emp.companyId,
                                locationIds: emp.assignedLocationIds || [],
                                details: {
                                    message: `${emp.name} updated progress on '${courseTitle}'. Status: ${progressData.status || 'N/A'}`,
                                    courseId: courseId,
                                    courseTitle: courseTitle,
                                    status: progressData.status
                                }
                            });
                       }
                   }
                }
            }

            // Sort activities by timestamp descending
            derivedActivities.sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime());
            setRecentActivity(derivedActivities);
            setIsLoadingActivity(false);
             // --- End Derive Recent Activity ---


        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
        } finally {
             setIsLoading(false);
             setIsLoadingActivity(false); // Finish loading activity here too
        }
   }, [toast]);

   // Listener for Auth State Change
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            fetchInitialData(user?.email || null);
        });
        return () => unsubscribe();
    }, [fetchInitialData]);


    // Filter employees based on selected location
    const filterEmployeesByLocation = useCallback(() => {
        // Reset pagination when filter changes
        setActiveCurrentPage(1);
        setInactiveCurrentPage(1);
        if (!selectedLocationId || selectedLocationId === 'all') {
            setFilteredEmployees(employees);
        } else {
            setFilteredEmployees(employees.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId)));
        }
    }, [employees, selectedLocationId]);

    // Apply location filter when employees or selectedLocationId change
    useEffect(() => {
        filterEmployeesByLocation();
    }, [filterEmployeesByLocation]);

    // Filter activity logs based on selected location
    const filteredActivity = React.useMemo(() => {
        if (selectedLocationId === 'all') {
            return recentActivity; // Show all if 'All' is selected
        }
        // Filter logs where the user belongs to the selected location
        return recentActivity.filter(log => log.locationIds.includes(selectedLocationId));
    }, [recentActivity, selectedLocationId]);


   // Function to refresh employee list after adding/editing
   const refreshEmployees = () => {
      if (currentUser?.email) {
          fetchInitialData(currentUser.email); // Re-fetch all data
      }
   };

   // Function to handle adding a new employee
   const handleAddEmployeeClick = () => {
      setIsAddUserDialogOpen(true);
   };

   // Function to open the edit user dialog
   const handleEditUserClick = (user: User) => {
        if (!currentUser) {
             toast({ title: "Error", description: "User not logged in.", variant: "destructive" });
             return;
         }
         // Add permission checks if necessary, e.g., only allow editing users within the same company
         if (currentUser.companyId !== user.companyId) {
             toast({ title: "Permission Denied", description: "You can only edit users in your company.", variant: "destructive" });
             return;
         }
         // Implement more granular role-based checks if needed
         setUserToEdit(user);
         setIsEditUserDialogOpen(true);
   };

   // Function called when user is updated in EditUserDialog
   const handleUserUpdated = () => {
        refreshEmployees();
        setIsEditUserDialogOpen(false);
        setUserToEdit(null);
   };


  // Function to handle toggling employee status
  const handleToggleEmployeeStatus = async (userId: string) => {
        const targetUser = employees.find(emp => emp.id === userId);
        if (!currentUser || !targetUser || currentUser.companyId !== targetUser.companyId) {
            toast({ title: "Permission Denied", variant: "destructive" });
            return;
        }
        if (currentUser.id === targetUser.id) {
             toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive" });
             return;
        }
        if (targetUser.role !== 'Staff') {
            toast({ title: "Permission Denied", description: "Managers can only manage Staff.", variant: "destructive" });
            return;
        }

      const updatedUser = await toggleUserDataStatus(userId);
      if (updatedUser) {
           refreshEmployees();
           toast({
             title: updatedUser.isActive ? "User Reactivated" : "User Deactivated",
             description: `${updatedUser.name}'s status has been updated.`,
             variant: updatedUser.isActive ? "default" : "destructive",
           });
      } else {
          toast({ title: "Error", description: "Failed to update user status.", variant: "destructive" });
      }
  };


  // Function to open the assign course dialog
  const openAssignCourseDialog = (employee: User) => {
     if (!currentUser || currentUser.companyId !== employee.companyId) {
         toast({ title: "Permission Denied", variant: "destructive" });
         return;
     }
    //   if (currentUser.role === 'Manager' && employee.role !== 'Staff') {
    //      toast({ title: "Permission Denied", description: "Managers can only assign courses to Staff.", variant: "destructive" });
    //      return;
    //  }
      if (courses.length === 0) {
         toast({ title: "No Courses Available", description: "No courses are assigned to your company. Contact an Admin.", variant: "destructive" });
         return;
     }

    setUserToAssignCourse(employee);
    setIsAssignCourseDialogOpen(true);
  };

  // Function to handle assigning/unassigning a course
  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;

    if (!currentUser || currentUser.companyId !== userToAssignCourse.companyId || (currentUser.role === 'Manager' && userToAssignCourse.role !== 'Staff')) {
         toast({ title: "Permission Denied", variant: "destructive" });
         setIsAssignCourseDialogOpen(false);
         setUserToAssignCourse(null);
         return;
     }

    const course = courses.find(c => c.id === courseId);
    if (!course && action === 'assign') {
        toast({ title: "Error", description: "Selected course not found.", variant: "destructive" });
        return;
    }

    // Use toggleUserCourseAssignments to handle single or multiple courses
    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);

    if (updatedUser) {
        refreshEmployees(); // Refresh the list to show updated assigned courses
        toast({
            title: action === 'assign' ? "Course Assigned" : "Course Unassigned",
            description: action === 'assign'
                ? `"${course?.title}" assigned to ${userToAssignCourse.name}.`
                : `Course removed from ${userToAssignCourse.name}.`
        });
    } else {
        toast({ title: "Error", description: `Failed to ${action} course.`, variant: "destructive" });
    }

    setIsAssignCourseDialogOpen(false);
    setUserToAssignCourse(null);
  };

  // Filter employees based on active/inactive status for tabs
  const activeEmployees = useMemo(() => filteredEmployees.filter(emp => emp.isActive), [filteredEmployees]);
  const inactiveEmployees = useMemo(() => filteredEmployees.filter(emp => !emp.isActive), [filteredEmployees]);

  // Pagination Logic
  const rowsToShow = rowsPerPage === 'all' ? Infinity : rowsPerPage;
  const totalActivePages = Math.ceil(activeEmployees.length / rowsToShow);
  const totalInactivePages = Math.ceil(inactiveEmployees.length / rowsToShow);

  const paginatedActiveEmployees = useMemo(() => {
    if (rowsPerPage === 'all') return activeEmployees;
    const startIndex = (activeCurrentPage - 1) * rowsPerPage;
    return activeEmployees.slice(startIndex, startIndex + rowsPerPage);
  }, [activeEmployees, activeCurrentPage, rowsPerPage]);

  const paginatedInactiveEmployees = useMemo(() => {
    if (rowsPerPage === 'all') return inactiveEmployees;
    const startIndex = (inactiveCurrentPage - 1) * rowsPerPage;
    return inactiveEmployees.slice(startIndex, startIndex + rowsPerPage);
  }, [inactiveEmployees, inactiveCurrentPage, rowsPerPage]);


  // Calculate dynamic stats based on *active* employees *in the filtered view*
  const totalActiveFiltered = activeEmployees.length;

  // Calculate average completion and certificates issued based on OVERALL progress
   const totalOverallProgress = activeEmployees.reduce((sum, emp) => sum + emp.overallProgress, 0);
   const avgCompletion = totalActiveFiltered > 0 ? Math.round(totalOverallProgress / totalActiveFiltered) : 0;
   // --- Updated Calculation for Certificates Issued ---
    // Count completed courses for each active employee and sum them up
    const certificatesIssued = useMemo(() => {
        let count = 0;
        activeEmployees.forEach(emp => {
            if (emp.courseProgress) {
                 count += Object.values(emp.courseProgress).filter(progress => progress?.status === 'Completed').length;
            }
        });
        return count;
    }, [activeEmployees]);
    // --- End Updated Calculation ---


    // Count unique assigned courses for display
    const activeFilteredCoursesSet = new Set(activeEmployees.flatMap(emp => emp.assignedCourseIds || []).filter(Boolean));
    const totalActiveFilteredCourses = activeFilteredCoursesSet.size;

    const handleRowsPerPageChange = (value: string) => {
        if (value === 'all') {
            setRowsPerPage('all');
        } else {
            setRowsPerPage(parseInt(value, 10));
        }
         // Reset page to 1 when rows per page changes
         setActiveCurrentPage(1);
         setInactiveCurrentPage(1);
    };


  if (isLoading) {
      return (
         <div className="flex-1 space-y-4 p-8 pt-6">
             <Skeleton className="h-8 w-1/3 mb-4" />
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
             </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                 <Skeleton className="col-span-4 h-64" />
                 <Skeleton className="col-span-4 lg:col-span-3 h-64" />
              </div>
         </div>
      );
  }

  if (!currentUser || !company) {
       return <div className="flex-1 space-y-4 p-8 pt-6 text-center">Could not load dashboard data. Please ensure you are assigned to a company.</div>;
  }

  // Helper function to render icon based on activity type
    const getActivityIcon = (type: ActivityLog['type']) => {
        switch (type) {
        case 'user_added':
            return <UserPlus className="h-4 w-4 text-green-500" />;
        case 'course_progress_updated':
            return <Activity className="h-4 w-4 text-blue-500" />;
        default:
            return <Activity className="h-4 w-4 text-muted-foreground" />; // Default icon
        }
    };


  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Manager Dashboard</h1>
            <p className="text-muted-foreground flex items-center gap-2">
                <Building className="h-4 w-4" /> {company.name}
             </p>
         </div>
        <div className="flex items-center space-x-2">
           <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                   //disabled={currentUser.role !== 'Admin' && currentUser.role !== 'Owner' && currentUser.role !== 'Super Admin'}
 disabled={currentUser.role !== 'Admin' && currentUser.role !== 'Owner' && currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager'}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
                </Button>
              </DialogTrigger>
                <AddUserDialog
                    onUserAdded={refreshEmployees}
                    isOpen={isAddUserDialogOpen}
                    setIsOpen={setIsAddUserDialogOpen}
                    companies={company ? [company] : []} // Only pass the current company if not Super Admin
                    locations={allCompanyLocations} // Pass locations relevant to the current manager/admin
                    currentUser={currentUser}
                />
           </Dialog>
        </div>
      </div>

        {/* Location Filter Dropdown */}
        {allCompanyLocations.length > 1 && ( // Only show if manager has access to more than 1 location
            <div className="flex items-center gap-2 mb-4">
                 <Label htmlFor="location-filter">View Location:</Label>
                 <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                     <SelectTrigger id="location-filter" className="w-[250px]">
                         <SelectValue placeholder="All Accessible Locations" />
                     </SelectTrigger>
                     <SelectContent>
                          {/* Added placeholder item */}
                         <SelectItem value="all">All Accessible Locations</SelectItem>
                         {allCompanyLocations.map(location => (
                             <SelectItem key={location.id} value={location.id}>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" /> {location.name}
                                </div>
                             </SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
             </div>
        )}

      {/* Overview Stats Cards */}
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees ({selectedLocationId === 'all' ? 'All' : allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'Unknown'})</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveFiltered}</div>
             <p className="text-xs text-muted-foreground">{inactiveEmployees.length} inactive in view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Courses (Assigned)</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveFilteredCourses}</div>
             <p className="text-xs text-muted-foreground">unique courses assigned in view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion (Overall)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletion}%</div>
             <p className="text-xs text-muted-foreground">Across all assigned courses in view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates Issued (Overall)</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{certificatesIssued}</div>
             <p className="text-xs text-muted-foreground">Total courses completed by users</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Management & Recent Activity - Stacked Layout */}
      <div className="flex flex-col space-y-4">
        {/* Team Management Card */}
        <Card>
           <CardHeader>
             <CardTitle>Team Management ({selectedLocationId === 'all' ? 'All Locations' : allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'Unknown'})</CardTitle>
           </CardHeader>
             <CardContent>
                 <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger>
                        <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger>
                    </TabsList>

                     <TabsContent value="active">
                         <CardDescription className="mb-4">Track your active team's overall course completion status.</CardDescription>
                         <EmployeeTable
                            employees={paginatedActiveEmployees}
                            onToggleEmployeeStatus={handleToggleEmployeeStatus}
                            onAssignCourse={openAssignCourseDialog}
                            onEditUser={handleEditUserClick} // Pass edit handler
                            currentUser={currentUser}
                            locations={allCompanyLocations}
                            companyCourses={courses}
                         />
                        {/* Pagination Controls for Active */}
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <div className="flex-1 text-sm text-muted-foreground">
                                Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active employees)
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={activeCurrentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveCurrentPage(prev => Math.min(prev + 1, totalActivePages))}
                                disabled={activeCurrentPage === totalActivePages}
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                     </TabsContent>

                     <TabsContent value="inactive">
                         <CardDescription className="mb-4">View deactivated employees. They can be reactivated.</CardDescription>
                         <EmployeeTable
                            employees={paginatedInactiveEmployees}
                            onToggleEmployeeStatus={handleToggleEmployeeStatus}
                            onAssignCourse={openAssignCourseDialog}
                            onEditUser={handleEditUserClick} // Pass edit handler
                            currentUser={currentUser}
                            locations={allCompanyLocations}
                            companyCourses={courses}
                         />
                         {/* Pagination Controls for Inactive */}
                        <div className="flex items-center justify-end space-x-2 py-4">
                             <div className="flex-1 text-sm text-muted-foreground">
                                Page {inactiveCurrentPage} of {totalInactivePages} ({inactiveEmployees.length} total inactive employees)
                             </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInactiveCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={inactiveCurrentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInactiveCurrentPage(prev => Math.min(prev + 1, totalInactivePages))}
                                disabled={inactiveCurrentPage === totalInactivePages}
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                         </div>
                     </TabsContent>
                 </Tabs>

                  {/* Rows Per Page Selector */}
                 <div className="flex items-center justify-end space-x-2 pt-4 border-t mt-4">
                    <Label htmlFor="rows-per-page">Rows per page:</Label>
                    <Select
                        value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)}
                        onValueChange={handleRowsPerPageChange}
                     >
                        <SelectTrigger id="rows-per-page" className="w-[80px]">
                             <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="15">15</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
             </CardContent>
        </Card>


        {/* Recent Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
             <CardDescription>Latest updates for {selectedLocationId === 'all' ? 'all accessible locations' : `the ${allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'selected'} location`}.</CardDescription>
          </CardHeader>
           <CardContent className="space-y-4 max-h-[400px] overflow-y-auto"> {/* Limit height and add scroll */}
             {isLoadingActivity ? (
                <div className="space-y-4 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                 </div>
             ) : filteredActivity.length > 0 ? (
                filteredActivity.slice(0, 15).map((activity) => ( // Limit to latest 15 entries
                    <div key={activity.id} className="flex items-center gap-3 p-2 border-b last:border-b-0">
                        <div className="flex-shrink-0">
                             {getActivityIcon(activity.type)}
                         </div>
                        <div className="flex-1">
                            <p className="text-sm text-foreground">{activity.details.message}</p>
                            <p className="text-xs text-muted-foreground">
                                 {formatDistanceToNow(activity.timestamp as Date, { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                ))
            ) : (
                 <p className="text-center text-muted-foreground py-10 italic">No recent activity to display for this location.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Course Dialog */}
       {userToAssignCourse && (
        <AssignCourseDialog
          isOpen={isAssignCourseDialogOpen}
          setIsOpen={setIsAssignCourseDialogOpen}
          employee={userToAssignCourse}
          courses={courses}
          onAssignCourse={handleAssignCourse}
        />
      )}

       {/* Edit User Dialog */}
       {isEditUserDialogOpen && userToEdit && currentUser && (
            <EditUserDialog
                isOpen={isEditUserDialogOpen}
                setIsOpen={setIsEditUserDialogOpen}
                user={userToEdit}
                onUserUpdated={handleUserUpdated}
                currentUser={currentUser}
                companies={company ? [company] : []} // Pass current company context
                locations={allCompanyLocations} // Pass locations for the current company
            />
        )}
    </div>
  );
}
