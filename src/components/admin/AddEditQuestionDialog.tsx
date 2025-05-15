
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
  option1: z.string().min(1, { message: 'Option 1 cannot be empty.' }),
  option2: z.string().min(1, { message: 'Option 2 cannot be empty.' }),
  option3: z.string().min(1, { message: 'Option 3 cannot be empty.' }),
  option4: z.string().min(1, { message: 'Option 4 cannot be empty.' }),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer.' }),
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
// Add a refinement to ensure the correctAnswer matches one of the options for multiple choice
.refine(data => {
    if (data.type === 'multiple-choice') {
        const options = [data.option1, data.option2, data.option3, data.option4];
        // Ensure correctAnswer exists and is included in the options
        return data.correctAnswer && options.includes(data.correctAnswer);
    }
    return true;
}, {
    message: "Correct answer must match one of the provided options.",
    path: ["correctAnswer"], // Apply the error to the correctAnswer field
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
      type: initialData?.type || 'multiple-choice', // Default to multiple-choice or existing type
      text: initialData?.text || '',
      option1: initialData?.type === 'multiple-choice' ? initialData?.options?.[0] || '' : '',
      option2: initialData?.type === 'multiple-choice' ? initialData?.options?.[1] || '' : '',
      option3: initialData?.type === 'multiple-choice' ? initialData?.options?.[2] || '' : '',
      option4: initialData?.type === 'multiple-choice' ? initialData?.options?.[3] || '' : '',
      correctAnswer: initialData?.correctAnswer || '',
    },
  });

  // Watch the type field to conditionally render inputs
  const questionType = form.watch('type');

  // Effect to populate form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      form.reset({
        type: initialData.type,
        text: initialData.text,
        // Populate options only if multiple choice
        option1: initialData.type === 'multiple-choice' ? initialData.options?.[0] || '' : '',
        option2: initialData.type === 'multiple-choice' ? initialData.options?.[1] || '' : '',
        option3: initialData.type === 'multiple-choice' ? initialData.options?.[2] || '' : '',
        option4: initialData.type === 'multiple-choice' ? initialData.options?.[3] || '' : '',
        correctAnswer: initialData.correctAnswer,
      });
    } else {
      // Reset with default type when adding new
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
  }, [initialData, form, isOpen]); // Rerun when dialog opens/closes or initialData changes

  const onSubmit = async (data: QuestionFormValues) => {
    try {

        let savedQuestion: Question | null = null;
        // Construct QuestionFormData based on type
        const questionData: QuestionFormData = {
            type: data.type,
            text: data.text,
            correctAnswer: data.correctAnswer,
            ...(data.type === 'multiple-choice' && {
                option1: data.option1,
                option2: data.option2,
                option3: data.option3,
                option4: data.option4,
            }),
            // For true/false, options are implicitly ["True", "False"] handled in firestore function
        };


        if (isEditing && initialData) {
            savedQuestion = await updateQuestion(quizId, initialData.id, questionData);
        } else {
             savedQuestion = await addQuestionToQuiz(quizId, questionData);
        }

        if (savedQuestion) {
            toast({
                title: isEditing ? 'Question Updated' : 'Question Added',
                description: `The question has been successfully saved.`,
            });
            onQuestionSaved(savedQuestion); // Call the callback
            handleClose(); // Close dialog
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

  // Handle closing the dialog
  const handleClose = () => {
    // Don't reset type here, let useEffect handle it based on initialData
    form.reset({
        type: initialData?.type || 'multiple-choice', // Keep type or default
        text: initialData?.text || '',
        option1: initialData?.type === 'multiple-choice' ? initialData?.options?.[0] || '' : '',
        option2: initialData?.type === 'multiple-choice' ? initialData?.options?.[1] || '' : '',
        option3: initialData?.type === 'multiple-choice' ? initialData?.options?.[2] || '' : '',
        option4: initialData?.type === 'multiple-choice' ? initialData?.options?.[3] || '' : '',
        correctAnswer: initialData?.correctAnswer || '',
    });
    setIsOpen(false);
  };

   // Get options from form for Multiple Choice RadioGroup
   // Ensure options are trimmed and only valid ones are included
   const watchedOption1 = form.watch('option1')?.trim();
   const watchedOption2 = form.watch('option2')?.trim();
   const watchedOption3 = form.watch('option3')?.trim();
   const watchedOption4 = form.watch('option4')?.trim();

   const mcOptions = [
      watchedOption1,
      watchedOption2,
      watchedOption3,
      watchedOption4,
   ].filter(opt => typeof opt === 'string' && opt.length > 0); // Filter out empty or undefined options

   const allMcOptionsFilled = watchedOption1 && watchedOption2 && watchedOption3 && watchedOption4;


  // Options for True/False
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
            {/* Question Type Selection */}
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
                          // Reset options and correctAnswer when switching types
                          form.setValue('option1', '');
                          form.setValue('option2', '');
                          form.setValue('option3', '');
                          form.setValue('option4', '');
                          form.setValue('correctAnswer', ''); // Reset correct answer
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

            {/* Question Text */}
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

             {/* Multiple Choice Options (Conditional) */}
             {questionType === 'multiple-choice' && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="option1" render={({ field }) => (
                        <FormItem><FormLabel>Option 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="option2" render={({ field }) => (
                        <FormItem><FormLabel>Option 2</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="option3" render={({ field }) => (
                        <FormItem><FormLabel>Option 3</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="option4" render={({ field }) => (
                        <FormItem><FormLabel>Option 4</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                 </div>
             )}

            {/* Correct Answer Selection */}
             <FormField
              control={form.control}
              name="correctAnswer"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Correct Answer</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => field.onChange(value)} // Use field.onChange provided by RHF
                      value={field.value || ''} // Controlled component: value is from RHF state, default to empty string
                      className="flex flex-col space-y-1"
                    >
                      {questionType === 'multiple-choice' ? (
                        // Directly map the watched option values for MC
                        [watchedOption1, watchedOption2, watchedOption3, watchedOption4].map((optionValue, index) => (
                           optionValue !== undefined ? ( // Render only if the corresponding input is filled (allow empty string)
                            <FormItem key={`mc-${index}-${optionValue || 'empty'}`} className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem
                                  value={optionValue || ''} // The value of this item IS the text from the input
                                  id={`${field.name}-mc-${index}`}
                                  // Disable if the option input is empty string or null/undefined
                                  disabled={!optionValue && optionValue !== ''}
                                />
                              </FormControl>
                              <FormLabel
                                htmlFor={`${field.name}-mc-${index}`}
                                className={cn("font-normal", (!optionValue && optionValue !== '') && "text-muted-foreground opacity-50")} // Style disabled label
                              >
                                {optionValue || `Option ${index + 1} (empty)`}
                              </FormLabel>
                            </FormItem>
                          ) : (
                             <FormItem key={`mc-empty-${index}`} className="flex items-center space-x-3 space-y-0 opacity-50">
                                <FormControl>
                                    <RadioGroupItem value={`empty-${index}`} id={`${field.name}-mc-empty-${index}`} disabled />
                                </FormControl>
                                <FormLabel htmlFor={`${field.name}-mc-empty-${index}`} className="font-normal text-muted-foreground">
                                    Option {index + 1} (empty)
                                </FormLabel>
                            </FormItem>
                          )
                        ))
                      ) : (
                        // Map the static True/False options
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
                  {/* Display warning if not all options are filled for MC */}
                  {questionType === 'multiple-choice' && !allMcOptionsFilled && (
                    <p className="text-xs font-medium text-yellow-600">Please fill all 4 options to select a correct answer.</p>
                  )}
                  <FormMessage /> {/* Shows Zod validation errors */}
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
                // Disable if MC and not all options are filled
                disabled={questionType === 'multiple-choice' && !allMcOptionsFilled}
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
