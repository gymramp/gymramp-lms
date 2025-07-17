
'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, PlusCircle, Edit, Trash2, CheckCircle, Loader2, HelpCircle, Save, Layers, ListChecks, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Quiz, Question, QuizFormData, QuizTranslation } from '@/types/course';
import { getQuizById, deleteQuestion, updateQuiz } from '@/lib/firestore-data';
import { AddEditQuestionDialog } from '@/components/admin/AddEditQuestionDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { translateContent } from '@/ai/flows/translate-content';

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
  title: z.string().optional().or(z.literal('')),
});

const editQuizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
  translations: z.record(quizTranslationSchema).optional(),
});

type EditQuizFormValues = z.infer<typeof editQuizFormSchema>;

export default function ManageQuizQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const form = useForm<EditQuizFormValues>({
    resolver: zodResolver(editQuizFormSchema),
    defaultValues: { title: '', translations: {} },
  });

  const fetchQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!quizId) throw new Error("Quiz ID missing");
      const fetchedQuiz = await getQuizById(quizId);
      if (!fetchedQuiz) {
        toast({ title: "Error", description: "Quiz not found.", variant: "destructive" });
        router.push('/admin/quizzes');
        return;
      }
      setQuiz(fetchedQuiz);
      form.reset({
        title: fetchedQuiz.title,
        translations: (fetchedQuiz.translations as any) || {},
      });
    } catch (error) {
      toast({ title: "Error", description: "Could not load quiz data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [quizId, router, toast, form]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const onTitleSubmit = async (data: EditQuizFormValues) => {
    setIsSaving(true);
    try {
      const updatedQuiz = await updateQuiz(quizId, {
        title: data.title,
        translations: data.translations,
      });
      if (updatedQuiz) {
        setQuiz(updatedQuiz);
        toast({ title: "Quiz Updated", description: "The quiz details have been saved." });
      } else {
        throw new Error("Failed to update quiz");
      }
    } catch (error: any) {
      toast({ title: "Error Saving Quiz", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAutoTranslate = async (targetLocale: string) => {
    const { title } = form.getValues();
    if (!title) {
      toast({
        title: "Missing Title",
        description: "Please fill in the main English title before translating.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(prev => ({ ...prev, [targetLocale]: true }));
    try {
      // For quiz titles, we only need to translate the title. We pass an empty string for content.
      const result = await translateContent({
        sourceTitle: title,
        sourceContent: 'title only', // Placeholder as content is not needed
        targetLocale: targetLocale
      });

      if (result.translatedTitle) {
        form.setValue(`translations.${targetLocale}.title`, result.translatedTitle);
        toast({
          title: "Translation Complete!",
          description: `Title has been translated to ${SUPPORTED_LOCALES.find(l => l.value === targetLocale)?.label}.`,
        });
      } else {
        throw new Error("AI did not return a translated title.");
      }
    } catch (error: any) {
      toast({
        title: "Translation Failed",
        description: error.message || "Could not translate content.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(prev => ({ ...prev, [targetLocale]: false }));
    }
  };

  const openDeleteConfirmation = (question: Question) => {
    setQuestionToDelete(question);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!quizId || !questionToDelete) return;
    try {
      const success = await deleteQuestion(quizId, questionToDelete.id);
      if (success) {
        fetchQuiz(); // Re-fetch quiz to update question list
        toast({ title: 'Question Deleted', description: `Question deleted successfully.` });
      } else {
        throw new Error('API returned false on delete');
      }
    } catch (error) {
      toast({ title: 'Error', description: `Failed to delete question.`, variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setQuestionToDelete(null);
    }
  };

  if (isLoading || !quiz) {
    return <div className="container mx-auto p-6 text-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/admin/quizzes')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quiz Library
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onTitleSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl"><HelpCircle className="h-6 w-6"/> Edit Quiz</CardTitle>
              <CardDescription>Manage the quiz title, translations, and its questions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="main">
                <TabsList>
                  <TabsTrigger value="main">Main Content</TabsTrigger>
                  <TabsTrigger value="translations">Translations</TabsTrigger>
                </TabsList>
                <TabsContent value="main" className="pt-6">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiz Title (English)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </TabsContent>
                <TabsContent value="translations" className="pt-6 space-y-4">
                  <Alert variant="default" className="text-sm">
                    <AlertDescription>Provide translations for the quiz title.</AlertDescription>
                  </Alert>
                  {SUPPORTED_LOCALES.map(locale => (
                    <div key={locale.value} className="p-4 border rounded-md space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-lg">{locale.label}</h3>
                           <Button type="button" variant="outline" size="sm" onClick={() => handleAutoTranslate(locale.value)} disabled={isTranslating[locale.value]}>
                              {isTranslating[locale.value] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                              Auto-Translate Title
                          </Button>
                      </div>
                      <FormField control={form.control} name={`translations.${locale.value}.title`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title ({locale.label})</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Title & Translations
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/> Questions ({quiz.questions.length})</CardTitle>
            <CardDescription>Add, edit, or remove questions for this quiz.</CardDescription>
          </div>
          <Button onClick={() => setIsAddQuestionDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </CardHeader>
        <CardContent>
          {quiz.questions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No questions added yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Question Text</TableHead><TableHead>Type</TableHead><TableHead>Correct Answer(s)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {quiz.questions.map((q, idx) => (
                  <TableRow key={q.id || idx}>
                    <TableCell className="font-medium max-w-md truncate">{q.text}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{q.type.replace('-', ' ')}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="flex items-center gap-1 w-fit whitespace-normal"><CheckCircle className="h-3 w-3 text-green-600"/> <span className="break-all">{q.type === 'multiple-select' ? (q.correctAnswers || []).join(', ') : q.correctAnswer}</span></Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="mr-1"><Link href={`/admin/quizzes/manage/${quizId}/${q.id}/edit`}><Edit className="h-4 w-4 mr-1"/> Edit</Link></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirmation(q)}><Trash2 className="h-4 w-4 mr-1"/> Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditQuestionDialog
        isOpen={isAddQuestionDialogOpen}
        setIsOpen={setIsAddQuestionDialogOpen}
        quizId={quizId}
        initialData={null}
        onQuestionSaved={fetchQuiz}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the question: "{questionToDelete?.text.substring(0, 50)}...".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteQuestion} className="bg-destructive hover:bg-destructive/90">Yes, delete question</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
