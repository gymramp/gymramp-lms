
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
import type { BrandLesson, BrandLessonFormData } from '@/types/course';
import { Upload, PlaySquare, FileUp, Image as ImageIconLucide, Trash2, Loader2, Video } from 'lucide-react';
import RichTextEditor from '@/components/ui/RichTextEditor';

const brandLessonFormSchema = z.object({
  title: z.string().min(3, { message: 'Lesson title must be at least 3 characters.' }),
  content: z.string().min(10, { message: 'Lesson content must be at least 10 characters.' }),
  featuredImageUrl: z.string().optional().or(z.literal('')),
  videoUrl: z.string().url({ message: 'Invalid video URL format.' }).optional().or(z.literal('')),
  playbackHours: z.coerce.number().min(0).optional(),
  playbackMinutes: z.coerce.number().min(0).max(59).optional(),
  playbackSeconds: z.coerce.number().min(0).max(59).optional(),
  exerciseFilesInfo: z.string().optional().or(z.literal('')),
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
            });
        } else {
            form.reset({
                title: '', content: '', featuredImageUrl: '', videoUrl: '',
                playbackHours: 0, playbackMinutes: 0, playbackSeconds: 0, exerciseFilesInfo: '',
            });
        }
        setIsVideoUploading(false); setVideoUploadProgress(0); setVideoUploadError(null);
        setIsImageUploading(false); setImageUploadProgress(0); setImageUploadError(null);
        setIsSaving(false);
    }
  }, [initialData, form, isOpen]);

  const handleVideoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsVideoUploading(true); setVideoUploadProgress(0); setVideoUploadError(null);
    try {
        const uniqueFileName = `${brandId}-${isEditing && initialData?.id ? initialData.id : Date.now()}-lessonvideo-${file.name}`;
        const storagePath = `${STORAGE_PATHS.LESSON_VIDEOS}/${uniqueFileName}`;
        const downloadURL = await uploadImage(file, storagePath, setVideoUploadProgress);
        form.setValue('videoUrl', downloadURL, { shouldValidate: true });
        toast({ title: "Video Uploaded", description: "Lesson video successfully uploaded." });
    } catch (error: any) {
        setVideoUploadError(error.message || "Failed to upload video.");
        toast({ title: "Video Upload Failed", description: error.message || "Could not upload video.", variant: "destructive" });
    } finally {
        setIsVideoUploading(false);
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

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <FormField control={form.control} name="title" render={({ field }) => ( <FormItem> <FormLabel className="text-base font-semibold">Name</FormLabel> <FormControl><Input placeholder="Enter lesson name" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Content</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter the main text content for this lesson..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="md:col-span-1 space-y-6">
                  <FormField control={form.control} name="featuredImageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Featured Image</FormLabel>
                      <FormControl>
                        <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                          {field.value && !isImageUploading ? ( <div className="relative aspect-video bg-muted rounded-md"><Image src={field.value ?? ''} alt="Preview" fill style={{ objectFit: 'contain' }} className="rounded-md" data-ai-hint="lesson image" onError={() => field.onChange('')} /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => field.onChange('')}><Trash2 className="h-4 w-4" /></Button></div> )
                          : isImageUploading ? ( <div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={imageUploadProgress} className="w-full h-2" />{imageUploadError && <p className="text-xs text-destructive mt-2">{imageUploadError}</p>}</div> )
                          : ( <Label htmlFor="brand-lesson-image-upload" className="cursor-pointer block"><ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload image</p><Input id="brand-lesson-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} disabled={isImageUploading} /></Label> )}
                        </div>
                      </FormControl> <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="videoUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Lesson Video</FormLabel>
                      <FormControl>
                        <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                          {field.value && !isVideoUploading ? ( <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center"><Video className="h-10 w-10 text-muted-foreground" /><p className="text-xs text-muted-foreground mt-1 truncate w-full px-2">{field.value}</p><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => field.onChange('')}><Trash2 className="h-4 w-4" /></Button></div> )
                          : isVideoUploading ? ( <div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={videoUploadProgress} className="w-full h-2" />{videoUploadError && <p className="text-xs text-destructive mt-2">{videoUploadError}</p>}</div> )
                          : ( <Label htmlFor="brand-lesson-video-upload" className="cursor-pointer block"><FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Upload video</p><Input id="brand-lesson-video-upload" type="file" accept="video/*" className="hidden" onChange={handleVideoFileChange} disabled={isVideoUploading} /></Label> )}
                        </div>
                      </FormControl> <FormMessage />
                    </FormItem>
                  )} />
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Playback Time (Optional)</Label>
                    <div className="flex items-center space-x-2">
                      <FormField control={form.control} name="playbackHours" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">h</FormLabel></FormItem>)} />
                      <FormField control={form.control} name="playbackMinutes" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">m</FormLabel></FormItem>)} />
                      <FormField control={form.control} name="playbackSeconds" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">s</FormLabel></FormItem>)} />
                    </div>
                  </div>
                  <FormField control={form.control} name="exerciseFilesInfo" render={({ field }) => ( <FormItem><FormLabel className="text-base font-semibold">Exercise Files (Optional)</FormLabel><FormControl><Textarea rows={3} placeholder="File URLs/Names (one per line)" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                </div>
              </form>
            </Form>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t bg-background z-10">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90" disabled={isSaving || isVideoUploading || isImageUploading}>
              {(isSaving || isVideoUploading || isImageUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
