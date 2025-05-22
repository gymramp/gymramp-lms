
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
import { Loader2, Upload, ImageIcon, Trash2, Award } from 'lucide-react'; // Added Award

// Zod schema for form validation
const brandCourseFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Short description must be at least 10 characters.' }),
  longDescription: z.string().min(20, { message: 'Detailed description must be at least 20 characters.' }),
  imageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
  featuredImageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
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
      level: undefined,
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
            imageUrl: initialData.imageUrl || '',
            featuredImageUrl: initialData.featuredImageUrl || '',
            level: initialData.level,
            duration: initialData.duration || '',
            certificateTemplateId: initialData.certificateTemplateId || null,
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
          });
        }
        setIsUploading(false);
        setUploadProgress(0);
        setUploadError(null);
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

  const onSubmit = async (data: BrandCourseFormValues) => {
    setIsSaving(true);
    const finalFeaturedImageUrl = data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl;

    const formData: BrandCourseFormData = {
        title: data.title,
        description: data.description,
        longDescription: data.longDescription,
        imageUrl: data.imageUrl?.trim() === '' ? `https://placehold.co/600x350.png?text=${encodeURIComponent(data.title)}` : data.imageUrl,
        featuredImageUrl: finalFeaturedImageUrl,
        level: data.level,
        duration: data.duration,
        certificateTemplateId: data.certificateTemplateId || null,
    };

    try {
        let savedCourse: BrandCourse | null = null;
        if (isEditing && initialData) {
            savedCourse = await updateBrandCourseMetadata(initialData.id, formData);
            if (savedCourse) {
                toast({ title: 'Brand Course Updated', description: `"${data.title}" has been successfully updated.` });
                onCourseSaved(savedCourse);
            } else {
                throw new Error("Failed to update brand course.");
            }
        } else {
            savedCourse = await createBrandCourse(brandId, formData);
            if (savedCourse) {
                toast({ title: 'Brand Course Added', description: `"${data.title}" has been successfully added.` });
                onCourseSaved(savedCourse);
            } else {
                throw new Error("Failed to add brand course.");
            }
        }
        handleClose();
    } catch (error: any) {
        console.error("Failed to save brand course:", error);
        toast({
            title: 'Error Saving Brand Course',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
            variant: 'destructive',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Brand Course' : 'Add New Brand Course'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this brand-specific course.' : 'Fill in the details for the new course for your brand.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem> <FormLabel>Course Title</FormLabel> <FormControl> <Input placeholder="e.g., Our Gym's Sales Process" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem> <FormLabel>Short Description</FormLabel> <FormControl> <Textarea rows={2} placeholder="Briefly describe the course..." {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="longDescription" render={({ field }) => ( <FormItem> <FormLabel>Detailed Description</FormLabel> <FormControl> <Textarea rows={4} placeholder="Provide a detailed overview..." {...field} value={field.value ?? ''}/> </FormControl> <FormMessage /> </FormItem> )}/>
            
            <FormItem className="space-y-2">
              <FormLabel className="text-base font-semibold">Featured Image</FormLabel>
              <FormControl>
                <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                  {featuredImageUrlValue && !isUploading ? (
                    <div className="relative w-full max-w-xs mx-auto aspect-video mb-2">
                      <Image src={featuredImageUrlValue} alt="Preview" fill style={{ objectFit: 'cover' }} className="rounded-md" data-ai-hint="course image" onError={() => { form.setValue('featuredImageUrl', ''); toast({ title: "Image Load Error", variant: "destructive" }); }}/>
                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => form.setValue('featuredImageUrl', '')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : isUploading ? (
                    <div className="py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" /><Progress value={uploadProgress} className="w-full max-w-xs h-2" />{uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}</div>
                  ) : (
                    <Label htmlFor="brand-course-image-upload" className="cursor-pointer block"><ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload</p><Input id="brand-course-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} disabled={isUploading}/></Label>
                  )}
                </div>
              </FormControl>
              <FormField control={form.control} name="featuredImageUrl" render={({ field }) => ( <FormItem className="hidden"><FormControl><Input type="url" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem> )}/>
            </FormItem>

            <FormField control={form.control} name="level" render={({ field }) => ( <FormItem> <FormLabel>Difficulty Level</FormLabel> <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select a level" /></SelectTrigger></FormControl> <SelectContent><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent> </Select> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem> <FormLabel>Approximate Duration</FormLabel> <FormControl><Input placeholder="e.g., Approx. 2 hours" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
            
            <FormField
              control={form.control}
              name="certificateTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Award className="h-4 w-4"/> Certificate Template</FormLabel>
                   <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'}
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
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving || isUploading}>
                {(isSaving || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {isEditing ? 'Save Changes' : 'Add Brand Course'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
