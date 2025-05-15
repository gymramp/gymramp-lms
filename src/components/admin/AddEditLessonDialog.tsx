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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from "@/components/ui/alert"; // Removed AlertTitle import
import { Progress } from "@/components/ui/progress"; // Import Progress component
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Import Select components
import { ScrollArea } from '../ui/scroll-area'; // Import ScrollArea
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { createLesson, updateLesson } from '@/lib/firestore-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage'; // Use uploadImage for videos too for now
import type { Lesson, LessonFormData } from '@/types/course';
import { Upload, Link as LinkIcon, PlaySquare, Info, FileUp, Image as ImageIconLucide, Trash2, Bold, Italic, Underline, List, ListOrdered, Quote, Link as LinkEditorIcon, Code, Loader2, Video } from 'lucide-react'; // Renamed Image icon to avoid conflict
import { cn } from '@/lib/utils'; // Ensure cn is imported

// **Updated:** List of images assumed to be in `public/images` directory
// Replace these with the actual filenames in your `public/images` folder.
const availableImages = [
  { value: '/images/hero.png', label: 'Hero Image (Woman on Phone)' },
  { value: '/images/newlogo.png', label: 'GYMRAMP Logo' },
  // Add more image paths relative to the /public directory
  // Example: { value: '/images/lesson-thumbnail-1.jpg', label: 'Lesson Thumbnail 1' },
  { value: '', label: 'No Image / Use Default' }, // Option for no image
];

// Update Zod schema: featuredImageUrl is now optional string (URL), handled separately.
const lessonFormSchema = z.object({
  title: z.string().min(3, { message: 'Lesson title must be at least 3 characters.' }),
  content: z.string().min(10, { message: 'Lesson content must be at least 10 characters.' }),
  featuredImageUrl: z.string().optional(), // URL or empty string, handled by select
  videoUrl: z.string().url({ message: 'Invalid video URL format.' }).optional().or(z.literal('')), // Video upload handled separately
  playbackHours: z.coerce.number().min(0).optional(), // Use coerce for number inputs
  playbackMinutes: z.coerce.number().min(0).max(59).optional(),
  playbackSeconds: z.coerce.number().min(0).max(59).optional(),
  exerciseFilesInfo: z.string().optional(),
  isPreviewAvailable: z.boolean().default(false),
});


type LessonFormValues = z.infer<typeof lessonFormSchema>;

interface AddEditLessonDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Lesson | null;
  onLessonSaved: (lesson: Lesson) => void;
}

export function AddEditLessonDialog({
  isOpen,
  setIsOpen,
  initialData,
  onLessonSaved,
}: AddEditLessonDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isVisualMode, setIsVisualMode] = useState(true);
  // State for video upload
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
   // State for image upload
   const [isImageUploading, setIsImageUploading] = useState(false);
   const [imageUploadProgress, setImageUploadProgress] = useState(0);
   const [imageUploadError, setImageUploadError] = useState<string | null>(null);


  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: '',
      content: '',
      featuredImageUrl: '', // Default to empty string
      videoUrl: '',
      playbackHours: 0,
      playbackMinutes: 0,
      playbackSeconds: 0,
      exerciseFilesInfo: '',
      isPreviewAvailable: false,
    },
  });

  const selectedImageUrl = form.watch('featuredImageUrl'); // Watch selected image URL
  const videoUrlValue = form.watch('videoUrl'); // Watch video URL

  useEffect(() => {
    if (initialData) {
       // Basic parsing for playbackTime string "Xh Ym Zs" - enhance as needed
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
        title: initialData.title,
        content: initialData.content,
        featuredImageUrl: initialData.featuredImageUrl || '', // Use existing or default to empty
        videoUrl: initialData.videoUrl || '',
        playbackHours: hours,
        playbackMinutes: minutes,
        playbackSeconds: seconds,
        exerciseFilesInfo: initialData.exerciseFilesInfo || '',
        isPreviewAvailable: initialData.isPreviewAvailable || false,
      });
    } else {
      form.reset({
        title: '',
        content: '',
        featuredImageUrl: '', // Start empty
        videoUrl: '',
        playbackHours: 0,
        playbackMinutes: 0,
        playbackSeconds: 0,
        exerciseFilesInfo: '',
        isPreviewAvailable: false,
      });
    }
    setIsVideoUploading(false); // Reset video upload state
    setVideoUploadProgress(0);
    setVideoUploadError(null);
     setIsImageUploading(false); // Reset image upload state
     setImageUploadProgress(0);
     setImageUploadError(null);


  }, [initialData, form, isOpen]); // Add isOpen dependency


    // Handle video file selection and upload
    const handleVideoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log("Video file selected:", file.name);
        setIsVideoUploading(true); // Use video uploading state
        setVideoUploadProgress(0);
        setVideoUploadError(null);

        try {
            console.log("Starting video upload...");
            const uniqueFileName = isEditing && initialData?.id
                ? `${initialData.id}-video-${file.name}` // Include 'video' identifier
                : `${Date.now()}-video-${file.name}`;
            const storagePath = `${STORAGE_PATHS.LESSON_VIDEOS}/${uniqueFileName}`; // Use video path
            console.log("Video storage path:", storagePath);

            // Use the same uploadImage function, storage handles file types
            const downloadURL = await uploadImage(file, storagePath, setVideoUploadProgress);

            console.log("Video upload complete, URL:", downloadURL);
            form.setValue('videoUrl', downloadURL, { shouldValidate: true }); // Set videoUrl field
            toast({
                title: "Video Uploaded",
                description: "Lesson video successfully uploaded.",
            });

        } catch (error: any) {
            console.error("Video upload failed:", error);
            setVideoUploadError(error.message || "Failed to upload video.");
            toast({
                title: "Video Upload Failed",
                description: error.message || "Could not upload the lesson video.",
                variant: "destructive",
            });
        } finally {
            console.log("Setting isVideoUploading to false");
            setIsVideoUploading(false);
        }
    };

      // Handle FEATURED IMAGE file selection and upload
      const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
         const file = event.target.files?.[0];
         if (!file) return;

         setIsImageUploading(true); // Use image uploading state
         setImageUploadProgress(0);
         setImageUploadError(null);

         try {
             const uniqueFileName = isEditing && initialData?.id
                 ? `${initialData.id}-image-${file.name}`
                 : `${Date.now()}-image-${file.name}`;
             const storagePath = `${STORAGE_PATHS.LESSON_IMAGES}/${uniqueFileName}`;

             const downloadURL = await uploadImage(file, storagePath, setImageUploadProgress);

             form.setValue('featuredImageUrl', downloadURL, { shouldValidate: true }); // Set featuredImageUrl field
             toast({
                 title: "Image Uploaded",
                 description: "Featured image successfully uploaded.",
             });

         } catch (error: any) {
             setImageUploadError(error.message || "Failed to upload image.");
             toast({
                 title: "Image Upload Failed",
                 description: error.message || "Could not upload the featured image.",
                 variant: "destructive",
             });
         } finally {
             setIsImageUploading(false);
         }
     };


  const onSubmit = async (data: LessonFormValues) => {
    // Prevent submission while uploading video OR image
    if (isVideoUploading || isImageUploading) {
        toast({
            title: "Upload in Progress",
            description: "Please wait for uploads to complete.",
            variant: "destructive",
        });
        return;
    }

    try {
      let savedLesson: Lesson | null = null;

       // Handle potentially empty strings, converting them to null for Firestore
       const featuredImageUrl = data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl; // Get from form
       const videoUrl = data.videoUrl?.trim() === '' ? null : data.videoUrl; // Get from form
       const exerciseFilesInfo = data.exerciseFilesInfo?.trim() === '' ? null : data.exerciseFilesInfo;


      const hours = data.playbackHours || 0;
      const minutes = data.playbackMinutes || 0;
      const seconds = data.playbackSeconds || 0;
      const playbackTime = (hours > 0 || minutes > 0 || seconds > 0)
        ? `${hours}h ${minutes}m ${seconds}s`
        : null;

      // Prepare data ensuring consistency with Firestore (null for optional empty fields)
      const lessonData: LessonFormData = {
        title: data.title,
        content: data.content,
        featuredImageUrl: featuredImageUrl, // Use URL from form state
        videoUrl: videoUrl, // Use the URL from the form state (set by upload or paste)
        exerciseFilesInfo: exerciseFilesInfo,
        isPreviewAvailable: data.isPreviewAvailable,
        playbackTime: playbackTime,
      };

      if (isEditing && initialData) {
        savedLesson = await updateLesson(initialData.id, lessonData);
      } else {
        savedLesson = await createLesson(lessonData);
      }

      if (savedLesson) {
        toast({
          title: isEditing ? 'Lesson Updated' : 'Lesson Added',
          description: `"${data.title}" has been successfully saved.`,
        });
        onLessonSaved(savedLesson);
        handleClose();
      } else {
        throw new Error("Failed to save lesson.");
      }
    } catch (error) {
      console.error("Failed to save lesson:", error);
      toast({
        title: 'Error Saving Lesson',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    }
  };


  const handleClose = () => {
    // form.reset(); // Resetting is handled by useEffect now
    setIsVideoUploading(false); // Reset video state too
    setVideoUploadProgress(0);
    setVideoUploadError(null);
     setIsImageUploading(false); // Reset image state
     setImageUploadProgress(0);
     setImageUploadError(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center space-x-2">
              <PlaySquare className="h-6 w-6 text-primary" />
              <DialogTitle className="text-xl">{isEditing ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
            </div>
            <DialogDescription>
              {isEditing ? 'Update the details of this lesson.' : 'Create a standalone lesson that can be added to course curriculums.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* --- Left Column --- */}
                <div className="md:col-span-2 space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter lesson name" {...field} className="text-base py-2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center justify-between">
                          Content
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            rows={10}
                            placeholder="Enter the main text content for this lesson..."
                            {...field}
                            className="text-base mt-1"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground pt-1">Use Markdown or integrate a real WYSIWYG editor for full formatting functionality.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* --- Right Column --- */}
                <div className="md:col-span-1 space-y-6">
                     {/* Featured Image Upload */}
                      <FormField
                         control={form.control}
                         name="featuredImageUrl"
                         render={({ field }) => (
                             <FormItem>
                                 <FormLabel className="text-base font-semibold">Featured Image</FormLabel>
                                 <FormControl>
                                     <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                                         {field.value && !isImageUploading ? (
                                             <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center">
                                                 <Image
                                                     src={field.value} // Use the URL from form state
                                                     alt="Featured image preview"
                                                     fill
                                                     style={{ objectFit: 'contain' }} // Use contain to show full image
                                                     className="rounded-md"
                                                     onError={() => field.onChange('')} // Clear on error
                                                 />
                                                 <Button
                                                     type="button"
                                                     variant="destructive"
                                                     size="icon"
                                                     className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                                                     onClick={() => field.onChange('')} // Clear field
                                                     aria-label="Remove image"
                                                 > <Trash2 className="h-4 w-4" /> </Button>
                                             </div>
                                         ) : isImageUploading ? (
                                             <div className="flex flex-col items-center justify-center h-full py-8">
                                                 <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                                 <p className="text-sm text-muted-foreground mb-1">Uploading Image...</p>
                                                 <Progress value={imageUploadProgress} className="w-full h-2" />
                                                 {imageUploadError && <p className="text-xs text-destructive mt-2">{imageUploadError}</p>}
                                             </div>
                                         ) : (
                                             <Label htmlFor="lesson-image-upload" className="cursor-pointer block">
                                                 <ImageIconLucide className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                                 <p className="text-sm text-muted-foreground">Click to upload image</p>
                                                 {/* Hidden Input for image file selection */}
                                                 <Input
                                                     id="lesson-image-upload"
                                                     type="file"
                                                     accept="image/*" // Accept image files
                                                     className="hidden"
                                                     onChange={handleImageFileChange}
                                                     disabled={isImageUploading}
                                                 />
                                             </Label>
                                         )}
                                     </div>
                                 </FormControl>
                                  <FormMessage />
                                  <p className="text-xs text-muted-foreground">Upload an image or select from existing list.</p>
                             </FormItem>
                         )}
                     />


                    {/* Video Upload */}
                    <FormField
                        control={form.control}
                        name="videoUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base font-semibold">Lesson Video</FormLabel>
                                <FormControl>
                                     <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                                         {field.value && !isVideoUploading ? (
                                            <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center">
                                                {/* Basic preview for video URL - enhance as needed */}
                                                <Video className="h-10 w-10 text-muted-foreground" />
                                                <p className="text-xs text-muted-foreground mt-1 truncate w-full px-2">{field.value}</p>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                                                    onClick={() => field.onChange('')} // Clear field
                                                    aria-label="Remove video"
                                                > <Trash2 className="h-4 w-4" /> </Button>
                                            </div>
                                         ) : isVideoUploading ? (
                                            <div className="flex flex-col items-center justify-center h-full py-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                                <p className="text-sm text-muted-foreground mb-1">Uploading Video...</p>
                                                <Progress value={videoUploadProgress} className="w-full h-2" />
                                                {videoUploadError && <p className="text-xs text-destructive mt-2">{videoUploadError}</p>}
                                            </div>
                                         ) : (
                                             <Label htmlFor="lesson-video-upload" className="cursor-pointer block">
                                                 <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                                 <p className="text-sm text-muted-foreground">Click to upload video</p>
                                                 {/* Hidden Input for video file selection */}
                                                  <Input
                                                     id="lesson-video-upload"
                                                     type="file"
                                                     accept="video/*" // Accept video files
                                                     className="hidden"
                                                     onChange={handleVideoFileChange}
                                                     disabled={isVideoUploading}
                                                  />
                                             </Label>
                                         )}
                                     </div>
                                 </FormControl>
                                 <FormMessage />
                                  <p className="text-xs text-muted-foreground">Upload a video file for this lesson.</p>
                             </FormItem>
                         )}
                     />



                  {/* Playback Time */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Video Playback Time (Optional)</Label>
                    <div className="flex items-center space-x-2">
                      <FormField control={form.control} name="playbackHours" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} className="text-center" /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">h</FormLabel></FormItem>)} />
                      <FormField control={form.control} name="playbackMinutes" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} className="text-center" /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">m</FormLabel></FormItem>)} />
                      <FormField control={form.control} name="playbackSeconds" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input type="number" min="0" max="59" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} className="text-center" /></FormControl><FormLabel className="text-xs text-muted-foreground block text-center">s</FormLabel></FormItem>)} />
                    </div>
                    <FormMessage /> {/* Add FormMessage for playback time fields if needed */}
                  </div>

                  {/* Exercise Files */}
                  <FormField
                    control={form.control}
                    name="exerciseFilesInfo"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-base font-semibold">Exercise Files (Optional)</FormLabel>
                        <FormLabel className="text-xs text-muted-foreground pt-1 block">Enter File URLs/Names (one per line)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="worksheet.pdf\nhttps://example.com/resource.zip" {...field} value={field.value ?? ''} className="text-sm" />
                        </FormControl> <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview Toggle */}
                    <FormField
                      control={form.control}
                      name="isPreviewAvailable"
                      render={({ field }) => (
                        <FormItem className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-base font-semibold flex items-center">Lesson Preview <Info className="h-4 w-4 text-muted-foreground ml-1.5" /></FormLabel>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                             </FormControl>
                          </div>
                          <Alert variant={field.value ? "success" : "default"} className={`bg-opacity-10 border-opacity-30`}>
                            <Info className={`h-4 w-4 ${field.value ? 'text-green-600' : 'text-muted-foreground'}`} />
                            <AlertDescription className={`text-xs ${field.value ? 'text-green-800' : 'text-muted-foreground'}`}>
                              {field.value ? "Preview enabled. Non-enrolled users can view this lesson." : "Preview disabled. Only enrolled users can view this lesson."}
                            </AlertDescription>
                          </Alert>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </form>
            </Form>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t bg-background z-10">
             <DialogClose asChild>
               <Button type="button" variant="outline">Cancel</Button>
             </DialogClose>
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90" disabled={isImageUploading || isVideoUploading}>
              {(isImageUploading || isVideoUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? 'Save Changes' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}