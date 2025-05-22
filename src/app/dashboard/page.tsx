
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, UserPlus, Activity, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"; // Added Chevron icons
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { AssignCourseDialog } from '@/components/dashboard/AssignCourseDialog';
import type { User, Company, Location } from '@/types/user';
import type { Course } from '@/types/course';
import type { ActivityLog } from '@/types/activity';
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers, toggleUserCourseAssignments, getUserOverallProgress, updateUser } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations } from '@/lib/company-data';
import { getCustomerPurchaseRecordByBrandId } from '@/lib/customer-data'; // Corrected import
import { getAllCourses, getCourseById, getAllPrograms } from '@/lib/firestore-data'; // Import getAllPrograms
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
import { useRouter } from 'next/navigation'; // Import useRouter

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed";
};

const DEFAULT_ROWS_PER_PAGE = 5;

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanyLocations, setAllCompanyLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [employees, setEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithOverallProgress[]>([]);
  const [availableGlobalCourses, setAvailableGlobalCourses] = useState<Course[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isAssignCourseDialogOpen, setIsAssignCourseDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToAssignCourse, setUserToAssignCourse] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const { toast } = useToast();
  const router = useRouter(); // Initialize useRouter

  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

   const fetchInitialData = useCallback(async (userEmail: string | null) => {
        if (!userEmail) {
            setIsLoading(false); setIsLoadingActivity(false); return;
        }
        setIsLoading(true); setIsLoadingActivity(true);
        try {
            const userDetails = await getUserByEmail(userEmail);
            setCurrentUser(userDetails);

            if (!userDetails || !userDetails.companyId) {
                 setCompany(null); setAllCompanyLocations([]); setEmployees([]); setAvailableGlobalCourses([]); setRecentActivity([]);
                 setIsLoading(false); setIsLoadingActivity(false); return;
            }

            const companyDetails = await getCompanyById(userDetails.companyId);
            setCompany(companyDetails);

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

             let companyUsers: User[] = [];
             if (userDetails.role === 'Admin' || userDetails.role === 'Owner' || userDetails.role === 'Super Admin') {
                 companyUsers = (await getAllUsers()).filter(u => u.companyId === userDetails.companyId);
             } else if (userDetails.role === 'Manager') {
                  const allCompanyUsers = (await getAllUsers()).filter(u => u.companyId === userDetails.companyId);
                  companyUsers = allCompanyUsers.filter((emp) =>
                      (emp.assignedLocationIds || []).some(locId => (userDetails.assignedLocationIds || []).includes(locId)) || emp.id === userDetails.id // Include manager themselves
                  );
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

            // Fetch Global Courses available to the Brand (via its assigned Programs)
            if (companyDetails) {
                const allLibraryCourses = await getAllCourses();
                const allPrograms = await getAllPrograms();
                const brandProgramIds = new Set<string>();
                
                const purchaseRecord = await getCustomerPurchaseRecordByBrandId(companyDetails.id);
                if (purchaseRecord?.selectedProgramId) {
                    brandProgramIds.add(purchaseRecord.selectedProgramId);
                }
                
                const brandAccessibleCourseIds = new Set<string>();
                allPrograms.forEach(program => {
                    if (brandProgramIds.has(program.id)) {
                        (program.courseIds || []).forEach(courseId => brandAccessibleCourseIds.add(courseId));
                    }
                });
                
                (companyDetails.assignedCourseIds || []).forEach(courseId => brandAccessibleCourseIds.add(courseId));

                const globalCoursesForBrand = allLibraryCourses.filter(course => brandAccessibleCourseIds.has(course.id));
                setAvailableGlobalCourses(globalCoursesForBrand);
            } else {
                setAvailableGlobalCourses([]);
            }


            setIsLoadingActivity(true);
            const derivedActivities: ActivityLog[] = [];
            const courseTitleCache: Record<string, string> = {};

            for (const emp of employeesWithProgress) {
                if (emp.createdAt && emp.createdAt instanceof Timestamp) {
                   derivedActivities.push({
                       id: `user-added-${emp.id}`, timestamp: emp.createdAt.toDate(), type: 'user_added',
                       userId: emp.id, userName: emp.name, companyId: emp.companyId,
                       locationIds: emp.assignedLocationIds || [], details: { message: `${emp.name} was added.` }
                   });
                }
                if (emp.courseProgress) {
                   for (const courseId in emp.courseProgress) {
                       const progressData = emp.courseProgress[courseId];
                       if (progressData?.lastUpdated && progressData.lastUpdated instanceof Timestamp) {
                           if (!courseTitleCache[courseId]) {
                                const course = await getCourseById(courseId); 
                                courseTitleCache[courseId] = course?.title || 'Unknown Course';
                           }
                            const courseTitle = courseTitleCache[courseId];
                            derivedActivities.push({
                                id: `progress-${emp.id}-${courseId}-${progressData.lastUpdated.toMillis()}`,
                                timestamp: progressData.lastUpdated.toDate(), type: 'course_progress_updated',
                                userId: emp.id, userName: emp.name, companyId: emp.companyId,
                                locationIds: emp.assignedLocationIds || [],
                                details: { message: `${emp.name} updated progress on '${courseTitle}'. Status: ${progressData.status || 'N/A'}`,
                                    courseId: courseId, courseTitle: courseTitle, status: progressData.status
                                }
                            });
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
   }, [toast]); // Removed router from dependencies as it's not used inside this callback

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            fetchInitialData(user?.email || null);
        });
        return () => unsubscribe();
    }, [fetchInitialData]);

    const filterEmployeesByLocation = useCallback(() => {
        setActiveCurrentPage(1); setInactiveCurrentPage(1);
        if (!selectedLocationId || selectedLocationId === 'all') {
            setFilteredEmployees(employees);
        } else {
            setFilteredEmployees(employees.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId)));
        }
    }, [employees, selectedLocationId]);

    useEffect(() => {
        filterEmployeesByLocation();
    }, [filterEmployeesByLocation]);

    const filteredActivity = React.useMemo(() => {
        if (selectedLocationId === 'all') return recentActivity;
        return recentActivity.filter(log => (log.locationIds || []).includes(selectedLocationId));
    }, [recentActivity, selectedLocationId]);

   const refreshEmployees = () => {
      if (currentUser?.email) fetchInitialData(currentUser.email);
   };

   const handleAddEmployeeClick = () => setIsAddUserDialogOpen(true);

   const handleEditUserClick = (user: User) => {
        if (!currentUser || currentUser.companyId !== user.companyId) {
             toast({ title: "Permission Denied", variant: "destructive" }); return;
        }
        setUserToEdit(user); setIsEditUserDialogOpen(true);
   };

   const handleUserUpdated = () => {
        refreshEmployees(); setIsEditUserDialogOpen(false); setUserToEdit(null);
   };

  const handleToggleEmployeeStatus = async (userId: string) => {
        const targetUser = employees.find(emp => emp.id === userId);
        if (!currentUser || !targetUser || currentUser.companyId !== targetUser.companyId) {
            toast({ title: "Permission Denied", variant: "destructive" }); return;
        }
        if (currentUser.id === targetUser.id) {
             toast({ title: "Action Denied", description: "You cannot change your own status.", variant: "destructive" }); return;
        }
        if (currentUser.role === 'Manager' && targetUser.role !== 'Staff') { 
            toast({ title: "Permission Denied", description: "Managers can only manage Staff.", variant: "destructive" }); return;
        }

      const updatedUser = await toggleUserDataStatus(userId);
      if (updatedUser) {
           refreshEmployees();
           toast({ title: updatedUser.isActive ? "User Reactivated" : "User Deactivated", description: `${updatedUser.name}'s status updated.`, variant: updatedUser.isActive ? "default" : "destructive" });
      } else {
          toast({ title: "Error", description: "Failed to update user status.", variant: "destructive" });
      }
  };

  const openAssignCourseDialog = (employee: User) => {
     if (!currentUser || currentUser.companyId !== employee.companyId) {
         toast({ title: "Permission Denied", variant: "destructive" }); return;
     }
     if (currentUser.role === 'Manager' && employee.role !== 'Staff') {
         toast({ title: "Permission Denied", description: "Managers can only assign courses to Staff.", variant: "destructive" }); return;
     }
     const hasGlobalCourses = availableGlobalCourses.length > 0;
     const canManageBrandCourses = company?.canManageCourses;
     if (!hasGlobalCourses && !canManageBrandCourses) {
         toast({ title: "No Courses Available", description: "No courses are available for assignment to users in this brand.", variant: "destructive" }); return;
     }
    setUserToAssignCourse(employee); setIsAssignCourseDialogOpen(true);
  };

  const handleAssignCourse = async (courseId: string, action: 'assign' | 'unassign') => {
    if (!userToAssignCourse) return;
    if (!currentUser || currentUser.companyId !== userToAssignCourse.companyId || (currentUser.role === 'Manager' && userToAssignCourse.role !== 'Staff')) {
         toast({ title: "Permission Denied", variant: "destructive" });
         setIsAssignCourseDialogOpen(false); setUserToAssignCourse(null); return;
    }

    const updatedUser = await toggleUserCourseAssignments(userToAssignCourse.id, [courseId], action);
    if (updatedUser) {
        refreshEmployees();
        const courseDetails = await getCourseById(courseId); // Fetch details to get title
        const courseTitle = courseDetails?.title || "a course";
        toast({ title: action === 'assign' ? "Course Assigned" : "Course Unassigned", description: `${action === 'assign' ? `"${courseTitle}" assigned to` : `Course removed from`} ${userToAssignCourse.name}.` });
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


  const paginatedActiveEmployees = useMemo(() => {
    if (rowsPerPage === 'all') return activeEmployees;
    const startIndex = (activeCurrentPage - 1) * rowsToShow;
    return activeEmployees.slice(startIndex, startIndex + rowsToShow);
  }, [activeEmployees, activeCurrentPage, rowsToShow]);

  const paginatedInactiveEmployees = useMemo(() => {
    if (rowsPerPage === 'all') return inactiveEmployees;
    const startIndex = (inactiveCurrentPage - 1) * rowsToShow;
    return inactiveEmployees.slice(startIndex, startIndex + rowsToShow);
  }, [inactiveEmployees, inactiveCurrentPage, rowsToShow]);

  const totalActiveFiltered = activeEmployees.length;
  const totalOverallProgress = activeEmployees.reduce((sum, emp) => sum + emp.overallProgress, 0);
  const avgCompletion = totalActiveFiltered > 0 ? Math.round(totalOverallProgress / totalActiveFiltered) : 0;
  const certificatesIssued = useMemo(() => {
    let count = 0;
    activeEmployees.forEach(emp => { if (emp.courseProgress) count += Object.values(emp.courseProgress).filter(p => p?.status === 'Completed').length; });
    return count;
  }, [activeEmployees]);
  const activeFilteredCoursesSet = new Set(activeEmployees.flatMap(emp => emp.assignedCourseIds || []).filter(Boolean));
  const totalActiveFilteredCourses = activeFilteredCoursesSet.size;

  const handleRowsPerPageChange = (value: string) => {
    if (value === 'all') setRowsPerPage('all'); else setRowsPerPage(parseInt(value, 10));
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
  };

  if (isLoading) {
      return ( <div className="flex-1 space-y-4 p-8 pt-6"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"> <Skeleton className="col-span-4 h-64" /> <Skeleton className="col-span-4 lg:col-span-3 h-64" /> </div> </div> );
  }
  if (!currentUser || !company) {
       return <div className="flex-1 space-y-4 p-8 pt-6 text-center">Could not load dashboard data. Ensure user is assigned to a brand.</div>;
  }

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) { case 'user_added': return <UserPlus className="h-4 w-4 text-green-500" />; case 'course_progress_updated': return <Activity className="h-4 w-4 text-blue-500" />; default: return <Activity className="h-4 w-4 text-muted-foreground" />; }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
         <div> <h1 className="text-3xl font-bold tracking-tight text-primary">Manager Dashboard</h1> <p className="text-muted-foreground flex items-center gap-2"> <Building className="h-4 w-4" /> {company.name} </p> </div>
        <div className="flex items-center space-x-2">
           <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={(currentUser.role !== 'Admin' && currentUser.role !== 'Owner' && currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
                </Button>
              </DialogTrigger>
                <AddUserDialog onUserAdded={(user, tempPass) => refreshEmployees()} isOpen={isAddUserDialogOpen} setIsOpen={setIsAddUserDialogOpen} companies={company ? [company] : []} locations={allCompanyLocations} currentUser={currentUser} />
           </Dialog>
        </div>
      </div>

        {allCompanyLocations.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
                 <Label htmlFor="location-filter">View Location:</Label>
                 <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                     <SelectTrigger id="location-filter" className="w-[250px]"> <SelectValue placeholder="All Accessible Locations" /> </SelectTrigger>
                     <SelectContent> <SelectItem value="all">All Accessible Locations</SelectItem> {allCompanyLocations.map(loc => ( <SelectItem key={loc.id} value={loc.id}> <div className="flex items-center gap-2"> <MapPin className="h-4 w-4 text-muted-foreground" /> {loc.name} </div> </SelectItem> ))} </SelectContent>
                 </Select>
             </div>
        )}

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Employees ({selectedLocationId === 'all' ? 'All' : allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'Unknown'})</CardTitle> <UserCheck className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalActiveFiltered}</div> <p className="text-xs text-muted-foreground">{inactiveEmployees.length} inactive in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Active Courses (Assigned)</CardTitle> <BookOpen className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{totalActiveFilteredCourses}</div> <p className="text-xs text-muted-foreground">unique courses assigned in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Avg. Completion (Overall)</CardTitle> <TrendingUp className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{avgCompletion}%</div> <p className="text-xs text-muted-foreground">Across all assigned courses in view</p> </CardContent> </Card>
        <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Certificates Issued (Overall)</CardTitle> <Award className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">+{certificatesIssued}</div> <p className="text-xs text-muted-foreground">Total courses completed by users</p> </CardContent> </Card>
      </div>

      <div className="flex flex-col space-y-4">
        <Card>
           <CardHeader> <CardTitle>Team Management ({selectedLocationId === 'all' ? 'All Locations' : allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'Unknown'})</CardTitle> </CardHeader>
             <CardContent>
                 <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4"> <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger> <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger> </TabsList>
                     <TabsContent value="active"> <CardDescription className="mb-4">Track your active team's overall course completion status.</CardDescription>
                         <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allCompanyLocations} companyCourses={availableGlobalCourses} />
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage} of {totalActivePages} ({activeEmployees.length} total active) </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.max(p - 1, 1))} disabled={activeCurrentPage === 1}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p => Math.min(p + 1, totalActivePages))} disabled={activeCurrentPage === totalActivePages}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                     <TabsContent value="inactive"> <CardDescription className="mb-4">View deactivated employees. They can be reactivated.</CardDescription>
                         <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={handleToggleEmployeeStatus} onAssignCourse={openAssignCourseDialog} onEditUser={handleEditUserClick} currentUser={currentUser} locations={allCompanyLocations} companyCourses={availableGlobalCourses} />
                        <div className="flex items-center justify-end space-x-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {inactiveCurrentPage} of {totalInactivePages} ({inactiveEmployees.length} total inactive) </div> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.max(p - 1, 1))} disabled={inactiveCurrentPage === 1}> <ChevronLeft className="h-4 w-4" /> Prev </Button> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p => Math.min(p + 1, totalInactivePages))} disabled={inactiveCurrentPage === totalInactivePages}> Next <ChevronRight className="h-4 w-4" /> </Button> </div>
                     </TabsContent>
                 </Tabs>
                 <div className="flex items-center justify-end space-x-2 pt-4 border-t mt-4"> <Label htmlFor="rows-per-page">Rows:</Label> <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}> <SelectTrigger id="rows-per-page" className="w-[80px]"> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="5">5</SelectItem> <SelectItem value="10">10</SelectItem> <SelectItem value="15">15</SelectItem> <SelectItem value="all">All</SelectItem> </SelectContent> </Select> </div>
             </CardContent>
        </Card>

        <Card>
          <CardHeader> <CardTitle>Recent Activity</CardTitle> <CardDescription>Latest updates for {selectedLocationId === 'all' ? 'all accessible locations' : `the ${allCompanyLocations.find(l=>l.id===selectedLocationId)?.name || 'selected'} location`}.</CardDescription> </CardHeader>
           <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
             {isLoadingActivity ? ( <div className="space-y-4 py-4"> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </div> )
             : filteredActivity.length > 0 ? ( filteredActivity.slice(0, 15).map((activity) => ( <div key={activity.id} className="flex items-center gap-3 p-2 border-b last:border-b-0"> <div className="flex-shrink-0"> {getActivityIcon(activity.type)} </div> <div className="flex-1"> <p className="text-sm text-foreground">{activity.details.message}</p> <p className="text-xs text-muted-foreground"> {formatDistanceToNow(activity.timestamp as Date, { addSuffix: true })} </p> </div> </div> )) )
             : ( <p className="text-center text-muted-foreground py-10 italic">No recent activity for this location.</p> )}
          </CardContent>
        </Card>
      </div>

       {userToAssignCourse && company && ( 
        <AssignCourseDialog 
          isOpen={isAssignCourseDialogOpen} 
          setIsOpen={setIsAssignCourseDialogOpen} 
          employee={userToAssignCourse} 
          courses={availableGlobalCourses} 
          company={company} 
          onAssignCourse={handleAssignCourse} 
        />
      )}

       {isEditUserDialogOpen && userToEdit && currentUser && (
            <EditUserDialog isOpen={isEditUserDialogOpen} setIsOpen={setIsEditUserDialogOpen} user={userToEdit} onUserUpdated={handleUserUpdated} currentUser={currentUser} companies={company ? [company] : []} locations={allCompanyLocations} />
        )}
    </div>
  );
}

