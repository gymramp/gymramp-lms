
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
import { Progress } from '@/components/ui/progress'; // Import Progress
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
// Use specific functions for course operations
import { addCourse, updateCourseMetadata, getCourseById } from '@/lib/firestore-data';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage'; // Import uploadImage and paths
import { ScrollArea } from '../ui/scroll-area'; // Import ScrollArea
import { Loader2, Upload, ImageIcon, Trash2 } from 'lucide-react'; // Import icons

// Zod schema: imageUrl is general, featuredImageUrl is specific for uploads/display.
const courseFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Short description must be at least 10 characters.' }),
  longDescription: z.string().min(20, { message: 'Detailed description must be at least 20 characters.' }),
  imageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')), // Keep general imageUrl
  featuredImageUrl: z.string().url({ message: "Invalid URL." }).optional().or(z.literal('')), // Add specific featuredImageUrl
  numberOfModules: z.coerce // Use coerce to convert string input from number field to number
    .number({ invalid_type_error: "Please enter a number." })
    .int({ message: "Number of modules must be a whole number."})
    .min(1, { message: 'Must have at least 1 module.' }), // Changed from modulesInput
  level: z.enum(['Beginner', 'Intermediate', 'Advanced'], { required_error: 'Please select a difficulty level.' }),
  duration: z.string().min(3, { message: 'Please enter an approximate duration.' }),
  price: z.string().regex(/^\$?\d+(\.\d{1,2})?$/, { message: 'Please enter a valid price (e.g., $199 or 199.99).' }),
});


type CourseFormValues = z.infer<typeof courseFormSchema>;

interface AddEditCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (course: Course) => void; // Use the main Course type
  initialData: Course | null; // Course or null for adding
}

export function AddEditCourseDialog({ isOpen, setIsOpen, onSave, initialData }: AddEditCourseDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false); // Add saving state
  const [isUploading, setIsUploading] = useState(false); // State for image upload
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: '',
      description: '',
      longDescription: '',
      imageUrl: '', // Keep imageUrl potentially for other uses or legacy
      featuredImageUrl: '', // Default featured image to empty string
      numberOfModules: 1, // Default to 1 module
      level: undefined, // Let placeholder show
      duration: '',
      price: '',
    },
  });

  const featuredImageUrlValue = form.watch('featuredImageUrl'); // Watch the FEATURED image URL for preview

   // Effect to populate form when initialData changes (for editing) or dialog opens
   useEffect(() => {
    if (isOpen) {
        if (initialData) {
          form.reset({
            title: initialData.title,
            description: initialData.description,
            longDescription: initialData.longDescription,
            imageUrl: initialData.imageUrl || '', // Use existing general image URL
            featuredImageUrl: initialData.featuredImageUrl || '', // Use existing featured image URL
            numberOfModules: initialData.modules?.length || 1, // Get length of modules array
            level: initialData.level,
            duration: initialData.duration,
            price: initialData.price,
          });
        } else {
          form.reset({ // Reset form if adding a new course
            title: '',
            description: '',
            longDescription: '',
            imageUrl: '', // Start empty
            featuredImageUrl: '', // Start featured empty
            numberOfModules: 1,
            level: undefined,
            duration: '',
            price: '',
          });
        }
         // Reset upload state when dialog opens
         setIsUploading(false);
         setUploadProgress(0);
         setUploadError(null);
    }
  }, [initialData, form, isOpen]);


  // Handle file selection and upload for Featured Image
   const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;

       setIsUploading(true);
       setUploadProgress(0);
       setUploadError(null);

       try {
           // Generate a unique filename
           const uniqueFileName = isEditing && initialData?.id
             ? `${initialData.id}-courseimg-${file.name}`
             : `${Date.now()}-courseimg-${file.name}`;
           const storagePath = `${STORAGE_PATHS.COURSE_IMAGES}/${uniqueFileName}`; // Use course image path

           const downloadURL = await uploadImage(file, storagePath, setUploadProgress);

           form.setValue('featuredImageUrl', downloadURL, { shouldValidate: true }); // Update featuredImageUrl form field
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
     setIsSaving(true); // Set saving state
     // Handle the empty string case for featuredImageUrl
     const finalFeaturedImageUrl = data.featuredImageUrl?.trim() === '' ? null : data.featuredImageUrl;

     // Prepare form data object matching CourseFormData type
     // Ensure featuredImageUrl is correctly passed
     const formData: CourseFormData = {
         title: data.title,
         description: data.description,
         longDescription: data.longDescription,
         imageUrl: data.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(data.title)}/600/350`, // Fallback for general imageUrl
         featuredImageUrl: finalFeaturedImageUrl, // Pass the final featured URL (could be null)
         numberOfModules: data.numberOfModules, // Pass the number
         level: data.level,
         duration: data.duration,
         price: data.price,
     };


    try {
        let savedCourse: Course | null = null;
        if (isEditing && initialData) {
            // Update existing course metadata in Firestore
            savedCourse = await updateCourseMetadata(initialData.id, formData);
            if (savedCourse) {
                toast({ title: 'Course Updated', description: `"${data.title}" has been successfully updated.` });
                onSave(savedCourse); // Pass the potentially updated course data
            } else {
                 throw new Error("Failed to update course.");
            }
        } else {
            // Add new course to Firestore (addCourse now handles empty curriculum)
            savedCourse = await addCourse(formData);
            if (savedCourse) {
                toast({ title: 'Course Added', description: `"${data.title}" has been successfully added.` });
                onSave(savedCourse); // Call the callback with the new course
            } else {
                throw new Error("Failed to add course.");
            }
        }

        handleClose(); // Close dialog after successful save

    } catch (error: any) {
        console.error("Failed to save course:", error);
        toast({
            title: 'Error Saving Course',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
            variant: 'destructive',
        });
    } finally {
        setIsSaving(false); // Reset saving state
    }
  };

  // Handle closing the dialog
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
            {/* Title */}
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

            {/* Short Description */}
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

             {/* Long Description */}
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

             {/* Featured Image Upload */}
              <FormItem className="space-y-2">
                <FormLabel className="text-base font-semibold">Featured Image</FormLabel>
                <FormControl>
                  <div className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary">
                    {featuredImageUrlValue && !isUploading ? ( // Use featuredImageUrlValue
                      <div className="relative w-full max-w-xs mx-auto aspect-video mb-2"> {/* Fixed size preview */}
                        <Image
                          src={featuredImageUrlValue} // Use featuredImageUrlValue
                          alt="Featured image preview"
                          fill
                          style={{ objectFit: 'cover' }} // Use cover for aspect ratio
                          className="rounded-md"
                          onError={() => {
                            form.setValue('featuredImageUrl', ''); // Clear featuredImageUrl if broken
                            toast({ title: "Image Load Error", variant: "destructive" });
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100 z-10"
                          onClick={() => form.setValue('featuredImageUrl', '')} // Clear featuredImageUrl
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
                          accept="image/*" // Accept only image files
                          className="hidden"
                          onChange={handleImageFileChange}
                          disabled={isUploading}
                        />
                      </Label>
                    )}
                  </div>
                </FormControl>
                 {/* Input to store featuredImageUrl for validation */}
                <FormField
                  control={form.control}
                  name="featuredImageUrl" // Ensure this points to featuredImageUrl
                  render={({ field }) => (
                     <FormItem className="hidden">
                       <FormControl>
                          <Input type="url" {...field} value={field.value ?? ''} readOnly />
                       </FormControl>
                       <FormMessage /> {/* Display validation errors for the URL */}
                     </FormItem>
                  )}
                />
                 <p className="text-xs text-muted-foreground">Upload a featured image for the course.</p>
              </FormItem>

               {/* General imageUrl (Optional, can be hidden or used differently) */}
                {/* <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                       <FormLabel>General Image URL (Optional)</FormLabel>
                       <FormControl>
                         <Input type="url" placeholder="Paste a general image URL (optional)" {...field} value={field.value ?? ''} />
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                  )}
                /> */}


             {/* Number of Modules Input */}
             <FormField
              control={form.control}
              name="numberOfModules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Modules</FormLabel>
                  <FormControl>
                     {/* Use Input type="number" */}
                    <Input type="number" min="1" step="1" placeholder="e.g., 5" {...field} />
                  </FormControl>
                   <FormMessage />
                   <p className="text-xs text-muted-foreground">Enter the total number of modules in this course.</p>
                </FormItem>
              )}
            />

             {/* Level */}
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

            {/* Duration */}
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

             {/* Price */}
             <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., $199.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
