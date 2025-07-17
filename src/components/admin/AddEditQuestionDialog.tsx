
'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { PlusCircle, Trash2 } from 'lucide-react';
import { addQuestionToQuiz } from '@/lib/firestore-data';

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
    .min(2, "At least two options are required for multiple choice."),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer for multiple choice.' }),
  correctAnswers: z.array(z.string()).optional(), // Not used by this specific type
});

const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  options: z.array(multipleChoiceOptionSchema).optional(), // Not used by this specific type, but kept for schema consistency
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
  correctAnswers: z.array(z.string()).optional(), // Not used by this specific type
});

const multipleSelectSchema = baseSchema.extend({
  type: z.literal('multiple-select'),
  options: z.array(multipleChoiceOptionSchema)
    .min(2, "At least two options are required for multiple select."),
  correctAnswer: z.string().optional(), // Not used by this specific type
  correctAnswers: z.array(z.string()).min(1, { message: "At least one correct answer must be selected for multiple select."}),
});

const questionFormSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  trueFalseSchema,
  multipleSelectSchema,
])
.refine(data => { // Uniqueness for options in MC and MS
    if (data.type === 'multiple-choice' || data.type === 'multiple-select') {
        const providedOptions = data.options.map(opt => opt.text.trim()).filter(Boolean);
        const uniqueOptions = new Set(providedOptions);
        return providedOptions.length === uniqueOptions.size;
    }
    return true;
}, {
    message: "Answer options must be unique.",
    path: ["options"],
})
.refine(data => { // Correct answer(s) must be among provided options
    if (data.type === 'multiple-choice') {
        const providedOptionTexts = data.options.map(opt => opt.text.trim()).filter(Boolean);
        return data.correctAnswer && providedOptionTexts.includes(data.correctAnswer);
    }
    if (data.type === 'multiple-select') {
        const providedOptionTexts = data.options.map(opt => opt.text.trim()).filter(Boolean);
        return data.correctAnswers && data.correctAnswers.every(ca => providedOptionTexts.includes(ca));
    }
    return true;
}, {
    message: "Correct answer(s) must be selected from the provided options.",
    path: ["correctAnswer"], // This path might need adjustment for multiple-select if error shows on wrong field
});


type QuestionFormValues = z.infer<typeof questionFormSchema>;

interface AddEditQuestionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  quizId: string;
  initialData: Question | null; // This will now always be null for adding
  onQuestionSaved: (question: Question) => void;
}

export function AddEditQuestionDialog({
  isOpen,
  setIsOpen,
  quizId,
  initialData, // Kept for prop consistency, but logic will treat it as 'add only'
  onQuestionSaved,
}: AddEditQuestionDialogProps) {
  const isEditing = false; // This dialog is now only for adding
  const { toast } = useToast();

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: 'multiple-choice',
      text: '',
      options: [{ text: '' }, { text: '' }],
      correctAnswer: '',
      correctAnswers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options" as any,
  });

  const questionType = form.watch('type');
  const watchedOptions = form.watch('options' as any) || [];

  useEffect(() => {
    if (isOpen) {
      form.reset({
        type: 'multiple-choice',
        text: '',
        options: [{ text: '' }, { text: '' }],
        correctAnswer: '',
        correctAnswers: [],
      });
    }
  }, [form, isOpen]);

  const onSubmit = async (data: QuestionFormValues) => {
    try {
      let optionsForStorage: string[] = [];
      if (data.type === 'multiple-choice' || data.type === 'multiple-select') {
        optionsForStorage = data.options.map(opt => opt.text.trim()).filter(Boolean);
      } else if (data.type === 'true-false') {
        optionsForStorage = ["True", "False"];
      }

      const questionPayload: QuestionFormData = {
        type: data.type,
        text: data.text,
        options: optionsForStorage,
        correctAnswer: (data.type === 'multiple-choice' || data.type === 'true-false') ? data.correctAnswer : undefined,
        correctAnswers: data.type === 'multiple-select' ? data.correctAnswers : undefined,
      };

      const savedQuestion = await addQuestionToQuiz(quizId, questionPayload);

      if (savedQuestion) {
        toast({ title: 'Question Added', description: `The question has been successfully saved.` });
        onQuestionSaved(savedQuestion);
        handleClose();
      } else {
        throw new Error("Failed to save question.");
      }
    } catch (error) {
      console.error("Failed to save question:", error);
      toast({ title: 'Error Saving Question', description: error instanceof Error ? error.message : 'An unknown error occurred.', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const currentOptionsForDisplay = (questionType === 'multiple-choice' || questionType === 'multiple-select')
    ? watchedOptions
    : [{ text: 'True' }, { text: 'False' }];


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Question</DialogTitle>
          <DialogDescription>Enter the details for the new question.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
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
                          form.setValue('correctAnswers', []);
                          form.setValue('correctAnswer', '');
                        } else if (value === 'true-false') {
                          form.setValue('options' as any, []);
                          form.setValue('correctAnswers', []);
                          form.setValue('correctAnswer', '');
                        } else if (value === 'multiple-select') {
                          form.setValue('options' as any, [{ text: '' }, { text: '' }]);
                          form.setValue('correctAnswer', '');
                          form.setValue('correctAnswers', []);
                        }
                      }}
                      value={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="multiple-choice" /></FormControl><FormLabel className="font-normal">MC (Single)</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="true-false" /></FormControl><FormLabel className="font-normal">T/F</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="multiple-select" /></FormControl><FormLabel className="font-normal">MC (Multi)</FormLabel></FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="text" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea rows={3} placeholder="Enter the question text..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
              <div className="space-y-3">
                <FormLabel>Answer Options</FormLabel>
                {fields.map((item, index) => (
                  <FormField key={item.id} control={form.control} name={`options.${index}.text` as any} render={({ field }) => (
                    <FormItem><div className="flex items-center gap-2"><FormControl><Input placeholder={`Option ${index + 1}`} {...field} /></FormControl>{fields.length > 2 && (<Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>)}</div><FormMessage /></FormItem>
                  )}/>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })} className="mt-2"><PlusCircle className="mr-2 h-4 w-4"/>Add Option</Button>
                {form.formState.errors.options && !Array.isArray(form.formState.errors.options) && form.formState.errors.options.message && (<p className="text-sm font-medium text-destructive">{form.formState.errors.options.message}</p>)}
                {Array.isArray(form.formState.errors.options) && form.formState.errors.options.map((error: any, index: number) => (error && error.text && <p key={index} className="text-sm font-medium text-destructive">Option {index+1}: {error.text.message}</p>))}
              </div>
            )}

            {questionType === 'multiple-choice' && (
              <FormField control={form.control} name="correctAnswer" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Correct Answer (Pick One)</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                  {currentOptionsForDisplay.filter(option => option.text.trim() !== '').map((option, index) => (<FormItem key={`mc-correct-${index}`} className="flex items-center space-x-3"><FormControl><RadioGroupItem value={option.text} id={`mc-correct-${index}-${option.text}`} /></FormControl><Label htmlFor={`mc-correct-${index}-${option.text}`} className="font-normal">{option.text}</Label></FormItem>))}
                </RadioGroup></FormControl>{currentOptionsForDisplay.filter(opt => opt.text.trim() !== '').length < 2 && (<p className="text-xs font-medium text-muted-foreground">Fill at least two options to select a correct answer.</p>)}<FormMessage />
                </FormItem>
              )}/>
            )}

            {questionType === 'true-false' && (
              <FormField control={form.control} name="correctAnswer" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                  <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="True" id="tf-correct-true" /></FormControl><Label htmlFor="tf-correct-true" className="font-normal">True</Label></FormItem>
                  <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="False" id="tf-correct-false" /></FormControl><Label htmlFor="tf-correct-false" className="font-normal">False</Label></FormItem>
                </RadioGroup></FormControl><FormMessage />
                </FormItem>
              )}/>
            )}

            {questionType === 'multiple-select' && (
              <FormField control={form.control} name="correctAnswers" render={() => (
                <FormItem className="space-y-3"><FormLabel>Correct Answers (Select All That Apply)</FormLabel><div className="space-y-2">
                  {currentOptionsForDisplay.filter(option => option.text.trim() !== '').map((option, index) => (<FormField key={`ms-correct-${index}`} control={form.control} name={`correctAnswers`} render={({ field: checkboxField }) => (
                    <FormItem className="flex flex-row items-center space-x-3 p-2 border rounded-md hover:bg-muted/50"><FormControl><Checkbox checked={checkboxField.value?.includes(option.text)} onCheckedChange={(checked) => checked ? checkboxField.onChange([...(checkboxField.value || []), option.text]) : checkboxField.onChange((checkboxField.value || []).filter(value => value !== option.text))} id={`ms-correct-${index}-${option.text}`} /></FormControl><Label htmlFor={`ms-correct-${index}-${option.text}`} className="font-normal cursor-pointer flex-1">{option.text}</Label></FormItem>
                  )}/>))}
                </div>{currentOptionsForDisplay.filter(opt => opt.text.trim() !== '').length < 2 && (<p className="text-xs font-medium text-muted-foreground">Fill at least two options to select.</p>)}<FormMessage />
                </FormItem>
              )}/>
            )}
            
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={(questionType === 'multiple-choice' || questionType === 'multiple-select') && currentOptionsForDisplay.filter(opt => opt.text.trim() !== '').length < 2}>Add Question</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
