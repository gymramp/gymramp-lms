'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form'; // Import useFieldArray
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
import { CheckCircle, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addQuestionToQuiz, updateQuestion } from '@/lib/firestore-data';

// Zod schema using discriminated union for question types
const baseSchema = z.object({
  text: z.string().min(5, { message: 'Question text must be at least 5 characters.' }),
});

const multipleChoiceOptionSchema = z.object({
  text: z.string().min(1, "Option text cannot be empty.")
});

const multipleChoiceSchema = baseSchema.extend({
  type: z.literal('multiple-choice'),
  options: z.array(multipleChoiceOptionSchema)
    .min(2, "At least two options are required."),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer.' }),
});

const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
  // Keep options for form structure consistency, though not used by true-false logic directly
  options: z.array(multipleChoiceOptionSchema).optional(),
});

const questionFormSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  trueFalseSchema,
])
.refine(data => {
    if (data.type === 'multiple-choice') {
        const providedOptions = data.options.map(opt => opt.text.trim()).filter(Boolean);
        const uniqueOptions = new Set(providedOptions);
        return providedOptions.length === uniqueOptions.size;
    }
    return true;
}, {
    message: "Multiple choice options must be unique.",
    path: ["options"],
})
.refine(data => {
    if (data.type === 'multiple-choice') {
        const providedOptionTexts = data.options.map(opt => opt.text.trim()).filter(Boolean);
        return data.correctAnswer && providedOptionTexts.includes(data.correctAnswer);
    }
    return true;
}, {
    message: "Correct answer must be selected and match one of the filled-in options.",
    path: ["correctAnswer"],
});

type QuestionFormValues = z.infer<typeof questionFormSchema>;

interface AddEditQuestionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  quizId: string;
  initialData: Question | null;
  onQuestionSaved: (question: Question) => void;
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
      type: 'multiple-choice',
      text: '',
      options: [{ text: '' }, { text: '' }], // Default to two empty options for MC
      correctAnswer: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options" as any, // Type assertion needed for discriminated union
  });

  const questionType = form.watch('type');
  const watchedOptions = form.watch('options' as any) || [];

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          type: initialData.type,
          text: initialData.text,
          options: initialData.type === 'multiple-choice'
            ? initialData.options.map(opt => ({ text: opt }))
            : [{ text: 'True' }, { text: 'False' }], // Or keep current options for TF if any
          correctAnswer: initialData.correctAnswer,
        });
      } else {
        form.reset({
          type: 'multiple-choice',
          text: '',
          options: [{ text: '' }, { text: '' }],
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
        optionsForStorage = data.options.map(opt => opt.text.trim()).filter(Boolean);
      } else if (data.type === 'true-false') {
        optionsForStorage = ["True", "False"];
      }

      const finalQuestionPayload = {
        type: data.type,
        text: data.text,
        options: optionsForStorage,
        correctAnswer: data.correctAnswer,
      };

      if (isEditing && initialData) {
        savedQuestion = await updateQuestion(quizId, initialData.id, finalQuestionPayload);
      } else {
        savedQuestion = await addQuestionToQuiz(quizId, finalQuestionPayload);
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

  const currentOptionsForRadio = questionType === 'multiple-choice'
    ? watchedOptions.map((opt: { text: string }) => opt.text.trim()).filter(Boolean)
    : ["True", "False"];

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
                        if (value === 'multiple-choice') {
                          form.setValue('options' as any, [{ text: '' }, { text: '' }]);
                        } else {
                          form.setValue('options' as any, []); // Clear options for true/false
                        }
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
              <div className="space-y-3">
                <FormLabel>Answer Options</FormLabel>
                {fields.map((item, index) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={`options.${index}.text` as any}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input placeholder={`Option ${index + 1}`} {...field} />
                          </FormControl>
                          {fields.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive hover:bg-destructive/10"
                              aria-label="Remove option"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ text: '' })}
                  className="mt-2"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                </Button>
                {form.formState.errors.options && !form.formState.errors.options.root && form.formState.errors.options.message && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.options.message}</p>
                )}
                 {Array.isArray(form.formState.errors.options) && form.formState.errors.options.map((error, index) => (
                    error && error.text && <p key={index} className="text-sm font-medium text-destructive">{error.text.message}</p>
                ))}


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
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {currentOptionsForRadio.map((optionValue, index) => (
                        <FormItem key={`${questionType}-correct-${index}-${optionValue}`} className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem
                              value={optionValue}
                              id={`${field.name}-${questionType}-${index}`}
                            />
                          </FormControl>
                          <FormLabel htmlFor={`${field.name}-${questionType}-${index}`} className="font-normal">
                            {optionValue}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  {questionType === 'multiple-choice' && currentOptionsForRadio.length < 2 && (
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
                disabled={questionType === 'multiple-choice' && currentOptionsForRadio.length < 2}
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
