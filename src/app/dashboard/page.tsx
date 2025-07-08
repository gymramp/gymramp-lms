
// src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Award, UserCheck, BookOpen, MapPin, Building, Activity, ChevronLeft, ChevronRight, Loader2, Layers, Info, ShieldCheck, PlusCircle } from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/EmployeeTable";
import { AddUserDialog } from '@/components/admin/AddUserDialog'; // Changed path
// EditUserDialog and AssignCourseDialog are removed as their functionality moves to a new page
import type { User, Company, Location, UserRole } from '@/types/user';
import type { Course, BrandCourse, Program } from '@/types/course';
import type { ActivityLog } from '@/types/activity';
import { getUserByEmail, toggleUserStatus as toggleUserDataStatus, getAllUsers as fetchAllSystemUsers, getUserOverallProgress, getUsersByCompanyId } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllLocations as fetchAllSystemLocations, getAllCompanies as fetchAllAccessibleBrandsForUser } from '@/lib/company-data';
import { getAllCourses as getAllLibraryCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms } from '@/lib/firestore-data';
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
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEFAULT_ROWS_PER_PAGE = 5;

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoadingBrandDataForFilters, setIsLoadingBrandDataForFilters] = useState(true);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null);
  const [selectedBrandIdForDashboard, setSelectedBrandIdForDashboard] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const { toast } = useToast();
  const router = useRouter();

  const [activeCurrentPage, setActiveCurrentPage] = useState(1);
  const [inactiveCurrentPage, setInactiveCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(DEFAULT_ROWS_PER_PAGE);

  const fetchInitialDashboardData = useCallback(async (user: User) => {
    setIsLoadingBrandDataForFilters(true);
    setUserPrimaryBrand(null);
    try {
      const fetchedAccessibleBrands = await fetchAllAccessibleBrandsForUser(user);
      setViewableBrandsForFilter(fetchedAccessibleBrands);
      let primaryBrandForState: Company | null = user.companyId ? fetchedAccessibleBrands.find(b => b.id === user.companyId) : null;
      setUserPrimaryBrand(primaryBrandForState);
      let initialSelectedBrandId = user.companyId || '';
      if (user.role === 'Super Admin') initialSelectedBrandId = 'all'; // SA defaults to all
      else if (!initialSelectedBrandId && fetchedAccessibleBrands.length > 0) initialSelectedBrandId = fetchedAccessibleBrands[0].id; // Non-SA defaults to first accessible or their own

      let allVisibleSystemLocationsForUser: Location[] = await fetchAllSystemLocations();
      if (user.role !== 'Super Admin' && user.companyId) {
          const accessibleBrandIds = fetchedAccessibleBrands.map(b => b.id);
          allVisibleSystemLocationsForUser = allVisibleSystemLocationsForUser.filter(loc => accessibleBrandIds.includes(loc.companyId));
           if (user.role === 'Manager' && user.assignedLocationIds && user.assignedLocationIds.length > 0) {
              allVisibleSystemLocationsForUser = allVisibleSystemLocationsForUser.filter(loc => user.assignedLocationIds!.includes(loc.id));
           }
      }
      setAllSystemLocations(allVisibleSystemLocationsForUser);
      setSelectedBrandIdForDashboard(initialSelectedBrandId);
      setSelectedLocationId('all');
    } catch (error) {
      toast({ title: "Error Initializing Dashboard Filters", variant: "destructive" });
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
          if (!userDetails || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
            router.push('/courses/my-courses');
          } else {
            await fetchInitialDashboardData(userDetails);
          }
        } catch (error) {
          router.push('/');
        }
      } else {
        setCurrentUser(null); router.push('/');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [fetchInitialDashboardData, router, toast]);

  const fetchEmployeesAndAssignableCourses = useCallback(async () => {
    if (!currentUser || isAuthLoading || isLoadingBrandDataForFilters || !selectedBrandIdForDashboard) {
      setEmployees([]); setIsLoadingEmployees(false); return;
    }
    setIsLoadingEmployees(true); setLastGeneratedPassword(null);
    try {
      let usersToProcess: User[] = [];
      if (currentUser.role === 'Super Admin') {
        usersToProcess = (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) ? await fetchAllSystemUsers() : await getUsersByCompanyId(selectedBrandIdForDashboard);
      } else if (currentUser.role === 'Admin' || currentUser.role === 'Owner') {
         usersToProcess = (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard)
            ? (await Promise.all(viewableBrandsForFilter.map(b => getUsersByCompanyId(b.id)))).flat().filter((user, index, self) => index === self.findIndex((u) => u.id === user.id))
            : (viewableBrandsForFilter.some(b => b.id === selectedBrandIdForDashboard) ? await getUsersByCompanyId(selectedBrandIdForDashboard) : []);
      } else if (currentUser.role === 'Manager' && currentUser.companyId) {
        usersToProcess = await getUsersByCompanyId(currentUser.companyId);
      }
      const employeesWithProgressPromises = usersToProcess.map(async (user) => ({ ...user, overallProgress: await getUserOverallProgress(user.id), overallStatus: "Not Started" as const }));
      setEmployees(await Promise.all(employeesWithProgressPromises));
    } catch (error) {
      toast({ title: "Error Fetching Employees", variant: "destructive" });
      setEmployees([]);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [currentUser, selectedBrandIdForDashboard, viewableBrandsForFilter, toast, isAuthLoading, isLoadingBrandDataForFilters]);

  useEffect(() => {
    if (!isAuthLoading && currentUser && !isLoadingBrandDataForFilters && selectedBrandIdForDashboard) {
        fetchEmployeesAndAssignableCourses();
    }
  }, [fetchEmployeesAndAssignableCourses, isAuthLoading, currentUser, isLoadingBrandDataForFilters, selectedBrandIdForDashboard]);

 useEffect(() => {
    if (isLoadingBrandDataForFilters || !currentUser) { setLocationsForLocationFilter([]); return; }
    let currentBrandLocations: Location[] = (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard) ? allSystemLocations : allSystemLocations.filter(loc => loc.companyId === selectedBrandIdForDashboard);
    setLocationsForLocationFilter(currentBrandLocations);
    if (!currentBrandLocations.some(loc => loc.id === selectedLocationId) && selectedLocationId !== 'all') setSelectedLocationId('all');
  }, [selectedBrandIdForDashboard, allSystemLocations, currentUser, isLoadingBrandDataForFilters, selectedLocationId]);

 useEffect(() => { setSelectedLocationId('all'); }, [selectedBrandIdForDashboard]);

  useEffect(() => {
    if (isLoadingEmployees || !currentUser) { setFilteredEmployees([]); return; }
    let tempUsers = [...employees];
    if (selectedLocationId && selectedLocationId !== 'all') {
      tempUsers = tempUsers.filter(emp => (emp.assignedLocationIds || []).includes(selectedLocationId));
    } else if (currentUser.role === 'Manager' && selectedBrandIdForDashboard === currentUser.companyId && selectedLocationId === 'all') {
      const managerAssignedLocationIds = allSystemLocations.map(loc => loc.id);
      if (managerAssignedLocationIds.length > 0) {
        tempUsers = tempUsers.filter(emp => emp.id === currentUser.id || (emp.assignedLocationIds || []).some(empLocId => managerAssignedLocationIds.includes(empLocId)));
      } else {
        tempUsers = tempUsers.filter(emp => emp.id === currentUser.id);
      }
    }
    setFilteredEmployees(tempUsers);
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
  }, [employees, selectedLocationId, currentUser, isLoadingEmployees, selectedBrandIdForDashboard, allSystemLocations]);

  const refreshDashboardData = (newUser?: User, tempPassword?: string) => {
    if (tempPassword) setLastGeneratedPassword(tempPassword); else setLastGeneratedPassword(null);
    if (currentUser) fetchEmployeesAndAssignableCourses();
  };

  const handleAddEmployeeClick = () => {
    if (!currentUser) return;
    if ((currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard ))) {
      toast({ title: "Cannot Add User", variant: "destructive" }); return;
    }
    if (currentUser.role !== 'Super Admin' && !currentUser.companyId) {
      toast({ title: "Cannot Add User", variant: "destructive" }); return;
    }
    setLastGeneratedPassword(null); setIsAddUserDialogOpen(true);
  };
  
  const handleToggleUserStatus = async (userId: string, userName: string, currentIsActive: boolean) => {
    if (!currentUser || currentUser.id === userId) {
        toast({ title: "Action Denied", variant: "destructive"}); return;
    }
    const targetUser = employees.find(u => u.id === userId);
    if (!targetUser) {
         toast({ title: "Error", variant: "destructive"}); return;
    }
    let canToggle = false;
    if (currentUser.role === 'Super Admin') canToggle = true;
    else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && currentUser.companyId && viewableBrandsForFilter.some(b => b.id === targetUser.companyId)) {
        canToggle = ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[targetUser.role];
    } else if (currentUser.role === 'Manager' && currentUser.companyId === targetUser.companyId) {
        canToggle = (targetUser.role === 'Staff' || targetUser.role === 'Manager');
    }
    if (!canToggle) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
    const updatedUser = await toggleUserDataStatus(userId);
    if (updatedUser) {
      fetchEmployeesAndAssignableCourses();
      toast({ title: currentIsActive ? "User Deactivated" : "User Reactivated", variant: currentIsActive ? "destructive" : "default" });
    } else {
        toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleResetFilters = () => {
      let initialBrandId = '';
      if (currentUser?.role === 'Super Admin') initialBrandId = 'all';
      else if (currentUser?.companyId) initialBrandId = currentUser.companyId;
      setSelectedBrandIdForDashboard(initialBrandId);
      setSelectedLocationId('all');
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

  const handleRowsPerPageChange = (value: string) => {
    if (value === 'all') setRowsPerPage('all'); else setRowsPerPage(parseInt(value, 10));
    setActiveCurrentPage(1); setInactiveCurrentPage(1);
  };

  const displayBrandNameForManager = userPrimaryBrand?.name || (isLoadingBrandDataForFilters ? 'Loading brand...' : 'Brand Not Found');
  const displayBrandNameForTitle = selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard ? (currentUser?.role === 'Super Admin' ? 'All System Brands' : (viewableBrandsForFilter.length > 1 || (viewableBrandsForFilter.length === 0 && !userPrimaryBrand) ? 'All Accessible Brands' : (userPrimaryBrand?.name || 'Your Brand'))) : (viewableBrandsForFilter.find(b => b.id === selectedBrandIdForDashboard)?.name || userPrimaryBrand?.name || 'Selected Brand');
  const displayLocationName = selectedLocationId === 'all' ? 'All Locations' : allSystemLocations.find(l => l.id === selectedLocationId)?.name || '';
  const pageIsLoading = isAuthLoading || isLoadingBrandDataForFilters;

  if (pageIsLoading || !currentUser) return ( <div className="container mx-auto flex-1 space-y-4"> <Skeleton className="h-8 w-1/3 mb-4" /> <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)} </div> <div className="grid gap-4"> <Skeleton className="h-64" /> </div> </div> );
  if (!userPrimaryBrand && currentUser.role !== 'Super Admin') return <div className="container mx-auto text-center">Error: User not associated with a primary brand.</div>;

  return (
    <div className="container mx-auto flex-1 space-y-4 pb-6">
      <div className="flex items-center justify-between space-y-2">
        <div> <h1 className="text-3xl font-bold text-primary">{displayBrandNameForTitle} Dashboard</h1> <p className="text-muted-foreground flex items-center gap-2"> <MapPin className="h-4 w-4" /> {displayLocationName ? `Viewing: ${displayLocationName}` : 'Overview'} </p> </div>
        <div className="flex items-center space-x-2"> {currentUser && ['Super Admin', 'Admin', 'Owner', 'Manager'].includes(currentUser.role) && ( <Button onClick={handleAddEmployeeClick} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoadingEmployees || isLoadingBrandDataForFilters || (currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard))} title={(currentUser.role === 'Super Admin' && viewableBrandsForFilter.length === 0 && (selectedBrandIdForDashboard === 'all' || !selectedBrandIdForDashboard)) ? "Add a brand first" : ""}> <PlusCircle className="mr-2 h-4 w-4" /> Add Employee </Button> )} </div>
      </div>
      {lastGeneratedPassword && ( <Alert variant="success" className="mb-6"> <ShieldCheck className="h-4 w-4" /> <AlertTitle>New User Added!</AlertTitle> <AlertDescription> Temporary password: <strong className="font-bold">{lastGeneratedPassword}</strong>. Welcome email sent. <Button variant="ghost" size="sm" onClick={() => setLastGeneratedPassword(null)} className="ml-4">Dismiss</Button> </AlertDescription> </Alert> )}
      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-secondary rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold mr-4 self-center text-foreground">Filters:</h2>
          <div className="flex flex-col space-y-1"> <Label htmlFor="brand-filter-dashboard" className="text-sm text-muted-foreground">Brand</Label>
            {currentUser?.role === 'Manager' ? ( <Input id="brand-filter-dashboard-manager" value={displayBrandNameForManager} readOnly disabled className="w-[220px] bg-background/50 h-10" /> )
            : ( <Select value={selectedBrandIdForDashboard || 'placeholder-brand'} onValueChange={(value) => setSelectedBrandIdForDashboard(value === 'placeholder-brand' ? '' : value)} disabled={isLoadingEmployees || isLoadingBrandDataForFilters || (viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin')}>
                  <SelectTrigger id="brand-filter-dashboard" className="w-[220px] bg-background h-10"> <SelectValue placeholder="Select Brand" /> </SelectTrigger>
                  <SelectContent> <SelectItem value="placeholder-brand" disabled>Select a brand...</SelectItem>
                    {(currentUser?.role === 'Super Admin' || ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && viewableBrandsForFilter.length > 1)) && <SelectItem value="all">All Accessible Brands</SelectItem>}
                    {viewableBrandsForFilter.map(brand => ( <SelectItem key={brand.id} value={brand.id}>{brand.name} {brand.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                    {viewableBrandsForFilter.length === 0 && currentUser?.role === 'Super Admin' && <SelectItem value="no-brands" disabled>No Brands</SelectItem>}
                  </SelectContent> </Select> )}
          </div>
          <div className="flex flex-col space-y-1"> <Label htmlFor="location-filter-dashboard" className="text-sm text-muted-foreground">Location</Label>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isLoadingEmployees || isLoadingBrandDataForFilters || locationsForLocationFilter.length === 0} >
              <SelectTrigger id="location-filter-dashboard" className="w-[220px] bg-background h-10"> <SelectValue placeholder="All Locations" /> </SelectTrigger>
              <SelectContent> <SelectItem value="all">All Locations</SelectItem> {locationsForLocationFilter.map(loc => ( <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem> ))} {selectedBrandIdForDashboard && selectedBrandIdForDashboard !== 'all' && locationsForLocationFilter.length === 0 && ( <SelectItem value="none" disabled>No locations in brand</SelectItem> )} </SelectContent>
            </Select>
          </div>
        <Button variant="outline" onClick={() => { setSelectedBrandIdForDashboard(userPrimaryBrand?.id || (currentUser?.role === 'Super Admin' ? 'all' : '')); setSelectedLocationId('all');}} className="h-10 self-end" disabled={isLoadingBrandDataForFilters}>Reset</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-lift-hover"> <CardHeader className="flex flex-row items-center justify-between pb-2"> <CardTitle className="text-sm font-medium">Active Employees</CardTitle> <UserCheck className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : totalActiveFiltered}</div> <p className="text-xs text-muted-foreground">{isLoadingEmployees ? '...' : `${inactiveEmployees.length} inactive`}</p> </CardContent> </Card>
        <Card className="card-lift-hover"> <CardHeader className="flex flex-row items-center justify-between pb-2"> <CardTitle className="text-sm font-medium">Assignable Courses</CardTitle> <BookOpen className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">N/A</div> <p className="text-xs text-muted-foreground">Contextual count</p> </CardContent> </Card>
        <Card className="card-lift-hover"> <CardHeader className="flex flex-row items-center justify-between pb-2"> <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle> <TrendingUp className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : `${avgCompletion}%`}</div> <p className="text-xs text-muted-foreground">Overall, active users</p> </CardContent> </Card>
        <Card className="card-lift-hover"> <CardHeader className="flex flex-row items-center justify-between pb-2"> <CardTitle className="text-sm font-medium">Certificates</CardTitle> <Award className="h-4 w-4 text-muted-foreground" /> </CardHeader> <CardContent> <div className="text-2xl font-bold">{isLoadingEmployees ? <Loader2 className="h-6 w-6 animate-spin"/> : `+${certificatesIssued}`}</div> <p className="text-xs text-muted-foreground">Issued (Overall)</p> </CardContent> </Card>
      </div>
      <div className="flex flex-col space-y-4 pt-6"> <Card className="card-lift-hover"> <CardHeader> <CardTitle>Team Management</CardTitle> </CardHeader>
          <CardContent> <Tabs defaultValue="active" className="w-full"> <TabsList className="grid w-full grid-cols-2 mb-4"> <TabsTrigger value="active">Active ({activeEmployees.length})</TabsTrigger> <TabsTrigger value="inactive">Inactive ({inactiveEmployees.length})</TabsTrigger> </TabsList>
              <TabsContent value="active"> <CardDescription className="mb-4 text-foreground">Active team members.</CardDescription> {isLoadingEmployees ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : <EmployeeTable employees={paginatedActiveEmployees} onToggleEmployeeStatus={handleToggleUserStatus} currentUser={currentUser} locations={allSystemLocations} companies={viewableBrandsForFilter} baseEditPath="/dashboard/users" />}
                <div className="flex items-center justify-end gap-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {activeCurrentPage}/{totalActivePages} </div> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p=>Math.max(p-1,1))} disabled={activeCurrentPage===1}>Prev</Button> <Button variant="outline" size="sm" onClick={() => setActiveCurrentPage(p=>Math.min(p+1,totalActivePages))} disabled={activeCurrentPage===totalActivePages}>Next</Button> </div> </TabsContent>
              <TabsContent value="inactive"> <CardDescription className="mb-4 text-foreground">Deactivated employees.</CardDescription> {isLoadingEmployees ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : <EmployeeTable employees={paginatedInactiveEmployees} onToggleEmployeeStatus={handleToggleUserStatus} currentUser={currentUser} locations={allSystemLocations} companies={viewableBrandsForFilter} baseEditPath="/dashboard/users" />}
                <div className="flex items-center justify-end gap-2 py-4"> <div className="flex-1 text-sm text-muted-foreground"> Page {inactiveCurrentPage}/{totalInactivePages} </div> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p=>Math.max(p-1,1))} disabled={inactiveCurrentPage===1}>Prev</Button> <Button variant="outline" size="sm" onClick={() => setInactiveCurrentPage(p=>Math.min(p+1,totalInactivePages))} disabled={inactiveCurrentPage===totalInactivePages}>Next</Button> </div> </TabsContent>
            </Tabs>
            <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4"> <Label htmlFor="rows-per-page">Rows:</Label> <Select value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)} onValueChange={handleRowsPerPageChange}> <SelectTrigger id="rows-per-page" className="w-[80px]"> <SelectValue /> </SelectTrigger> <SelectContent> <SelectItem value="5">5</SelectItem> <SelectItem value="10">10</SelectItem> <SelectItem value="15">15</SelectItem> <SelectItem value="all">All</SelectItem> </SelectContent> </Select> </div>
          </CardContent> </Card>
      </div>
      {isAddUserDialogOpen && currentUser && ( <AddUserDialog onUserAdded={refreshDashboardData} isOpen={isAddUserDialogOpen} setIsOpen={setIsAddUserDialogOpen} companies={viewableBrandsForFilter} locations={allSystemLocations} currentUser={currentUser}/> )}
    </div>
  );
}
