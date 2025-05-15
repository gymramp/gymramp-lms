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
import type { Quiz } from '@/types/course';
import { useToast } from '@/hooks/use-toast';

interface AddQuizToCurriculumDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  availableQuizzes: Quiz[]; // Quizzes not currently in the curriculum
  onAddQuiz: (quizId: string) => void;
}

export function AddQuizToCurriculumDialog({
  isOpen,
  setIsOpen,
  availableQuizzes,
  onAddQuiz,
}: AddQuizToCurriculumDialogProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedQuizId) {
        toast({ title: "No Quiz Selected", description: "Please choose a quiz to add.", variant: "destructive" });
        return;
    }
    onAddQuiz(selectedQuizId);
    setSelectedQuizId(''); // Reset selection after adding
    // Dialog closes automatically via onAddQuiz callback setting isOpen to false
  };

  const handleClose = () => {
    setSelectedQuizId(''); // Reset selection on cancel
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Quiz to Curriculum</DialogTitle>
          <DialogDescription>
            Select an existing quiz from your library to add to this course's curriculum.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-2">
            <Label htmlFor="quiz-select">Available Quizzes</Label>
            {availableQuizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No more quizzes available to add.</p>
            ) : (
                <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                  <SelectTrigger id="quiz-select">
                    <SelectValue placeholder="Select a quiz..." />
                  </SelectTrigger>
                  <SelectContent>
                     <ScrollArea className="h-[200px]"> {/* Add ScrollArea for long lists */}
                        {availableQuizzes.map((quiz) => (
                          <SelectItem key={quiz.id} value={quiz.id}>
                            {quiz.title}
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
            disabled={availableQuizzes.length === 0 || !selectedQuizId}
            className="bg-primary hover:bg-primary/90"
          >
            Add Selected Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}