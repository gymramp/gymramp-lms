
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import type { UserRole, User, Company, Location } from '@/types/user';
import { getUserByEmail as fetchUserByEmail, getAllUsers } from '@/lib/user-data';
import { getAllCompanies, getLocationsByCompanyId } from '@/lib/company-data';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, ShieldCheck, ArrowLeft, UserPlus } from 'lucide-react';
import { createUserAndSendWelcomeEmail } from '@/actions/userManagement';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';


const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};
const ASSIGNABLE_ROLES_BY_ADMINS: UserRole[] = ['Admin', 'Owner', 'Manager', 'Staff'];

const userFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.string().min(1, { message: 'Please select a user role' }) as z.ZodType<UserRole>,
  companyId: z.string().min(1, { message: 'Please select an account.' }),
  assignedLocationIds: z.array(z.string()).default([]),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function AddNewUserPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locationsForSelectedBrand, setLocationsForSelectedBrand] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<Company | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', role: 'Staff', companyId: '', assignedLocationIds: [] },
  });

  const selectedCompanyIdForm = form.watch('companyId');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await fetchUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (!userDetails || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(userDetails.role)) {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  useEffect(() => {
    async function fetchData() {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const fetchedCompanies = await getAllCompanies(currentUser);
        setCompanies(fetchedCompanies);

        const initialCompanyId = currentUser.role !== 'Super Admin' ? currentUser.companyId || '' : (fetchedCompanies.length === 1 ? fetchedCompanies[0].id : '');
        form.setValue('companyId', initialCompanyId);

      } catch (error) {
        toast({ title: "Error", description: "Could not load necessary data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [currentUser, form, toast]);


  useEffect(() => {
    async function fetchLocations() {
      if (!selectedCompanyIdForm) {
        setLocationsForSelectedBrand([]);
        setSelectedCompanyDetails(null);
        return;
      }
      try {
        const companyDetails = companies.find(c => c.id === selectedCompanyIdForm);
        const allUsers = await getAllUsers();
        const userCount = allUsers.filter(u => u.companyId === selectedCompanyIdForm && u.isActive).length;
        
        if (companyDetails) {
            setSelectedCompanyDetails({...companyDetails, userCount });
        }
        
        const locs = await getLocationsByCompanyId(selectedCompanyIdForm);
        setLocationsForSelectedBrand(locs);
        form.setValue('assignedLocationIds', []);
      } catch (e) {
        setLocationsForSelectedBrand([]);
        setSelectedCompanyDetails(null);
      }
    }
    fetchLocations();
  }, [selectedCompanyIdForm, companies, form]);


  const onSubmit = async (data: UserFormValues) => {
    startTransition(async () => {
      if (!currentUser) { toast({ title: "Error", description: "Current team member not found.", variant: "destructive" }); return; }

      const permissionError = checkPermissions(currentUser, data.role);
      if (permissionError) {
        toast({ title: "Permission Denied", description: permissionError, variant: "destructive" });
        return;
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
        toast({ title: 'Team Member Added & Email Sent', description: `${result.user.name} successfully added. Welcome email initiated. Temp Password: ${result.tempPassword}`, duration: 10000 });
        router.push('/admin/users');
      } else {
        toast({ title: 'Team Member Creation Error', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
      }
    });
  };

  const checkPermissions = (currentUser: User, targetRole: UserRole): string | null => {
    if (currentUser.role === 'Super Admin') return null;
    if (ROLE_HIERARCHY[currentUser.role] < ROLE_HIERARCHY[targetRole]) {
      return "You cannot create a team member with a role higher than your own.";
    }
    if (currentUser.role === 'Manager' && !(targetRole === 'Staff' || targetRole === 'Manager')) {
      return "Managers can only create Staff or other Manager users.";
    }
    if ((currentUser.role === 'Admin' || currentUser.role === 'Owner') && ROLE_HIERARCHY[currentUser.role] <= ROLE_HIERARCHY[targetRole]) {
      return "You cannot create a team member with a role equal to or higher than your own.";
    }
    return null;
  };

  const assignableRoles = ASSIGNABLE_ROLES_BY_ADMINS.filter(role => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin') return true;
    if (currentUser.role === 'Manager') return role === 'Staff' || role === 'Manager';
    return ROLE_HIERARCHY[currentUser.role] > ROLE_HIERARCHY[role];
  });
  
  const isUserLimitReached = selectedCompanyDetails?.maxUsers !== null && 
                             selectedCompanyDetails?.maxUsers !== undefined &&
                             (selectedCompanyDetails.userCount || 0) >= selectedCompanyDetails.maxUsers;
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-1/3" />
        <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><UserPlus className="h-6 w-6"/> Add Team Member</CardTitle>
          <CardDescription>Fill out the form below to create a new team member account.</CardDescription>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="mb-6 border-blue-300 bg-blue-50 dark:bg-blue-900/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">Password & Email</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
              A temporary password will be auto-generated. The user will be prompted to change it on first login.
              A welcome email with these credentials will be sent to the user.
            </AlertDescription>
          </Alert>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel>Full Name</FormLabel> 
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormDescription>The team member's full name for certificates and display.</FormDescription>
                  <FormMessage /> 
                </FormItem> 
              )} />
              <FormField control={form.control} name="email" render={({ field }) => ( 
                <FormItem> 
                  <FormLabel>Email Address</FormLabel> 
                  <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl> 
                  <FormDescription>The email address the team member will use to log in.</FormDescription>
                  <FormMessage /> 
                </FormItem> 
              )} />
              
              <FormField control={form.control} name="companyId" render={({ field }) => (
                <FormItem> 
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={currentUser?.role !== 'Super Admin' && companies.length <= 1}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                    <SelectContent>{companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <FormDescription>Assigns the team member to a specific customer account.</FormDescription>
                  {isUserLimitReached && <p className="text-xs font-medium text-destructive mt-1">Team member limit reached for this account.</p>}
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="assignedLocationIds" render={({ field }) => (
                <FormItem> 
                  <FormLabel>Assign to Locations (Optional)</FormLabel>
                  <FormControl>
                    <ScrollArea className="h-40 w-full rounded-md border p-4">
                      {locationsForSelectedBrand.length > 0 ? (
                        <div className="space-y-2">{locationsForSelectedBrand.map((loc) => (
                          <FormField key={loc.id} control={form.control} name="assignedLocationIds" render={({ field: cbField }) => (
                            <FormItem className="flex items-center space-x-3"><FormControl><Checkbox checked={cbField.value?.includes(loc.id)} onCheckedChange={(checked) => checked ? cbField.onChange([...(cbField.value || []), loc.id]) : cbField.onChange((cbField.value || []).filter(v => v !== loc.id))} id={`loc-${loc.id}`} /></FormControl><FormLabel htmlFor={`loc-${loc.id}`} className="font-normal">{loc.name}</FormLabel></FormItem>
                          )}/>
                        ))}</div>
                      ) : (<div className="text-sm text-muted-foreground italic h-full flex items-center justify-center">{selectedCompanyIdForm ? 'No locations for this account.' : 'Select an account first.'}</div>)}
                    </ScrollArea>
                  </FormControl> 
                  <FormDescription>Determines which location-specific data the team member can access or be associated with.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem> 
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={assignableRoles.length === 0}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {assignableRoles.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      {ASSIGNABLE_ROLES_BY_ADMINS.filter(r => !assignableRoles.includes(r) && r !== 'Super Admin').map(r => ( <SelectItem key={r} value={r} disabled>{r} (Permission Denied)</SelectItem> ))}
                    </SelectContent>
                  </Select>
                   <FormDescription>
                      <ul className="list-disc pl-4 text-xs space-y-1 mt-2">
                        <li><strong>Admin/Owner:</strong> Full control over their account & child accounts.</li>
                        <li><strong>Manager:</strong> Manages users within their assigned locations.</li>
                        <li><strong>Staff:</strong> Standard user, can only access assigned learning content.</li>
                      </ul>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              
              <CardFooter className="p-0 pt-6">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isPending || isUserLimitReached}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isPending ? 'Adding Team Member...' : 'Add Team Member'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
