
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, PlusCircle, Edit, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Quiz, Question } from '@/types/course';
import { getQuizById, deleteQuestion, addQuestionToQuiz, updateQuestion } from '@/lib/firestore-data';
import { AddEditQuestionDialog } from '@/components/admin/AddEditQuestionDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

export default function ManageQuizQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);


  const fetchQuizAndQuestions = useCallback(async () => {
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
      setQuestions(fetchedQuiz.questions || []); 

    } catch (error) {
      console.error("Error fetching quiz/questions:", error);
      toast({ title: "Error", description: "Could not load quiz data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [quizId, router, toast]);

  useEffect(() => {
    fetchQuizAndQuestions();
  }, [fetchQuizAndQuestions]);


  const handleAddQuestionClick = () => {
    setEditingQuestion(null);
    setIsQuestionDialogOpen(true);
  };

  const handleEditQuestionClick = (question: Question) => {
    setEditingQuestion(question);
    setIsQuestionDialogOpen(true);
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
        setQuestions(prev => prev.filter(q => q.id !== questionToDelete.id));
        toast({
            title: 'Question Deleted',
            description: `Question deleted successfully.`,
        });
      } else {
        throw new Error('API returned false on delete');
      }
    } catch (error) {
      console.error("Failed to delete question:", error);
      toast({
          title: 'Error',
          description: `Failed to delete question.`,
          variant: 'destructive',
      });
    } finally {
        setIsDeleteDialogOpen(false);
        setQuestionToDelete(null);
    }
  };

   const handleQuestionSaved = (savedQuestion: Question) => {
        fetchQuizAndQuestions(); 
        setIsQuestionDialogOpen(false);
        setEditingQuestion(null);
   };

  if (isLoading) {
    return <div className="container mx-auto text-center">Loading quiz questions...</div>;
  }

  if (!quiz) {
      return <div className="container mx-auto text-center">Quiz not found.</div>;
  }

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/admin/quizzes')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quiz Library
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{quiz.title}</h1>
          <p className="text-muted-foreground">Manage Quiz Questions</p>
        </div>
         <Button onClick={handleAddQuestionClick} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Question
         </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            Questions ({questions.length})
          </CardTitle>
          <CardDescription>Add, edit, or remove questions for this quiz.</CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No questions added to this quiz yet.</div>
          ) : (
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Question Text</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Options</TableHead>
                        <TableHead>Correct Answer(s)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {questions.map((question, index) => (
                        <TableRow key={question.id || index}>
                             <TableCell className="font-medium max-w-sm truncate">{question.text}</TableCell>
                             <TableCell>
                                <Badge variant="outline" className="capitalize">{question.type.replace('-', ' ')}</Badge>
                             </TableCell>
                             <TableCell className="text-sm text-muted-foreground">
                                <ul className="list-disc list-inside">
                                    {question.options.map((opt, i) => <li key={i}>{opt}</li>)}
                                </ul>
                             </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit whitespace-normal">
                                   <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                                    <span className="break-all">
                                      {question.type === 'multiple-select' 
                                        ? (question.correctAnswers || []).join(', ') 
                                        : question.correctAnswer
                                      }
                                    </span>
                                </Badge>
                            </TableCell>
                             <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditQuestionClick(question)}
                                    className="mr-1"
                                >
                                    <Edit className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => openDeleteConfirmation(question)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                                </Button>
                             </TableCell>
                         </TableRow>
                    ))}
                 </TableBody>
             </Table>
          )}
        </CardContent>
      </Card>

       <AddEditQuestionDialog
            isOpen={isQuestionDialogOpen}
            setIsOpen={setIsQuestionDialogOpen}
            quizId={quizId}
            initialData={editingQuestion}
            onQuestionSaved={handleQuestionSaved}
       />

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the question: "{questionToDelete?.text.substring(0, 50)}...".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteQuestion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, delete question
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}

    