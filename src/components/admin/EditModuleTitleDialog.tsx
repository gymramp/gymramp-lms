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
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

// Zod schema for the module title
const moduleTitleSchema = z.object({
  title: z.string().min(1, { message: 'Module title cannot be empty.' }),
});

type ModuleTitleFormValues = z.infer<typeof moduleTitleSchema>;

interface EditModuleTitleDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentTitle: string;
  moduleIndex: number;
  onSave: (index: number, newTitle: string) => void; // Callback with index and new title
}

export function EditModuleTitleDialog({
  isOpen,
  setIsOpen,
  currentTitle,
  moduleIndex,
  onSave,
}: EditModuleTitleDialogProps) {
  const { toast } = useToast();

  const form = useForm<ModuleTitleFormValues>({
    resolver: zodResolver(moduleTitleSchema),
    defaultValues: {
      title: currentTitle,
    },
  });

  // Reset form when dialog opens or currentTitle changes
  useEffect(() => {
    if (isOpen) {
      form.reset({ title: currentTitle });
    }
  }, [isOpen, currentTitle, form]);

  const onSubmit = (data: ModuleTitleFormValues) => {
    if (data.title === currentTitle) {
        toast({
            title: "No Changes",
            description: "The module title was not changed.",
            variant: "default"
        });
        setIsOpen(false);
        return;
    }
    onSave(moduleIndex, data.title);
    // Parent component handles API call, toast confirmation, and closing
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Module Title</DialogTitle>
          <DialogDescription>
            Enter a new title for this module (Module {moduleIndex + 1}).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Module Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter new title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Save Title
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
