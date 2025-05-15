'use client';

import React, { useTransition, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader, // Added DialogHeader
  DialogTitle} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole, User, Company, Location } from '@/types/user';
import { addUser as addUserToFirestore } from '@/lib/user-data'; // Import Firestore add user function

// Update Zod schema to include companyId and assignedLocationIds
const userFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters.' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long.' }),
  role: z
    .string()
    .min(1, { message: 'Please select a user role' }) as z.ZodType<UserRole>, // Use UserRole type
  companyId: z
    .string()
    .min(1, { message: 'Please select a company.' }),
  assignedLocationIds: z
    .array(z.string()) // Array of location IDs
    .min(1, { message: 'Please assign at least one location.' }), // Require at least one location
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface AddUserDialogProps {
  onUserAdded: (user: User) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  companies: Company[]; // Pass list of available companies
  locations: Location[]; // Pass list of available locations
  currentUser: User | null; // Pass current user to pre-select company if needed
}

// Define the role hierarchy here or import it if defined elsewhere
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

// Rename the exported component to AddUserDialog
export function AddUserDialog({ onUserAdded, isOpen, setIsOpen, companies, locations, currentUser }: AddUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]); // Locations filtered by selected company

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'Staff',
      companyId: currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '', // Pre-select company if not Super Admin
      assignedLocationIds: [],
    },
  });

  const selectedCompanyId = form.watch('companyId');

  // Filter locations when selected company changes
  useEffect(() => {
    if (selectedCompanyId) {
      setFilteredLocations(locations.filter(loc => loc.companyId === selectedCompanyId));
      form.setValue('assignedLocationIds', []); // Reset location selection when company changes
    } else {
      setFilteredLocations([]); // No company selected, no locations to show initially
    }
  }, [selectedCompanyId, locations, form]);

  // Reset form when dialog opens/closes or currentUser changes
   useEffect(() => {
     form.reset({
        name: '',
        email: '',
        password: '',
        role: 'Staff',
        companyId: currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '',
        assignedLocationIds: [],
     });
   }, [isOpen, currentUser, form]);


  const userRoles: UserRole[] = ['Admin', 'Owner', 'Manager', 'Staff']; // Exclude Super Admin for regular adding

  const onSubmit = async (data: UserFormValues) => {
    startTransition(async () => {
       // Permission check: Ensure current user can create a user with the selected role
        if (!currentUser || (currentUser.role !== 'Super Admin' && ROLE_HIERARCHY[currentUser.role] < ROLE_HIERARCHY[data.role])) {
             toast({ title: "Permission Denied", description: "You cannot create a user with a role higher than your own.", variant: "destructive"});
             return;
        }

        // Ensure locations are selected
        if (!data.assignedLocationIds || data.assignedLocationIds.length === 0) {
             form.setError("assignedLocationIds", { type: "manual", message: "User must be assigned to at least one location." });
             return;
         }


      try {
        // 1. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );
        const authUser = userCredential.user;
        console.log('New auth user created with UID: ', authUser.uid);

        // 2. Add user data to Firestore
        const newUser = await addUserToFirestore({
          name: data.name,
          email: data.email,
          role: data.role,
          companyId: data.companyId,
          assignedLocationIds: data.assignedLocationIds,
          // No need to pass isActive, handled in addUserToFirestore
        });

        if (newUser) {
            console.log('New user added to firestore with ID: ', newUser.id);
            toast({
                title: 'User Added',
                description: `${data.name} has been successfully added.`,
            });
            onUserAdded(newUser); // Pass the Firestore User object
            form.reset();
            setIsOpen(false);
        } else {
             // Handle case where Firestore add failed (e.g., duplicate email caught)
             // Consider deleting the auth user if Firestore add fails
             // await authUser.delete(); // Requires care with error handling
             throw new Error("Failed to add user details to database. Auth user might need manual cleanup.");
        }

      } catch (error: any) {
        console.error('Error creating user:', error);
        let description = 'There was a problem adding the user.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'This email address is already in use.';
        } else if (error.code === 'auth/weak-password') {
            description = 'The password is too weak.';
        }
        toast({
          title: 'User Creation Error',
          description: description,
          variant: 'destructive',
        });
      }
    });
  };

  return (
     // Removed the outer fragment and DialogTrigger
     // The Dialog component itself is now handled in the parent (e.g., AdminUsersPage)
     // DialogContent is the root element returned here
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Enter the details of the new user. They will be added to the selected company and locations.
              </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              {/* Name */}
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Full Name</FormLabel> <FormControl> <Input placeholder="John Doe" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
              {/* Email */}
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email Address</FormLabel> <FormControl> <Input type="email" placeholder="john.doe@example.com" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => ( <FormItem> <FormLabel>Password</FormLabel> <FormControl> <Input type="password" placeholder="Min. 6 characters" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />

              {/* Company Selection */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset location selection when company changes is handled by useEffect
                      }}
                      value={field.value}
                      // Disable if not Super Admin and company is pre-filled
                      disabled={currentUser?.role !== 'Super Admin' && !!currentUser?.companyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Allow Super Admin to select any company */}
                        {currentUser?.role === 'Super Admin' ? (
                           companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                           ))
                        ) : currentUser?.companyId ? (
                           // Non-Super Admin can only select their own company
                           <SelectItem value={currentUser.companyId}>
                             {companies.find(c => c.id === currentUser.companyId)?.name || 'Your Company'}
                           </SelectItem>
                        ) : (
                           // Handle case where non-super admin has no company (shouldn't happen)
                            <SelectItem value="" disabled>No company assigned</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

             {/* Location Assignment (Multi-select Checkboxes) */}
             <FormField
                control={form.control}
                name="assignedLocationIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Locations</FormLabel>
                    {selectedCompanyId && filteredLocations.length > 0 ? (
                         <ScrollArea className="h-40 w-full rounded-md border p-4">
                             <div className="space-y-2">
                                {filteredLocations.map((location) => (
                                    <FormField
                                        key={location.id}
                                        control={form.control}
                                        name="assignedLocationIds"
                                        render={({ field: checkboxField }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={checkboxField.value?.includes(location.id)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? checkboxField.onChange([...checkboxField.value, location.id])
                                                            : checkboxField.onChange(
                                                                checkboxField.value?.filter(
                                                                    (value) => value !== location.id
                                                                )
                                                                );
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    {location.name}
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                     />
                                ))}
                             </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">
                            {selectedCompanyId ? 'No locations found for this company.' : 'Please select a company first.'}
                        </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />


               {/* Role Selection */}
               <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         {/* Filter roles assignable by current user */}
                         {userRoles
                           .filter(role => currentUser && (currentUser.role === 'Super Admin' || ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[role]))
                           .map((role) => (
                             <SelectItem key={role} value={role}>{role}</SelectItem>
                           ))}
                           {/* Optional: Show disabled roles */}
                            {userRoles
                              .filter(role => currentUser && (currentUser.role !== 'Super Admin' && ROLE_HIERARCHY[currentUser.role] < ROLE_HIERARCHY[role]))
                               .map((role) => (
                                 <SelectItem key={role} value={role} disabled>{role} (Requires higher privilege)</SelectItem>
                              ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={()=>setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending}>
                  {isPending ? 'Adding...' : 'Add User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
  );
}
