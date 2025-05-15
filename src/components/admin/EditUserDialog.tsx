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
import { AlertCircle, Loader2 } from 'lucide-react';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5,
  'Admin': 4,
  'Owner': 3,
  'Manager': 2,
  'Staff': 1,
};

const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];

const editUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  companyId: z.string().nullable(),
  assignedLocationIds: z.array(z.string()).default([]),
  role: z.string().min(1) as z.ZodType<UserRole>,
}).refine(data => {
    // If a company is selected, at least one location must be assigned,
    // UNLESS the user being edited is a Super Admin (who might not have locations)
    // OR if the companyId is being set to null (unassigning from company).
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
  const [isLoadingCompanyData, setIsLoadingCompanyData] = useState(false);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: user?.name || '',
      companyId: user?.companyId || null,
      assignedLocationIds: user?.assignedLocationIds || [],
      role: user?.role || 'Staff',
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
      });

      const targetCompanyId = user.companyId;
      let filtered: Location[] = [];
      if (targetCompanyId) {
        if (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Owner') {
          filtered = locations.filter(loc => loc.companyId === targetCompanyId);
        } else if (currentUser?.role === 'Manager') {
          // Managers can only see/assign locations they are assigned to within the target user's company
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
     if (currentUser?.role === 'Super Admin' && isOpen) { // Only Super Admin can freely change company and see all its locations
        let filtered: Location[] = [];
        if (selectedCompanyId) {
             filtered = locations.filter(loc => loc.companyId === selectedCompanyId);
        }
         setAvailableLocationsForUser(filtered);
         const currentAssigned = form.getValues('assignedLocationIds') || [];
         const validAssigned = currentAssigned.filter(locId => filtered.some(filteredLoc => filteredLoc.id === locId));
         form.setValue('assignedLocationIds', validAssigned, { shouldValidate: true });
     } else if (currentUser?.role === 'Manager' && isOpen && selectedCompanyId === currentUser.companyId) {
        // If Manager is editing a Staff user in their own company, filter locations by manager's access
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


    // Determine if the current user can edit the target user's role
    const canEditRole = currentUser && user &&
        currentUser.id !== user.id && // User cannot edit their own role
        !isTargetUserSuperAdmin &&    // Cannot change an existing Super Admin's role
        (
            currentUser.role === 'Super Admin' || // Super Admin can edit any non-Super Admin's role
            (
                currentUser.companyId === user.companyId && // Non-Super Admins must be in the same company
                ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[user.role] && // and have a higher role than the target
                !(currentUser.role === 'Manager' && user.role !== 'Staff') // Manager can only affect Staff
            )
        );
   const isRoleSelectDisabled = !canEditRole;
   const isCompanySelectDisabled = !currentUser || currentUser.role !== 'Super Admin';


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
        // If Manager is editing, ensure they are not changing role from Staff
        if (currentUser?.role === 'Manager' && user.role === 'Staff' && data.role !== 'Staff') {
            toast({ title: "Permission Denied", description: "Managers can only edit Staff users and cannot change their role.", variant: "destructive" });
            return;
        }


      try {
        const updateData: Partial<User> = {
            name: data.name,
            role: data.role,
            companyId: data.companyId || '', // Ensure companyId is empty string if null
            assignedLocationIds: data.companyId ? data.assignedLocationIds : [],
        };

        const updatedUser = await updateFirestoreUser(user.id, updateData);

        if (updatedUser) {
          toast({
            title: 'User Updated',
            description: `${data.name}'s details have been successfully updated.`,
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
            assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => r !== 'Super Admin' || user.role === 'Super Admin'); // Allow keeping Super Admin if already one
        } else if (currentUser && currentUser.companyId === user.companyId) {
            assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(
                r => ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[r] && r !== 'Super Admin'
            );
             if (currentUser.role === 'Manager' && user.role === 'Staff') { // Manager can only see Staff for Staff edit
                assignableRolesForDropdown = ['Staff'];
            }
        }
    }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
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
                                <FormLabel>Company</FormLabel>
                                {!user.companyId && currentUser?.role === 'Super Admin' && (
                                    <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md flex items-center gap-2 h-10 items-center">
                                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                                        This user currently has no company assigned. Please assign one.
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
                                             <SelectValue placeholder={!user.companyId ? "Assign a company..." : "Select a company"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="placeholder-company" disabled>Select a company...</SelectItem>
                                        {currentUser?.role === 'Super Admin' && <SelectItem value="no-company">No Company Assigned</SelectItem>}
                                        {companies.map((company) => (
                                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isLoadingCompanyData && <p className="text-xs text-muted-foreground">Loading company info...</p>}
                                {isCompanySelectDisabled && <p className="text-xs text-muted-foreground pt-1">Only Super Admins can change the company.</p>}
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
                                                 {selectedCompanyId ? 'No locations available for assignment in this company (or for your access level).' : 'Select a company to assign locations.'}
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
                                     {/* Ensure the current role is always an option, even if disabled */}
                                     <SelectItem value={user.role} disabled={!assignableRolesForDropdown.includes(user.role) && user.role !== field.value && user.role !== 'Super Admin'}>
                                        {user.role} {user.role === 'Super Admin' ? '(Cannot Change)' : ''}
                                    </SelectItem>
                                     {assignableRolesForDropdown
                                         .filter(r => r !== user.role) // Exclude current role if already in list
                                         .map((role) => (
                                             <SelectItem key={role} value={role}>{role}</SelectItem>
                                     ))}
                                     {/* Show other roles as disabled if not assignable */}
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
