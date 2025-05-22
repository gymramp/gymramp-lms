
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
import { Label }
from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import type { BrandQuestion, BrandQuestionFormData, QuestionType } from '@/types/course';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { addBrandQuestionToBrandQuiz, updateBrandQuestionInBrandQuiz } from '@/lib/brand-content-data';

const baseSchema = z.object({
  text: z.string().min(5, { message: 'Question text must be at least 5 characters.' }),
});
const multipleChoiceOptionSchema = z.object({ text: z.string().min(1, "Option text cannot be empty.") });

const multipleChoiceSchema = baseSchema.extend({
  type: z.literal('multiple-choice'),
  options: z.array(multipleChoiceOptionSchema).min(2, "At least two options are required."),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer.' }),
  correctAnswers: z.array(z.string()).optional(), // Not used for this type
});
const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  options: z.array(multipleChoiceOptionSchema).optional(), // Not directly used in form for TF, but kept for schema structure
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
  correctAnswers: z.array(z.string()).optional(), // Not used for this type
});
const multipleSelectSchema = baseSchema.extend({
  type: z.literal('multiple-select'),
  options: z.array(multipleChoiceOptionSchema).min(2, "At least two options are required."),
  correctAnswer: z.string().optional(), // Not used for this type
  correctAnswers: z.array(z.string()).min(1, { message: "At least one correct answer must be selected."}),
});

const brandQuestionFormSchema = z.discriminatedUnion("type", [multipleChoiceSchema, trueFalseSchema, multipleSelectSchema])
.refine(data => {
    if (data.type === 'multiple-choice' || data.type === 'multiple-select') {
        const providedOptions = data.options.map(opt => opt.text.trim()).filter(Boolean);
        const uniqueOptions = new Set(providedOptions);
        return providedOptions.length === uniqueOptions.size;
    }
    return true;
}, { message: "Answer options must be unique.", path: ["options"] })
.refine(data => {
    if (data.type === 'multiple-choice' && data.correctAnswer) {
        // Check if correctAnswer is one of the provided, non-empty options
        return data.options.map(opt => opt.text.trim()).filter(Boolean).includes(data.correctAnswer.trim());
    }
    if (data.type === 'multiple-select' && data.correctAnswers) {
        // Check if all correctAnswers are among the provided, non-empty options
        const providedOptionTexts = data.options.map(opt => opt.text.trim()).filter(Boolean);
        return data.correctAnswers.every(ca => providedOptionTexts.includes(ca.trim()));
    }
    // For true-false, this refinement does not apply to options in the same way
    return true;
}, { message: "Correct answer(s) must be selected from the provided options.", path: ["correctAnswer"] }); // Path might need adjustment for MS

type BrandQuestionFormValues = z.infer<typeof brandQuestionFormSchema>;

interface AddEditBrandQuestionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  brandQuizId: string;
  initialData: BrandQuestion | null;
  onQuestionSaved: (question: BrandQuestion) => void;
}

export function AddEditBrandQuestionDialog({ isOpen, setIsOpen, brandQuizId, initialData, onQuestionSaved }: AddEditBrandQuestionDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<BrandQuestionFormValues>({
    resolver: zodResolver(brandQuestionFormSchema),
    defaultValues: { type: 'multiple-choice', text: '', options: [{ text: '' }, { text: '' }], correctAnswer: '', correctAnswers: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" as any }); // Cast for discriminated union
  const questionType = form.watch('type');
  const watchedOptions = form.watch('options' as any) || []; // Cast for discriminated union

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          type: initialData.type, text: initialData.text,
          options: (initialData.type === 'multiple-choice' || initialData.type === 'multiple-select') 
                    ? (initialData.options || []).map(opt => ({ text: opt })) 
                    : [], // True/False doesn't use dynamic options array in form state
          correctAnswer: (initialData.type === 'multiple-choice' || initialData.type === 'true-false') ? initialData.correctAnswer || '' : '',
          correctAnswers: initialData.type === 'multiple-select' ? initialData.correctAnswers || [] : [],
        });
      } else {
        form.reset({ type: 'multiple-choice', text: '', options: [{ text: '' }, { text: '' }], correctAnswer: '', correctAnswers: [] });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: BrandQuestionFormValues) => {
    setIsSaving(true);
    try {
      let savedQuestion: BrandQuestion | null = null;
      let optionsForStorage: string[] = [];
      let finalCorrectAnswer: string | undefined = undefined;
      let finalCorrectAnswers: string[] | undefined = undefined;

      if (data.type === 'multiple-choice' || data.type === 'multiple-select') {
        optionsForStorage = data.options.map(opt => opt.text.trim()).filter(Boolean);
      } else if (data.type === 'true-false') {
        optionsForStorage = ["True", "False"]; // Options for TF are implicit
      }

      if (data.type === 'multiple-choice' || data.type === 'true-false') {
        finalCorrectAnswer = data.correctAnswer;
      } else if (data.type === 'multiple-select') {
        finalCorrectAnswers = data.correctAnswers;
      }
      
      const questionPayload: BrandQuestionFormData = {
        type: data.type, text: data.text, options: optionsForStorage,
        ...(finalCorrectAnswer !== undefined && { correctAnswer: finalCorrectAnswer }),
        ...(finalCorrectAnswers !== undefined && { correctAnswers: finalCorrectAnswers })
      };

      if (isEditing && initialData) {
        savedQuestion = await updateBrandQuestionInBrandQuiz(brandQuizId, initialData.id, questionPayload);
      } else {
        savedQuestion = await addBrandQuestionToBrandQuiz(brandQuizId, questionPayload);
      }

      if (savedQuestion) {
        toast({ title: isEditing ? 'Question Updated' : 'Question Added', description: `The question has been successfully saved.` });
        onQuestionSaved(savedQuestion); handleClose();
      } else { throw new Error("Failed to save question."); }
    } catch (error: any) {
      toast({ title: 'Error Saving Question', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => setIsOpen(false);
  
  const currentOptionsForDisplay = (questionType === 'multiple-choice' || questionType === 'multiple-select') 
    ? watchedOptions 
    : [{ text: 'True' }, { text: 'False' }]; // For TF radio group rendering

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? 'Edit Brand Question' : 'Add New Brand Question'}</DialogTitle><DialogDescription>{isEditing ? 'Update details.' : 'Enter details.'}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem className="space-y-3"><FormLabel>Question Type</FormLabel><FormControl><RadioGroup 
                onValueChange={(newType) => {
                  const currentText = form.getValues('text');
                  field.onChange(newType as QuestionType);
                  let newDefaults: Partial<BrandQuestionFormValues> = { type: newType as QuestionType, text: currentText };

                  if (newType === 'multiple-choice') {
                    newDefaults = { ...newDefaults, options: [{ text: '' }, { text: '' }], correctAnswer: '', correctAnswers: [] };
                  } else if (newType === 'true-false') {
                    newDefaults = { ...newDefaults, options: [], correctAnswer: '', correctAnswers: [] };
                  } else if (newType === 'multiple-select') {
                    newDefaults = { ...newDefaults, options: [{ text: '' }, { text: '' }], correctAnswer: '', correctAnswers: [] };
                  }
                  // Reset the form with the new structure, preserving existing text.
                  // The spread of form.getValues() first ensures all fields are present, then specific type defaults override.
                  form.reset({ ...form.getValues(), ...newDefaults }); 
                }} 
                value={field.value} className="flex space-x-4">
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="multiple-choice" /></FormControl><FormLabel className="font-normal">MC (Single)</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="true-false" /></FormControl><FormLabel className="font-normal">T/F</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="multiple-select" /></FormControl><FormLabel className="font-normal">MC (Multi)</FormLabel></FormItem>
              </RadioGroup></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="text" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea rows={3} placeholder="Enter question..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
              <div className="space-y-3"><FormLabel>Answer Options</FormLabel>
                {fields.map((item, index) => (<FormField key={item.id} control={form.control} name={`options.${index}.text` as any} render={({ field }) => (
                  <FormItem><div className="flex items-center gap-2"><FormControl><Input placeholder={`Option ${index + 1}`} {...field} /></FormControl>{fields.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>}</div><FormMessage /></FormItem>
                )} />))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}><PlusCircle className="mr-2 h-4 w-4" /> Add Option</Button>
                {form.formState.errors.options && !Array.isArray(form.formState.errors.options) && form.formState.errors.options.message && <p className="text-sm font-medium text-destructive">{form.formState.errors.options.message}</p>}
                {Array.isArray(form.formState.errors.options) && form.formState.errors.options.map((e:any, i:number) => e?.text && <p key={i} className="text-sm font-medium text-destructive">Option {i+1}: {e.text.message}</p>)}
              </div>
            )}

            {questionType === 'multiple-choice' && ( <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Correct Answer (Pick One)</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value || ''} className="flex flex-col space-y-1">
              {/* Filter out empty options for display in RadioGroup */}
              {watchedOptions.filter(opt => opt.text.trim() !== '').map((opt, i) => (<FormItem key={`mc-c-${i}`} className="flex items-center space-x-3"><FormControl><RadioGroupItem value={opt.text} id={`mc-c-${i}-${opt.text}`} /></FormControl><Label htmlFor={`mc-c-${i}-${opt.text}`} className="font-normal">{opt.text}</Label></FormItem>))}
            </RadioGroup></FormControl>{watchedOptions.filter(opt=>opt.text.trim()!=='').length<2 && <p className="text-xs font-medium text-muted-foreground">Fill at least two options above to select a correct answer.</p>}<FormMessage /></FormItem>)} /> )}
            
            {questionType === 'true-false' && ( <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value || ''} className="flex flex-col space-y-1">
              <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="True" id="tf-c-t" /></FormControl><Label htmlFor="tf-c-t" className="font-normal">True</Label></FormItem>
              <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="False" id="tf-c-f" /></FormControl><Label htmlFor="tf-c-f" className="font-normal">False</Label></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>)} /> )}
            
            {questionType === 'multiple-select' && ( <FormField control={form.control} name="correctAnswers" render={() => (
              <FormItem className="space-y-3"><FormLabel>Correct Answers (Select All That Apply)</FormLabel><div className="space-y-2">
                {/* Filter out empty options for display in Checkbox group */}
                {watchedOptions.filter(opt=>opt.text.trim()!=='').map((opt, i) => (<FormField key={`ms-c-${i}`} control={form.control} name={`correctAnswers`} render={({ field: cbField }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 border rounded-md hover:bg-muted/50"><FormControl><Checkbox checked={cbField.value?.includes(opt.text)} onCheckedChange={c=>c?cbField.onChange([...(cbField.value||[]),opt.text]):cbField.onChange((cbField.value||[]).filter(v=>v!==opt.text))} id={`ms-c-${i}-${opt.text}`}/></FormControl><Label htmlFor={`ms-c-${i}-${opt.text}`} className="font-normal cursor-pointer flex-1">{opt.text}</Label></FormItem>
                )}/>))}
              </div>{watchedOptions.filter(opt=>opt.text.trim()!=='').length<2 && <p className="text-xs font-medium text-muted-foreground">Fill at least two options above to select correct answers.</p>}<FormMessage name="correctAnswers" /></FormItem>
            )} />)}

            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" className="bg-primary hover:bg-primary/90" 
              disabled={isSaving || ((questionType === 'multiple-choice' || questionType === 'multiple-select') && watchedOptions.filter(opt=>opt.text.trim()!=='').length<2)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {isEditing ? 'Save Changes' : 'Add Question'}
            </Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

