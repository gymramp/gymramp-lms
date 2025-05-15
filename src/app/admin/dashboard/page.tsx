
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, Building, CreditCard, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Import Button component
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail, getAllUsers } from '@/lib/user-data';
import { getAllCourses } from '@/lib/firestore-data';
import { getAllCompanies } from '@/lib/company-data';
import type { User } from '@/types/user';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuperAdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCourses, setTotalCourses] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalSales, setTotalSales] = useState(0); // Placeholder for sales data
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [users, courses, companies] = await Promise.all([
        getAllUsers(),
        getAllCourses(),
        getAllCompanies(),
      ]);
      setTotalUsers(users.length);
      setTotalCourses(courses.length);
      setTotalCompanies(companies.length);
      setTotalSales(0); // Placeholder, replace with actual sales fetching logic
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails?.role === 'Super Admin') {
            setCurrentUser(userDetails);
            await fetchData();
          } else {
            toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
            router.push('/');
          }
        } catch (error) {
          console.error("Auth check error:", error);
          toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
          router.push('/');
        }
      } else {
        toast({ title: "Authentication Required", description: "Please log in as a Super Admin.", variant: "destructive" });
        router.push('/');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router, toast, fetchData]);


  if (isAuthLoading || isLoading) {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <div className="mb-8">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-4 w-1/3 mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8">
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // This should ideally be handled by the redirect in useEffect, but as a fallback:
    return (
        <div className="container mx-auto py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-xl font-semibold text-destructive">Access Denied</p>
            <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of the GYMRAMP platform.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">All registered users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCourses}</div>
            <p className="text-xs text-muted-foreground">Courses in the library</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">Registered companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales (Placeholder)</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime sales volume</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 grid gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Navigate to key management areas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <Button variant="outline" onClick={() => router.push('/admin/companies')}>Manage Companies</Button>
                <Button variant="outline" onClick={() => router.push('/admin/users')}>Manage Users</Button>
                <Button variant="outline" onClick={() => router.push('/admin/courses')}>Manage Courses</Button>
                <Button variant="outline" onClick={() => router.push('/admin/checkout')}>New Customer Checkout</Button>
            </CardContent>
        </Card>
         {/* Placeholder for future charts or more detailed reports */}
         <Card>
            <CardHeader>
                <CardTitle>Platform Activity (Placeholder)</CardTitle>
                <CardDescription>Graphs and reports will be shown here.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground italic">
                Chart data and visualizations coming soon.
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

