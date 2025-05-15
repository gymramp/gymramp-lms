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
// import { Label } from '@/components/ui/label'; // Not directly used, FormLabel is used
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
// import { addDoc, collection, serverTimestamp } from 'firebase/firestore'; // No longer directly used
// import { db } from '@/lib/firebase'; // No longer directly used
import type { UserRole, User, Company, Location } from '@/types/user';
import { addUser as addUserToFirestore, getUserCountByCompanyId } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import { AlertCircle, Loader2 } from 'lucide-react';
// import { sendWelcomeEmail } from '@/actions/checkout'; // Removed import, email handled by Cloud Function

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
    .string()
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
      password: '',
      role: currentUser?.role === 'Manager' ? 'Staff' : 'Staff', // Default to Staff if Manager is adding
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

            // Filter locations based on current user's access if Manager
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
        password: '',
        role: initialRole,
        companyId: initialCompanyId,
        assignedLocationIds: [],
     });
   }, [isOpen, currentUser, form]);


  const onSubmit = async (data: UserFormValues) => {
       const originalAdminEmail = auth.currentUser?.email;
       const originalAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "password";

       if (!originalAdminEmail || !originalAdminPassword) {
            toast({ title: "Admin Session Error", description: "Could not verify admin session. Please log in again.", variant: "destructive" });
            return;
        }


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

          if (!data.assignedLocationIds || data.assignedLocationIds.length === 0) {
               form.setError("assignedLocationIds", { type: "manual", message: "User must be assigned to at least one location." });
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
                       description: `This company (${selectedCompanyDetails.name}) has reached its maximum user limit of ${selectedCompanyDetails.maxUsers}. Contact a Super Admin to increase the limit.`,
                       variant: "destructive",
                       duration: 7000,
                   });
                   return;
           }


        let authUserUid: string | undefined;
        try {
            const userCredential = await createUserWithEmailAndPassword(
            auth,
            data.email,
            data.password
            );
            const authUser = userCredential.user;
            authUserUid = authUser.uid; // Store UID for potential cleanup

            const newUser = await addUserToFirestore({
            name: data.name,
            email: data.email,
            role: data.role,
            companyId: data.companyId,
            assignedLocationIds: data.assignedLocationIds,
            });

            if (newUser) {
                toast({
                    title: 'User Added',
                    description: `${data.name} has been successfully added.`,
                });

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
                 }

                // Removed direct call to sendWelcomeEmail. Email sending should be handled by a Firebase Cloud Function.
                // try {
                //     await sendWelcomeEmail(data.email, data.name, data.password);
                //     toast({
                //         title: "Welcome Email Sent",
                //         description: `A welcome email has been sent to ${data.email}.`,
                //     });
                // } catch (emailError: any) {
                //      console.error("Failed to send welcome email:", emailError);
                //      toast({
                //          title: "Email Sending Failed",
                //          description: `User ${data.name} was created, but the welcome email could not be sent. Error: ${emailError.message}`,
                //          variant: "destructive",
                //          duration: 7000,
                //      });
                // }

                onUserAdded(newUser);
                setIsOpen(false);
            } else {
                 // Attempt to delete the created Auth user if Firestore add fails only if UID was captured
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
            } else if (error.code === 'auth/invalid-credential'){
                 description = 'Invalid email or password provided for admin re-authentication.';
             }

            toast({
            title: 'User Creation Error',
            description: description,
            variant: 'destructive',
            });
            if (auth.currentUser?.email !== originalAdminEmail) {
                try {
                    await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword);
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
            Enter the details of the new user. They will be added to the selected company and locations.
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

            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  {currentUser?.role === 'Super Admin' && companies.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md flex items-center gap-2 h-10 items-center">
                      <AlertCircle className="h-4 w-4 text-yellow-500" /> No companies found. Please add a company first.
                    </div>
                  )}
                    <Select
                        onValueChange={(value) => field.onChange(value === 'placeholder-company' ? '' : value)}
                        value={field.value || 'placeholder-company'}
                        disabled={(currentUser?.role !== 'Super Admin' && !!currentUser?.companyId) || (currentUser?.role === 'Super Admin' && companies.length === 0)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <SelectItem value="placeholder-company" disabled>Select a company...</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  {isLoadingCompanyData && <p className="text-xs text-muted-foreground">Loading company info...</p>}
                  {!isLoadingCompanyData && selectedCompanyDetails && (
                    <p className="text-xs text-muted-foreground">
                      Current Users: {currentUserCount} / {selectedCompanyDetails.maxUsers === null || selectedCompanyDetails.maxUsers === undefined ? 'Unlimited' : selectedCompanyDetails.maxUsers}
                    </p>
                  )}
                  {isLimitReached && !isLoadingCompanyData && (
                    <p className="text-xs font-medium text-destructive">User limit reached for this company.</p>
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
                  <FormLabel>Assign to Locations</FormLabel>
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
                            {selectedCompanyId ? 'No locations available for assignment in this company/your access.' : 'Please select a company first.'}
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
                        disabled={currentUser?.role === 'Manager'} // Disable role selection for Managers
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
                        {/* Show non-assignable roles as disabled for clarity */}
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
