

'use client';

import React, { useEffect, useState } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz, BrandQuizFormData, QuizTranslation } from '@/types/course';
import { createBrandQuiz, updateBrandQuiz } from '@/lib/brand-content-data';
import { Loader2 } from 'lucide-react';
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

const brandQuizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
  translations: z.record(quizTranslationSchema).optional(),
});

type BrandQuizFormValues = z.infer<typeof brandQuizFormSchema>;

interface AddEditBrandQuizDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  brandId: string;
  initialData: BrandQuiz | null;
  onQuizSaved: (quiz: BrandQuiz) => void;
}

export function AddEditBrandQuizDialog({
  isOpen,
  setIsOpen,
  brandId,
  initialData,
  onQuizSaved,
}: AddEditBrandQuizDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<BrandQuizFormValues>({
    resolver: zodResolver(brandQuizFormSchema),
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
          translations: (initialData.translations as any) || {},
        });
      } else {
        form.reset({ title: '', translations: {} });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: BrandQuizFormValues) => {
    if (!brandId) {
        toast({ title: "Error", description: "Brand information is missing.", variant: "destructive"});
        return;
    }
    setIsSaving(true);
    try {
      let savedQuiz: BrandQuiz | null = null;
      const quizPayload: BrandQuizFormData = { 
        title: data.title, 
        brandId, 
        translations: data.translations 
      };

      if (isEditing && initialData) {
        savedQuiz = await updateBrandQuiz(initialData.id, quizPayload);
      } else {
        savedQuiz = await createBrandQuiz(brandId, quizPayload);
      }

      if (savedQuiz) {
        toast({
          title: isEditing ? 'Quiz Updated' : 'Quiz Created',
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
          <DialogTitle>{isEditing ? 'Edit My Quiz' : 'Add Quiz'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this quiz.' : 'Enter the details for the new quiz.'}
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
                            <Input placeholder="e.g., Product Knowledge Check" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </TabsContent>
                <TabsContent value="translations" className="pt-4 space-y-4">
                    <Alert variant="default" className="text-sm">
                        <AlertDescription>
                            Provide translations for the quiz title. If a translation is not provided, the English title will be used as a fallback.
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
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Quiz'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
