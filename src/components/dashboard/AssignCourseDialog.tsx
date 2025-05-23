
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import type { User, Company } from '@/types/user';
import type { Course, BrandCourse, Program } from '@/types/course';
import { Check, Loader2 } from 'lucide-react';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
import { getAllPrograms as fetchAllGlobalPrograms, getCourseById as fetchGlobalCourseById } from '@/lib/firestore-data'; // Renamed to avoid conflict
import { useToast } from '@/hooks/use-toast';

interface AssignCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: User;
  company: Company | null;
  onAssignCourse: (courseId: string, action: 'assign' | 'unassign') => void;
}

export function AssignCourseDialog({ isOpen, setIsOpen, employee, company, onAssignCourse }: AssignCourseDialogProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [isCourseAssigned, setIsCourseAssigned] = useState(false);
  
  const [availableGlobalCourses, setAvailableGlobalCourses] = useState<Course[]>([]);
  const [brandSpecificCourses, setBrandSpecificCourses] = useState<BrandCourse[]>([]);
  
  const [isLoadingGlobalCourses, setIsLoadingGlobalCourses] = useState(false);
  const [isLoadingBrandCourses, setIsLoadingBrandCourses] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchCoursesForAssignment = async () => {
      if (!isOpen || !company) {
        setAvailableGlobalCourses([]);
        setBrandSpecificCourses([]);
        return;
      }

      setIsLoadingGlobalCourses(true);
      setIsLoadingBrandCourses(true);

      try {
        // Fetch global courses available through the company's assigned programs
        if (company.assignedProgramIds && company.assignedProgramIds.length > 0) {
          const allPrograms = await fetchAllGlobalPrograms();
          const relevantPrograms = allPrograms.filter(p => company.assignedProgramIds!.includes(p.id));
          
          const courseIdSet = new Set<string>();
          relevantPrograms.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
          
          const coursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
          const fetchedGlobalCourses = (await Promise.all(coursePromises)).filter(Boolean) as Course[];
          setAvailableGlobalCourses(fetchedGlobalCourses.filter(c => !c.isDeleted));
        } else {
          setAvailableGlobalCourses([]);
        }
      } catch (error) {
        console.error("Error fetching global program courses:", error);
        toast({ title: "Error", description: "Could not load global courses for assignment.", variant: "destructive" });
        setAvailableGlobalCourses([]);
      } finally {
        setIsLoadingGlobalCourses(false);
      }

      // Fetch brand-specific courses if the brand can manage them
      if (company.canManageCourses && company.id) {
        try {
          const fetchedBrandCourses = await getBrandCoursesByBrandId(company.id);
          setBrandSpecificCourses(fetchedBrandCourses.filter(bc => !bc.isDeleted));
        } catch (error) {
          console.error("Error fetching brand specific courses:", error);
          toast({ title: "Error", description: "Could not load brand-specific courses.", variant: "destructive" });
          setBrandSpecificCourses([]);
        } finally {
          setIsLoadingBrandCourses(false);
        }
      } else {
        setBrandSpecificCourses([]);
        setIsLoadingBrandCourses(false); // Ensure this is set if no fetch attempt
      }
    };

    fetchCoursesForAssignment();

  }, [isOpen, company, toast]);

  useEffect(() => {
    if (selectedCourseId) {
      setIsCourseAssigned(employee.assignedCourseIds?.includes(selectedCourseId) || false);
    } else {
      setIsCourseAssigned(false);
    }
  }, [selectedCourseId, employee.assignedCourseIds]);

  const handleSubmit = () => {
    if (!selectedCourseId) return;
    const action = isCourseAssigned ? 'unassign' : 'assign';
    onAssignCourse(selectedCourseId, action);
    // Dialog closure and state reset handled by parent via onAssignCourse callback
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset local states when dialog is explicitly closed
    setSelectedCourseId(undefined);
    setIsCourseAssigned(false);
  };

  const combinedCourses = useMemo(() => [
    ...availableGlobalCourses.map(c => ({ ...c, type: 'global' as const })),
    ...brandSpecificCourses.map(bc => ({ ...bc, type: 'brand' as const }))
  ], [availableGlobalCourses, brandSpecificCourses]);

  const isLoadingAnyCourses = isLoadingGlobalCourses || isLoadingBrandCourses;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Course Assignment for {employee.name}</DialogTitle>
          <DialogDescription>
            Select a course to assign or unassign from this user.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-select-assignment">Select Course</Label>
            <Select
              value={selectedCourseId || ''}
              onValueChange={setSelectedCourseId}
              disabled={isLoadingAnyCourses || combinedCourses.length === 0}
            >
              <SelectTrigger id="course-select-assignment">
                <SelectValue placeholder={isLoadingAnyCourses ? "Loading courses..." : (combinedCourses.length === 0 ? "No courses available" : "Select a course...")} />
              </SelectTrigger>
              <SelectContent>
                {isLoadingAnyCourses ? (
                  <div className="flex items-center justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading courses...</span>
                  </div>
                ) : (
                  <>
                    {availableGlobalCourses.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Program Courses (Global Library)</SelectLabel>
                        {availableGlobalCourses.map((course) => (
                          <SelectItem key={`global-${course.id}`} value={course.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{course.title} ({course.level})</span>
                              {employee.assignedCourseIds?.includes(course.id) && (
                                <Check className="h-4 w-4 text-green-500 ml-2" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {brandSpecificCourses.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>My Brand's Courses</SelectLabel>
                        {brandSpecificCourses.map((course) => (
                          <SelectItem key={`brand-${course.id}`} value={course.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{course.title} ({course.level})</span>
                              {employee.assignedCourseIds?.includes(course.id) && (
                                <Check className="h-4 w-4 text-green-500 ml-2" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {combinedCourses.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground italic text-center">
                        No courses available for assignment to this brand's users.
                      </div>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedCourseId || isLoadingAnyCourses}
            className="bg-primary hover:bg-primary/90"
          >
            {isCourseAssigned ? 'Unassign Selected' : 'Assign Selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    