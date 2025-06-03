
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
import { Edit, Archive, Undo, BookCopy, MapPin, Loader2, ShieldCheck } from "lucide-react"; // Changed MoreHorizontal to Edit
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole, Location, Company } from '@/types/user';
import type { Course, BrandCourse } from '@/types/course';
import { cn } from '@/lib/utils';
import { getCourseById as fetchGlobalCourseById } from '@/lib/firestore-data';
import { getBrandCourseById } from '@/lib/brand-content-data';

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
  // onAssignCourse and onEditUser are removed as this functionality moves to a new page
  currentUser: User | null;
  locations: Location[];
  companies: Company[];
  baseEditPath: "/admin/users" | "/dashboard/users"; // New prop for dynamic edit link
}

export function EmployeeTable({ employees, onToggleEmployeeStatus, currentUser, locations = [], companies = [], baseEditPath }: EmployeeTableProps) {
    const { toast } = useToast();
    const [assignedCourseTitles, setAssignedCourseTitles] = useState<Record<string, string>>({});
    const [isLoadingTitles, setIsLoadingTitles] = useState(false);

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
        if (currentUser.id === targetUser.id && !['Super Admin', 'Admin', 'Owner'].includes(currentUser.role)) {
             return false;
        }
        if (currentUser.role === 'Super Admin') {
             return currentUser.id !== targetUser.id;
        }
        
        if (!currentUser.companyId) return false; 

        const isTargetUserInAccessibleBrand = companies.some(c => c.id === targetUser.companyId);
        if (!isTargetUserInAccessibleBrand) return false;

        if (currentUser.role === 'Manager') {
            return (targetUser.role === 'Staff' || targetUser.role === 'Manager');
        }
        
        return ROLE_HIERARCHY_TABLE[currentUser.role] > ROLE_HIERARCHY_TABLE[targetUser.role];
    };
     
    const canAssignCoursesToTarget = (cu: User | null, tu: User): boolean => {
        if (!cu) return false;
        
        if (cu.id === tu.id) {
            return (cu.role === 'Super Admin' || cu.role === 'Admin' || cu.role === 'Owner');
        }

        if (cu.role === 'Super Admin') return true;
        if (!cu.companyId) return false; 

        const isTargetUserInAccessibleBrand = companies.some(c => c.id === tu.companyId);
        if (!isTargetUserInAccessibleBrand) return false;

        if (cu.role === 'Manager') {
            return (tu.role === 'Staff' || tu.role === 'Manager');
        }
        if (cu.role === 'Admin' || cu.role === 'Owner') {
            return ROLE_HIERARCHY_TABLE[cu.role] > ROLE_HIERARCHY_TABLE[tu.role];
        }
        return false;
    };

    const handleToggleClick = (employee: User) => {
        if (currentUser?.id === employee.id) {
            toast({ title: "Action Denied", description: "You cannot deactivate your own account.", variant: "destructive" });
            return;
        }
        if (!canPerformGeneralAction(employee)) {
            toast({ title: "Permission Denied", description: "You cannot modify this user's status.", variant: "destructive" });
            return;
        }
        onToggleEmployeeStatus(employee.id, employee.name, employee.isActive);
    };

    const canEditTargetUser = (targetUser: User): boolean => {
        if (!currentUser) return false;
        if (currentUser.id === targetUser.id) return true; // Can always edit self
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Course(s) Assigned</TableHead>
          <TableHead className="text-center">Status (Overall)</TableHead>
          <TableHead className="text-center">Progress (Overall)</TableHead>
           <TableHead>Locations</TableHead>
          <TableHead className="text-center">Active</TableHead>
          <TableHead className="text-center">Edit</TableHead> {/* Changed Header */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.length === 0 && (
            <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
              <Badge
                variant={
                  employee.overallStatus === "Completed" ? "default" :
                  employee.overallStatus === "In Progress" ? "secondary" :
                  employee.overallStatus === "Started" ? "outline" :
                  "destructive"
                }
                 className={cn(
                    'text-xs px-2 py-0.5',
                    employee.overallStatus === 'Completed' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700' :
                    employee.overallStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700' :
                    employee.overallStatus === 'Started' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700' :
                    'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                 )}
              >
                {employee.overallStatus}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
               <div className="flex items-center justify-center gap-2">
                <Progress value={employee.overallProgress} className="w-[60%]" aria-label={`${employee.name} overall progress ${employee.overallProgress}%`} />
                 <span className="text-xs font-medium">{employee.overallProgress}%</span>
               </div>
            </TableCell>
             <TableCell>
                <div className="flex flex-wrap gap-1 max-w-xs">
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
            <TableCell className="text-center"> {/* Changed from text-right */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                disabled={!canEditTargetUser(employee)}
                title={canEditTargetUser(employee) ? `Edit ${employee.name}` : "You do not have permission to edit this user."}
              >
                <Link href={`${baseEditPath}/${employee.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit {employee.name}</span>
                </Link>
              </Button>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
