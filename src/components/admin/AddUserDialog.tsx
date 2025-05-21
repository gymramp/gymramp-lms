
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
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { UserRole, User, Company, Location } from '@/types/user';
import { addUser as addUserToFirestore, getUserCountByCompanyId } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { AlertCircle, Loader2, Info, ShieldCheck } from 'lucide-react'; // Import Info, ShieldCheck
import { generateRandomPassword } from '@/lib/utils'; // Import password generator

const userFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters.' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' }),
  role: z
    .string()
    .min(1, { message: 'Please select a user role' }) as z.ZodType<UserRole>,
  companyId: z
    .string()
    .min(1, { message: 'Please select a company.' }),
  assignedLocationIds: z.array(z.string()).default([]),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface AddUserDialogProps {
  onUserAdded: (user: User, tempPassword?: string) => void; // Updated signature
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

const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];

export function AddUserDialog({ onUserAdded, isOpen, setIsOpen, companies, locations, currentUser }: AddUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<Company | null>(null);
  const [currentUserCount, setCurrentUserCount] = useState<number>(0);
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: currentUser?.role === 'Manager' ? 'Staff' : 'Staff',
      companyId: currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '',
      assignedLocationIds: [],
    },
  });

  const selectedCompanyId = form.watch('companyId');

  useEffect(() => {
    const fetchCompanyData = async () => {
        if (!selectedCompanyId) {
            setSelectedCompanyDetails(null);
            setCurrentUserCount(0);
            setFilteredLocations([]);
            form.setValue('assignedLocationIds', []);
            return;
        }
        setIsLoadingCompanyData(true);
        try {
            const companyData = await getCompanyById(selectedCompanyId);
            const userCount = await getUserCountByCompanyId(selectedCompanyId);
            setSelectedCompanyDetails(companyData);
            setCurrentUserCount(userCount);

            let companySpecificLocations = locations.filter(loc => loc.companyId === selectedCompanyId);
            if (currentUser?.role === 'Manager' && currentUser.assignedLocationIds) {
                companySpecificLocations = companySpecificLocations.filter(loc =>
                    (currentUser.assignedLocationIds || []).includes(loc.id)
                );
            }
            setFilteredLocations(companySpecificLocations);
            form.setValue('assignedLocationIds', []);
        } catch (error) {
            console.error("Error fetching company data or user count:", error);
            toast({ title: "Error", description: "Could not load company details or user count.", variant: "destructive" });
            setSelectedCompanyDetails(null);
            setCurrentUserCount(0);
            setFilteredLocations([]);
        } finally {
             setIsLoadingCompanyData(false);
        }
    };
    if (isOpen) {
        fetchCompanyData();
    }
  }, [selectedCompanyId, locations, form, toast, isOpen, currentUser]);

  useEffect(() => {
     const initialCompanyId = currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : '';
     const initialRole = currentUser?.role === 'Manager' ? 'Staff' : 'Staff';
     form.reset({
        name: '',
        email: '',
        // password: '', // Password removed from form
        role: initialRole,
        companyId: initialCompanyId,
        assignedLocationIds: [],
     });
   }, [isOpen, currentUser, form]);

  const onSubmit = async (data: UserFormValues) => {
      startTransition(async () => {
          if (!currentUser) {
              toast({ title: "Permission Denied", description: "You must be logged in to add users.", variant: "destructive"});
              return;
          }
          if (currentUser.role === 'Manager' && data.role !== 'Staff') {
            toast({ title: "Permission Denied", description: "Managers can only create Staff users.", variant: "destructive"});
            return;
          }
          if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager' && ROLE_HIERARCHY[currentUser.role] <= ROLE_HIERARCHY[data.role]) {
              toast({ title: "Permission Denied", description: "You cannot create a user with a role higher than or equal to your own.", variant: "destructive"});
              return;
          }
           if (!data.companyId) {
                form.setError("companyId", { type: "manual", message: "Company selection is required." });
                return;
           }
           if (selectedCompanyDetails?.maxUsers !== null &&
               selectedCompanyDetails?.maxUsers !== undefined &&
               currentUserCount >= selectedCompanyDetails.maxUsers) {
                   toast({
                       title: "User Limit Reached",
                       description: `This brand (${selectedCompanyDetails.name}) has reached its maximum user limit of ${selectedCompanyDetails.maxUsers}. Contact a Super Admin to increase the limit.`,
                       variant: "destructive",
                       duration: 7000,
                   });
                   return;
           }

        let authUserUid: string | undefined;
        const tempPassword = generateRandomPassword(); // Generate password

        try {
            const userCredential = await createUserWithEmailAndPassword(
            auth,
            data.email,
            tempPassword // Use generated password
            );
            const authUser = userCredential.user;
            authUserUid = authUser.uid;

            const newUser = await addUserToFirestore({
              name: data.name,
              email: data.email,
              role: data.role,
              companyId: data.companyId,
              assignedLocationIds: data.assignedLocationIds || [],
              requiresPasswordChange: true, // Mark for password change
            });

            if (newUser) {
                toast({
                    title: 'User Added',
                    description: `${data.name} has been successfully added.`,
                });
                onUserAdded(newUser, tempPassword); // Pass password to callback
                setIsOpen(false);
            } else {
                 if (authUserUid) {
                     const userToDelete = auth.currentUser;
                     if (userToDelete && userToDelete.uid === authUserUid) {
                        console.error("Failed to add user details to database. Attempting to delete Auth user...");
                        await userToDelete.delete().catch(delErr => console.error("Failed to delete orphaned Auth user:", delErr));
                     }
                 }
                 throw new Error("Failed to add user details to database. Auth user cleanup attempted if possible.");
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

    const assignableRoles = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(role =>
         currentUser && (
             currentUser.role === 'Super Admin' ||
             ((currentUser.role === 'Admin' || currentUser.role === 'Owner') &&
             ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[role])
             || (currentUser.role === 'Manager' && role === 'Staff')
            )
     );

     const isLimitReached = selectedCompanyDetails?.maxUsers !== null &&
                            selectedCompanyDetails?.maxUsers !== undefined &&
                            currentUserCount >= selectedCompanyDetails.maxUsers;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Enter the details of the new user. A temporary password will be auto-generated, and the user will be prompted to change it on their first login.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Password field removed */}
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  {currentUser?.role === 'Super Admin' && companies.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md flex items-center gap-2 h-10 items-center">
                      <AlertCircle className="h-4 w-4 text-yellow-500" /> No brands found. Please add a brand first.
                    </div>
                  )}
                    <Select
                        onValueChange={(value) => field.onChange(value === 'placeholder-company' ? '' : value)}
                        value={field.value || 'placeholder-company'}
                        disabled={(currentUser?.role !== 'Super Admin' && !!currentUser?.companyId) || (currentUser?.role === 'Super Admin' && companies.length === 0)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!currentUser?.companyId && currentUser?.role !== 'Super Admin' ? "No Brand Assigned" : "Select a brand"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <SelectItem value="placeholder-company" disabled>Select a brand...</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  {isLoadingCompanyData && <p className="text-xs text-muted-foreground">Loading brand info...</p>}
                  {!isLoadingCompanyData && selectedCompanyDetails && (
                    <p className="text-xs text-muted-foreground">
                      Current Users: {currentUserCount} / {selectedCompanyDetails.maxUsers === null || selectedCompanyDetails.maxUsers === undefined ? 'Unlimited' : selectedCompanyDetails.maxUsers}
                    </p>
                  )}
                  {isLimitReached && !isLoadingCompanyData && (
                    <p className="text-xs font-medium text-destructive">User limit reached for this brand.</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assignedLocationIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Locations (Optional)</FormLabel>
                  <FormControl>
                    <ScrollArea className="h-40 w-full rounded-md border p-4">
                        {isLoadingCompanyData ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : selectedCompanyId && filteredLocations.length > 0 ? (
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
                                                : checkboxField.onChange(currentValues.filter((value) => value !== location.id));
                                            }}
                                            id={`location-${location.id}`}
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
                            {selectedCompanyId ? 'No locations available for assignment in this brand/your access.' : 'Please select a brand first.'}
                          </div>
                        )}
                    </ScrollArea>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>User Role</FormLabel>
                    <Select
                        onValueChange={(value) => field.onChange(value === 'placeholder-role' ? '' : value)}
                        value={field.value || 'placeholder-role'}
                        defaultValue={field.value}
                        disabled={currentUser?.role === 'Manager'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <SelectItem value="placeholder-role" disabled>Select a role...</SelectItem>
                        {assignableRoles.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                        {ALL_POSSIBLE_ROLES_TO_ASSIGN
                          .filter(r => !assignableRoles.includes(r))
                          .map((role) => (
                            <SelectItem key={role} value={role} disabled>{role} (Permission Denied)</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {currentUser?.role === 'Manager' && <p className="text-xs text-muted-foreground pt-1">Managers can only create Staff users.</p>}
                  <FormMessage />
                </FormItem>
              )} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={isPending || (currentUser?.role === 'Super Admin' && companies.length === 0) || isLimitReached || isLoadingCompanyData}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPending ? 'Adding...' : 'Add User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    