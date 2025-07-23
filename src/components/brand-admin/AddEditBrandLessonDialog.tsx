

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogPortal } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { createBrandLesson, updateBrandLesson } from '@/lib/brand-content-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import type { BrandLesson, BrandLessonFormData, LessonTranslation } from '@/types/course';
import { Upload, PlaySquare, FileUp, Image as ImageIconLucide, Trash2, Loader2, Video, Globe, Languages, Wand2 } from 'lucide-react';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { translateContent } from '@/ai/flows/translate-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from '../ui/alert';

const SUPPORTED_LOCALES = [
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
];

const lessonTranslationSchema = z.object({
  title: z.string().optional().or(z.literal('')),
  content: z.string().optional().or(z.literal('')),
  videoUrl: z.string().url({ message: 'Invalid video URL format.' }).optional().or(z.literal('')).nullable(),
});


const brandLessonFormSchema = z.object({
  title: z.string().min(3, { message: 'Lesson title must be at least 3 characters.' }),
  content: z.string().min(10, { message: 'Lesson content must be at least 10 characters.' }),
  featuredImageUrl: z.string().optional().or(z.literal('')),
  videoUrl: z.string().url({ message: 'Invalid video URL format.' }).optional().or(z.literal('')),
  playbackHours: z.coerce.number().min(0).optional(),
  playbackMinutes: z.coerce.number().min(0).max(59).optional(),
  playbackSeconds: z.coerce.number().min(0).max(59).optional(),
  exerciseFilesInfo: z.string().optional().or(z.literal('')),
  translations: z.record(lessonTranslationSchema).optional(),
});

type BrandLessonFormValues = z.infer<typeof brandLessonFormSchema>;

interface AddEditBrandLessonDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  brandId: string;
  initialData: BrandLesson | null;
  onLessonSaved: (lesson: BrandLesson) => void;
}

export function AddEditBrandLessonDialog({
  isOpen,
  setIsOpen,
  brandId,
  initialData,
  onLessonSaved,
}: AddEditBrandLessonDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  
  const [translationVideoUploadState, setTranslationVideoUploadState] = useState<Record<string, { progress: number; error: string | null; uploading: boolean }>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const form = useForm<BrandLessonFormValues>({
    resolver: zodResolver(brandLessonFormSchema),
    defaultValues: {
      title: '',
      content: '',
      featuredImageUrl: '',
      videoUrl: '',
      playbackHours: 0,
      playbackMinutes: 0,
      playbackSeconds: 0,
      exerciseFilesInfo: '',
    },
  });

  const featuredImageUrlValue = form.watch('featuredImageUrl');
  const videoUrlValue = form.watch('videoUrl');

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            let hours = 0, minutes = 0, seconds = 0;
            if (initialData.playbackTime) {
                const timeParts = initialData.playbackTime.match(/(\d+)h|(\d+)m|(\d+)s/g) || [];
                timeParts.forEach(part => {
                    if (part.endsWith('h')) hours = parseInt(part, 10);
                    else if (part.endsWith('m')) minutes = parseInt(part, 10);
                    else if (part.endsWith('s')) seconds = parseInt(part, 10);
                });
            }
            form.reset({
                title: initialData.title || '',
                content: initialData.content || '',
                featuredImageUrl: initialData.featuredImageUrl || '',
                videoUrl: initialData.videoUrl || '',
                playbackHours: hours,
                playbackMinutes: minutes,
                playbackSeconds: seconds,
                exerciseFilesInfo: initialData.exerciseFilesInfo || '',
                translations: initialData.translations || {},
            });
        } else {
            form.reset({
                title: '', content: '', featuredImageUrl: '', videoUrl: '',
                playbackHours: 0, playbackMinutes: 0, playbackSeconds: 0, exerciseFilesInfo: '', translations: {}
            });
        }
        setIsVideoUploading(false); setVideoUploadProgress(0); setVideoUploadError(null);
        setIsImageUploading(false); setImageUploadProgress(0); setImageUploadError(null);
        setIsSaving(false);
    }
  }, [initialData, form, isOpen]);
  
  const handleAutoTranslate = async (targetLocale: string) => {
    const { title, content } = form.getValues();
    if (!title || !content) {
      toast({
        title: "Missing Content",
        description: "Please fill in the main English title and content before translating.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(prev => ({...prev, [targetLocale]: true}));
    try {
        const result = await translateContent({
            sourceTitle: title,
            sourceContent: content,
            targetLocale: targetLocale
        });

        if (result.translatedTitle && result.translatedContent) {
             form.setValue(`translations.${targetLocale}.title`, result.translatedTitle);
             form.setValue(`translations.${targetLocale}.content`, result.translatedContent);
             toast({
                title: "Translation Complete!",
                description: `Content has been translated to ${SUPPORTED_LOCALES.find(l => l.value === targetLocale)?.label}.`,
             });
        } else {
             throw new Error("AI did not return translated content.");
        }
    } catch (error: any) {
         toast({
            title: "Translation Failed",
            description: error.message || "Could not translate content.",
            variant: "destructive",
         });
    } finally {
        setIsTranslating(prev => ({...prev, [targetLocale]: false}));
    }
 };


  const handleVideoFileChange = async (event: React.ChangeEvent<HTMLInputElement>, locale?: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploaderStateSetter = locale ? (state: any) => setTranslationVideoUploadState(prev => ({...prev, [locale]: {...(prev[locale] || {}), ...state}})) : setIsVideoUploading;
    const progressSetter = locale ? (progress: number) => setTranslationVideoUploadState(prev => ({...prev, [locale]: {...(prev[locale] || {}), progress}})) : setVideoUploadProgress;
    const errorSetter = locale ? (error: string | null) => setTranslationVideoUploadState(prev => ({...prev, [locale]: {...(prev[locale] || {}), error}})) : setVideoUploadError;

    uploaderStateSetter({ uploading: true, progress: 0, error: null });

    try {
        const uniqueFileName = `${brandId}-${isEditing && initialData?.id ? initialData.id : Date.now()}${locale ? `-${locale}` : ''}-lessonvideo-${file.name}`;
        const storagePath = `${STORAGE_PATHS.LESSON_VIDEOS}/${uniqueFileName}`;
        const downloadURL = await uploadImage(file, storagePath, progressSetter);

        const fieldName = locale ? `translations.${locale}.videoUrl` as const : 'videoUrl' as const;
        form.setValue(fieldName, downloadURL, { shouldValidate: true });

        toast({ title: "Video Uploaded", description: `Video for ${locale || 'main language'} successfully uploaded.` });

    } catch (error: any) {
        errorSetter(error.message || "Failed to upload video.");
        toast({ title: "Video Upload Failed", description: error.message || "Could not upload the video.", variant: "destructive" });
    } finally {
        uploaderStateSetter({ uploading: false });
    }
  };
  

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImageUploading(true); setImageUploadProgress(0); setImageUploadError(null);
    try {
        const uniqueFileName = `${brandId}-${isEditing && initialData?.id ? initialData.id : Date.now()}-lessonimage-${file.name}`;
        const storagePath = `${STORAGE_PATHS.LESSON_IMAGES}/${uniqueFileName}`;
        const downloadURL = await uploadImage(file, storagePath, setImageUploadProgress);
        form.setValue('featuredImageUrl', downloadURL, { shouldValidate: true });
        toast({ title: "Image Uploaded", description: "Featured image successfully uploaded." });
    } catch (error: any) {
        setImageUploadError(error.message || "Failed to upload image.");
        toast({ title: "Image Upload Failed", description: error.message || "Could not upload image.", variant: "destructive" });
    } finally {
        setIsImageUploading(false);
    }
  };

  const onSubmit = async (data: BrandLessonFormValues) => {
    if (isSaving || isVideoUploading || isImageUploading) return;
    setIsSaving(true);
    try {
      const hours = data.playbackHours || 0;
      const minutes = data.playbackMinutes || 0;
      const seconds = data.playbackSeconds || 0;
      const playbackTime = (hours > 0 || minutes > 0 || seconds > 0)
        ? `${hours}h ${minutes}m ${seconds}s`
        : null;

      const lessonPayload: BrandLessonFormData = {
        brandId: brandId,
        title: data.title,
        content: data.content,
        featuredImageUrl: data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl,
        videoUrl: data.videoUrl?.trim() === '' ? null : data.videoUrl,
        exerciseFilesInfo: data.exerciseFilesInfo?.trim() === '' ? null : data.exerciseFilesInfo,
        playbackTime: playbackTime,
        translations: data.translations,
      };

      let savedLesson: BrandLesson | null = null;
      if (isEditing && initialData) {
        savedLesson = await updateBrandLesson(initialData.id, lessonPayload);
      } else {
        savedLesson = await createBrandLesson(brandId, lessonPayload);
      }

      if (savedLesson) {
        toast({ title: isEditing ? 'Lesson Updated' : 'Lesson Created', description: `"${savedLesson.title}" saved.` });
        onLessonSaved(savedLesson);
        handleClose();
      } else {
        throw new Error("Failed to save brand lesson.");
      }
    } catch (error: any) {
      toast({ title: 'Error Saving Lesson', description: error.message || 'An unknown error occurred.', variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center space-x-2">
              <PlaySquare className="h-6 w-6 text-primary" />
              <DialogTitle className="text-xl">{isEditing ? 'Edit My Lesson' : 'Create New Lesson'}</DialogTitle>
            </div>
            <DialogDescription>
              {isEditing ? 'Update the details of this lesson.' : 'Create a new lesson for your account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
               <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <Tabs defaultValue="main" className="h-full flex flex-col">
                    <TabsList className="mx-6">
                        <TabsTrigger value="main" className="flex items-center gap-1"><Globe className="h-4 w-4" /> Main Content (English)</TabsTrigger>
                        <TabsTrigger value="translations" className="flex items-center gap-1"><Languages className="h-4 w-4" /> Translations</TabsTrigger>
                    </TabsList>
                    <TabsContent value="main" className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                <FormField control={form.control} name="title" render={({ field }) => ( <FormItem> <FormLabel className="text-base font-semibold">Name</FormLabel> <FormControl><Input placeholder="Enter lesson name" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
                                <FormField control={form.control} name="content" render={({ field }) => ( <FormItem><FormLabel className="text-base font-semibold">Content</FormLabel><FormControl><RichTextEditor value={field.value} onChange={field.onChange} placeholder="Enter main content..." /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="md:col-span-1 space-y-6">
                                <FormField control={form.control} name="featuredImageUrl" render={({ field }) => ( <FormItem><FormLabel>Featured Image</FormLabel><FormControl><div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">{field.value && !isImageUploading ? (<div className="relative aspect-video bg-muted rounded-md"><Image src={field.value ?? ''} alt="Preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="lesson image" onError={() => field.onChange('')} /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => field.onChange('')}><Trash2 className="h-4 w-4" /></Button></div>) : isImageUploading ? (<div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={imageUploadProgress} className="w-full h-2" />{imageUploadError && <p className="text-xs text-destructive mt-2">{imageUploadError}</p>}</div>) : (<Label htmlFor="brand-lesson-image-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload image</p><Input id="brand-lesson-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} disabled={isImageUploading} /></Label>)}</div></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="videoUrl" render={({ field }) => ( <FormItem><FormLabel>Lesson Video</FormLabel><FormControl><div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">{field.value && !isVideoUploading ? (<div className="relative aspect-video bg-muted rounded-md flex items-center justify-center"><Video className="h-10 w-10 text-muted-foreground" /><p className="text-xs text-muted-foreground mt-1 truncate w-full px-2">{field.value}</p><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => field.onChange('')}><Trash2 className="h-4 w-4" /></Button></div>) : isVideoUploading ? (<div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={videoUploadProgress} className="w-full h-2" />{videoUploadError && <p className="text-xs text-destructive mt-2">{videoUploadError}</p>}</div>) : (<Label htmlFor="brand-lesson-video-upload" className="cursor-pointer block"><FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload video</p><Input id="brand-lesson-video-upload" type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFileChange(e)} disabled={isVideoUploading} /></Label>)}</div></FormControl><FormMessage /></FormItem> )} />
                                <div className="space-y-2"><Label>Playback Time</Label><div className="flex items-center space-x-2"><FormField control={form.control} name="playbackHours" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">h</FormLabel></FormItem>)} /><FormField control={form.control} name="playbackMinutes" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">m</FormLabel></FormItem>)} /><FormField control={form.control} name="playbackSeconds" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">s</FormLabel></FormItem>)} /></div></div>
                                <FormField control={form.control} name="exerciseFilesInfo" render={({ field }) => ( <FormItem><FormLabel>Exercise Files</FormLabel><FormControl><Textarea rows={3} placeholder="File URLs/Names (one per line)" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="translations" className="flex-1 overflow-y-auto px-6 py-4">
                     <div className="space-y-6">
                        {SUPPORTED_LOCALES.map(locale => {
                           const uploadState = translationVideoUploadState[locale.value] || { progress: 0, error: null, uploading: false };
                           return (
                            <div key={locale.value} className="p-4 border rounded-md space-y-4">
                                <div className="flex justify-between items-center"><h3 className="font-semibold text-lg">{locale.label}</h3><Button type="button" variant="outline" size="sm" onClick={() => handleAutoTranslate(locale.value)} disabled={isTranslating[locale.value]}><Wand2 className="mr-2 h-4 w-4" />Auto-Translate</Button></div>
                                <FormField control={form.control} name={`translations.${locale.value}.title`} render={({ field }) => ( <FormItem><FormLabel>Translated Title</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name={`translations.${locale.value}.content`} render={({ field }) => ( <FormItem><FormLabel>Translated Content</FormLabel><FormControl><RichTextEditor value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name={`translations.${locale.value}.videoUrl`} render={({ field }) => (
                                  <FormItem><FormLabel>Translated Video</FormLabel><FormControl><div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                                    {field.value && !uploadState.uploading ? ( <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center"><Video className="h-10 w-10 text-muted-foreground" /><p className="text-xs text-muted-foreground mt-1 truncate w-full px-2">{field.value}</p><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => field.onChange('')}><Trash2 className="h-4 w-4" /></Button></div> )
                                    : uploadState.uploading ? ( <div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={uploadState.progress} className="w-full h-2" />{uploadState.error && <p className="text-xs text-destructive mt-2">{uploadState.error}</p>}</div> )
                                    : ( <Label htmlFor={`brand-lesson-video-upload-${locale.value}`} className="cursor-pointer block"><FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload video for {locale.label}</p><Input id={`brand-lesson-video-upload-${locale.value}`} type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFileChange(e, locale.value)} disabled={uploadState.uploading} /></Label> )}
                                  </div></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                           )
                        })}
                     </div>
                  </TabsContent>
                 </Tabs>
              </form>
            </Form>
          </div>
          <DialogFooter className="px-6 pb-6 pt-4 border-t bg-background z-10 shrink-0">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90" disabled={isSaving || isVideoUploading || isImageUploading || Object.values(translationVideoUploadState).some(s => s.uploading)}>
              {(isSaving || isVideoUploading || isImageUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
