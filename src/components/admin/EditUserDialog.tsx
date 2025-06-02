
// src/components/admin/EditUserDialog.tsx
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
import type { UserRole, User, Company, Location } from '@/types/user';
import { updateUser as updateFirestoreUser } from '@/lib/user-data';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { getCompanyById, getLocationsByCompanyId } from '@/lib/company-data';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};
const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];

const editUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  companyId: z.string().nullable(),
  assignedLocationIds: z.array(z.string()).default([]), 
  role: z.string().min(1) as z.ZodType<UserRole>,
  newTemporaryPassword: z.string().optional().refine(val => !val || val.length === 0 || val.length >= 6, {
    message: "New password must be at least 6 characters if provided.",
  }),
}).refine(data => {
    if (data.role !== 'Super Admin' && !data.companyId) return false;
    return true;
}, {
    message: "Non-Super Admin users must be assigned to a brand.",
    path: ["companyId"],
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
  const [locationsForSelectedBrandInDialog, setLocationsForSelectedBrandInDialog] = useState<Location[]>([]);
  const [isLoadingLocationsForDialog, setIsLoadingLocationsForDialog] = useState(false);
  const [initialCompanyIdForUser, setInitialCompanyIdForUser] = useState<string | null>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: { name: '', companyId: null, assignedLocationIds: [], role: 'Staff', newTemporaryPassword: '' },
  });

  const selectedCompanyIdInDialog = form.watch('companyId');
  const isTargetUserSuperAdmin = user?.role === 'Super Admin';

  useEffect(() => {
    if (user && isOpen) {
      setInitialCompanyIdForUser(user.companyId || null);
      form.reset({
        name: user.name || '',
        companyId: user.companyId || null,
        assignedLocationIds: user.assignedLocationIds || [],
        role: user.role || 'Staff',
        newTemporaryPassword: '',
      });
    }
  }, [user, form, isOpen]);

  useEffect(() => {
    const fetchLocationsForBrand = async () => {
      if (isOpen && selectedCompanyIdInDialog) {
        setIsLoadingLocationsForDialog(true);
        try {
          const brandLocations = locations.filter(loc => loc.companyId === selectedCompanyIdInDialog);
           if (currentUser?.role === 'Manager' && currentUser.companyId === selectedCompanyIdInDialog && currentUser.assignedLocationIds) {
            setLocationsForSelectedBrandInDialog(brandLocations.filter(loc => currentUser.assignedLocationIds!.includes(loc.id)));
           } else {
            setLocationsForSelectedBrandInDialog(brandLocations);
           }
          
          if (selectedCompanyIdInDialog !== initialCompanyIdForUser) {
             form.setValue('assignedLocationIds', [], { shouldValidate: true });
          }

        } catch (error) {
            toast({ title: "Error", description: "Could not load locations for selected brand.", variant: "destructive" });
            setLocationsForSelectedBrandInDialog([]);
            form.setValue('assignedLocationIds', []);
        } finally {
            setIsLoadingLocationsForDialog(false);
        }
      } else if (isOpen && !selectedCompanyIdInDialog) { 
        setLocationsForSelectedBrandInDialog([]);
        if (initialCompanyIdForUser !== null) { 
           form.setValue('assignedLocationIds', []);
        }
      }
    };
    if (isOpen) fetchLocationsForBrand();
  }, [selectedCompanyIdInDialog, isOpen, form, currentUser, initialCompanyIdForUser, locations, toast]); 


  const canEditRole = currentUser && user && currentUser.id !== user.id && !isTargetUserSuperAdmin &&
    (currentUser.role === 'Super Admin' ||
     (currentUser.companyId &&
      (companies.some(c => c.id === user.companyId)) && 
      (
        (currentUser.role === 'Manager' && (user.role === 'Staff' || user.role === 'Manager')) || 
        (ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[user.role]) 
      )
     )
    );

  const isRoleSelectDisabled = !canEditRole;
  const isCompanySelectDisabled = !currentUser || currentUser.role !== 'Super Admin' || user.role === 'Super Admin';
  const canSetPassword = currentUser && currentUser.role === 'Super Admin' && currentUser.id !== user.id && !isTargetUserSuperAdmin;

  const onSubmit = async (data: EditUserFormValues) => {
    startTransition(async () => {
      if (!currentUser || !user) return;

      if (data.role !== user.role) {
        if (isTargetUserSuperAdmin) {
            toast({ title: "Permission Denied", description: "Super Admin role cannot be changed.", variant: "destructive" }); return;
        }
        if (!canEditRole) { 
            toast({ title: "Permission Denied", description: "You do not have permission to change this user's role to the selected role.", variant: "destructive" }); return;
        }
         if (currentUser.role !== 'Super Admin') {
            if (ROLE_HIERARCHY[currentUser.role] < ROLE_HIERARCHY[data.role]) {
                 toast({ title: "Permission Denied", description: "Cannot assign a role higher than your own.", variant: "destructive"}); return;
            }
             if (currentUser.role === 'Manager' && !(data.role === 'Staff' || data.role === 'Manager')) {
                toast({ title: "Permission Denied", description: "Managers can only assign 'Staff' or 'Manager' roles.", variant: "destructive"}); return;
            }
            if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] <= ROLE_HIERARCHY[data.role]) {
                toast({ title: "Permission Denied", description: "Cannot assign a role equal to or higher than your own.", variant: "destructive"}); return;
            }
        }
      }

      if (data.companyId !== user.companyId && isCompanySelectDisabled) { toast({ title: "Permission Denied", description: "Only Super Admins can change brand for non-Super Admins.", variant: "destructive" }); return; }
      if (data.role !== 'Super Admin' && !data.companyId) {
          form.setError("companyId", {type: "manual", message: "Non-Super Admin users must be assigned to a brand."}); return;
      }

      try {
        const updateData: Partial<User> = {
            name: data.name, role: data.role,
            companyId: data.role === 'Super Admin' ? null : (data.companyId || null),
            assignedLocationIds: (data.role === 'Super Admin' || !data.companyId) ? [] : (data.assignedLocationIds || []),
        };
        let passwordMessage = "";
        if (canSetPassword && data.newTemporaryPassword && data.newTemporaryPassword.length >= 6) {
            updateData.requiresPasswordChange = true;
            console.warn(`ADMIN SDK NEEDED: Simulating password update for ${user.email} to ${data.newTemporaryPassword}`);
            toast({ title: "Password Update (Simulated)", description: `Password for ${user.email} would be set to '${data.newTemporaryPassword}' via Admin SDK. User will be prompted to change it. Communicate this password to the user.`, variant: "default", duration: 15000 });
            passwordMessage = ` New temporary password noted.`;
        }
        const updatedUser = await updateFirestoreUser(user.id, updateData);
        if (updatedUser) {
          toast({ title: 'User Updated', description: `${data.name}'s details updated.${passwordMessage}`, duration: passwordMessage ? 10000 : 5000 });
          onUserUpdated(updatedUser); setIsOpen(false);
        } else { throw new Error("Failed to update user details in database."); }
      } catch (error: any) {
        toast({ title: 'Update Error', description: error.message || 'Could not update user details.', variant: 'destructive' });
      }
    });
  };

  let assignableRolesForDropdown: UserRole[] = [];
  if (canEditRole && currentUser) {
    if (currentUser.role === 'Super Admin' && !isTargetUserSuperAdmin) {
        assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => r !== 'Super Admin');
    } else if (currentUser.role === 'Manager' && (user.role === 'Staff' || user.role === 'Manager')) {
        assignableRolesForDropdown = ['Staff', 'Manager'];
    } else if ((currentUser.role === 'Admin' || currentUser.role === 'Owner')) {
        assignableRolesForDropdown = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[r] && r !== 'Super Admin');
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader> <DialogTitle>Edit User: {user.name}</DialogTitle> <DialogDescription> Update user info. Role/Brand changes require specific permissions. </DialogDescription> </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Full Name</FormLabel> <FormControl><Input placeholder="John Doe" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormItem> <FormLabel>Email Address</FormLabel> <FormControl><Input type="email" value={user.email} disabled className="opacity-60" /></FormControl> </FormItem>
            
            <FormField control={form.control} name="companyId" render={({ field }) => (
              <FormItem> <FormLabel>Brand</FormLabel>
                {user.role !== 'Super Admin' && !field.value && currentUser?.role === 'Super Admin' && ( <div className="text-sm text-muted-foreground p-2 border rounded-md flex items-center gap-2 h-10"> <AlertCircle className="h-4 w-4 text-yellow-500" /> Assign a brand. </div> )}
                <Select onValueChange={(value) => field.onChange(value === 'no-company' || value === 'placeholder-company' ? null : value)} value={field.value || 'placeholder-company'} disabled={isCompanySelectDisabled || isLoadingLocationsForDialog}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={user.role === 'Super Admin' ? "No Brand (Super Admin)" : "Select a brand"} /></SelectTrigger>
                  </FormControl>
                  <SelectContent> 
                    <SelectItem value="placeholder-company" disabled>Select a brand...</SelectItem>
                    {currentUser?.role === 'Super Admin' && <SelectItem value="no-company">No Brand Assigned</SelectItem>}
                    {companies.map((c) => ( <SelectItem key={c.id} value={c.id}>{c.name} {c.parentBrandId ? "(Child)" : ""}</SelectItem> ))}
                  </SelectContent>
                </Select>
                {isCompanySelectDisabled && user.role !== 'Super Admin' && <p className="text-xs text-muted-foreground pt-1">Only Super Admins can change brand for non-Super Admins.</p>}
                {user.role === 'Super Admin' && <p className="text-xs text-muted-foreground pt-1">Super Admins are not assigned to a brand.</p>}
                <FormMessage />
              </FormItem> )} />

            <FormField control={form.control} name="assignedLocationIds" render={() => (
              <FormItem> <FormLabel>Assigned Locations (Optional)</FormLabel>
                <FormControl>
                  <div> 
                    <ScrollArea className="h-40 w-full rounded-md border p-4">
                        {isLoadingLocationsForDialog ? ( <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) :selectedCompanyIdInDialog && locationsForSelectedBrandInDialog.length > 0 ? ( <div className="space-y-2"> {locationsForSelectedBrandInDialog.map((loc) => ( <FormField key={loc.id} control={form.control} name="assignedLocationIds" render={({ field: cbField }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0"> <FormControl><Checkbox checked={cbField.value?.includes(loc.id)} onCheckedChange={c => { const current = cbField.value || []; const newVals = c ? [...current, loc.id] : current.filter(v => v !== loc.id); cbField.onChange(newVals); }} id={`edit-loc-${loc.id}`} /></FormControl> <FormLabel htmlFor={`edit-loc-${loc.id}`} className="font-normal">{loc.name}</FormLabel> </FormItem> )}/> ))} </div>
                        ) : ( <div className="text-sm text-muted-foreground italic flex items-center justify-center h-full"> {selectedCompanyIdInDialog ? 'No locations for this brand or your access.' : (user.role !== 'Super Admin' ? 'Select a brand to assign locations.' : 'Super Admins are not assigned to locations.')} </div> )}
                    </ScrollArea>
                  </div>
                </FormControl> <FormMessage />
              </FormItem> )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem> <FormLabel>User Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isRoleSelectDisabled}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a user role" /></SelectTrigger>
                  </FormControl>
                  <SelectContent> 
                    <SelectItem value={user.role} disabled={!assignableRolesForDropdown.includes(user.role) && user.role !== field.value && user.role !== 'Super Admin'}>{user.role} {user.role === 'Super Admin' ? '(Cannot Change)' : (canEditRole ? '' : '(Permission Denied)')}</SelectItem>
                    {assignableRolesForDropdown.filter(r => r !== user.role).map(r => ( <SelectItem key={r} value={r}>{r}</SelectItem> ))}
                    {ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => r !== user.role && !assignableRolesForDropdown.includes(r) && r !== 'Super Admin').map(r => ( <SelectItem key={r} value={r} disabled>{r} (Permission Denied)</SelectItem> ))}
                  </SelectContent>
                </Select>
                {isRoleSelectDisabled && currentUser?.id !== user.id && !isTargetUserSuperAdmin && <p className="text-xs text-muted-foreground pt-1">Cannot change this user's role.</p>}
                {isTargetUserSuperAdmin && <p className="text-xs text-muted-foreground pt-1">Super Admin role cannot be changed.</p>}
                <FormMessage />
              </FormItem> )} />

            {canSetPassword && ( <FormField control={form.control} name="newTemporaryPassword" render={({ field }) => ( <FormItem className="pt-2 border-t mt-6"> <FormLabel className="text-base font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-orange-500" />Set New Temporary Password</FormLabel> <FormControl><Input type="text" placeholder="Leave blank to keep current password" {...field} value={field.value ?? ''} /></FormControl> <p className="text-xs text-muted-foreground"> User will be forced to change on next login if set. </p> <FormMessage /> </FormItem> )} /> )}
            
            <DialogFooter> <DialogClose asChild><Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button></DialogClose> <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending || isLoadingLocationsForDialog}> {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isPending ? 'Saving...' : 'Save Changes'} </Button> </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
    
      
