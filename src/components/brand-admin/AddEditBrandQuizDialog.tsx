

'use client';

import React, { useEffect } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz, BrandQuizFormData } from '@/types/course';
import { createBrandQuiz } from '@/lib/brand-content-data';
import { Loader2 } from 'lucide-react';

const brandQuizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
});

type BrandQuizFormValues = z.infer<typeof brandQuizFormSchema>;

interface AddEditBrandQuizDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  brandId: string;
  initialData: BrandQuiz | null; // Always null for creation
  onQuizSaved: (quiz: BrandQuiz) => void;
}

export function AddEditBrandQuizDialog({
  isOpen,
  setIsOpen,
  brandId,
  initialData, // Kept for prop signature consistency
  onQuizSaved,
}: AddEditBrandQuizDialogProps) {
  const isEditing = false; // This dialog is only for adding
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<BrandQuizFormValues>({
    resolver: zodResolver(brandQuizFormSchema),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ title: '' });
    }
  }, [form, isOpen]);

  const onSubmit = async (data: BrandQuizFormValues) => {
    if (!brandId) {
        toast({ title: "Error", description: "Brand information is missing.", variant: "destructive"});
        return;
    }
    setIsSaving(true);
    try {
      const quizPayload: BrandQuizFormData = { 
        title: data.title, 
        brandId, 
        translations: {} 
      };

      const savedQuiz = await createBrandQuiz(brandId, quizPayload);

      if (savedQuiz) {
        toast({
          title: 'Quiz Created',
          description: `Quiz "${savedQuiz.title}" has been successfully saved. You can now add questions to it.`,
        });
        onQuizSaved(savedQuiz);
        handleClose();
      } else {
        throw new Error('Failed to save quiz.');
      }
    } catch (error: any) {
      toast({
        title: 'Error Saving Quiz',
        description: error.message || 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Quiz</DialogTitle>
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
                    <Input placeholder="e.g., Product Knowledge Check" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Quiz
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
