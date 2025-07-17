

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
import type { Quiz, QuizFormData, QuizTranslation } from '@/types/course';
import { createQuiz, updateQuiz } from '@/lib/firestore-data'; // Use standalone quiz functions
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from '@/components/ui/alert';

const SUPPORTED_LOCALES = [
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
];

const quizTranslationSchema = z.object({
  title: z.string().optional(),
});

const quizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
  translations: z.record(quizTranslationSchema).optional(),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

interface AddEditQuizDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Quiz | null;
  onQuizSaved: (quiz: Quiz) => void;
}

export function AddEditQuizDialog({
  isOpen,
  setIsOpen,
  initialData,
  onQuizSaved,
}: AddEditQuizDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      title: '',
      translations: {},
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          title: initialData.title,
          translations: (initialData.translations as any) || {}, // Cast to handle potential type mismatch
        });
      } else {
        form.reset({ title: '', translations: {} });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: QuizFormValues) => {
    try {
      let savedQuiz: Quiz | null = null;
      const quizData: QuizFormData = {
        title: data.title,
        translations: data.translations,
      };

      if (isEditing && initialData) {
        savedQuiz = await updateQuiz(initialData.id, quizData);
      } else {
        savedQuiz = await createQuiz(quizData);
      }

       if (savedQuiz) {
          toast({
            title: isEditing ? 'Quiz Updated' : 'Quiz Created',
            description: `Quiz "${savedQuiz.title}" has been successfully saved. Add questions separately.`,
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
          <DialogTitle>{isEditing ? 'Edit Quiz' : 'Add Quiz'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this quiz.' : 'Enter the details for the new quiz. Questions are managed separately.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <Tabs defaultValue="main">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="main">Main Content</TabsTrigger>
                    <TabsTrigger value="translations">Translations</TabsTrigger>
                </TabsList>
                <TabsContent value="main" className="pt-4">
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
                </TabsContent>
                <TabsContent value="translations" className="pt-4 space-y-4">
                    <Alert variant="default" className="text-sm">
                        <AlertDescription>
                            Provide translations for the quiz title. If a translation is not provided, the English title will be used as a fallback. Question translations are managed on the question edit page.
                        </AlertDescription>
                    </Alert>
                     {SUPPORTED_LOCALES.map(locale => (
                         <FormField
                            key={locale.value}
                            control={form.control}
                            name={`translations.${locale.value}.title`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title ({locale.label})</FormLabel>
                                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                     ))}
                </TabsContent>
             </Tabs>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {isEditing ? 'Save Changes' : 'Create Quiz'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
