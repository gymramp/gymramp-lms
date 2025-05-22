
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
import type { BrandQuiz } from '@/types/course';
import { useToast } from '@/hooks/use-toast';

interface AddBrandQuizToCurriculumDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  availableQuizzes: BrandQuiz[];
  onAddQuiz: (quizId: string) => void;
}

export function AddBrandQuizToCurriculumDialog({
  isOpen,
  setIsOpen,
  availableQuizzes,
  onAddQuiz,
}: AddBrandQuizToCurriculumDialogProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedQuizId) {
        toast({ title: "No Quiz Selected", description: "Please choose a brand quiz to add.", variant: "destructive" });
        return;
    }
    onAddQuiz(selectedQuizId);
    setSelectedQuizId(''); 
    setIsOpen(false); 
  };

  const handleClose = () => {
    setSelectedQuizId(''); 
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Brand Quiz to Curriculum</DialogTitle>
          <DialogDescription>
            Select an existing quiz created by your brand to add to this course's curriculum.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-2">
            <Label htmlFor="brand-quiz-select">Available Brand Quizzes</Label>
            {availableQuizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No more brand quizzes available to add, or all are already in the curriculum.</p>
            ) : (
                <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                  <SelectTrigger id="brand-quiz-select">
                    <SelectValue placeholder="Select a brand quiz..." />
                  </SelectTrigger>
                  <SelectContent>
                     <ScrollArea className="h-[200px]">
                        {availableQuizzes.map((quiz) => (
                          <SelectItem key={quiz.id} value={quiz.id}>
                            {quiz.title} ({quiz.questionCount || 0} questions)
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
