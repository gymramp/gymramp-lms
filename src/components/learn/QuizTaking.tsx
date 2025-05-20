
'use client';

import React, { useState, useEffect } from 'react';
import type { Quiz, Question, QuestionType } from '@/types/course';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface QuizTakingProps {
  quiz: Quiz;
  onComplete: (quizId: string, score: number, passed: boolean) => void;
  isCompleted?: boolean;
}

export function QuizTaking({ quiz, onComplete, isCompleted = false }: QuizTakingProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | string[]>>({}); // Can be string or array
  const [selectedRadioAnswer, setSelectedRadioAnswer] = useState<string | undefined>(undefined);
  const [selectedCheckboxAnswers, setSelectedCheckboxAnswers] = useState<string[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(isCompleted);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [incorrectQuestionNumbers, setIncorrectQuestionNumbers] = useState<number[]>([]);

  const totalQuestions = quiz.questions?.length || 0;
  const currentQuestion = totalQuestions > 0 ? quiz.questions[currentQuestionIndex] : null;

  useEffect(() => {
    if (isCompleted && totalQuestions > 0) {
      setScore(100);
      setPassed(true);
      setQuizSubmitted(true);
      setIncorrectQuestionNumbers([]);
    } else if (!isCompleted) {
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setSelectedRadioAnswer(undefined);
      setSelectedCheckboxAnswers([]);
      setQuizSubmitted(false);
      setScore(0);
      setPassed(false);
      setIncorrectQuestionNumbers([]);
    }
  }, [isCompleted, quiz, totalQuestions]);

  // Reset selections when question changes
  useEffect(() => {
    setSelectedRadioAnswer(undefined);
    setSelectedCheckboxAnswers([]);
  }, [currentQuestionIndex]);


  const handleRadioAnswerSelect = (value: string) => {
    if (quizSubmitted) return;
    setSelectedRadioAnswer(value);
  };

  const handleCheckboxAnswerChange = (optionValue: string, checked: boolean) => {
    if (quizSubmitted) return;
    setSelectedCheckboxAnswers(prev =>
      checked ? [...prev, optionValue] : prev.filter(val => val !== optionValue)
    );
  };

  const recordCurrentAnswer = () => {
    if (!currentQuestion || quizSubmitted) return {};

    let answerToStore: string | string[];
    if (currentQuestion.type === 'multiple-select') {
      answerToStore = [...selectedCheckboxAnswers].sort(); // Store sorted for consistent comparison
    } else {
      answerToStore = selectedRadioAnswer || ""; // Store empty string if undefined
    }

    return {
      ...userAnswers,
      [currentQuestion.id]: answerToStore,
    };
  };

  const handleNextQuestion = () => {
    const updatedAnswers = recordCurrentAnswer();
    setUserAnswers(updatedAnswers);

    // Reset selections for the next question is handled by useEffect on currentQuestionIndex change
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handleSubmitQuiz = () => {
    const finalAnswers = recordCurrentAnswer();
    setUserAnswers(finalAnswers);

    let correctCount = 0;
    const incorrectNumbers: number[] = [];
    quiz.questions?.forEach((q, index) => {
      const userAnswer = finalAnswers[q.id];
      let isCorrect = false;
      if (q.type === 'multiple-select') {
        const userAnsArray = Array.isArray(userAnswer) ? userAnswer.sort() : [];
        const correctAnsArray = (q.correctAnswers || []).sort();
        isCorrect = userAnsArray.length === correctAnsArray.length &&
                    userAnsArray.every((val, idx) => val === correctAnsArray[idx]);
      } else {
        isCorrect = userAnswer === q.correctAnswer;
      }

      if (isCorrect) {
        correctCount++;
      } else {
        incorrectNumbers.push(index + 1);
      }
    });

    const calculatedScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 100;
    const didPass = correctCount === totalQuestions; // Requires 100% for now

    setScore(calculatedScore);
    setPassed(didPass);
    setIncorrectQuestionNumbers(didPass ? [] : incorrectNumbers);
    setQuizSubmitted(true);
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedRadioAnswer(undefined);
    setSelectedCheckboxAnswers([]);
    setQuizSubmitted(false);
    setScore(0);
    setPassed(false);
    setIncorrectQuestionNumbers([]);
  };

  const handleContinue = () => {
    onComplete(quiz.id, score, passed);
  };

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
    let incorrectMessagePart = "";
    if (!passed && incorrectQuestionNumbers.length > 0) {
      incorrectMessagePart = ` You answered the following questions incorrectly: ${incorrectQuestionNumbers.map(n => `#${n}`).join(', ')}.`;
    }

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
                Your score: {score}%.{incorrectMessagePart} You must score 100% to pass. Please review the material and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {passed ? (
            <Button onClick={handleContinue}>Continue Course</Button>
          ) : (
            <Button onClick={handleRetry} variant="outline" disabled={isCompleted}>Retry Quiz</Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  if (!currentQuestion) {
    return <p>Loading question...</p>;
  }

  const progressValue = totalQuestions > 0 ? Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100) : 0;

  const isCurrentQuestionAnswered = currentQuestion.type === 'multiple-select'
    ? selectedCheckboxAnswers.length > 0 // Or based on your specific requirement for "answered"
    : !!selectedRadioAnswer;

  return (
    <Card className="my-6 shadow-lg">
      <CardHeader>
        <CardTitle>Quiz: {quiz.title}</CardTitle>
        <CardDescription>
          Question {currentQuestionIndex + 1} of {totalQuestions}
          {currentQuestion.type === 'multiple-select' && <span className="text-xs text-muted-foreground ml-2">(Select all that apply)</span>}
        </CardDescription>
        <Progress value={progressValue} aria-label={`Quiz progress ${progressValue}%`} className="mt-2 h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg font-medium">{currentQuestion.text}</p>

        {currentQuestion.type === 'multiple-select' ? (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 rounded-md border border-input p-3 hover:bg-muted/50 transition-colors has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                <Checkbox
                  id={`${currentQuestion.id}-option-${index}`}
                  checked={selectedCheckboxAnswers.includes(option)}
                  onCheckedChange={(checked) => handleCheckboxAnswerChange(option, !!checked)}
                  disabled={quizSubmitted}
                />
                <Label htmlFor={`${currentQuestion.id}-option-${index}`} className="font-normal flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        ) : (
          <RadioGroup
            onValueChange={handleRadioAnswerSelect}
            value={selectedRadioAnswer}
            className="space-y-3"
            disabled={quizSubmitted}
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
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button onClick={handleNextQuestion} disabled={!isCurrentQuestionAnswered || quizSubmitted}>
            Next Question
          </Button>
        ) : (
          <Button onClick={handleSubmitQuiz} disabled={!isCurrentQuestionAnswered || quizSubmitted}>
            Submit Quiz
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
