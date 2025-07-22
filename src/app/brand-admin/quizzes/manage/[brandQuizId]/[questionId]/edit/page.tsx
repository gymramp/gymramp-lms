
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import type { BrandQuiz, BrandQuestion, BrandQuestionFormData, QuestionType, QuestionTranslation, User } from '@/types/course';
import { getBrandQuizById, updateBrandQuestionInBrandQuiz } from '@/lib/brand-content-data';
import { PlusCircle, Trash2, ArrowLeft, Loader2, HelpCircle, Languages, Wand2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { translateContent } from '@/ai/flows/translate-content';

const SUPPORTED_LOCALES = [
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
];

const questionTranslationSchema = z.object({
    text: z.string().optional().or(z.literal('')),
    options: z.array(z.string().optional().or(z.literal(''))).optional(),
});

const baseSchema = z.object({
  text: z.string().min(5, { message: 'Question text must be at least 5 characters.' }),
  translations: z.record(questionTranslationSchema).optional(),
});
const multipleChoiceOptionSchema = z.object({ text: z.string().min(1, "Option text cannot be empty.") });

const multipleChoiceSchema = baseSchema.extend({
  type: z.literal('multiple-choice'),
  options: z.array(multipleChoiceOptionSchema).min(2, "At least two options are required."),
  correctAnswer: z.string().min(1, { message: 'Please select the correct answer.' }),
  correctAnswers: z.array(z.string()).optional(),
});
const trueFalseSchema = baseSchema.extend({
  type: z.literal('true-false'),
  options: z.array(multipleChoiceOptionSchema).optional(),
  correctAnswer: z.enum(['True', 'False'], { required_error: 'Please select True or False.' }),
  correctAnswers: z.array(z.string()).optional(),
});
const multipleSelectSchema = baseSchema.extend({
  type: z.literal('multiple-select'),
  options: z.array(multipleChoiceOptionSchema).min(2, "At least two options are required."),
  correctAnswer: z.string().optional(),
  correctAnswers: z.array(z.string()).min(1, { message: "At least one correct answer must be selected."}),
});

const brandQuestionFormSchema = z.discriminatedUnion("type", [multipleChoiceSchema, trueFalseSchema, multipleSelectSchema])
.refine(data => (data.type !== 'multiple-choice' && data.type !== 'multiple-select') || new Set(data.options.map(opt => opt.text.trim())).size === data.options.length, {
    message: "Answer options must be unique.",
    path: ["options"],
})
.refine(data => (data.type !== 'multiple-choice' && data.type !== 'multiple-select') || data.options.map(opt => opt.text).includes(data.correctAnswer || ''), {
    message: "Correct answer must be one of the options.",
    path: ["correctAnswer"],
})
.refine(data => data.type !== 'multiple-select' || (data.correctAnswers || []).every(ca => data.options.map(opt => opt.text).includes(ca)), {
    message: "Correct answers must be from the provided options.",
    path: ["correctAnswers"],
});

type BrandQuestionFormValues = z.infer<typeof brandQuestionFormSchema>;

export default function EditBrandQuestionPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const brandQuizId = params.brandQuizId as string;
    const questionId = params.questionId as string;
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [quiz, setQuiz] = useState<BrandQuiz | null>(null);
    const [initialQuestionData, setInitialQuestionData] = useState<BrandQuestion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

    const form = useForm<BrandQuestionFormValues>({
        resolver: zodResolver(brandQuestionFormSchema),
        defaultValues: { type: 'multiple-choice', text: '', options: [], correctAnswer: '', correctAnswers: [], translations: {} },
    });
    
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" as any });
    const questionType = form.watch('type');
    const watchedOptions = form.watch('options' as any) || [];
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push('/login');
                return;
            }
            if (firebaseUser.email) {
                const user = await getUserByEmail(firebaseUser.email);
                setCurrentUser(user);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const fetchInitialData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            if (!brandQuizId || !questionId) throw new Error("Quiz or Question ID missing");
            
            const fetchedQuiz = await getBrandQuizById(brandQuizId);
            if (!fetchedQuiz || fetchedQuiz.brandId !== currentUser.companyId) {
                toast({ title: "Error", description: "Quiz not found or you don't have permission to edit it.", variant: "destructive" });
                router.push('/brand-admin/quizzes'); return;
            }
            setQuiz(fetchedQuiz);

            const question = fetchedQuiz.questions?.find(q => q.id === questionId);
            if (!question) {
                toast({ title: "Error", description: "Question not found in this quiz.", variant: "destructive" });
                router.push(`/brand-admin/quizzes/manage/${brandQuizId}`); return;
            }
            setInitialQuestionData(question);

            form.reset({
                type: question.type, text: question.text,
                options: (question.type === 'multiple-choice' || question.type === 'multiple-select') ? (question.options || []).map(opt => ({ text: opt })) : [],
                correctAnswer: (question.type === 'multiple-choice' || question.type === 'true-false') ? question.correctAnswer || '' : '',
                correctAnswers: question.type === 'multiple-select' ? question.correctAnswers || [] : [],
                translations: (question as any).translations || {},
            });

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "Could not load data for editing.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [brandQuizId, questionId, router, toast, form, currentUser]);

    useEffect(() => { if(currentUser) fetchInitialData(); }, [fetchInitialData, currentUser]);
    
    const handleAutoTranslate = async (targetLocale: string) => {
        const stripQuotes = (str: string) => str.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

        const questionText = form.getValues('text');
        const options = form.getValues('options') || [];
        
        if (!questionText) {
            toast({ title: "Missing Content", description: "Please enter the main question text.", variant: "destructive" });
            return;
        }

        const sourceTitle = stripQuotes(questionText);
        const sourceOptions = options.map(opt => stripQuotes(opt.text));
        const sourceContent = sourceOptions.join('\n');

        setIsTranslating(prev => ({...prev, [targetLocale]: true}));
        try {
            const result = await translateContent({
                sourceTitle: sourceTitle,
                sourceContent: sourceContent,
                targetLocale: targetLocale
            });

            if (result.translatedTitle && result.translatedContent) {
                const translatedOptions = result.translatedContent.split('\n');

                const originalQuestionHasQuotes = /^".*"$/.test(questionText.trim()) || /^'.*'$/.test(questionText.trim());
                const finalTranslatedQuestion = originalQuestionHasQuotes ? `"${result.translatedTitle}"` : result.translatedTitle;
                form.setValue(`translations.${targetLocale}.text`, finalTranslatedQuestion);

                if (options && translatedOptions.length === options.length) {
                    options.forEach((originalOption, index) => {
                        const originalOptionHasQuotes = /^".*"$/.test(originalOption.text.trim()) || /^'.*'$/.test(originalOption.text.trim());
                        const finalTranslatedOption = originalOptionHasQuotes ? `"${translatedOptions[index]}"` : translatedOptions[index];
                        form.setValue(`translations.${targetLocale}.options.${index}`, finalTranslatedOption);
                    });
                }
                
                toast({ title: "Translation Complete!", description: `Question and options translated to ${SUPPORTED_LOCALES.find(l => l.value === targetLocale)?.label}.` });
            } else {
                throw new Error("AI did not return translated content.");
            }
        } catch (error: any) {
            toast({ title: "Translation Failed", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsTranslating(prev => ({...prev, [targetLocale]: false}));
        }
    };


    const onSubmit = async (data: BrandQuestionFormValues) => {
        try {
            let optionsForStorage: string[] = [];
            if (data.type === 'multiple-choice' || data.type === 'multiple-select') {
                optionsForStorage = data.options.map(opt => opt.text.trim()).filter(Boolean);
            } else if (data.type === 'true-false') {
                optionsForStorage = ["True", "False"];
            }

            const questionPayload: BrandQuestionFormData = {
                type: data.type, text: data.text, options: optionsForStorage,
                correctAnswer: (data.type === 'multiple-choice' || data.type === 'true-false') ? data.correctAnswer : undefined,
                correctAnswers: data.type === 'multiple-select' ? data.correctAnswers : undefined,
                translations: data.translations,
            };

            const updatedQuestion = await updateBrandQuestionInBrandQuiz(brandQuizId, questionId, questionPayload);

            if (updatedQuestion) {
                toast({ title: 'Question Updated', description: `The question has been successfully saved.` });
                router.push(`/brand-admin/quizzes/manage/${brandQuizId}`);
            } else {
                throw new Error("Failed to update question.");
            }
        } catch (error) {
            console.error("Failed to save question:", error);
            toast({ title: 'Error Saving Question', description: error instanceof Error ? error.message : 'An unknown error occurred.', variant: 'destructive' });
        }
    };
    
    if (isLoading || !currentUser) return <div className="container mx-auto p-6"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    if (!quiz || !initialQuestionData) return <div className="container mx-auto p-6">Quiz or question data not found.</div>;

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <Button variant="outline" onClick={() => router.push(`/brand-admin/quizzes/manage/${brandQuizId}`)} className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quiz Questions
            </Button>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5"/>Edit Question</CardTitle>
                            <CardDescription>For quiz: {quiz.title}</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Tabs defaultValue="main">
                                <TabsList>
                                    <TabsTrigger value="main">Main Content (English)</TabsTrigger>
                                    <TabsTrigger value="translations"><Languages className="mr-2 h-4 w-4"/>Translations</TabsTrigger>
                                </TabsList>
                                <TabsContent value="main" className="pt-6 space-y-6">
                                    <FormField control={form.control} name="type" render={({ field }) => ( <div/> )} />
                                    <FormField control={form.control} name="text" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />

                                    {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
                                        <div className="space-y-3">
                                            <FormLabel>Answer Options</FormLabel>
                                            {fields.map((item, index) => (<FormField key={item.id} control={form.control} name={`options.${index}.text` as any} render={({ field }) => (<FormItem><div className="flex items-center gap-2"><FormControl><Input {...field} /></FormControl>{fields.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>}</div><FormMessage /></FormItem>)}/>))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })}><PlusCircle className="mr-2 h-4 w-4"/>Add Option</Button>
                                        </div>
                                    )}

                                    {questionType === 'multiple-choice' && (
                                        <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">{watchedOptions.filter(o => o.text).map((opt, i) => (<FormItem key={`mc-c-${i}`} className="flex items-center space-x-3"><FormControl><RadioGroupItem value={opt.text} /></FormControl><Label className="font-normal">{opt.text}</Label></FormItem>))}</RadioGroup></FormControl><FormMessage/></FormItem>)} />
                                    )}
                                     {questionType === 'true-false' && (
                                        <FormField control={form.control} name="correctAnswer" render={({ field }) => (<FormItem><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1"><FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="True" /></FormControl><Label className="font-normal">True</Label></FormItem><FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="False" /></FormControl><Label className="font-normal">False</Label></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                                    )}
                                     {questionType === 'multiple-select' && (
                                        <FormField control={form.control} name="correctAnswers" render={() => (<FormItem><FormLabel>Correct Answers</FormLabel><div className="space-y-2">{watchedOptions.filter(o => o.text).map((opt, i) => (<FormField key={`ms-c-${i}`} control={form.control} name="correctAnswers" render={({ field }) => (<FormItem className="flex items-center space-x-3"><FormControl><Checkbox checked={field.value?.includes(opt.text)} onCheckedChange={c=>c?field.onChange([...(field.value||[]), opt.text]):field.onChange((field.value||[]).filter(v=>v!==opt.text))}/></FormControl><Label className="font-normal">{opt.text}</Label></FormItem>)}/>))}</div><FormMessage /></FormItem>)} />
                                    )}
                                </TabsContent>
                                <TabsContent value="translations" className="pt-6 space-y-6">
                                    <Alert><AlertDescription>Provide translations for the question text and each corresponding answer option. If a translation is not provided, the English version will be used.</AlertDescription></Alert>
                                    {SUPPORTED_LOCALES.map(locale => (
                                        <div key={locale.value} className="p-4 border rounded-md space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-semibold text-lg">{locale.label}</h3>
                                                <Button type="button" variant="outline" size="sm" onClick={() => handleAutoTranslate(locale.value)} disabled={isTranslating[locale.value]}>
                                                    {isTranslating[locale.value] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                                    Auto-Translate
                                                </Button>
                                            </div>
                                            <FormField control={form.control} name={`translations.${locale.value}.text`} render={({ field }) => ( <FormItem><FormLabel>Translated Question Text</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                                            {(questionType === 'multiple-choice' || questionType === 'multiple-select') && (
                                                <div className="space-y-2">
                                                    <FormLabel>Translated Answer Options</FormLabel>
                                                    {watchedOptions.map((option, index) => (
                                                        <FormField key={`${locale.value}-${index}`} control={form.control} name={`translations.${locale.value}.options.${index}`} render={({ field }) => (<FormItem><FormLabel className="text-xs text-muted-foreground">Original: "{option.text}"</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder={`Translation for "${option.text}"`}/></FormControl><FormMessage /></FormItem>)} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </TabsContent>
                           </Tabs>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit">Save Changes</Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}
