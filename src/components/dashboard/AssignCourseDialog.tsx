
'use client';

import React, { useState, useEffect } from 'react';
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
import type { Course, BrandCourse } from '@/types/course';
import { Check, Loader2 } from 'lucide-react';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data'; // To fetch brand specific courses
import { useToast } from '@/hooks/use-toast';

interface AssignCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: User;
  courses: Course[]; // Global courses available to the brand via programs
  company: Company | null; // The company/brand the employee belongs to
  onAssignCourse: (courseId: string, action: 'assign' | 'unassign') => void;
}

export function AssignCourseDialog({ isOpen, setIsOpen, employee, courses, company, onAssignCourse }: AssignCourseDialogProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [isCourseAssigned, setIsCourseAssigned] = useState(false);
  const [brandSpecificCourses, setBrandSpecificCourses] = useState<BrandCourse[]>([]);
  const [isLoadingBrandCourses, setIsLoadingBrandCourses] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBrandSpecificCourses = async () => {
      if (company && company.canManageCourses && company.id) {
        setIsLoadingBrandCourses(true);
        try {
          const fetchedBrandCourses = await getBrandCoursesByBrandId(company.id);
          setBrandSpecificCourses(fetchedBrandCourses);
        } catch (error) {
          console.error("Error fetching brand specific courses:", error);
          toast({ title: "Error", description: "Could not load brand-specific courses.", variant: "destructive" });
          setBrandSpecificCourses([]);
        } finally {
          setIsLoadingBrandCourses(false);
        }
      } else {
        setBrandSpecificCourses([]); // Reset if company cannot manage courses or no company info
      }
    };

    if (isOpen) {
      fetchBrandSpecificCourses();
    } else {
      // Reset when dialog closes
      setSelectedCourseId(undefined);
      setIsCourseAssigned(false);
      setBrandSpecificCourses([]);
      setIsLoadingBrandCourses(false);
    }
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
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const allAvailableCourses = [
    ...(courses || []).map(c => ({ ...c, type: 'program' as const })), // Mark program courses
    ...(brandSpecificCourses || []).map(bc => ({ ...bc, type: 'brand' as const })) // Mark brand courses
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Course Assignment for {employee.name}</DialogTitle>
          <DialogDescription>
            Select a course and assign or unassign it from the user.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-select">Select Course</Label>
            <Select
              value={selectedCourseId || ''}
              onValueChange={setSelectedCourseId}
            >
              <SelectTrigger id="course-select">
                <SelectValue placeholder="Select a course..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingBrandCourses && (
                  <div className="flex items-center justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading brand courses...</span>
                  </div>
                )}

                {courses.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Program Courses</SelectLabel>
                    {courses.map((course) => (
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

                {company?.canManageCourses && brandSpecificCourses.length > 0 && (
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
                
                {!isLoadingBrandCourses && courses.length === 0 && (!company?.canManageCourses || brandSpecificCourses.length === 0) && (
                   <div className="px-2 py-1.5 text-sm text-muted-foreground italic text-center">
                     No courses available to assign.
                   </div>
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
            disabled={!selectedCourseId || isLoadingBrandCourses}
            className="bg-primary hover:bg-primary/90"
          >
            {isCourseAssigned ? 'Unassign Selected Course' : 'Assign Selected Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
