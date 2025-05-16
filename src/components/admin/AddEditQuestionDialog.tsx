
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import type { Question, QuestionFormData, QuestionType } from '@/types/course';
import { CheckCircle } from 'lucide-react'; // Import CheckCircle
import { cn } from '@/lib/utils'; // Import cn
import { addQuestionToQuiz, updateQuestion } from '@/lib/firestore-data'; // Updated import

// Zod schema using discriminated union for question types
const baseSchema = z.object({
  text: z.string().min(5, { message: 'Question text must be at least 5 characters.' }),
});

const multipleChoiceSchema = baseSchema.extend({
  type: z.literal('multiple-choice'),
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional(),
  option4: z.string().optional(),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer.' }), // Keep this, refinement will check validity
});

const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
  // Optional fields for form compatibility, not strictly needed for validation here
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional(),
  option4: z.string().optional(),
});

const questionFormSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  trueFalseSchema,
])
.refine(data => { // Refinement for minimum options for multiple choice
    if (data.type === 'multiple-choice') {
        const providedOptions = [data.option1, data.option2, data.option3, data.option4]
            .filter(opt => typeof opt === 'string' && opt.trim() !== '');
        return providedOptions.length >= 2;
    }
    return true;
}, {
    message: "Multiple choice questions must have at least two filled-in options.",
    path: ["option1"], // Apply to a general field or the first option
})
.refine(data => { // Refinement for correct answer matching provided options
    if (data.type === 'multiple-choice') {
        const providedOptions = [data.option1, data.option2, data.option3, data.option4]
            .filter(opt => typeof opt === 'string' && opt.trim() !== '');
        // Correct answer must exist and be one of the *provided* (non-empty) options
        return data.correctAnswer && providedOptions.includes(data.correctAnswer);
    }
    return true;
}, {
    message: "Correct answer must be selected and match one of the filled-in options.",
    path: ["correctAnswer"],
});


// Derive the TS type from the Zod schema
type QuestionFormValues = z.infer<typeof questionFormSchema>;


interface AddEditQuestionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  quizId: string; // ID of the quiz this question belongs to
  initialData: Question | null; // Question data for editing, null for adding
  onQuestionSaved: (question: Question) => void; // Callback after save
}

export function AddEditQuestionDialog({
  isOpen,
  setIsOpen,
  quizId,
  initialData,
  onQuestionSaved,
}: AddEditQuestionDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: initialData?.type || 'multiple-choice',
      text: initialData?.text || '',
      option1: initialData?.type === 'multiple-choice' ? initialData?.options?.[0] || '' : '',
      option2: initialData?.type === 'multiple-choice' ? initialData?.options?.[1] || '' : '',
      option3: initialData?.type === 'multiple-choice' ? initialData?.options?.[2] || '' : '',
      option4: initialData?.type === 'multiple-choice' ? initialData?.options?.[3] || '' : '',
      correctAnswer: initialData?.correctAnswer || '',
    },
  });

  const questionType = form.watch('type');
  const watchedOption1 = form.watch('option1');
  const watchedOption2 = form.watch('option2');
  const watchedOption3 = form.watch('option3');
  const watchedOption4 = form.watch('option4');

  useEffect(() => {
    if (isOpen) { // Only reset when dialog opens
        if (initialData) {
          form.reset({
            type: initialData.type,
            text: initialData.text,
            option1: initialData.type === 'multiple-choice' ? initialData.options?.[0] || '' : '',
            option2: initialData.type === 'multiple-choice' ? initialData.options?.[1] || '' : '',
            option3: initialData.type === 'multiple-choice' ? initialData.options?.[2] || '' : '',
            option4: initialData.type === 'multiple-choice' ? initialData.options?.[3] || '' : '',
            correctAnswer: initialData.correctAnswer,
          });
        } else {
          form.reset({
              type: 'multiple-choice',
              text: '',
              option1: '',
              option2: '',
              option3: '',
              option4: '',
              correctAnswer: '',
          });
        }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: QuestionFormValues) => {
    try {
        let savedQuestion: Question | null = null;
        let optionsForStorage: string[] = [];

        if (data.type === 'multiple-choice') {
            optionsForStorage = [data.option1, data.option2, data.option3, data.option4]
                .map(opt => typeof opt === 'string' ? opt.trim() : '') // Trim and handle undefined
                .filter(opt => opt !== ''); // Filter out empty strings
        } else if (data.type === 'true-false') {
            optionsForStorage = ["True", "False"];
        }

        const questionData: QuestionFormData & { optionsForStorage?: string[] } = { // Temporary extend type for clarity if needed
            type: data.type,
            text: data.text,
            correctAnswer: data.correctAnswer,
            // These are for the schema but not directly used for storage array
            ...(data.type === 'multiple-choice' && {
                option1: data.option1,
                option2: data.option2,
                option3: data.option3,
                option4: data.option4,
            }),
        };
        
        // The actual data to be saved for Firestore (will use optionsForStorage for the 'options' field)
        const finalQuestionPayload = {
            type: data.type,
            text: data.text,
            options: optionsForStorage, // Use the filtered options
            correctAnswer: data.correctAnswer,
        };


        if (isEditing && initialData) {
            // Cast to any to satisfy updateQuestion's expected QuestionFormData,
            // but the actual logic in updateQuestion should construct the Question object properly
            savedQuestion = await updateQuestion(quizId, initialData.id, finalQuestionPayload as any);
        } else {
             savedQuestion = await addQuestionToQuiz(quizId, finalQuestionPayload as any);
        }

        if (savedQuestion) {
            toast({
                title: isEditing ? 'Question Updated' : 'Question Added',
                description: `The question has been successfully saved.`,
            });
            onQuestionSaved(savedQuestion);
            handleClose();
        } else {
             throw new Error("Failed to save question.");
        }
    } catch (error) {
        console.error("Failed to save question:", error);
        toast({
            title: 'Error Saving Question',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
            variant: 'destructive',
        });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

   const mcOptions = [
      watchedOption1,
      watchedOption2,
      watchedOption3,
      watchedOption4,
   ].filter(opt => typeof opt === 'string' && opt.trim() !== ''); // Filter out empty or undefined options

   const atLeastTwoMcOptionsFilled = mcOptions.length >= 2;

  const tfOptions = ["True", "False"];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Question' : 'Add New Question'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this question.' : 'Enter the details for the new question.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Question Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                          field.onChange(value as QuestionType);
                          form.setValue('option1', '');
                          form.setValue('option2', '');
                          form.setValue('option3', '');
                          form.setValue('option4', '');
                          form.setValue('correctAnswer', '');
                      }}
                      value={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="multiple-choice" />
                        </FormControl>
                        <FormLabel className="font-normal">Multiple Choice</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="true-false" />
                        </FormControl>
                        <FormLabel className="font-normal">True/False</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Enter the question text..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {questionType === 'multiple-choice' && (
                 <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="option1" render={({ field }) => (
                            <FormItem><FormLabel>Option 1</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="option2" render={({ field }) => (
                            <FormItem><FormLabel>Option 2</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="option3" render={({ field }) => (
                            <FormItem><FormLabel>Option 3 (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="option4" render={({ field }) => (
                            <FormItem><FormLabel>Option 4 (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                     </div>
                     {!atLeastTwoMcOptionsFilled && (
                        <p className="text-xs font-medium text-yellow-600">Please fill in at least two options for a multiple-choice question.</p>
                     )}
                 </div>
             )}

             <FormField
              control={form.control}
              name="correctAnswer"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Correct Answer</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value || ''}
                      className="flex flex-col space-y-1"
                    >
                      {questionType === 'multiple-choice' ? (
                        mcOptions.map((optionValue, index) => (
                           optionValue ? (
                            <FormItem key={`mc-${index}-${optionValue}`} className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem
                                  value={optionValue}
                                  id={`${field.name}-mc-${index}`}
                                />
                              </FormControl>
                              <FormLabel htmlFor={`${field.name}-mc-${index}`} className="font-normal">
                                {optionValue}
                              </FormLabel>
                            </FormItem>
                          ) : null // Don't render radio item for empty/undefined options
                        ))
                      ) : ( // True/False options
                        tfOptions.map((option, index) => (
                          <FormItem key={`tf-${index}-${option}`} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem
                                value={option}
                                id={`${field.name}-tf-${index}`}
                              />
                            </FormControl>
                            <FormLabel htmlFor={`${field.name}-tf-${index}`} className="font-normal">
                              {option}
                            </FormLabel>
                          </FormItem>
                        ))
                      )}
                    </RadioGroup>
                  </FormControl>
                  {questionType === 'multiple-choice' && !atLeastTwoMcOptionsFilled && (
                    <p className="text-xs font-medium text-muted-foreground">Fill at least two options above to select a correct answer.</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={questionType === 'multiple-choice' && !atLeastTwoMcOptionsFilled}
              >
                {isEditing ? 'Save Changes' : 'Add Question'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

