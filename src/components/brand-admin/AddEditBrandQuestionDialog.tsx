
'use client';

import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
});
const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  options: z.array(multipleChoiceOptionSchema).optional(),
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
});
const multipleSelectSchema = baseSchema.extend({
  type: z.literal('multiple-select'),
  options: z.array(multipleChoiceOptionSchema).min(2, "At least two options are required."),
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
        return data.options.map(opt => opt.text).includes(data.correctAnswer);
    }
    if (data.type === 'multiple-select' && data.correctAnswers) {
        return data.correctAnswers.every(ca => data.options.map(opt => opt.text).includes(ca));
    }
    return true;
}, { message: "Correct answer(s) must be selected from the provided options.", path: ["correctAnswer"] });

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

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" as any });
  const questionType = form.watch('type');
  const watchedOptions = form.watch('options' as any) || [];

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          type: initialData.type, text: initialData.text,
          options: (initialData.type === 'multiple-choice' || initialData.type === 'multiple-select') ? (initialData.options || []).map(opt => ({ text: opt })) : [{ text: 'True' }, { text: 'False' }],
          correctAnswer: initialData.type !== 'multiple-select' ? initialData.correctAnswer || '' : '',
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
      const optionsForStorage: string[] = (data.type === 'multiple-choice' || data.type === 'multiple-select') ? data.options.map(opt => opt.text.trim()).filter(Boolean) : ["True", "False"];
      
      const questionPayload: BrandQuestionFormData = {
        type: data.type, text: data.text, options: optionsForStorage,
        ...(data.type === 'multiple-select' ? { correctAnswers: data.correctAnswers } : { correctAnswer: data.correctAnswer })
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
  const currentOptionsForDisplay = (questionType === 'multiple-choice' || questionType === 'multiple-select') ? watchedOptions : [{ text: 'True' }, { text: 'False' }];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? 'Edit Brand Question' : 'Add New Brand Question'}</DialogTitle><DialogDescription>{isEditing ? 'Update details.' : 'Enter details.'}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem className="space-y-3"><FormLabel>Question Type</FormLabel><FormControl><RadioGroup onValueChange={(v) => { field.onChange(v as QuestionType); form.resetField("options"); form.resetField("correctAnswer"); form.resetField("correctAnswers"); if(v==='multiple-choice' || v==='multiple-select') form.setValue('options' as any, [{text:''},{text:''}]); }} value={field.value} className="flex space-x-4">
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="multiple-choice" /></FormControl><FormLabel className="font-normal">MC (Single)</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="true-false" /></FormControl><FormLabel className="font-normal">T/F</FormLabel></FormItem>
                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="multiple-select" /></FormControl><FormLabel className="font-normal">MC (Multi)</FormLabel></FormItem>
              </RadioGroup></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="text" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea rows={3} placeholder="Enter question..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
              <div className="space-y-3"><FormLabel>Answer Options</FormLabel>
                {fields.map((item, index) => (<FormField key={item.id} control={form.control} name={`options.${index}.text` as any} render={({ field }) => (
                  <FormItem><div className="flex items-center gap-2"><FormControl><Input placeholder={`Opt ${index + 1}`} {...field} /></FormControl>{fields.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>}</div><FormMessage /></FormItem>
                )} />))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}><PlusCircle className="mr-2 h-4 w-4" /> Add Option</Button>
                {form.formState.errors.options && !Array.isArray(form.formState.errors.options) && form.formState.errors.options.message && <p className="text-sm font-medium text-destructive">{form.formState.errors.options.message}</p>}
                {Array.isArray(form.formState.errors.options) && form.formState.errors.options.map((e:any, i:number) => e?.text && <p key={i} className="text-sm text-destructive">Opt {i+1}: {e.text.message}</p>)}
              </div>
            )}
            {questionType === 'multiple-choice' && ( <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Correct Answer (Pick One)</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
              {currentOptionsForDisplay.filter(opt => opt.text.trim() !== '').map((opt, i) => (<FormItem key={`mc-c-${i}`} className="flex items-center space-x-3"><FormControl><RadioGroupItem value={opt.text} id={`mc-c-${i}-${opt.text}`} /></FormControl><Label htmlFor={`mc-c-${i}-${opt.text}`} className="font-normal">{opt.text}</Label></FormItem>))}
            </RadioGroup></FormControl>{currentOptionsForDisplay.filter(opt=>opt.text.trim()!=='').length<2 && <p className="text-xs text-muted-foreground">Need min 2 options.</p>}<FormMessage /></FormItem>)} /> )}
            {questionType === 'true-false' && ( <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
              <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="True" id="tf-c-t" /></FormControl><Label htmlFor="tf-c-t" className="font-normal">True</Label></FormItem>
              <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="False" id="tf-c-f" /></FormControl><Label htmlFor="tf-c-f" className="font-normal">False</Label></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>)} /> )}
            {questionType === 'multiple-select' && ( <FormField control={form.control} name="correctAnswers" render={() => (
              <FormItem className="space-y-3"><FormLabel>Correct Answers (Select All)</FormLabel><div className="space-y-2">
                {currentOptionsForDisplay.filter(opt=>opt.text.trim()!=='').map((opt, i) => (<FormField key={`ms-c-${i}`} control={form.control} name={`correctAnswers`} render={({ field: cbField }) => (
                  <FormItem className="flex items-center space-x-3 p-2 border rounded-md"><FormControl><Checkbox checked={cbField.value?.includes(opt.text)} onCheckedChange={c=>c?cbField.onChange([...cbField.value||[],opt.text]):cbField.onChange((cbField.value||[]).filter(v=>v!==opt.text))} id={`ms-c-${i}-${opt.text}`}/></FormControl><Label htmlFor={`ms-c-${i}-${opt.text}`} className="font-normal flex-1">{opt.text}</Label></FormItem>
                )}/>))}
              </div>{currentOptionsForDisplay.filter(opt=>opt.text.trim()!=='').length<2 && <p className="text-xs text-muted-foreground">Need min 2 options.</p>}<FormMessage /></FormItem>
            )} />)}
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving || ((questionType === 'multiple-choice' || questionType === 'multiple-select') && currentOptionsForDisplay.filter(opt=>opt.text.trim()!=='').length<2)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {isEditing ? 'Save Changes' : 'Add Question'}
            </Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
