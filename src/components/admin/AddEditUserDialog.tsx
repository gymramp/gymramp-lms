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
  DialogHeader,
  DialogTitle,
  DialogClose
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'; // Import signInWithEmailAndPassword
import { auth } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole, User, Company, Location } from '@/types/user'; // Import Location
import { addUser as addUserToFirestore } from '@/lib/user-data';
import { AlertCircle } from 'lucide-react'; // Import AlertCircle

// Update Zod schema to include all fields
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
    .min(1, { message: 'Please select a user role' }) as z.ZodType<UserRole>,
  companyId: z
    .string() // Company ID is now required
    .min(1, { message: 'Please select a company.' }),
  assignedLocationIds: z
    .array(z.string())
    .min(1, { message: 'Please assign at least one location.' }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface AddUserDialogProps {
  onUserAdded: (user: User) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  companies: Company[];
  locations: Location[];
  currentUser: User | null;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

const USER_ROLES: UserRole[] = ['Admin', 'Owner', 'Manager', 'Staff']; // Exclude Super Admin for regular adding

export function AddUserDialog({ onUserAdded, isOpen, setIsOpen, companies, locations, currentUser }: AddUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'Staff',
      companyId: currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '',
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
      setFilteredLocations([]);
    }
  }, [selectedCompanyId, locations, form]);


  // Reset form when dialog opens/closes or currentUser changes
  useEffect(() => {
     const initialCompanyId = currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '';
     form.reset({
        name: '',
        email: '',
        password: '',
        role: 'Staff',
        companyId: initialCompanyId,
        assignedLocationIds: [],
     });
     // Re-filter locations based on potentially pre-filled companyId
     if (initialCompanyId) {
        setFilteredLocations(locations.filter(loc => loc.companyId === initialCompanyId));
     } else {
        setFilteredLocations([]); // Reset locations if Super Admin or no initial company
     }
   }, [isOpen, currentUser, form, locations]); // Added locations dependency


  const onSubmit = async (data: UserFormValues) => {
      const originalAdminEmail = auth.currentUser?.email; // Store the original admin's email
      // !! IMPORTANT: Fetching/Storing admin password like this is insecure !!
      // !! This is a placeholder and needs a secure mechanism in production !!
      // !! e.g., using a backend function, session management, or re-authentication prompt !!
      // const originalAdminPassword = prompt("Please re-enter your admin password:");
      const originalAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "password"; // Highly insecure fallback

      if (!originalAdminEmail || !originalAdminPassword) {
           toast({ title: "Admin Session Error", description: "Could not verify admin session. Please log in again.", variant: "destructive" });
           return;
       }


      startTransition(async () => {
          // Permission check
          if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin' && currentUser.role !== 'Owner')) {
              toast({ title: "Permission Denied", description: "You do not have permission to add users.", variant: "destructive"});
              return;
          }
          if (currentUser.role !== 'Super Admin' && ROLE_HIERARCHY[currentUser.role] < ROLE_HIERARCHY[data.role]) {
              toast({ title: "Permission Denied", description: "You cannot create a user with a role higher than or equal to your own.", variant: "destructive"});
              return;
          }

          // Location check
          if (!data.assignedLocationIds || data.assignedLocationIds.length === 0) {
               form.setError("assignedLocationIds", { type: "manual", message: "User must be assigned to at least one location." });
               return;
           }
           // Company check
           if (!data.companyId) {
                form.setError("companyId", { type: "manual", message: "Company selection is required." });
                return;
           }

        try {
            // 1. Create Firebase Auth user (this temporarily signs in the new user)
            const userCredential = await createUserWithEmailAndPassword(
            auth,
            data.email,
            data.password
            );
            const authUser = userCredential.user;
            console.log('New auth user created and temporarily signed in: ', authUser.uid);

            // 2. Add user data to Firestore
            const newUser = await addUserToFirestore({
            name: data.name,
            email: data.email,
            role: data.role,
            companyId: data.companyId, // Ensure companyId is included
            assignedLocationIds: data.assignedLocationIds,
            });

            if (newUser) {
                console.log('New user added to firestore with ID: ', newUser.id);
                toast({
                    title: 'User Added',
                    description: `${data.name} has been successfully added.`,
                });

                 // 3. Sign back in as the original admin
                 try {
                     console.log(`Attempting to sign back in as ${originalAdminEmail}`);
                     await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword);
                     console.log(`Successfully signed back in as ${originalAdminEmail}`);
                 } catch (reSignInError) {
                     console.error("Failed to sign back in as admin:", reSignInError);
                      toast({
                        title: "Session Issue",
                        description: "Could not automatically sign back in. Please refresh or log in again.",
                        variant: "destructive",
                     });
                      // Optional: Force reload or redirect
                      // window.location.reload();
                      // router.push('/login');
                 }

                onUserAdded(newUser);
                setIsOpen(false); // Close dialog
            } else {
                 // Attempt to delete the created Auth user if Firestore add fails
                 console.error("Failed to add user details to database. Attempting to delete Auth user...");
                 if (authUser) { // Check if authUser exists before trying to delete
                    await authUser.delete().catch(delErr => console.error("Failed to delete orphaned Auth user:", delErr));
                 }
                 throw new Error("Failed to add user details to database. Auth user cleanup attempted.");
            }

        } catch (error: any) {
            console.error('Error creating user:', error);
            let description = 'There was a problem adding the user.';
            if (error.code === 'auth/email-already-in-use') {
                description = 'This email address is already in use.';
            } else if (error.code === 'auth/weak-password') {
                description = 'The password is too weak.';
            } else if (error.code === 'auth/invalid-credential'){
                 description = 'Invalid email or password provided for admin re-authentication.'; // Check this case
             }

            toast({
            title: 'User Creation Error',
            description: description,
            variant: 'destructive',
            });
             // Attempt to sign back in as admin even if creation failed
            if (auth.currentUser?.email !== originalAdminEmail) {
                try {
                    await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword);
                    console.log("Signed back in as admin after error.");
                } catch (reSignInError) {
                    console.error("Failed to sign back in as admin after error:", reSignInError);
                     toast({
                        title: "Session Issue",
                        description: "Could not automatically sign back in after error. Please refresh or log in again.",
                        variant: "destructive",
                    });
                }
            }
        }
        });
    };

    // Filter assignable roles based on current user's role
     const assignableRoles = USER_ROLES.filter(role =>
         currentUser &&
         (currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.role === 'Owner') && // Ensure current user can add
         ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[role] // Can only add roles strictly lower
     );


  return (
     <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                    Enter the details of the new user. They will be added to the selected company and locations.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    {/* Full Name Field */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email Field */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="johndoe@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                     {/* Password Field */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Min. 6 characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                     {/* Company Selection */}
                    <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Company</FormLabel>
                             {/* Message if no companies exist (for Super Admin) */}
                             {currentUser?.role === 'Super Admin' && companies.length === 0 && (
                                <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    No companies found. Please add a company first.
                                </div>
                             )}
                            <Select
                                onValueChange={(value) => {
                                    field.onChange(value);
                                }}
                                value={field.value}
                                disabled={(currentUser?.role !== 'Super Admin' && !!currentUser?.companyId) || (currentUser?.role === 'Super Admin' && companies.length === 0)}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select a company" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {/* Default empty option */}
                                    <SelectItem value="" disabled>Select a company...</SelectItem>
                                    {/* Map companies */}
                                    {companies.map((company) => (
                                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                    ))}
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
                            <FormControl>
                              <ScrollArea className="h-40 w-full rounded-md border p-4">
                                  {selectedCompanyId && filteredLocations.length > 0 ? (
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
                                                                      const currentValues = checkboxField.value || [];
                                                                      return checked
                                                                      ? checkboxField.onChange([...currentValues, location.id])
                                                                      : checkboxField.onChange(
                                                                          currentValues.filter(
                                                                              (value) => value !== location.id
                                                                          )
                                                                          );
                                                                  }}
                                                                  id={`location-${location.id}`} // Add unique ID
                                                              />
                                                          </FormControl>
                                                          <FormLabel htmlFor={`location-${location.id}`} className="font-normal">
                                                              {location.name}
                                                          </FormLabel>
                                                      </FormItem>
                                                  )}
                                               />
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="text-sm text-muted-foreground italic flex items-center justify-center h-full">
                                          {selectedCompanyId ? 'No locations found for this company.' : 'Please select a company first.'}
                                      </div>
                                  )}
                              </ScrollArea>
                            </FormControl>
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
                                 {/* Render only assignable roles */}
                                {assignableRoles.map((role) => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                                {/* Optional: Show non-assignable roles as disabled */}
                                {USER_ROLES.filter(role => !assignableRoles.includes(role)).map((role) => (
                                    <SelectItem key={role} value={role} disabled>{role} (Higher privilege needed)</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />


                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending || (currentUser?.role === 'Super Admin' && companies.length === 0)}>
                            {isPending ? 'Adding...' : 'Add User'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
     </Dialog>
  );
}
