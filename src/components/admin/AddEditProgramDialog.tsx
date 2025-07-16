
'use client';

import React, { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Program, ProgramFormData } from '@/types/course';
import { useToast } from '@/hooks/use-toast';
import { createProgram, updateProgram } from '@/lib/firestore-data';
import { Loader2 } from 'lucide-react';

// Simplified schema with only basic fields
const programFormSchema = z.object({
  title: z.string().min(3, { message: 'Program title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

interface AddEditProgramDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialData: Program | null;
  onSave: (program: Program) => void;
}

export function AddEditProgramDialog({ isOpen, setIsOpen, initialData, onSave }: AddEditProgramDialogProps) {
  const isEditing = !!initialData;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          title: initialData.title || '',
          description: initialData.description || '',
        });
      } else {
        form.reset({
            title: '',
            description: '',
        });
      }
    }
  }, [initialData, form, isOpen]);

  const onSubmit = async (data: ProgramFormValues) => {
    setIsSaving(true);
    try {
      let savedProgram: Program | null = null;
      // Construct a partial ProgramFormData, as other fields are now handled with defaults server-side
      const programData: Partial<ProgramFormData> = {
        title: data.title,
        description: data.description,
        // Other fields will use defaults or remain unchanged on update
      };

      if (isEditing && initialData) {
        savedProgram = await updateProgram(initialData.id, programData);
      } else {
        // We cast here because createProgram expects more, but will use defaults for missing fields
        savedProgram = await createProgram(programData as ProgramFormData);
      }

      if (savedProgram) {
        toast({ title: isEditing ? 'Program Updated' : 'Program Added', description: `"${savedProgram.title}" has been successfully saved.` });
        onSave(savedProgram);
        handleClose();
      } else {
        throw new Error('Failed to save program.');
      }
    } catch (error: any) {
      toast({ title: 'Error Saving Program', description: error.message || 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Program' : 'Add Program'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this program.' : 'Enter the details for the new program.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sales Mastery Program" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="A brief overview of the program..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Program'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
