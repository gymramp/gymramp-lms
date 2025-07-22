

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
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
  DialogPortal,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Course, CourseFormData, CourseTranslation } from '@/types/course';
import { addCourse, updateCourseMetadata, getCourseById } from '@/lib/firestore-data';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ImageIcon, Trash2, Award, Globe, Languages, Wand2 } from 'lucide-react';
import { translateContent } from '@/ai/flows/translate-content';
import { Alert, AlertDescription } from '../ui/alert';

// Supported languages for translation UI
const SUPPORTED_LOCALES = [
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
];

const courseTranslationSchema = z.object({
  title: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  longDescription: z.string().optional().or(z.literal('')),
});

const courseFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Short description must be at least 10 characters.' }),
  longDescription: z.string().min(20, { message: 'Detailed description must be at least 20 characters.' }),
  imageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
  featuredImageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: 'Please select a difficulty level.' }),
  duration: z.string().min(3, { message: 'Please enter an approximate duration.' }),
  certificateTemplateId: z.string().optional().nullable(),
  translations: z.record(courseTranslationSchema).optional(),
});


type CourseFormValues = z.infer<typeof courseFormSchema>;

interface AddEditCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (course: Course) => void;
  initialData: Course | null;
}

const CERTIFICATE_TEMPLATES = [
    { value: 'template-a', label: 'Template A - Modern Blue' },
    { value: 'template-b', label: 'Template B - Classic Gold' },
    { value: 'template-c', label: 'Template C - Formal Silver' },
    { value: 'template-d', label: 'Template D - Creative Green' },
];

export function AddEditCourseDialog({ isOpen, setIsOpen, onSave, initialData }: AddEditCourseDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: '',
      description: '',
      longDescription: '',
      imageUrl: '',
      featuredImageUrl: '',
      level: undefined,
      duration: '',
      certificateTemplateId: null,
      translations: {},
    },
  });

  const featuredImageUrlValue = form.watch('featuredImageUrl');

   useEffect(() => {
    if (isOpen) {
        if (initialData) {
          form.reset({
            title: initialData.title,
            description: initialData.description,
            longDescription: initialData.longDescription,
            imageUrl: initialData.imageUrl || '',
            featuredImageUrl: initialData.featuredImageUrl || '',
            level: initialData.level,
            duration: initialData.duration,
            certificateTemplateId: initialData.certificateTemplateId || null,
            translations: initialData.translations || {},
          });
        } else {
          form.reset({
            title: '',
            description: '',
            longDescription: '',
            imageUrl: '',
            featuredImageUrl: '',
            level: undefined,
            duration: '',
            certificateTemplateId: null,
            translations: {},
          });
        }
         setIsUploading(false);
         setUploadProgress(0);
         setUploadError(null);
         setIsTranslating({});
    }
  }, [initialData, form, isOpen]);

   const handleAutoTranslate = async (targetLocale: string) => {
    const { title, description, longDescription } = form.getValues();
    if (!title || !description || !longDescription) {
      toast({
        title: "Missing Content",
        description: "Please fill in all main English fields (title, short & detailed description) before translating.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(prev => ({ ...prev, [targetLocale]: true }));
    try {
      // Translate short description
      const descResult = await translateContent({
        sourceTitle: title, // Title provides context
        sourceContent: description,
        targetLocale: targetLocale
      });

      // Translate long description
      const longDescResult = await translateContent({
        sourceTitle: title, // Title provides context
        sourceContent: longDescription,
        targetLocale: targetLocale
      });

      if (descResult.translatedTitle && descResult.translatedContent && longDescResult.translatedContent) {
        form.setValue(`translations.${targetLocale}.title`, descResult.translatedTitle);
        form.setValue(`translations.${targetLocale}.description`, descResult.translatedContent);
        form.setValue(`translations.${targetLocale}.longDescription`, longDescResult.translatedContent);
        toast({
          title: "Translation Complete!",
          description: `Content has been translated to ${SUPPORTED_LOCALES.find(l => l.value === targetLocale)?.label}.`,
        });
      } else {
        throw new Error("AI did not return all translated content parts.");
      }
    } catch (error: any) {
      toast({
        title: "Translation Failed",
        description: error.message || "Could not translate content.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(prev => ({ ...prev, [targetLocale]: false }));
    }
  };


   const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;

       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);

       try {
           const uniqueFileName = isEditing && initialData?.id
             ? `${initialData.id}-courseimg-${file.name}`
             : `${Date.now()}-courseimg-${file.name}`;
           const storagePath = `${STORAGE_PATHS.COURSE_IMAGES}/${uniqueFileName}`;

           const downloadURL = await uploadImage(file, storagePath, setUploadProgress);

           form.setValue('featuredImageUrl', downloadURL, { shouldValidate: true });
           toast({
             title: "Image Uploaded",
             description: "Featured image successfully uploaded.",
           });

       } catch (error: any) {
           setUploadError(error.message || "Failed to upload image.");
           toast({
             title: "Upload Failed",
             description: error.message || "Could not upload the featured image.",
             variant: "destructive",
           });
       } finally {
           setIsUploading(false);
       }
   };


  const onSubmit = async (data: CourseFormValues) => {
     setIsSaving(true);
     const finalFeaturedImageUrl = data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl;

     const formData: CourseFormData = {
         title: data.title,
         description: data.description,
         longDescription: data.longDescription,
         imageUrl: data.imageUrl || `https://placehold.co/600x350.png?text=${encodeURIComponent(data.title)}`,
         featuredImageUrl: finalFeaturedImageUrl,
         level: data.level,
         duration: data.duration,
         certificateTemplateId: data.certificateTemplateId || null,
         translations: data.translations,
     };


    try {
        let savedCourse: Course | null = null;
        if (isEditing && initialData) {
            savedCourse = await updateCourseMetadata(initialData.id, formData);
            if (savedCourse) {
                toast({ title: 'Course Updated', description: `"${data.title}" has been successfully updated.` });
                onSave(savedCourse);
            } else {
                 throw new Error("Failed to update course.");
            }
        } else {
            savedCourse = await addCourse(formData);
            if (savedCourse) {
                toast({ title: 'Course Added', description: `"${data.title}" has been successfully added.` });
                onSave(savedCourse);
            } else {
                throw new Error("Failed to add course.");
            }
        }

        handleClose();

    } catch (error: any) {
        console.error("Failed to save course:", error);
        toast({
            title: 'Error Saving Course',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
            variant: 'destructive',
        });
    } finally {
        setIsSaving(false);
    }
  };

   const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditing ? 'Edit Course' : 'Add Course'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this course.' : 'Fill in the details for the new course.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <Tabs defaultValue="main" className="h-full flex flex-col">
              <TabsList className="mx-6">
                <TabsTrigger value="main" className="flex items-center gap-1"><Globe className="h-4 w-4"/> Main Content (English)</TabsTrigger>
                <TabsTrigger value="translations" className="flex items-center gap-1"><Languages className="h-4 w-4"/> Translations</TabsTrigger>
              </TabsList>
              <TabsContent value="main" className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Course Title</FormLabel><FormControl><Input placeholder="e.g., Advanced Sales Techniques" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Short Description (Catalog View)</FormLabel><FormControl><Textarea rows={2} placeholder="Briefly describe the course..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="longDescription" render={({ field }) => ( <FormItem><FormLabel>Detailed Description (Course Page)</FormLabel><FormControl><Textarea rows={4} placeholder="Provide a detailed overview of the course content..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormItem className="space-y-2"><FormLabel className="text-base font-medium">Featured Image</FormLabel>
                    <FormControl><div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                        {featuredImageUrlValue && !isUploading ? ( <div className="relative w-full max-w-xs mx-auto aspect-video mb-2"><Image src={featuredImageUrlValue} alt="Featured image preview" fill style={{ objectFit: 'cover' }} className="rounded-md" data-ai-hint="course image" onError={() => { form.setValue('featuredImageUrl', ''); toast({ title: "Image Load Error", variant: "destructive" }); }} /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100 z-10" onClick={() => form.setValue('featuredImageUrl', '')} aria-label="Remove Image"><Trash2 className="h-4 w-4" /></Button></div> )
                        : isUploading ? ( <div className="flex flex-col items-center justify-center h-full py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mb-2" /><p className="text-sm text-muted-foreground mb-1">Uploading...</p><Progress value={uploadProgress} className="w-full max-w-xs h-2" />{uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}</div> )
                        : ( <Label htmlFor="course-image-upload" className="cursor-pointer block"><ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload image</p><Input id="course-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} disabled={isUploading} /></Label> )}
                    </div></FormControl>
                    <FormField control={form.control} name="featuredImageUrl" render={({ field }) => ( <FormItem className="hidden"><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem> )}/>
                    <p className="text-xs text-muted-foreground">Upload a featured image for the course.</p>
                </FormItem>
                <FormField control={form.control} name="level" render={({ field }) => ( <FormItem><FormLabel>Difficulty Level</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a level" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem><FormLabel>Approximate Duration</FormLabel><FormControl><Input placeholder="e.g., Approx. 8 hours" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="certificateTemplateId" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1"><Award className="h-4 w-4"/> Certificate Template</FormLabel><Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}><FormControl><SelectTrigger><SelectValue placeholder="Select a certificate template" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None (Default)</SelectItem>{CERTIFICATE_TEMPLATES.map(template => ( <SelectItem key={template.value} value={template.value}>{template.label}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
              </TabsContent>
              <TabsContent value="translations" className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <Alert><AlertDescription>Provide translations for the course title and descriptions. If a translation is not provided, the main English content will be used.</AlertDescription></Alert>
                {SUPPORTED_LOCALES.map(locale => (
                    <div key={locale.value} className="p-4 border rounded-md space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-semibold text-lg">{locale.label}</h3><Button type="button" variant="outline" size="sm" onClick={() => handleAutoTranslate(locale.value)} disabled={isTranslating[locale.value]}><Wand2 className="mr-2 h-4 w-4" />{isTranslating[locale.value] ? "Translating..." : "Auto-Translate"}</Button></div>
                        <FormField control={form.control} name={`translations.${locale.value}.title`} render={({ field }) => ( <FormItem><FormLabel>Translated Title</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name={`translations.${locale.value}.description`} render={({ field }) => ( <FormItem><FormLabel>Translated Short Description</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name={`translations.${locale.value}.longDescription`} render={({ field }) => ( <FormItem><FormLabel>Translated Detailed Description</FormLabel><FormControl><Textarea rows={4} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                    </div>
                ))}
              </TabsContent>
            </Tabs>
          </form>
        </Form>
        </div>
        <DialogFooter className="px-6 pb-6 pt-4 border-t bg-background z-10 shrink-0">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90" disabled={isSaving || isUploading}>
                {(isSaving || isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isEditing ? 'Save Changes' : 'Add Course'}
            </Button>
        </DialogFooter>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
