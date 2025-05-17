
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // Import Image component
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
import type { Course, CourseFormData } from '@/types/course';
import { addCourse, updateCourseMetadata, getCourseById } from '@/lib/firestore-data';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Upload, ImageIcon, Trash2 } from 'lucide-react';

const courseFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Short description must be at least 10 characters.' }),
  longDescription: z.string().min(20, { message: 'Detailed description must be at least 20 characters.' }),
  imageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
  featuredImageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: 'Please select a difficulty level.' }),
  duration: z.string().min(3, { message: 'Please enter an approximate duration.' }),
  price: z.string().regex(/^\$?\d+(\.\d{1,2})?$/, { message: 'Please enter a valid price (e.g., $199 or 199.99).' }),
  subscriptionPrice: z.string().regex(/^\$?\d+(\.\d{1,2})?(\/(mo|month))?$/i, { message: 'Valid format: $29/mo or 29.99' }).optional().or(z.literal('')),
});


type CourseFormValues = z.infer<typeof courseFormSchema>;

interface AddEditCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (course: Course) => void;
  initialData: Course | null;
}

export function AddEditCourseDialog({ isOpen, setIsOpen, onSave, initialData }: AddEditCourseDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      price: '',
      subscriptionPrice: '',
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
            price: initialData.price,
            subscriptionPrice: initialData.subscriptionPrice || '',
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
            price: '',
            subscriptionPrice: '',
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
     const finalSubscriptionPrice = data.subscriptionPrice?.trim() === '' ? null : data.subscriptionPrice;

     const formData: CourseFormData = {
         title: data.title,
         description: data.description,
         longDescription: data.longDescription,
         imageUrl: data.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(data.title)}/600/350`,
         featuredImageUrl: finalFeaturedImageUrl,
         level: data.level,
         duration: data.duration,
         price: data.price,
         subscriptionPrice: finalSubscriptionPrice,
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Course' : 'Add New Course'}</DialogTitle>
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
                    <Input placeholder="e.g., Advanced Sales Techniques" {...field} />
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
                  <FormLabel>Short Description (Catalog View)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Briefly describe the course..." {...field} />
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
                  <FormLabel>Detailed Description (Course Page)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Provide a detailed overview of the course content..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              <FormItem className="space-y-2">
                <FormLabel className="text-base font-semibold">Featured Image</FormLabel>
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
                          onError={() => {
                            form.setValue('featuredImageUrl', '');
                            toast({ title: "Image Load Error", variant: "destructive" });
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
                      <Label htmlFor="course-image-upload" className="cursor-pointer block">
                        <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload image</p>
                        <Input
                          id="course-image-upload"
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
                <FormField
                  control={form.control}
                  name="featuredImageUrl"
                  render={({ field }) => (
                     <FormItem className="hidden">
                       <FormControl>
                          <Input type="url" {...field} value={field.value ?? ''} readOnly />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                  )}
                />
                 <p className="text-xs text-muted-foreground">Upload a featured image for the course.</p>
              </FormItem>

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty Level</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a level" />
                      </SelectTrigger>
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
                    <Input placeholder="e.g., Approx. 8 hours" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>One-time Price</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., $199.99" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="subscriptionPrice"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Subscription Price (Optional)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., $29/mo or $29" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>


             <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                 </DialogClose>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving || isUploading}>
                     {(isSaving || isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isEditing ? 'Save Changes' : 'Add Course'}
                 </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
    