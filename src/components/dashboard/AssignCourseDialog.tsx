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
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import type { User } from '@/types/user'; // Use User type
import type { Course } from '@/types/course';
import { Check } from 'lucide-react'; // Import Check icon

interface AssignCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: User; // Changed type to User
  courses: Course[]; // List of available courses for the company
  // Update callback to pass courseId and action
  onAssignCourse: (courseId: string, action: 'assign' | 'unassign') => void;
}

export function AssignCourseDialog({ isOpen, setIsOpen, employee, courses, onAssignCourse }: AssignCourseDialogProps) {
  // selectedCourseId now represents the course currently selected in the dropdown
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [isCourseAssigned, setIsCourseAssigned] = useState(false);

  // Update isCourseAssigned whenever the selected course changes
  useEffect(() => {
    if (selectedCourseId) {
        setIsCourseAssigned(employee.assignedCourseIds?.includes(selectedCourseId) || false);
    } else {
        setIsCourseAssigned(false); // No course selected, so not assigned
    }
  }, [selectedCourseId, employee.assignedCourseIds]);


  const handleSubmit = () => {
    if (!selectedCourseId) return; // Don't submit if no course is selected

    const action = isCourseAssigned ? 'unassign' : 'assign';
    onAssignCourse(selectedCourseId, action);
    // Let the parent component handle closing the dialog and resetting state if needed
  };

  const handleClose = () => {
    setSelectedCourseId(undefined); // Reset selection on close/cancel
    setIsCourseAssigned(false);
    setIsOpen(false);
  };

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
              value={selectedCourseId || ''} // Use empty string for placeholder state
              onValueChange={setSelectedCourseId} // Update selection
            >
              <SelectTrigger id="course-select">
                <SelectValue placeholder="Select a course..." />
              </SelectTrigger>
              <SelectContent>
                 {/* REMOVED: SelectItem with empty value - this causes the error */}
                 {courses.length > 0 ? courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    <div className="flex items-center justify-between w-full">
                        <span>{course.title} ({course.level})</span>
                         {/* Show checkmark if this course is currently assigned */}
                        {employee.assignedCourseIds?.includes(course.id) && (
                            <Check className="h-4 w-4 text-green-500 ml-2" />
                        )}
                     </div>
                  </SelectItem>
                 )) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground italic">
                      No courses available for this company
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
            // Disable only if no course is selected in the dropdown
            disabled={!selectedCourseId}
            className="bg-primary hover:bg-primary/90"
          >
             {/* Button text depends on whether the *selected* course is assigned */}
             {isCourseAssigned ? 'Unassign Selected Course' : 'Assign Selected Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
