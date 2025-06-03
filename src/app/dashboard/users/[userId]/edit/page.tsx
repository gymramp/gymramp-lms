// src/app/dashboard/users/[userId]/edit/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole, Company, Location, UserFormData } from '@/types/user';
import type { Course, BrandCourse, Program } from '@/types/course';
import { getUserById, updateUser, toggleUserCourseAssignments, getUserByEmail } from '@/lib/user-data';
import { getCompanyById, getLocationsByCompanyId, getAllCompanies as fetchAllAccessibleBrandsForUser, getAllLocations } from '@/lib/company-data';
import { getAllCourses as getAllGlobalCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId } from '@/lib/brand-content-data';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, User as UserIcon, Building, MapPin, BookOpen, BarChart3, Save, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};

const editUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  role: z.string().min(1) as z.ZodType<UserRole>,
  // companyId is typically not editable by these roles directly for other users, will be pre-filled
  assignedLocationIds: z.array(z.string()).default([]),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function DashboardEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string; // This is the ID of the user being edited
  const { toast } = useToast();

  const [currentUserSession, setCurrentUserSession] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userPrimaryBrand, setUserPrimaryBrand] = useState<Company | null>(null); // Brand of currentUserSession or userToEdit
  const [accessibleChildBrands, setAccessibleChildBrands] = useState<Company[]>([]); // Child brands currentUserSession can manage
  const [locationsForSelectedBrand, setLocationsForSelectedBrand] = useState<Location[]>([]);
  const [assignableCourses, setAssignableCourses] = useState<(Course | BrandCourse)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: { name: '', role: 'Staff', assignedLocationIds: [] },
  });

  // Only used for displaying locations; actual company assignment is complex and depends on editor's role
  const watchedCompanyIdForLocationFilter = userToEdit?.companyId; // Use userToEdit's companyId for location filtering

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const sessionUser = await getUserByEmail(firebaseUser.email);
        setCurrentUserSession(sessionUser);
        if (!sessionUser || !['Super Admin', 'Admin', 'Owner', 'Manager'].includes(sessionUser.role)) {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push(sessionUser?.role === 'Staff' ? '/courses/my-courses' : '/');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchData = useCallback(async () => {
    if (!currentUserSession || !userId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const targetUser = await getUserById(userId);
      if (!targetUser) {
        toast({ title: "User not found", variant: "destructive" });
        router.push('/dashboard'); return;
      }

      let canEdit = false;
      if (currentUserSession.role === 'Super Admin') {
          canEdit = true;
      } else if (currentUserSession.id === targetUser.id) {
          canEdit = true;
      } else if (currentUserSession.companyId === targetUser.companyId) {
          if (currentUserSession.role === 'Admin' || currentUserSession.role === 'Owner') {
              canEdit = ROLE_HIERARCHY[currentUserSession.role] > ROLE_HIERARCHY[targetUser.role];
          } else if (currentUserSession.role === 'Manager') {
              canEdit = (targetUser.role === 'Staff' || targetUser.role === 'Manager');
          }
      } else if ((currentUserSession.role === 'Admin' || currentUserSession.role === 'Owner') && currentUserSession.companyId) {
          const allAccessibleBrands = await fetchAllAccessibleBrandsForUser(currentUserSession);
          const childBrands = allAccessibleBrands.filter(b => b.parentBrandId === currentUserSession.companyId);
          if (childBrands.some(cb => cb.id === targetUser.companyId)) {
            canEdit = ROLE_HIERARCHY[currentUserSession.role] > ROLE_HIERARCHY[targetUser.role];
          }
          setAccessibleChildBrands(childBrands);
      }


      if (!canEdit) {
        toast({ title: "Permission Denied", description: "You cannot edit this user.", variant: "destructive" });
        router.push('/dashboard'); return;
      }

      setUserToEdit(targetUser);
      let brandForContext: Company | null = null;
      if (targetUser.companyId) {
        brandForContext = await getCompanyById(targetUser.companyId);
      } else if (currentUserSession.companyId && (currentUserSession.role === 'Admin' || currentUserSession.role === 'Owner')) {
        brandForContext = await getCompanyById(currentUserSession.companyId);
      }
      setUserPrimaryBrand(brandForContext);


      if (brandForContext) {
        const brandLocations = await getLocationsByCompanyId(brandForContext.id);
        if (currentUserSession.role === 'Manager' && currentUserSession.companyId === brandForContext.id && currentUserSession.assignedLocationIds) {
            setLocationsForSelectedBrand(brandLocations.filter(loc => currentUserSession.assignedLocationIds!.includes(loc.id)));
        } else {
            setLocationsForSelectedBrand(brandLocations);
        }
      } else {
        setLocationsForSelectedBrand([]);
      }
      

      form.reset({
        name: targetUser.name || '',
        role: targetUser.role || 'Staff',
        assignedLocationIds: targetUser.assignedLocationIds || [],
      });

      let courses: (Course | BrandCourse)[] = [];
      if (brandForContext) {
        if (brandForContext.assignedProgramIds?.length) {
          const allProgs = await fetchAllGlobalPrograms();
          const relevantProgs = allProgs.filter(p => brandForContext!.assignedProgramIds!.includes(p.id));
          const courseIdSet = new Set<string>();
          relevantProgs.forEach(p => (p.courseIds || []).forEach(cid => courseIdSet.add(cid)));
          if (courseIdSet.size > 0) {
            const globalCoursePromises = Array.from(courseIdSet).map(cid => fetchGlobalCourseById(cid));
            courses.push(...(await Promise.all(globalCoursePromises)).filter(Boolean) as Course[]);
          }
        }
        if (brandForContext.canManageCourses) {
          courses.push(...await getBrandCoursesByBrandId(brandForContext.id));
        }
      }
      setAssignableCourses(courses.filter((c, i, self) => i === self.findIndex(o => o.id === c.id) && !c.isDeleted));

    } catch (error) {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentUserSession, form, router, toast]);

  useEffect(() => {
    if (currentUserSession) {
      fetchData();
    }
  }, [currentUserSession, fetchData]);

  const onSubmit = async (data: EditUserFormValues) => {
    if (!userToEdit || !currentUserSession) { toast({ title: "Error", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      const updatePayload: Partial<UserFormData> = {
        name: data.name,
        role: data.role,
        assignedLocationIds: data.assignedLocationIds || [],
      };

      if (data.role !== userToEdit.role) {
        if (currentUserSession.id === userToEdit.id && data.role !== currentUserSession.role) {
             toast({ title: "Action Denied", description: "You cannot change your own role.", variant: "destructive"}); setIsSaving(false); return;
        }
        if (currentUserSession.role !== 'Super Admin' && ROLE_HIERARCHY[currentUserSession.role] <= ROLE_HIERARCHY[data.role]) {
          toast({ title: "Permission Denied", description: "Cannot assign a role equal to or higher than your own.", variant: "destructive" });
          setIsSaving(false); return;
        }
        if (currentUserSession.role === 'Manager' && !(data.role === 'Staff' || data.role === 'Manager')) {
            toast({ title: "Permission Denied", description: "Managers can only assign 'Staff' or 'Manager' roles.", variant: "destructive"});
            setIsSaving(false); return;
        }
      }


      const updatedUser = await updateUser(userToEdit.id, updatePayload);
      if (updatedUser) {
        toast({ title: "User Updated", description: `${updatedUser.name}'s details have been updated.` });
        setUserToEdit(updatedUser); 
        fetchData();
      } else {
        throw new Error("Failed to update user.");
      }
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCourseAssignment = async (courseId: string) => {
    if (!userToEdit) return;
    const isAssigned = userToEdit.assignedCourseIds?.includes(courseId);
    const action = isAssigned ? 'unassign' : 'assign';
    try {
      const updatedUser = await toggleUserCourseAssignments(userToEdit.id, [courseId], action);
      if (updatedUser) {
        setUserToEdit(updatedUser);
        toast({ title: `Course ${action === 'assign' ? 'Assigned' : 'Unassigned'}`, description: `Course successfully ${action}ed.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update course assignment.", variant: "destructive" });
    }
  };

  if (isLoading || !userToEdit || !currentUserSession) {
    return <div className="container mx-auto p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const canChangeRole = currentUserSession.id !== userToEdit.id &&
                       (currentUserSession.role === 'Super Admin' || currentUserSession.role === 'Admin' || currentUserSession.role === 'Owner' || currentUserSession.role === 'Manager') &&
                       (currentUserSession.role === 'Super Admin' ? userToEdit.role !== 'Super Admin' : ROLE_HIERARCHY[currentUserSession.role] > ROLE_HIERARCHY[userToEdit.role]);
  
  let assignableRolesForDropdown: UserRole[] = [];
  if (canChangeRole) {
      if (currentUserSession.role === 'Super Admin'){
          assignableRolesForDropdown = (['Admin', 'Owner', 'Manager', 'Staff'] as UserRole[]);
      } else if (currentUserSession.role === 'Manager') {
          assignableRolesForDropdown = ['Staff', 'Manager'].filter(r => ROLE_HIERARCHY[currentUserSession.role] > ROLE_HIERARCHY[r as UserRole]);
      } else { 
          assignableRolesForDropdown = (['Admin', 'Owner', 'Manager', 'Staff'] as UserRole[]).filter(r => ROLE_HIERARCHY[currentUserSession.role] > ROLE_HIERARCHY[r as UserRole]);
      }
  }


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2 flex items-center gap-2">
        <UserIcon className="h-7 w-7" /> Edit Employee: {userToEdit.name}
      </h1>
      <p className="text-muted-foreground mb-8">Manage employee details and course assignments.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormItem><FormLabel>Email</FormLabel><Input value={userToEdit.email} disabled className="opacity-70" /></FormItem>
                  <FormItem><FormLabel>Current Brand</FormLabel><Input value={userPrimaryBrand?.name || 'N/A'} disabled className="opacity-70" /></FormItem>
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canChangeRole}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={userToEdit.role} disabled={assignableRolesForDropdown.length > 0 && !assignableRolesForDropdown.includes(userToEdit.role)}>{userToEdit.role} {canChangeRole ? "" : "(Cannot Change)"}</SelectItem>
                          {assignableRolesForDropdown.filter(r => r !== userToEdit.role).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!canChangeRole && <p className="text-xs text-muted-foreground">Your role does not permit changing this user's role.</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="assignedLocationIds" render={() => (
                    <FormItem><FormLabel>Assigned Locations</FormLabel>
                      <ScrollArea className="h-40 w-full rounded-md border p-4">
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> :
                         locationsForSelectedBrand.length > 0 ? locationsForSelectedBrand.map(loc => (
                          <FormField key={loc.id} control={form.control} name="assignedLocationIds" render={({ field }) => (
                            <FormItem className="flex items-center space-x-3"><FormControl>
                              <Checkbox checked={field.value?.includes(loc.id)} onCheckedChange={c => field.onChange(c ? [...(field.value || []), loc.id] : (field.value || []).filter(v => v !== loc.id))} />
                            </FormControl><FormLabel className="font-normal">{loc.name}</FormLabel></FormItem>
                          )}/>))
                         : <p className="text-sm text-muted-foreground italic">No locations available for this brand or your access level.</p>
                        }
                      </ScrollArea><FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Details
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Assigned Courses</CardTitle></CardHeader>
            <CardContent>
              {assignableCourses.length === 0 ? <p className="text-sm text-muted-foreground">No courses available for assignment for this brand's context.</p> :
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {assignableCourses.map(course => (
                      <div key={course.id} className="flex items-center justify-between p-2 border rounded-md">
                        <Label htmlFor={`course-${course.id}`} className="text-sm font-medium flex-1 cursor-pointer">{course.title} <Badge variant="outline" className="ml-2 text-xs">{course.level}</Badge></Label>
                        <Checkbox
                          id={`course-${course.id}`}
                          checked={userToEdit.assignedCourseIds?.includes(course.id) || false}
                          onCheckedChange={() => handleToggleCourseAssignment(course.id)}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> User Statistics</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Coming Soon!</AlertTitle>
                <AlertDescription className="text-blue-600 text-xs">
                  Detailed statistics like time spent per course and quiz attempts are planned. Backend data tracking needed.
                </AlertDescription>
              </Alert>
              <div className="text-sm"><strong>Overall Progress:</strong> {userToEdit.courseProgress?.[Object.keys(userToEdit.courseProgress)[0]]?.progress || 0}% (Placeholder)</div>
              <div className="text-sm"><strong>Time Spent (Total):</strong> N/A</div>
              <div className="text-sm"><strong>Quizzes Attempted (Total):</strong> N/A</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
