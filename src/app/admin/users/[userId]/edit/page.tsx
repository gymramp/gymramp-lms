
// src/app/admin/users/[userId]/edit/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
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
import type { User, UserRole, Company, Location, UserFormData, UserCourseProgressData } from '@/types/user';
import type { Course, BrandCourse, Program, Quiz, BrandQuiz } from '@/types/course';
import { getUserById, updateUser, toggleUserCourseAssignments, getUserByEmail as fetchUserByEmail } from '@/lib/user-data';
import { getAllCompanies as fetchAllCompaniesForSA, getLocationsByCompanyId, getAllLocations, getCompanyById as fetchCompanyDataById } from '@/lib/company-data'; // Renamed specific import
import { getAllCourses as getAllGlobalCourses, getCourseById as fetchGlobalCourseById, getAllPrograms as fetchAllGlobalPrograms, getAllQuizzes, getQuizById as fetchGlobalQuizById } from '@/lib/firestore-data';
import { getBrandCoursesByBrandId, getBrandQuizzesByBrandId, getBrandQuizById } from '@/lib/brand-content-data';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, User as UserIcon, Building, MapPin, BookOpen, BarChart3, Save, Loader2, AlertCircle, KeyRound, Clock, ListChecks, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 5, 'Admin': 4, 'Owner': 3, 'Manager': 2, 'Staff': 1,
};
const ALL_POSSIBLE_ROLES_TO_ASSIGN: UserRole[] = ['Super Admin', 'Admin', 'Owner', 'Manager', 'Staff'];
const NO_BRAND_VALUE = "__NO_BRAND__";

const editUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  role: z.string().min(1) as z.ZodType<UserRole>,
  companyId: z.string().nullable(),
  assignedLocationIds: z.array(z.string()).default([]),
  newTemporaryPassword: z.string().optional().refine(val => !val || val.length === 0 || val.length >= 6, {
    message: "New password must be at least 6 characters if provided.",
  }),
}).refine(data => data.role === 'Super Admin' || !!data.companyId, {
  message: "Non-Super Admin users must be assigned to a brand.",
  path: ["companyId"],
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function AdminEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { toast } = useToast();

  const [currentUserSession, setCurrentUserSession] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [allCompaniesForSA, setAllCompaniesForSA] = useState<Company[]>([]);
  const [allSystemLocations, setAllSystemLocations] = useState<Location[]>([]);
  const [locationsForSelectedBrand, setLocationsForSelectedBrand] = useState<Location[]>([]);
  const [assignableCourses, setAssignableCourses] = useState<(Course | BrandCourse)[]>([]);
  const [allQuizzesMap, setAllQuizzesMap] = useState<Map<string, Quiz | BrandQuiz>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLocationsForDialog, setIsLoadingLocationsForDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: { name: '', role: 'Staff', companyId: null, assignedLocationIds: [], newTemporaryPassword: '' },
  });

  const watchedCompanyId = form.watch('companyId');
  const watchedRole = form.watch('role');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const sessionUser = await fetchUserByEmail(firebaseUser.email);
        setCurrentUserSession(sessionUser);
        if (sessionUser?.role !== 'Super Admin') {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchData = useCallback(async () => {
    if (!currentUserSession || currentUserSession.role !== 'Super Admin' || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [user, companiesData, locationsData, globalQuizzesData] = await Promise.all([
        getUserById(userId),
        fetchAllCompaniesForSA(currentUserSession),
        getAllLocations(),
        getAllQuizzes(),
      ]);

      if (!user) {
        toast({ title: "Team member not found", variant: "destructive" });
        router.push('/admin/users');
        return;
      }
      setUserToEdit(user);
      setAllCompaniesForSA(companiesData);
      setAllSystemLocations(locationsData);

      form.reset({
        name: user.name || '',
        role: user.role || 'Staff',
        companyId: user.companyId || null,
        assignedLocationIds: user.assignedLocationIds || [],
        newTemporaryPassword: '',
      });
      
      const quizzesMap = new Map<string, Quiz | BrandQuiz>();
      globalQuizzesData.forEach(q => quizzesMap.set(q.id, q));

      // For Super Admin, fetch all brand-specific quizzes from all companies
      for (const company of companiesData) {
          if (company.id) {
              const brandQuizzes = await getBrandQuizzesByBrandId(company.id);
              brandQuizzes.forEach(bq => {
                  if (!quizzesMap.has(bq.id)) {
                      quizzesMap.set(bq.id, bq);
                  }
              });
          }
      }
      setAllQuizzesMap(quizzesMap);

      let courses: (Course | BrandCourse)[] = [];
      const brandForContext = user.companyId ? await fetchCompanyDataById(user.companyId) : null;

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
      } else if (user.role === 'Super Admin') {
        courses.push(...await getAllGlobalCourses());
      }
      setAssignableCourses(courses.filter((c, i, self) => i === self.findIndex(o => o.id === c.id) && !c.isDeleted));

    } catch (error) {
      console.error("Error fetching data for admin edit user page:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentUserSession, form, router, toast]);

  useEffect(() => {
    if (currentUserSession?.role === 'Super Admin') {
      fetchData();
    }
  }, [currentUserSession, fetchData]);

  useEffect(() => {
    if (watchedCompanyId) {
      setIsLoadingLocationsForDialog(true);
      setLocationsForSelectedBrand(allSystemLocations.filter(loc => loc.companyId === watchedCompanyId));
      if (userToEdit && watchedCompanyId !== userToEdit.companyId) {
        form.setValue('assignedLocationIds', []);
      }
      setIsLoadingLocationsForDialog(false);
    } else {
      setLocationsForSelectedBrand([]);
      form.setValue('assignedLocationIds', []);
    }
  }, [watchedCompanyId, allSystemLocations, userToEdit, form]);

  const onSubmit = async (data: EditUserFormValues) => {
    if (!userToEdit || !currentUserSession || currentUserSession.role !== 'Super Admin') {
      toast({ title: "Permission Denied", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const updatePayload: Partial<UserFormData & { requiresPasswordChange?: boolean }> = {
        name: data.name,
        role: data.role,
        companyId: data.role === 'Super Admin' ? null : data.companyId,
        assignedLocationIds: (data.role === 'Super Admin' || !data.companyId) ? [] : data.assignedLocationIds,
      };
      let passwordMessage = "";
      if (data.newTemporaryPassword && data.newTemporaryPassword.length >= 6) {
        updatePayload.requiresPasswordChange = true;
        console.warn(`ADMIN SDK NEEDED: Simulating password update for ${userToEdit.email} to ${data.newTemporaryPassword}`);
        toast({ title: "Password Update (Simulated)", description: `Password for ${userToEdit.email} would be set to '${data.newTemporaryPassword}' via Admin SDK. User will be prompted to change it. Communicate this password to the user.`, variant: "default", duration: 15000 });
        passwordMessage = ` New temporary password noted.`;
      }

      const updatedUser = await updateUser(userToEdit.id, updatePayload);
      if (updatedUser) {
        toast({ title: "Team Member Updated", description: `${updatedUser.name}'s details have been updated.${passwordMessage}` });
        setUserToEdit(updatedUser);
        fetchData();
      } else {
        throw new Error("Failed to update team member.");
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

  const formatTimeSpent = (seconds?: number): string => {
    if (seconds === undefined || seconds === null || seconds < 0) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  if (isLoading || !userToEdit || !currentUserSession) {
    return <div className="container mx-auto p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  const canChangeRole = currentUserSession.id !== userToEdit.id && userToEdit.role !== 'Super Admin';
  const canSetPassword = currentUserSession.id !== userToEdit.id && userToEdit.role !== 'Super Admin';

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Button variant="outline" onClick={() => router.push('/admin/users')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-primary mb-2 flex items-center gap-2">
        <UserIcon className="h-7 w-7" /> Edit Team Member: {userToEdit.name}
      </h1>
      <p className="text-muted-foreground mb-8">Manage team member details, assignments, and view statistics.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Team Member Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormItem><FormLabel>Email</FormLabel><Input value={userToEdit.email} disabled className="opacity-70" /></FormItem>
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canChangeRole}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {ALL_POSSIBLE_ROLES_TO_ASSIGN.map(r => (
                            <SelectItem key={r} value={r} disabled={r === 'Super Admin' && currentUserSession.role !== 'Super Admin'}>
                              {r} {r === 'Super Admin' && currentUserSession.role !== 'Super Admin' ? '(Restricted)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!canChangeRole && userToEdit.role !== 'Super Admin' && <p className="text-xs text-muted-foreground">You cannot change your own role or this team member's role.</p>}
                      {userToEdit.role === 'Super Admin' && <p className="text-xs text-muted-foreground">Super Admin role cannot be changed.</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem><FormLabel>Brand</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === NO_BRAND_VALUE ? null : value)}
                        value={field.value === null ? NO_BRAND_VALUE : field.value || ''}
                        disabled={userToEdit.role === 'Super Admin'}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={NO_BRAND_VALUE}>No Brand (Only for Super Admin)</SelectItem>
                          {allCompaniesForSA.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {userToEdit.role === 'Super Admin' && <p className="text-xs text-muted-foreground">Super Admins are not assigned to a specific brand.</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="assignedLocationIds" render={() => (
                    <FormItem><FormLabel>Assigned Locations</FormLabel>
                      <ScrollArea className="h-40 w-full rounded-md border p-4">
                        {isLoadingLocationsForDialog ? <Loader2 className="h-5 w-5 animate-spin"/> :
                         locationsForSelectedBrand.length > 0 ? locationsForSelectedBrand.map(loc => (
                          <FormField key={loc.id} control={form.control} name="assignedLocationIds" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl>
                              <Checkbox checked={field.value?.includes(loc.id)} onCheckedChange={c => field.onChange(c ? [...(field.value || []), loc.id] : (field.value || []).filter(v => v !== loc.id))} />
                            </FormControl><FormLabel className="font-normal">{loc.name}</FormLabel></FormItem>
                          )}/>))
                         : <p className="text-sm text-muted-foreground italic">{(watchedCompanyId && watchedRole !== 'Super Admin') ? 'No locations for selected brand.' : (watchedRole !== 'Super Admin' ? 'Select a brand to see locations.' : 'Super Admins are not assigned locations.')}</p>
                        }
                      </ScrollArea><FormMessage />
                    </FormItem>
                  )} />
                   {canSetPassword && ( <FormField control={form.control} name="newTemporaryPassword" render={({ field }) => ( 
                      <FormItem className="pt-4 border-t"> 
                        <FormLabel className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-orange-500" />Set New Temporary Password</FormLabel> 
                          <div className="relative">
                            <FormControl>
                              <Input 
                                type={showTempPassword ? "text" : "password"} 
                                placeholder="Leave blank to keep current password" 
                                {...field} value={field.value ?? ''} 
                                className="pr-10"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2"
                              onClick={() => setShowTempPassword((prev) => !prev)}
                            >
                              {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              <span className="sr-only">{showTempPassword ? "Hide password" : "Show password"}</span>
                            </Button>
                          </div>
                        <p className="text-xs text-muted-foreground">Team member will be forced to change on next login if set.</p> <FormMessage /> 
                      </FormItem> 
                    )} /> )}
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
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
              {assignableCourses.length === 0 ? <p className="text-sm text-muted-foreground">No courses available for assignment in this user's brand context.</p> :
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
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Team Member Statistics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {userToEdit.assignedCourseIds && userToEdit.assignedCourseIds.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {userToEdit.assignedCourseIds.map(courseId => {
                      const courseProgress = userToEdit.courseProgress?.[courseId];
                      const courseInfo = assignableCourses.find(c => c.id === courseId);
                      return (
                        <div key={courseId} className="p-3 border rounded-md">
                          <h4 className="text-sm font-semibold">{courseInfo?.title || `Course ID: ${courseId}`}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Time Spent: {formatTimeSpent(courseProgress?.timeSpentSeconds)}
                          </p>
                          {Object.entries(courseProgress?.quizAttempts || {}).map(([quizId, attempts]) => { // quizId is short ID
                             const quizInfo = allQuizzesMap.get(quizId);
                             return (
                               <p key={quizId} className="text-xs text-muted-foreground pl-4 flex items-center gap-1">
                                 <ListChecks className="h-3 w-3" />
                                 {quizInfo?.title || `[Quiz: ${quizId}]`}: {attempts} attempt(s)
                               </p>
                             );
                          })}
                          {(!courseInfo?.curriculum?.some(c => c.startsWith('quiz-') || c.startsWith('brandQuiz-')) && Object.keys(courseProgress?.quizAttempts || {}).length === 0) && (
                            <p className="text-xs text-muted-foreground pl-4 italic">No quizzes recorded for this course.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground italic">No courses assigned to this team member to show statistics for.</p>
              )}
               <Alert variant="default" className="bg-blue-50 border-blue-200 mt-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700 text-sm">Note on Statistics</AlertTitle>
                <AlertDescription className="text-blue-600 text-xs">
                  Time spent tracking and quiz attempt counts are now being recorded. Data will populate as users interact with content.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
