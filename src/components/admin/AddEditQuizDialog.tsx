

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Quiz, QuizFormData } from '@/types/course';
import { createQuiz } from '@/lib/firestore-data';

const quizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

interface AddEditQuizDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Quiz | null; // Will always be null now for creating
  onQuizSaved: (quiz: Quiz) => void;
}

export function AddEditQuizDialog({
  isOpen,
  setIsOpen,
  initialData, // Kept for prop signature consistency
  onQuizSaved,
}: AddEditQuizDialogProps) {
  const isEditing = false; // This dialog is only for adding
  const { toast } = useToast();

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({ title: '' }); // Always reset for a new quiz
    }
  }, [form, isOpen]);

  const onSubmit = async (data: QuizFormValues) => {
    try {
      const quizData: QuizFormData = {
        title: data.title,
        translations: {}, // Translations will be added on the edit page
      };

      const savedQuiz = await createQuiz(quizData);

       if (savedQuiz) {
          toast({
            title: 'Quiz Created',
            description: `Quiz "${savedQuiz.title}" has been successfully saved. You can now add questions to it.`,
          });
          onQuizSaved(savedQuiz);
          handleClose();
       } else {
          throw new Error("Failed to save quiz.");
       }

    } catch (error) {
       console.error("Failed to save quiz:", error);
         toast({
            title: 'Error Saving Quiz',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
            variant: 'destructive',
        });
    }
  };

  const handleClose = () => {
    form.reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Quiz</DialogTitle>
          <DialogDescription>
            Enter the title for the new quiz. Questions are managed separately after creation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Title (English)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sales Fundamentals Checkpoint" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Create Quiz
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
