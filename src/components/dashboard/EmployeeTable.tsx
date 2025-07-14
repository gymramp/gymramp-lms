
// src/components/dashboard/EmployeeTable.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Archive, Undo, BookCopy, MapPin, Loader2, ShieldCheck, MoreHorizontal, Trash2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole, Location, Company } from '@/types/user';
import type { Course, BrandCourse } from '@/types/course';
import { cn } from '@/lib/utils';
import { getCourseById as fetchGlobalCourseById } from '@/lib/firestore-data';
import { getBrandCourseById } from '@/lib/brand-content-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SendNotificationDialog } from './SendNotificationDialog'; // Import the new dialog


const ROLE_HIERARCHY_TABLE: Record<UserRole, number> = {
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

interface EmployeeTableProps {
  employees: EmployeeWithOverallProgress[];
  onToggleEmployeeStatus: (userId: string, userName: string, currentStatus: boolean) => void;
  currentUser: User | null;
  locations: Location[];
  companies: Company[];
  baseEditPath: "/admin/users" | "/dashboard/users";
}

export function EmployeeTable({ employees, onToggleEmployeeStatus, currentUser, locations = [], companies = [], baseEditPath }: EmployeeTableProps) {
    const { toast } = useToast();
    const [assignedCourseTitles, setAssignedCourseTitles] = useState<Record<string, string>>({});
    const [isLoadingTitles, setIsLoadingTitles] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
    const [notificationRecipient, setNotificationRecipient] = useState<User | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchTitles = async () => {
            if (!isMounted) return;
            setIsLoadingTitles(true);
            const titles: Record<string, string> = {};
            const courseIdsToFetch = new Set(employees.flatMap(e => e.assignedCourseIds || []).filter(Boolean));

            for (const courseId of courseIdsToFetch) {
                if (courseId) {
                    try {
                        let course: Course | BrandCourse | null = await fetchGlobalCourseById(courseId);
                        if (!course) {
                            course = await getBrandCourseById(courseId);
                        }
                        if (isMounted) {
                            if (course && !course.isDeleted) {
                                titles[courseId] = course.title;
                            } else {
                                titles[courseId] = "Unknown/Deleted Course";
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching title for course ${courseId}:`, error);
                        if (isMounted) titles[courseId] = "Error Loading Title";
                    }
                }
            }
            if (isMounted) {
                setAssignedCourseTitles(titles);
                setIsLoadingTitles(false);
            }
        };

        if (employees.length > 0) {
            fetchTitles();
        } else {
             setAssignedCourseTitles({});
             setIsLoadingTitles(false);
        }
        return () => { isMounted = false; };
    }, [employees]);

    const canPerformGeneralAction = (targetUser: User): boolean => {
        if (!currentUser) return false;
        if (currentUser.id === targetUser.id) return false; // Cannot deactivate self
        if (currentUser.role === 'Super Admin') return true;
        if (!currentUser.companyId) return false; 
        const isTargetUserInAccessibleBrand = companies.some(c => c.id === targetUser.companyId);
        if (!isTargetUserInAccessibleBrand) return false;
        if (currentUser.role === 'Manager') {
            return (targetUser.role === 'Staff' || targetUser.role === 'Manager');
        }
        return ROLE_HIERARCHY_TABLE[currentUser.role] > ROLE_HIERARCHY_TABLE[targetUser.role];
    };
     
    const handleToggleClick = (employee: User) => {
        if (!canPerformGeneralAction(employee)) {
            toast({ title: "Permission Denied", description: "You cannot modify this user's status.", variant: "destructive" });
            return;
        }
        setUserToToggle(employee);
        setIsAlertOpen(true);
    };
    
    const confirmToggleStatus = () => {
        if (userToToggle) {
            onToggleEmployeeStatus(userToToggle.id, userToToggle.name, userToToggle.isActive);
        }
        setIsAlertOpen(false);
        setUserToToggle(null);
    };

    const handleSendMessageClick = (employee: User) => {
        if (!canPerformGeneralAction(employee)) {
            toast({ title: "Permission Denied", description: "You cannot send messages to this user.", variant: "destructive" });
            return;
        }
        setNotificationRecipient(employee);
        setIsNotificationDialogOpen(true);
    };

    const canEditTargetUser = (targetUser: User): boolean => {
        if (!currentUser) return false;
        if (currentUser.id === targetUser.id) return true;
        if (currentUser.role === 'Super Admin') return true;
        
        const isTargetInManagedScope = companies.some(c => c.id === targetUser.companyId);
        if (!isTargetInManagedScope) return false;

        if (currentUser.role === 'Manager') {
            return (targetUser.role === 'Staff' || targetUser.role === 'Manager');
        }
        return ROLE_HIERARCHY_TABLE[currentUser.role] > ROLE_HIERARCHY_TABLE[targetUser.role];
    };

    if (!currentUser) {
         return <div className="text-center text-muted-foreground py-8">Loading user data...</div>;
     }

    const getAccessibleLocationNames = (assignedIds: string[] | undefined): string[] => {
      if (!assignedIds) return [];
      return assignedIds
        .map(id => locations.find(loc => loc.id === id)?.name)
        .filter(Boolean) as string[];
    };

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Course(s) Assigned</TableHead>
          <TableHead className="text-center">Locations</TableHead>
          <TableHead className="text-center">Active</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.length === 0 && (
            <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No employees to display for the current filters.
                </TableCell>
            </TableRow>
        )}
        {employees.map((employee) => {
          const assignedCourseIds = employee.assignedCourseIds || [];
          const assignedCount = assignedCourseIds.length;
          let courseDisplay: React.ReactNode = <span className="text-xs text-muted-foreground italic">None Assigned</span>;

          if (isLoadingTitles) {
              courseDisplay = <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />;
          } else if (assignedCount > 0) {
              const courseList = assignedCourseIds
                                    .map(courseId => assignedCourseTitles[courseId] || 'Loading...')
                                    .filter(title => title !== 'Unknown/Deleted Course' && title !== 'Error Loading Title');
              if (courseList.length <= 2) {
                  courseDisplay = <span className="text-xs text-foreground">{courseList.join(', ')}</span>;
              } else {
                  courseDisplay = <Badge variant="secondary">{courseList.length} Courses</Badge>;
              }
              if (courseList.length === 0 && assignedCount > 0) {
                   courseDisplay = <span className="text-xs text-muted-foreground italic">{assignedCount} Course(s) (Details Loading...)</span>;
              }
          }

           const displayableLocationNames = getAccessibleLocationNames(employee.assignedLocationIds);

          return (
          <TableRow key={employee.id} className={cn(!employee.isActive && "opacity-50")}>
            <TableCell>
              <div className="font-medium">{employee.name}</div>
              <div className="text-xs text-muted-foreground">{employee.email}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 opacity-70" />
                {employee.role}
              </div>
            </TableCell>
            <TableCell>
                 {courseDisplay}
            </TableCell>
             <TableCell className="text-center">
                <div className="flex flex-wrap gap-1 max-w-xs justify-center">
                    {displayableLocationNames.length > 0 ? (
                        displayableLocationNames.map((name, index) => (
                        <Badge key={`${employee.id}-loc-${index}-${name}`} variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1"/>
                            {name}
                        </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                </div>
             </TableCell>
             <TableCell className="text-center">
                 <Badge variant={employee.isActive ? "default" : "secondary"} className={cn(
                     'text-xs px-2 py-0.5',
                     employee.isActive ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700' :
                                         'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                 )}>
                    {employee.isActive ? "Active" : "Inactive"}
                 </Badge>
            </TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={!canPerformGeneralAction(employee) && !canEditTargetUser(employee)}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {employee.name}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild disabled={!canEditTargetUser(employee)}>
                            <Link href={`${baseEditPath}/${employee.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit User
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendMessageClick(employee)} disabled={!canPerformGeneralAction(employee)}>
                            <Send className="mr-2 h-4 w-4" /> Send Message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleToggleClick(employee)}
                            disabled={!canPerformGeneralAction(employee)}
                            className={cn(employee.isActive ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600')}
                        >
                            {employee.isActive ? <Archive className="mr-2 h-4 w-4" /> : <Undo className="mr-2 h-4 w-4" />}
                            {employee.isActive ? 'Deactivate' : 'Reactivate'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will {userToToggle?.isActive ? 'deactivate' : 'reactivate'} the user account for <strong>{userToToggle?.name}</strong>.
                    {userToToggle?.isActive ? ' They will no longer be able to log in.' : ' They will be able to log in again.'}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsAlertOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmToggleStatus} className={cn(userToToggle?.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-green-600 text-white hover:bg-green-700")}>
                    Yes, {userToToggle?.isActive ? 'Deactivate' : 'Reactivate'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <SendNotificationDialog
        isOpen={isNotificationDialogOpen}
        setIsOpen={setIsNotificationDialogOpen}
        recipient={notificationRecipient}
        sender={currentUser}
    />
    </>
  );
}
