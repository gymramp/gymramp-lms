
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, PlusCircle, Edit, Trash2, CheckCircle, Loader2, HelpCircle, Save, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz, BrandQuestion, User, Company, QuizTranslation } from '@/types/course';
import { getBrandQuizById, deleteBrandQuestionFromBrandQuiz, updateBrandQuiz } from '@/lib/brand-content-data';
import { AddEditBrandQuestionDialog } from '@/components/brand-admin/AddEditBrandQuestionDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert } from '@/components/ui/alert';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';

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

const editBrandQuizFormSchema = z.object({
  title: z.string().min(3, { message: 'Quiz title must be at least 3 characters.' }),
  translations: z.record(quizTranslationSchema).optional(),
});

type EditBrandQuizFormValues = z.infer<typeof editBrandQuizFormSchema>;

export default function ManageBrandQuizQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const brandQuizId = params.brandQuizId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [quiz, setQuiz] = useState<BrandQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<BrandQuestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<EditBrandQuizFormValues>({
    resolver: zodResolver(editBrandQuizFormSchema),
    defaultValues: { title: '', translations: {} },
  });

  const fetchQuizAndAuthorize = useCallback(async () => {
    setIsLoading(true);
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      router.push('/login'); return;
    }
    try {
      const userDetails = await getUserByEmail(firebaseUser.email);
      setCurrentUser(userDetails);
      if (!userDetails?.companyId) {
        throw new Error("User not associated with a brand.");
      }
      const brandDetails = await getCompanyById(userDetails.companyId);
      if (!brandDetails?.canManageCourses) {
        throw new Error("You do not have permission to manage brand content.");
      }
      setIsAuthorized(true);

      if (!brandQuizId) throw new Error("Quiz ID missing");
      const fetchedQuiz = await getBrandQuizById(brandQuizId);
      if (!fetchedQuiz || fetchedQuiz.brandId !== userDetails.companyId) {
        throw new Error("Quiz not found or you do not have permission to edit it.");
      }
      setQuiz(fetchedQuiz);
      form.reset({
        title: fetchedQuiz.title,
        translations: (fetchedQuiz.translations as any) || {},
      });

    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not load data.", variant: "destructive" });
      router.push('/brand-admin/quizzes');
    } finally {
      setIsLoading(false);
    }
  }, [brandQuizId, router, toast, form]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            fetchQuizAndAuthorize();
        } else {
            router.push('/login');
        }
    });
    return () => unsubscribe();
  }, [fetchQuizAndAuthorize, router]);

  const onTitleSubmit = async (data: EditBrandQuizFormValues) => {
    if (!isAuthorized) return;
    setIsSaving(true);
    try {
      const updatedQuiz = await updateBrandQuiz(brandQuizId, {
        title: data.title,
        translations: data.translations,
      });
      if (updatedQuiz) {
        setQuiz(prev => prev ? { ...prev, title: updatedQuiz.title, translations: updatedQuiz.translations } : null);
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

  const openDeleteConfirmation = (question: BrandQuestion) => {
    setQuestionToDelete(question);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!brandQuizId || !questionToDelete) return;
    try {
      await deleteBrandQuestionFromBrandQuiz(brandQuizId, questionToDelete.id);
      fetchQuizAndAuthorize(); // Re-fetch to update list
      toast({ title: 'Question Deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setQuestionToDelete(null);
    }
  };

  if (isLoading || !quiz || !currentUser) {
    return <div className="container mx-auto p-6 text-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/brand-admin/quizzes')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Quizzes
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onTitleSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><HelpCircle className="h-6 w-6"/> Edit My Quiz</CardTitle><CardDescription>Manage the quiz title, translations, and its questions.</CardDescription></CardHeader>
            <CardContent>
              <Tabs defaultValue="main">
                <TabsList><TabsTrigger value="main">Main Content</TabsTrigger><TabsTrigger value="translations">Translations</TabsTrigger></TabsList>
                <TabsContent value="main" className="pt-6"><FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Quiz Title (English)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /></TabsContent>
                <TabsContent value="translations" className="pt-6 space-y-4">
                  <Alert variant="default" className="text-sm"><AlertDescription>Provide translations for the quiz title.</AlertDescription></Alert>
                  {SUPPORTED_LOCALES.map(locale => (<FormField key={locale.value} control={form.control} name={`translations.${locale.value}.title`} render={({ field }) => (<FormItem><FormLabel>Title ({locale.label})</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />))}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter><Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Save Title</Button></CardFooter>
          </Card>
        </form>
      </Form>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/> Questions ({quiz.questions.length})</CardTitle><CardDescription>Add, edit, or remove questions for this quiz.</CardDescription></div>
          <Button onClick={() => setIsAddQuestionDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><PlusCircle className="mr-2 h-4 w-4"/> Add Question</Button>
        </CardHeader>
        <CardContent>
          {quiz.questions.length === 0 ? (<div className="text-center text-muted-foreground py-8">No questions added yet.</div>) : (
            <Table>
              <TableHeader><TableRow><TableHead>Question Text</TableHead><TableHead>Type</TableHead><TableHead>Correct Answer(s)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{quiz.questions.map((q, idx) => (<TableRow key={q.id || idx}><TableCell className="font-medium max-w-md truncate">{q.text}</TableCell><TableCell><Badge variant="outline" className="capitalize">{q.type.replace('-', ' ')}</Badge></TableCell><TableCell><Badge variant="secondary" className="flex items-center gap-1 w-fit whitespace-normal"><CheckCircle className="h-3 w-3 text-green-600"/> <span className="break-all">{q.type === 'multiple-select' ? (q.correctAnswers || []).join(', ') : q.correctAnswer}</span></Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild className="mr-1"><Link href={`/brand-admin/quizzes/manage/${brandQuizId}/${q.id}/edit`}><Edit className="h-4 w-4 mr-1"/> Edit</Link></Button><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirmation(q)}><Trash2 className="h-4 w-4 mr-1"/> Remove</Button></TableCell></TableRow>))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <AddEditBrandQuestionDialog isOpen={isAddQuestionDialogOpen} setIsOpen={setIsAddQuestionDialogOpen} brandQuizId={brandQuizId} initialData={null} onQuestionSaved={fetchQuizAndAuthorize} />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the question: "{questionToDelete?.text.substring(0, 50)}...".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteQuestion} className="bg-destructive hover:bg-destructive/90">Yes, delete question</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
