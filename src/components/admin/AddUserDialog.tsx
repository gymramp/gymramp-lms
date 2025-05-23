
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
import type { UserRole, User, Company, Location } from '@/types/user';
import { getCompanyById, getLocationsByCompanyId } from '@/lib/company-data';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Info, ShieldCheck } from 'lucide-react';
import { createUserAndSendWelcomeEmail } from '@/actions/userManagement'; // Import new server action

const userFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.string().min(1, { message: 'Please select a user role' }) as z.ZodType<UserRole>,
  companyId: z.string().min(1, { message: 'Please select a brand.' }),
  assignedLocationIds: z.array(z.string()).default([]),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface AddUserDialogProps {
  onUserAdded: (user: User, tempPassword?: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  companies: Company[];
  locations: Location[];
  currentUser: User | null;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};
const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];

export function AddUserDialog({ onUserAdded, isOpen, setIsOpen, companies, locations, currentUser }: AddUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [locationsForSelectedBrand, setLocationsForSelectedBrand] = useState<Location[]>([]);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<Company | null>(null);
  const [currentUserCountForSelectedBrand, setCurrentUserCountForSelectedBrand] = useState<number>(0);
  const [isLoadingBrandData, setIsLoadingBrandData] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', role: 'Staff', companyId: '', assignedLocationIds: [] },
  });

  const selectedCompanyIdForm = form.watch('companyId');

  useEffect(() => {
    const fetchBrandDetails = async () => {
      if (!selectedCompanyIdForm) {
        setSelectedCompanyDetails(null);
        setCurrentUserCountForSelectedBrand(0);
        setLocationsForSelectedBrand([]);
        form.setValue('assignedLocationIds', []);
        return;
      }
      setIsLoadingBrandData(true);
      try {
        const companyData = await getCompanyById(selectedCompanyIdForm);
        // Assuming getUserCountByCompanyId is available or we adapt
        // For now, we'll just use companyData.maxUsers for the check.
        // const userCount = await getUserCountByCompanyId(selectedCompanyIdForm);
        const brandLocations = await getLocationsByCompanyId(selectedCompanyIdForm);
        setSelectedCompanyDetails(companyData);
        // setCurrentUserCountForSelectedBrand(userCount);
        
        if (currentUser?.role === 'Manager' && currentUser.companyId === selectedCompanyIdForm && currentUser.assignedLocationIds) {
            setLocationsForSelectedBrand(brandLocations.filter(loc => currentUser.assignedLocationIds!.includes(loc.id)));
        } else {
            setLocationsForSelectedBrand(brandLocations);
        }
        
        form.setValue('assignedLocationIds', []);
      } catch (error) {
        toast({ title: "Error", description: "Could not load brand details.", variant: "destructive" });
        setSelectedCompanyDetails(null); setCurrentUserCountForSelectedBrand(0); setLocationsForSelectedBrand([]);
      } finally {
        setIsLoadingBrandData(false);
      }
    };
    if (isOpen) fetchBrandDetails();
  }, [selectedCompanyIdForm, isOpen, currentUser, form, toast]); // Removed locations dependency

  useEffect(() => {
    if (isOpen) {
      const initialCompanyId = currentUser?.role !== 'Super Admin' ? currentUser?.companyId || '' : (companies.length === 1 ? companies[0].id : '');
      const initialRole = currentUser?.role === 'Manager' ? 'Staff' : 'Staff';
      form.reset({ name: '', email: '', role: initialRole, companyId: initialCompanyId, assignedLocationIds: [] });
      
      if (initialCompanyId) {
        form.setValue('companyId', initialCompanyId, { shouldValidate: true }); 
      } else {
        setLocationsForSelectedBrand([]); 
        setSelectedCompanyDetails(null);
        setCurrentUserCountForSelectedBrand(0);
      }
    }
  }, [isOpen, currentUser, companies, form]);


  const onSubmit = async (data: UserFormValues) => {
    startTransition(async () => {
      if (!currentUser) { toast({ title: "Error", description: "Current user not found.", variant: "destructive" }); return; }
      if (currentUser.role === 'Manager' && data.role !== 'Staff') { toast({ title: "Permission Denied", description: "Managers can only create Staff users.", variant: "destructive"}); return; }
      if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager' && ROLE_HIERARCHY[currentUser.role] <= ROLE_HIERARCHY[data.role]) { toast({ title: "Permission Denied", description: "Cannot create user with role higher/equal to your own.", variant: "destructive"}); return; }
      if (!data.companyId) { form.setError("companyId", { type: "manual", message: "Brand selection is required." }); return; }
      
      // Fetch current user count again before submitting to be sure
      if (selectedCompanyDetails?.maxUsers !== null && selectedCompanyDetails?.maxUsers !== undefined) {
          const currentCount = await getCompanyById(data.companyId).then(c => c?.maxUsers ? getUserCountByCompanyId(c.id) : Promise.resolve(0)); // Re-fetch count or estimate
          if (currentCount >= selectedCompanyDetails.maxUsers) {
            toast({ title: "User Limit Reached", description: `Brand ${selectedCompanyDetails.name} reached max users (${selectedCompanyDetails.maxUsers}).`, variant: "destructive", duration: 7000 }); return;
          }
      }

      const userDataToSend = {
        name: data.name,
        email: data.email,
        role: data.role,
        companyId: data.companyId,
        assignedLocationIds: data.assignedLocationIds || [],
      };

      const result = await createUserAndSendWelcomeEmail(userDataToSend);

      if (result.success && result.user) {
        toast({ title: 'User Added & Email Sent', description: `${result.user.name} successfully added. Welcome email initiated.` });
        onUserAdded(result.user, result.tempPassword);
        setIsOpen(false);
      } else {
        toast({ title: 'User Creation Error', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
      }
    });
  };

  const assignableRoles = ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(role =>
    currentUser && (currentUser.role === 'Super Admin' || ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[role]) || (currentUser.role === 'Manager' && role === 'Staff'))
  );
  // Re-fetch or estimate user count before this check
  const isUserLimitReached = selectedCompanyDetails?.maxUsers !== null && selectedCompanyDetails?.maxUsers !== undefined && currentUserCountForSelectedBrand >= selectedCompanyDetails.maxUsers;


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <Alert variant="default" className="mt-4 border-blue-300 bg-blue-50 dark:bg-blue-900/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">Password & Email</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
              A temporary password will be auto-generated. The user will be prompted to change it on first login.
              A welcome email with these credentials will be sent to the user.
            </AlertDescription>
          </Alert>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Full Name</FormLabel> <FormControl><Input placeholder="John Doe" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email Address</FormLabel> <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="companyId" render={({ field }) => (
              <FormItem> <FormLabel>Brand</FormLabel>
                {currentUser?.role === 'Super Admin' && companies.length === 0 && ( <div className="text-sm text-muted-foreground p-2 border rounded-md flex items-center gap-2 h-10"> <AlertCircle className="h-4 w-4 text-yellow-500" /> No brands. Add one first. </div> )}
                <Select onValueChange={(value) => field.onChange(value === 'placeholder-company' ? '' : value)} value={field.value || 'placeholder-company'} disabled={(currentUser?.role !== 'Super Admin' && !!currentUser?.companyId) || (currentUser?.role === 'Super Admin' && companies.length === 0) || isLoadingBrandData}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl>
                  <SelectContent> <SelectItem value="placeholder-company" disabled>Select a brand...</SelectItem> {companies.map((c) => ( <SelectItem key={c.id} value={c.id}>{c.name} {c.parentBrandId ? "(Child)" : ""}</SelectItem> ))} </SelectContent>
                </Select>
                {isLoadingBrandData && <p className="text-xs text-muted-foreground">Loading brand info...</p>}
                {!isLoadingBrandData && selectedCompanyDetails && ( <p className="text-xs text-muted-foreground"> Users: {currentUserCountForSelectedBrand} / {selectedCompanyDetails.maxUsers ?? 'Unlimited'} </p> )}
                {isUserLimitReached && !isLoadingBrandData && ( <p className="text-xs font-medium text-destructive">User limit reached for this brand.</p> )}
                <FormMessage />
              </FormItem> )} />
            <FormField control={form.control} name="assignedLocationIds" render={({ field }) => (
              <FormItem> <FormLabel>Assign to Locations (Optional)</FormLabel>
                <FormControl> <ScrollArea className="h-40 w-full rounded-md border p-4">
                    {isLoadingBrandData ? ( <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : selectedCompanyIdForm && locationsForSelectedBrand.length > 0 ? ( <div className="space-y-2"> {locationsForSelectedBrand.map((loc) => ( <FormField key={loc.id} control={form.control} name="assignedLocationIds" render={({ field: cbField }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0"> <FormControl><Checkbox checked={cbField.value?.includes(loc.id)} onCheckedChange={(checked) => checked ? cbField.onChange([...(cbField.value || []), loc.id]) : cbField.onChange((cbField.value || []).filter(v => v !== loc.id))} id={`loc-${loc.id}`} /></FormControl> <FormLabel htmlFor={`loc-${loc.id}`} className="font-normal">{loc.name}</FormLabel> </FormItem> )}/> ))} </div>
                    ) : ( <div className="text-sm text-muted-foreground italic flex items-center justify-center h-full"> {selectedCompanyIdForm ? 'No locations for this brand.' : 'Select brand first.'} </div> )}
                </ScrollArea> </FormControl> <FormMessage />
              </FormItem> )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem> <FormLabel>User Role</FormLabel>
                <Select onValueChange={(value) => field.onChange(value === 'placeholder-role' ? '' : value)} value={field.value || 'placeholder-role'} defaultValue={field.value} disabled={currentUser?.role === 'Manager' || assignableRoles.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a user role" /></SelectTrigger></FormControl>
                  <SelectContent> <SelectItem value="placeholder-role" disabled>Select a role...</SelectItem>
                    {assignableRoles.map((r) => ( <SelectItem key={r} value={r}>{r}</SelectItem> ))}
                    {ALL_POSSIBLE_ROLES_TO_ASSIGN.filter(r => !assignableRoles.includes(r)).map(r => ( <SelectItem key={r} value={r} disabled>{r} (Permission Denied)</SelectItem> ))}
                  </SelectContent>
                </Select>
                {currentUser?.role === 'Manager' && <p className="text-xs text-muted-foreground pt-1">Managers can only create Staff users.</p>}
                <FormMessage />
              </FormItem> )} />
            <DialogFooter> <DialogClose asChild><Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button></DialogClose> <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending || (currentUser?.role === 'Super Admin' && companies.length === 0) || isUserLimitReached || isLoadingBrandData}> {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isPending ? 'Adding...' : 'Add User'} </Button> </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
