
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, PlusCircle, Edit, Trash2, CheckCircle, Loader2, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz, BrandQuestion, User, Company } from '@/types/course'; 
import { getBrandQuizById, deleteBrandQuestionFromBrandQuiz } from '@/lib/brand-content-data';
import { AddEditBrandQuestionDialog } from '@/components/brand-admin/AddEditBrandQuestionDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';


export default function ManageBrandQuizQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const brandQuizId = params.brandQuizId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBrand, setCurrentBrand] = useState<Company | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [quiz, setQuiz] = useState<BrandQuiz | null>(null);
  const [questions, setQuestions] = useState<BrandQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BrandQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<BrandQuestion | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (userDetails && (userDetails.role === 'Admin' || userDetails.role === 'Owner') && userDetails.companyId) {
            const brandDetails = await getCompanyById(userDetails.companyId);
            setCurrentBrand(brandDetails);
            setIsAuthorized(brandDetails?.canManageCourses || false);
            if (!brandDetails?.canManageCourses) {
                toast({ title: "Access Denied", variant: "destructive", description: "Your brand does not have course management enabled." }); router.push('/dashboard');
            }
          } else {
            setIsAuthorized(false); toast({ title: "Access Denied", variant: "destructive", description: "You do not have permission to manage brand quizzes." }); router.push('/');
          }
        } catch (error) {
          setIsAuthorized(false); toast({ title: "Error", variant: "destructive", description: "Could not verify your permissions." }); router.push('/');
        }
      } else {
        setCurrentUser(null); setCurrentBrand(null); setIsAuthorized(false); router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchQuizAndQuestions = useCallback(async () => {
    if (!isAuthorized || !brandQuizId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const fetchedQuiz = await getBrandQuizById(brandQuizId);
      if (!fetchedQuiz || fetchedQuiz.brandId !== currentUser?.companyId) {
        toast({ title: "Error", description: "Quiz not found or not owned by your brand.", variant: "destructive" });
        router.push('/brand-admin/quizzes'); return;
      }
      setQuiz(fetchedQuiz);
      setQuestions(fetchedQuiz.questions || []);
    } catch (error) {
      toast({ title: "Error", description: "Could not load quiz data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, brandQuizId, currentUser?.companyId, router, toast]);

  useEffect(() => { if (isAuthorized) fetchQuizAndQuestions(); }, [isAuthorized, fetchQuizAndQuestions]);

  const handleAddQuestionClick = () => { setEditingQuestion(null); setIsQuestionDialogOpen(true); };
  const handleEditQuestionClick = (question: BrandQuestion) => { setEditingQuestion(question); setIsQuestionDialogOpen(true); };
  const openDeleteConfirmation = (question: BrandQuestion) => { setQuestionToDelete(question); setIsDeleteDialogOpen(true); };

  const confirmDeleteQuestion = async () => {
    if (!brandQuizId || !questionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBrandQuestionFromBrandQuiz(brandQuizId, questionToDelete.id);
      fetchQuizAndQuestions();
      toast({ title: 'Question Deleted', description: `Question deleted successfully.` });
    } catch (error) {
      toast({ title: 'Error', description: `Failed to delete question.`, variant: 'destructive' });
    } finally {
      setIsDeleting(false); setIsDeleteDialogOpen(false); setQuestionToDelete(null);
    }
  };

  const handleQuestionSaved = (savedQuestion: BrandQuestion) => {
    fetchQuizAndQuestions(); setIsQuestionDialogOpen(false); setEditingQuestion(null);
  };

  if (!currentUser || !currentBrand || !isAuthorized) {
    return <div className="container mx-auto text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (isLoading) {
    return <div className="container text-center"><Skeleton className="h-10 w-1/2 mb-4"/><Skeleton className="h-64 w-full"/></div>;
  }
  if (!quiz) return <div className="container text-center">Quiz not found.</div>;

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/brand-admin/quizzes')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Quizzes
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2"><HelpCircle className="h-7 w-7"/>{quiz.title}</h1>
          <p className="text-muted-foreground">Manage Questions for My Quiz</p>
        </div>
        <Button onClick={handleAddQuestionClick} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Question
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Questions ({questions.length})</CardTitle><CardDescription>Add, edit, or remove questions.</CardDescription></CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No questions added yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Question Text</TableHead><TableHead>Type</TableHead><TableHead>Options</TableHead><TableHead>Correct Answer(s)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {questions.map((q, idx) => (
                  <TableRow key={q.id || idx}>
                    <TableCell className="font-medium max-w-sm truncate">{q.text}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{q.type.replace('-', ' ')}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground"><ul className="list-disc list-inside">{q.options.map((opt, i) => <li key={i}>{opt}</li>)}</ul></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit whitespace-normal">
                        <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="break-all">
                          {q.type === 'multiple-select' ? (q.correctAnswers || []).join(', ') : q.correctAnswer}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditQuestionClick(q)} className="mr-1"><Edit className="h-4 w-4 mr-1" /> Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirmation(q)} disabled={isDeleting && questionToDelete?.id === q.id}>
                         {isDeleting && questionToDelete?.id === q.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 mr-1" />} Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {currentBrand?.id && (
        <AddEditBrandQuestionDialog
          isOpen={isQuestionDialogOpen}
          setIsOpen={setIsQuestionDialogOpen}
          brandQuizId={brandQuizId}
          initialData={editingQuestion}
          onQuestionSaved={handleQuestionSaved}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the question: "{questionToDelete?.text.substring(0, 50)}...".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuestion} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
