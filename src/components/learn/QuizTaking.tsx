
'use client';

import React, { useState, useEffect } from 'react';
import type { Quiz, Question, QuestionType } from '@/types/course';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress'; // Import Progress

interface QuizTakingProps {
  quiz: Quiz;
  onComplete: (quizId: string, score: number, passed: boolean) => void; // Callback with quiz ID, score, and pass status
  isCompleted?: boolean; // Optional: Indicates if the quiz is already completed for the user
}

export function QuizTaking({ quiz, onComplete, isCompleted = false }: QuizTakingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // Store answers keyed by question ID
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(undefined);
  const [quizSubmitted, setQuizSubmitted] = useState(isCompleted); // Initialize as submitted if already completed
  const [score, setScore] = useState(0); // Will be recalculated if submitted initially
  const [passed, setPassed] = useState(false); // Will be recalculated if submitted initially

  const totalQuestions = quiz.questions?.length || 0; // Handle cases where questions might be undefined
  const currentQuestion = totalQuestions > 0 ? quiz.questions[currentQuestionIndex] : null;


  // Recalculate score/passed status if quiz starts in completed state
  useEffect(() => {
    if (isCompleted && totalQuestions > 0) {
      // In a real scenario, you'd ideally fetch the user's previous answers/score.
      // For now, we'll assume 100% if marked complete externally.
      setScore(100);
      setPassed(true);
      setQuizSubmitted(true);
    } else if (!isCompleted) {
        // Reset if completion status changes back to false
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setSelectedAnswer(undefined);
        setQuizSubmitted(false);
        setScore(0);
        setPassed(false);
    }
  }, [isCompleted, quiz, totalQuestions]);


  const handleAnswerSelect = (value: string) => {
     if (quizSubmitted) return; // Don't allow changes after submission
    setSelectedAnswer(value);
  };

  const handleNextQuestion = () => {
    if (!selectedAnswer || !currentQuestion || quizSubmitted) return;

    // Store the selected answer
    const updatedAnswers = {
      ...userAnswers,
      [currentQuestion.id]: selectedAnswer,
    };
    setUserAnswers(updatedAnswers);

    // Move to the next question
    setSelectedAnswer(undefined); // Reset selection for the next question
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handleSubmitQuiz = () => {
    if (!selectedAnswer || !currentQuestion || quizSubmitted) return; // Need an answer for the last question or already submitted

     // Store the last answer
    const finalAnswers = {
      ...userAnswers,
      [currentQuestion.id]: selectedAnswer,
    };
    setUserAnswers(finalAnswers);

    // Grade the quiz
    let correctCount = 0;
    quiz.questions?.forEach((q) => { // Check if questions exist
      if (finalAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const calculatedScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 100; // Score 100 if no questions
    const didPass = correctCount === totalQuestions; // Require 100% for now

    setScore(calculatedScore);
    setPassed(didPass);
    setQuizSubmitted(true);

    // If passed, immediately notify parent (or wait for continue button?)
    // Let's notify parent via onComplete when "Continue" is clicked after passing.
  };

  const handleRetry = () => {
    // Reset state to retry the quiz
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedAnswer(undefined);
    setQuizSubmitted(false);
    setScore(0);
    setPassed(false);
  };

  const handleContinue = () => {
      // Notify parent component of completion status
      onComplete(quiz.id, score, passed);
  }

  // --- Render Logic ---

  if (totalQuestions === 0) {
    return (
        <Alert variant="default" className="my-6">
            <AlertCircle className="h-4 w-4" />
             <AlertTitle>Quiz Empty</AlertTitle>
             <AlertDescription>This quiz doesn't have any questions yet. Please proceed.</AlertDescription>
             <Button onClick={() => onComplete(quiz.id, 100, true)} className="mt-4">Continue Course</Button>
        </Alert>
    );
  }

  if (quizSubmitted) {
    return (
      <Card className="my-6">
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
          <CardDescription>You have completed the quiz: {quiz.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passed ? (
             <Alert variant="success" className="bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
               <AlertTitle className="text-green-800 dark:text-green-300">Quiz Passed!</AlertTitle>
               <AlertDescription className="text-green-700 dark:text-green-400">
                 {score > 0 ? `Your score: ${score}%` : 'Completed (No score calculated for empty quiz)'}
              </AlertDescription>
            </Alert>
          ) : (
             <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
               <AlertTitle>Quiz Failed</AlertTitle>
               <AlertDescription>
                Your score: {score}%. You must score 100% to pass. Please review the material and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {passed ? (
            <Button onClick={handleContinue}>Continue Course</Button>
          ) : (
             // Disable retry if quiz was marked completed externally (though score indicates fail)
            <Button onClick={handleRetry} variant="outline" disabled={isCompleted}>Retry Quiz</Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  if (!currentQuestion) {
      // Should not happen if totalQuestions > 0 and not submitted, but good safety check
      return <p>Loading question...</p>;
  }

  const progressValue = totalQuestions > 0 ? Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100) : 0;

  return (
    <Card className="my-6 shadow-lg">
      <CardHeader>
        <CardTitle>Quiz: {quiz.title}</CardTitle>
        <CardDescription>
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </CardDescription>
         <Progress value={progressValue} aria-label={`Quiz progress ${progressValue}%`} className="mt-2 h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg font-medium">{currentQuestion.text}</p>
        <RadioGroup
          onValueChange={handleAnswerSelect}
          value={selectedAnswer}
          className="space-y-3"
           disabled={quizSubmitted} // Disable selections after submit
        >
          {currentQuestion.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-3 rounded-md border border-input p-3 hover:bg-muted/50 transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
              <RadioGroupItem value={option} id={`${currentQuestion.id}-option-${index}`} disabled={quizSubmitted} />
              <Label htmlFor={`${currentQuestion.id}-option-${index}`} className="font-normal flex-1 cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter className="flex justify-end">
        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button onClick={handleNextQuestion} disabled={!selectedAnswer || quizSubmitted}>
            Next Question
          </Button>
        ) : (
          <Button onClick={handleSubmitQuiz} disabled={!selectedAnswer || quizSubmitted}>
            Submit Quiz
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
