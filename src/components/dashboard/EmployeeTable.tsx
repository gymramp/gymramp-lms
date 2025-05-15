'use client';

import React, { useState, useEffect } from 'react'; 
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
import { MoreHorizontal, Archive, Undo, Edit, BookCopy, MapPin, Loader2 } from "lucide-react"; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole, Location, Company } from '@/types/user'; 
import type { Course } from '@/types/course'; 
import { cn } from '@/lib/utils';
import { getCourseById } from '@/lib/firestore-data'; 

type EmployeeWithOverallProgress = User & {
    overallProgress: number;
    overallStatus: "Not Started" | "Started" | "In Progress" | "Completed"; 
};


interface EmployeeTableProps {
  employees: EmployeeWithOverallProgress[]; 
  onToggleEmployeeStatus: (userId: string) => void;
  onAssignCourse: (user: User) => void;
  onEditUser: (user: User) => void; 
  currentUser: User | null; 
  locations: Location[]; 
  companyCourses: Course[]; 
}

const ROLE_HIERARCHY_TABLE: Record<UserRole, number> = { 
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

export function EmployeeTable({ employees, onToggleEmployeeStatus, onAssignCourse, onEditUser, currentUser, locations = [], companyCourses = [] }: EmployeeTableProps) {
    const { toast } = useToast();
    const [assignedCourseTitles, setAssignedCourseTitles] = useState<Record<string, string>>({});
    const [isLoadingTitles, setIsLoadingTitles] = useState(false);

    useEffect(() => {
        let isMounted = true; // Flag to prevent state updates if component unmounts
        const fetchTitles = async () => {
            if (!isMounted) return;
            setIsLoadingTitles(true);
            const titles: Record<string, string> = {};
            const courseIdsToFetch = new Set(employees.flatMap(e => e.assignedCourseIds || []).filter(Boolean));

            for (const courseId of courseIdsToFetch) {
                if (courseId) { 
                    try {
                        const course = await getCourseById(courseId);
                        if (isMounted) { // Check again before setting state
                            if (course) {
                                titles[courseId] = course.title;
                            } else {
                                titles[courseId] = "Unknown Course";
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
        return () => { isMounted = false; }; // Cleanup function
    }, [employees]); 


     const canManageUser = (targetUser: User): boolean => {
         if (!currentUser) return false;
         if (currentUser.id === targetUser.id) return true;
         if (currentUser.role === 'Super Admin') return true; 
         if (!currentUser.companyId || currentUser.companyId !== targetUser.companyId) return false; 
         return ROLE_HIERARCHY_TABLE[currentUser.role] > ROLE_HIERARCHY_TABLE[targetUser.role];
     };

    const handleToggleClick = (employee: User) => {
        if (!canManageUser(employee) || currentUser?.id === employee.id) { 
            toast({ title: "Permission Denied", description: "You cannot modify this user's status.", variant: "destructive" });
            return;
        }
        onToggleEmployeeStatus(employee.id);
    };

    const handleAssignClick = (employee: User) => {
        if (!canManageUser(employee)) {
             toast({ title: "Permission Denied", description: "You cannot assign courses to this user.", variant: "destructive" });
             return;
         }
         if (companyCourses.length === 0) {
              toast({ title: "No Courses Available", description: "There are no courses assigned to this company to assign to users.", variant: "destructive" });
              return;
         }
         onAssignCourse(employee);
    }

    const handleEditClick = (employee: User) => {
        if (!canManageUser(employee)) { 
             toast({
                title: "Permission Denied",
                description: `You do not have permission to edit ${employee.name}.`,
                 variant: "destructive",
             });
             return;
        }
        onEditUser(employee); 
    };


    if (!currentUser) {
         return <div className="text-center text-muted-foreground py-8">Loading user data...</div>;
     }

    const getAccessibleLocationNames = (assignedIds: string[] | undefined): string[] => {
      if (!assignedIds) return [];
      const accessibleLocationIds = new Set(locations.map(loc => loc.id));
      return assignedIds
        .filter(id => accessibleLocationIds.has(id)) 
        .map(id => locations.find(loc => loc.id === id)?.name || ''); 
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
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.length === 0 && (
            <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No employees to display for this page or filter.
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
                                    .filter(title => title !== 'Unknown Course' && title !== 'Error Loading Title'); 
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
              <div className="text-xs text-muted-foreground">{employee.role}</div>
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
                        <span className="text-xs text-muted-foreground italic">None (Accessible)</span>
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
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <>
                      <span className="sr-only">Open menu for {employee.name}</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions for {employee.name}</DropdownMenuLabel>
                   <DropdownMenuItem onClick={() => handleAssignClick(employee)} disabled={!canManageUser(employee) || !employee.isActive || companyCourses.length === 0}>
                     <>
                       <BookCopy className="mr-2 h-4 w-4" />
                       <span>Manage Assigned Courses</span>
                     </>
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => handleEditClick(employee)} disabled={!canManageUser(employee) || !employee.isActive}>
                     <>
                       <Edit className="mr-2 h-4 w-4" />
                       <span>Edit Details</span>
                     </>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem
                      onClick={() => handleToggleClick(employee)}
                      className={cn(
                          employee.isActive
                          ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                          : "text-green-600 focus:text-green-600 focus:bg-green-500/10"
                      )}
                      disabled={!canManageUser(employee) || currentUser?.id === employee.id}
                    >
                     {employee.isActive ? (
                        <> <Archive className="mr-2 h-4 w-4" /> <span>Deactivate</span> </>
                     ) : (
                        <> <Undo className="mr-2 h-4 w-4" /> <span>Reactivate</span> </>
                     )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
