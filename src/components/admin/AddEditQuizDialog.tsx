
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
import { createQuiz, updateQuiz } from '@/lib/firestore-data'; // Use standalone quiz functions

// Zod schema for basic quiz form validation (title only for now)
const quizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

interface AddEditQuizDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  // courseId: string; // REMOVED - No longer tied to a specific course initially
  initialData: Quiz | null; // Quiz or null for adding
  onQuizSaved: (quiz: Quiz) => void; // Callback after save
}

export function AddEditQuizDialog({
  isOpen,
  setIsOpen,
  // courseId, // REMOVED
  initialData,
  onQuizSaved,
}: AddEditQuizDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      title: '',
    },
  });

  // Effect to populate form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      form.reset({
        title: initialData.title,
      });
    } else {
      form.reset(); // Reset form if adding a new quiz
    }
  }, [initialData, form]);

  const onSubmit = async (data: QuizFormValues) => { // Removed async as Firestore calls are now async
    try {
      let savedQuiz: Quiz | null = null;
       const quizData: QuizFormData = { // Use QuizFormData
          title: data.title,
          // Questions handled separately
      };

      if (isEditing && initialData) {
        // Update existing quiz using standalone updateQuiz
        savedQuiz = await updateQuiz(initialData.id, quizData); // await the async function
      } else {
        // Add new quiz using standalone createQuiz
        savedQuiz = await createQuiz(quizData); // await the async function
      }

       if (savedQuiz) {
          toast({
            title: isEditing ? 'Quiz Updated' : 'Quiz Added',
            description: `Quiz "${savedQuiz.title}" has been successfully saved. Add questions separately.`,
          });
          onQuizSaved(savedQuiz); // Call the callback with the saved quiz
          handleClose(); // Close dialog after successful save
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

  // Handle closing the dialog
  const handleClose = () => {
    form.reset(); // Reset form state on close
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Quiz Title' : 'Add Quiz'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the title of this quiz.' : 'Enter the title for the new standalone quiz. Questions can be added later.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Quiz Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sales Fundamentals Checkpoint" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {/* Placeholder for adding questions later */}
             <p className="text-sm text-muted-foreground pt-4">
               Note: Questions for this quiz must be managed separately after the quiz is created.
             </p>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {isEditing ? 'Save Title' : 'Create Quiz'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
