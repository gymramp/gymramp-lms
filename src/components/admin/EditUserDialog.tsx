
'use client';

import React, { useEffect, useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
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
import type { UserRole, User, Company, Location } from '@/types/user';
import { updateUser as updateFirestoreUser } from '@/lib/user-data';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, KeyRound } from 'lucide-react';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];

// Schema for main user details (excluding password for edit)
const editUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  companyId: z.string().nullable(),
  assignedLocationIds: z.array(z.string()).default([]),
  role: z.string().min(1) as z.ZodType<UserRole>,
  // New optional password field for Super Admins
  newTemporaryPassword: z.string().optional().refine(val => !val || val.length === 0 || val.length >= 6, {
    message: "New password must be at least 6 characters long if provided.",
  }),
}).refine(data => {
    if (data.companyId && data.role !== 'Super Admin' && (!data.assignedLocationIds || data.assignedLocationIds.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "User must be assigned to at least one location if a company is selected (unless Super Admin).",
    path: ["assignedLocationIds"],
});


type EditUserFormValues = z.infer<typeof editUserFormSchema>;

interface EditUserDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: User;
  onUserUpdated: (user: User) => void;
  currentUser: User;
  companies: Company[];
  locations: Location[];
}

export function EditUserDialog({ isOpen, setIsOpen, user, onUserUpdated, currentUser, companies = [], locations = [] }: EditUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [availableLocationsForUser, setAvailableLocationsForUser] = useState<Location[]>([]);
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false); // Not strictly used here but good to keep pattern if needed

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: user?.name || '',
      companyId: user?.companyId || null,
      assignedLocationIds: user?.assignedLocationIds || [],
      role: user?.role || 'Staff',
      newTemporaryPassword: '', // Initialize as empty
    },
  });

  const selectedCompanyId = form.watch('companyId');
  const isTargetUserSuperAdmin = user?.role === 'Super Admin';

  useEffect(() => {
    if (user && isOpen) {
      form.reset({
        name: user.name || '',
        companyId: user.companyId || null,
        assignedLocationIds: user.assignedLocationIds || [],
        role: user.role || 'Staff',
        newTemporaryPassword: '', // Reset password field on open
      });

      const targetCompanyId = user.companyId;
      let filtered: Location[] = [];
      if (targetCompanyId) {
        if (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Owner') {
          filtered = locations.filter(loc => loc.companyId === targetCompanyId);
        } else if (currentUser?.role === 'Manager') {
          filtered = locations.filter(loc => 
            loc.companyId === targetCompanyId && 
            (currentUser.assignedLocationIds || []).includes(loc.id)
          );
        }
      }
      setAvailableLocationsForUser(filtered);
    }
  }, [user, form, isOpen, locations, currentUser]);


  useEffect(() => {
     if (currentUser?.role === 'Super Admin' && isOpen) {
        let filtered: Location[] = [];
        if (selectedCompanyId) {
             filtered = locations.filter(loc => loc.companyId === selectedCompanyId);
        }
         setAvailableLocationsForUser(filtered);
         const currentAssigned = form.getValues('assignedLocationIds') || [];
         const validAssigned = currentAssigned.filter(locId => filtered.some(filteredLoc => filteredLoc.id === locId));
         form.setValue('assignedLocationIds', validAssigned, { shouldValidate: true });
     } else if ((currentUser?.role === 'Admin' || currentUser?.role === 'Owner') && isOpen && selectedCompanyId === currentUser.companyId) {
        const adminOwnerAccessibleLocations = locations.filter(loc => loc.companyId === selectedCompanyId);
        setAvailableLocationsForUser(adminOwnerAccessibleLocations);
         const currentAssigned = form.getValues('assignedLocationIds') || [];
         const validAssigned = currentAssigned.filter(locId => adminOwnerAccessibleLocations.some(filteredLoc => filteredLoc.id === locId));
         form.setValue('assignedLocationIds', validAssigned, { shouldValidate: true });
     } else if (currentUser?.role === 'Manager' && isOpen && selectedCompanyId === currentUser.companyId) {
        const managerAccessibleLocations = locations.filter(loc => 
            loc.companyId === selectedCompanyId && 
            (currentUser.assignedLocationIds || []).includes(loc.id)
        );
        setAvailableLocationsForUser(managerAccessibleLocations);
        const currentAssigned = form.getValues('assignedLocationIds') || [];
        const validAssigned = currentAssigned.filter(locId => managerAccessibleLocations.some(filteredLoc => filteredLoc.id === locId));
        form.setValue('assignedLocationIds', validAssigned, { shouldValidate: true });
     }
  }, [selectedCompanyId, locations, form, currentUser, isOpen]);


    const canEditRole = currentUser && user &&
        currentUser.id !== user.id &&
        !isTargetUserSuperAdmin &&
        (
            currentUser.role === 'Super Admin' ||
            (
                currentUser.companyId === user.companyId &&
                ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[user.role] &&
                !(currentUser.role === 'Manager' && user.role !== 'Staff')
            )
        );
   const isRoleSelectDisabled = !canEditRole;
   const isCompanySelectDisabled = !currentUser || currentUser.role !== 'Super Admin';
   const canSetPassword = currentUser && currentUser.role === 'Super Admin' && currentUser.id !== user.id && !isTargetUserSuperAdmin;


  const onSubmit = async (data: EditUserFormValues) => {
    startTransition(async () => {
       if (data.role !== user.role && isRoleSelectDisabled) {
         toast({ title: "Permission Denied", description: "You cannot change this user's role.", variant: "destructive" });
         return;
       }
       if (data.companyId !== user.companyId && isCompanySelectDisabled) {
          toast({ title: "Permission Denied", description: "Only Super Admins can change a user's company.", variant: "destructive" });
          return;
       }
        if (data.companyId && data.role !== 'Super Admin' && (!data.assignedLocationIds || data.assignedLocationIds.length === 0)) {
            form.setError("assignedLocationIds", { type: "manual", message: "User must be assigned to at least one location if a company is selected." });
            return;
        }
        if (currentUser?.role === 'Manager' && user.role === 'Staff' && data.role !== 'Staff') {
            toast({ title: "Permission Denied", description: "Managers can only edit Staff users and cannot change their role.", variant: "destructive" });
            return;
        }

      try {
        const updateData: Partial<User> = {
            name: data.name,
            role: data.role,
            companyId: data.companyId || '',
            assignedLocationIds: data.companyId ? data.assignedLocationIds : [],
        };

        let passwordMessage = "";
        if (canSetPassword && data.newTemporaryPassword && data.newTemporaryPassword.length >= 6) {
            // In a real app, this is where you'd call a server action to update Firebase Auth password
            // For now, we just set the flag and the admin communicates the password.
            updateData.requiresPasswordChange = true;
            passwordMessage = ` You have set a new temporary password: '${data.newTemporaryPassword}'. Please communicate this to the user. They will be required to change it on their next login.`;
             // Placeholder for actual password update:
             console.warn(`ADMIN SDK NEEDED: Pretending to update password for ${user.email} to ${data.newTemporaryPassword}`);
             toast({
                 title: "Password Update (Simulated)",
                 description: `The password for ${user.email} would be set to '${data.newTemporaryPassword}' by a server action using Admin SDK. The user will be prompted to change it.`,
                 variant: "default",
                 duration: 10000,
             });
        } else if (canSetPassword && data.newTemporaryPassword && data.newTemporaryPassword.length > 0 && data.newTemporaryPassword.length < 6) {
            // This case should be caught by Zod validation, but as a fallback
            toast({ title: "Password Error", description: "New password is too short.", variant: "destructive" });
            return;
        }


        const updatedUser = await updateFirestoreUser(user.id, updateData);

        if (updatedUser) {
          toast({
            title: 'User Updated',
            description: `${data.name}'s details have been successfully updated.${passwordMessage}`,
            duration: passwordMessage ? 10000 : 5000, // Longer duration if password message is included
          });
          onUserUpdated(updatedUser);
          setIsOpen(false);
        } else {
          throw new Error("Failed to update user details in database.");
        }
      } catch (error: any) {
        console.error('Error updating user:', error);
        toast({
          title: 'Update Error',
          description: error.message || 'Could not update user details.',
          variant: 'destructive',
        });
      }
    });
  };


    let assignableRolesForDropdown: UserRole[] = [];
    if (canEditRole) {
        if (currentUser?.role === 'Super Admin' && !isTargetUserSuperAdmin) {
            assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => r !== 'Super Admin' || user.role === 'Super Admin');
        } else if (currentUser && currentUser.companyId === user.companyId) {
            assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(
                r => ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[r] && r !== 'Super Admin'
            );
             if (currentUser.role === 'Manager' && user.role === 'Staff') {
                assignableRolesForDropdown = ['Staff'];
            }
        }
    }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Edit User: {user.name}</DialogTitle>
                <DialogDescription>
                    Update the user's information. Role and Company changes require specific permissions.
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

                    <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                            <Input
                            type="email"
                            value={user.email}
                            disabled
                            className="opacity-60"
                            />
                        </FormControl>
                    </FormItem>

                     <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brand</FormLabel>
                                {!user.companyId && currentUser?.role === 'Super Admin' && (
                                    <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md flex items-center gap-2 h-10 items-center">
                                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                                        This user currently has no brand assigned. Please assign one.
                                    </div>
                                )}
                                <Select
                                    onValueChange={(value) => {
                                        field.onChange(value === 'no-company' || value === 'placeholder-company' ? null : value);
                                    }}
                                    value={field.value || 'placeholder-company'}
                                    disabled={isCompanySelectDisabled || isLoadingCompanyData}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                             <SelectValue placeholder={!user.companyId ? "Assign a brand..." : "Select a brand"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="placeholder-company" disabled>Select a brand...</SelectItem>
                                        {currentUser?.role === 'Super Admin' && <SelectItem value="no-company">No Brand Assigned</SelectItem>}
                                        {companies.map((company) => (
                                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isLoadingCompanyData && <p className="text-xs text-muted-foreground">Loading brand info...</p>}
                                {isCompanySelectDisabled && <p className="text-xs text-muted-foreground pt-1">Only Super Admins can change the brand.</p>}
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                     <FormField
                         control={form.control}
                         name="assignedLocationIds"
                         render={() => (
                             <FormItem>
                                 <FormLabel>Assigned Locations</FormLabel>
                                 <FormControl>
                                     <ScrollArea className="h-40 w-full rounded-md border p-4">
                                         {isLoadingCompanyData ? (
                                             <div className="flex items-center justify-center h-full">
                                                 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                             </div>
                                         ) : selectedCompanyId && availableLocationsForUser.length > 0 ? (
                                             <div className="space-y-2">
                                                 {availableLocationsForUser.map((location) => (
                                                    <FormItem key={location.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={form.getValues('assignedLocationIds')?.includes(location.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentValues = form.getValues('assignedLocationIds') || [];
                                                                    const newValues = checked
                                                                        ? [...currentValues, location.id]
                                                                        : currentValues.filter((value) => value !== location.id);
                                                                    form.setValue('assignedLocationIds', newValues, { shouldValidate: true });
                                                                }}
                                                                id={`edit-location-${location.id}`}
                                                            />
                                                        </FormControl>
                                                        <FormLabel htmlFor={`edit-location-${location.id}`} className="font-normal">
                                                            {location.name}
                                                        </FormLabel>
                                                    </FormItem>
                                                 ))}
                                             </div>
                                         ) : (
                                             <div className="text-sm text-muted-foreground italic flex items-center justify-center h-full">
                                                 {selectedCompanyId ? 'No locations available for assignment in this brand (or for your access level).' : 'Select a brand to assign locations.'}
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
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isRoleSelectDisabled || isLoadingCompanyData}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a user role" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                     <SelectItem value={user.role} disabled={!assignableRolesForDropdown.includes(user.role) && user.role !== field.value && user.role !== 'Super Admin'}>
                                        {user.role} {user.role === 'Super Admin' ? '(Cannot Change)' : ''}
                                    </SelectItem>
                                     {assignableRolesForDropdown
                                         .filter(r => r !== user.role)
                                         .map((role) => (
                                             <SelectItem key={role} value={role}>{role}</SelectItem>
                                     ))}
                                     {ALL_POSSIBLE_ROLES_TO_ASSIGN
                                         .filter(r => r !== user.role && !assignableRolesForDropdown.includes(r) && r !== 'Super Admin')
                                         .map((role) => (
                                             <SelectItem key={role} value={role} disabled>{role} (Permission Denied)</SelectItem>
                                     ))}
                                </SelectContent>
                            </Select>
                            {isRoleSelectDisabled && currentUser?.id !== user.id && !isTargetUserSuperAdmin && <p className="text-xs text-muted-foreground pt-1">You do not have permission to change this user's role.</p>}
                            {isRoleSelectDisabled && currentUser?.id === user.id && <p className="text-xs text-muted-foreground pt-1">You cannot change your own role.</p>}
                            {isTargetUserSuperAdmin && <p className="text-xs text-muted-foreground pt-1">Super Admin role cannot be changed.</p>}
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    {/* New Temporary Password Field for Super Admins */}
                    {canSetPassword && (
                        <FormField
                            control={form.control}
                            name="newTemporaryPassword"
                            render={({ field }) => (
                                <FormItem className="pt-2 border-t mt-6">
                                    <FormLabel className="text-base font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-orange-500" />Set New Temporary Password</FormLabel>
                                    <FormControl>
                                        <Input type="text" placeholder="Leave blank to keep current password" {...field} />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">
                                        If you set a password here, you must communicate it to the user. They will be forced to change it on their next login.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}


                    <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending || isLoadingCompanyData}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}

