
'use client';

import React, { useState } from 'react';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from '@/components/ui/label';
import type { Lesson } from '@/types/course';
import { useToast } from '@/hooks/use-toast';

interface AddLessonToCurriculumDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  availableLessons: Lesson[]; // Lessons not currently in the curriculum
  onAddLesson: (lessonId: string) => void;
}

export function AddLessonToCurriculumDialog({
  isOpen,
  setIsOpen,
  availableLessons,
  onAddLesson,
}: AddLessonToCurriculumDialogProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedLessonId) {
        toast({ title: "No Lesson Selected", description: "Please choose a lesson to add.", variant: "destructive" });
        return;
    }
    onAddLesson(selectedLessonId);
    setSelectedLessonId(''); // Reset selection after adding
    // Dialog closes automatically via onAddLesson callback setting isOpen to false
  };

  const handleClose = () => {
    setSelectedLessonId(''); // Reset selection on cancel
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Lesson to Curriculum</DialogTitle>
          <DialogDescription>
            Select an existing lesson from your library to add to this course's curriculum.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-2">
            <Label htmlFor="lesson-select">Available Lessons</Label>
            {availableLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No more lessons available to add.</p>
            ) : (
                <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                  <SelectTrigger id="lesson-select">
                    <SelectValue placeholder="Select a lesson..." />
                  </SelectTrigger>
                  <SelectContent>
                     <ScrollArea className="h-[200px]"> {/* Add ScrollArea for long lists */}
                        {availableLessons.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </SelectItem>
                        ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
             )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={availableLessons.length === 0 || !selectedLessonId}
            className="bg-primary hover:bg-primary/90"
          >
            Add Selected Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
