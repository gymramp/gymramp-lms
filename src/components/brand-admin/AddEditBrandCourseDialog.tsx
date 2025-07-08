
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
import type { BrandCourse, BrandCourseFormData } from '@/types/course';
import { createBrandCourse, updateBrandCourseMetadata } from '@/lib/brand-content-data';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { Loader2, Upload, ImageIcon, Trash2, Award } from 'lucide-react';

// Zod schema for form validation
const brandCourseFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Short description must be at least 10 characters.' }),
  longDescription: z.string().min(20, { message: 'Detailed description must be at least 20 characters.' }),
  imageUrl: z.string().url({ message: "Invalid URL for placeholder." }).optional().or(z.literal('')), // Kept for now, but featuredImageUrl is primary
  featuredImageUrl: z.string().url({ message: "Invalid URL for featured image." }).optional().or(z.literal('')),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: 'Please select a difficulty level.' }),
  duration: z.string().min(3, { message: 'Please enter an approximate duration.' }),
  certificateTemplateId: z.string().optional().nullable(),
});

type BrandCourseFormValues = z.infer<typeof brandCourseFormSchema>;

interface AddEditBrandCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  brandId: string;
  onCourseSaved: (course: BrandCourse) => void;
  initialData: BrandCourse | null;
}

const CERTIFICATE_TEMPLATES = [
    { value: 'template-a', label: 'Template A - Modern Blue' },
    { value: 'template-b', label: 'Template B - Classic Gold' },
    { value: 'template-c', label: 'Template C - Formal Silver' },
    { value: 'template-d', label: 'Template D - Creative Green' },
];

export function AddEditBrandCourseDialog({ isOpen, setIsOpen, brandId, onCourseSaved, initialData }: AddEditBrandCourseDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm<BrandCourseFormValues>({
    resolver: zodResolver(brandCourseFormSchema),
    defaultValues: {
      title: '',
      description: '',
      longDescription: '',
      imageUrl: '',
      featuredImageUrl: '',
      level: undefined, // Let placeholder show
      duration: '',
      certificateTemplateId: null,
    },
  });

  const featuredImageUrlValue = form.watch('featuredImageUrl');

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
          form.reset({
            title: initialData.title || '',
            description: initialData.description || '',
            longDescription: initialData.longDescription || '',
            imageUrl: initialData.imageUrl || '', // Retain if set, fallback if not
            featuredImageUrl: initialData.featuredImageUrl || '',
            level: initialData.level,
            duration: initialData.duration || '',
            certificateTemplateId: initialData.certificateTemplateId || null,
          });
        } else {
          form.reset({ // Strict defaults for new course
            title: '',
            description: '',
            longDescription: '',
            imageUrl: '',
            featuredImageUrl: '',
            level: undefined,
            duration: '',
            certificateTemplateId: null,
          });
        }
        setIsUploading(false);
        setUploadProgress(0);
        setUploadError(null);
        setIsSaving(false);
    }
  }, [initialData, form, isOpen]);


  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
        const uniqueFileName = `${brandId}-${isEditing && initialData?.id ? initialData.id : Date.now()}-brandcourseimg-${file.name}`;
        const storagePath = `${STORAGE_PATHS.COURSE_IMAGES}/${uniqueFileName}`; // Use a common path, perhaps differentiate if needed

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

  const onSubmit = async (data: BrandCourseFormValues) => {
    if (isSaving) return;
    setIsSaving(true);

    const finalFeaturedImageUrl = data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl;
    const finalImageUrl = data.imageUrl?.trim() === '' ? `https://placehold.co/600x350.png?text=${encodeURIComponent(data.title)}` : data.imageUrl;

    const formData: BrandCourseFormData = {
        title: data.title,
        description: data.description,
        longDescription: data.longDescription,
        imageUrl: finalImageUrl, // Use placeholder if featured is also empty
        featuredImageUrl: finalFeaturedImageUrl,
        level: data.level,
        duration: data.duration,
        certificateTemplateId: data.certificateTemplateId || null,
    };

    try {
        let savedCourse: BrandCourse | null = null;
        if (isEditing && initialData) {
            savedCourse = await updateBrandCourseMetadata(initialData.id, formData);
        } else {
            savedCourse = await createBrandCourse(brandId, formData);
        }

        if (savedCourse) {
            toast({ title: isEditing ? 'Course Updated' : 'Course Created', description: `"${savedCourse.title}" has been successfully saved.` });
            onCourseSaved(savedCourse);
            handleClose(); // Close dialog on success
        } else {
            throw new Error(isEditing ? "Failed to update course." : "Failed to create course.");
        }
    } catch (error: any) {
        console.error("Failed to save brand course:", error);
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
    // Form reset is handled by useEffect when isOpen changes
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit My Course' : 'Add New Course'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this course.' : 'Fill in the details for the new course.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Our Gym's Sales Process" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description (for listings)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Briefly describe the course..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="longDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Description (for course page)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Provide a detailed overview of the course content, learning objectives, etc." {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormItem className="space-y-2">
              <FormLabel className="text-base font-medium">Featured Image</FormLabel>
              <FormControl>
                <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                  {featuredImageUrlValue && !isUploading ? (
                    <div className="relative w-full max-w-xs mx-auto aspect-video mb-2">
                      <Image
                        src={featuredImageUrlValue}
                        alt="Featured image preview"
                        fill
                        style={{ objectFit: 'cover' }}
                        className="rounded-md"
                        data-ai-hint="course image"
                        onError={() => {
                          form.setValue('featuredImageUrl', '');
                          toast({ title: "Image Load Error", description: "Could not load the preview image.", variant: "destructive" });
                        }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                        onClick={() => form.setValue('featuredImageUrl', '')}
                        aria-label="Remove Image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : isUploading ? (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Uploading...</p>
                      <Progress value={uploadProgress} className="w-full max-w-xs h-2" />
                      {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                    </div>
                  ) : (
                    <Label htmlFor="brand-course-image-upload" className="cursor-pointer block">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload image</p>
                      <Input
                        id="brand-course-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                        disabled={isUploading}
                      />
                    </Label>
                  )}
                </div>
              </FormControl>
              {/* Hidden input to store the URL from upload or manual entry if needed */}
              <FormField
                control={form.control}
                name="featuredImageUrl"
                render={({ field }) => (
                  <FormItem className="hidden"> {/* Keep hidden, value managed by upload/clear */}
                    <FormControl>
                       <Input type="url" {...field} value={field.value ?? ''} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">This image will be used as the primary visual for the course.</p>
            </FormItem>

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      {/* Wrap SelectTrigger in a div to ensure FormControl has a single child */}
                      <div> 
                        <SelectTrigger>
                          <SelectValue placeholder="Select a level" />
                        </SelectTrigger>
                      </div>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approximate Duration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Approx. 2 hours" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="certificateTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Award className="h-4 w-4"/> Certificate Template</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'} // Use 'none' as the value for the placeholder
                  >
                    <FormControl>
                      <div> {/* Wrapper for SelectTrigger */}
                        <SelectTrigger>
                          <SelectValue placeholder="Select a certificate template" />
                        </SelectTrigger>
                      </div>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None (Default)</SelectItem>
                      {CERTIFICATE_TEMPLATES.map(template => (
                        <SelectItem key={template.value} value={template.value}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving || isUploading}>
                {(isSaving || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {isEditing ? 'Save Changes' : 'Add Course'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
