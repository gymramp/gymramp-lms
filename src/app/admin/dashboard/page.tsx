// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, Building, CreditCard, Loader2, AlertTriangle, Cog, List, CalendarDays, Percent, UserPlus, BarChartBig, TestTube2, Gift, DatabaseZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail, getAllUsers } from '@/lib/user-data';
import { getAllCourses } from '@/lib/firestore-data';
import { getAllCompanies, getSalesTotalLastNDays } from '@/lib/company-data';
import type { User, Company } from '@/types/user';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
// Timestamp is not directly used for formatting here, relying on toDate().toISOString() then new Date()
// import { Timestamp } from 'firebase/firestore';

export default function SuperAdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCourses, setTotalCourses] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalRecentSales, setTotalRecentSales] = useState(0);
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, coursesData, companiesData, salesData] = await Promise.all([
        getAllUsers(),
        getAllCourses(),
        getAllCompanies(), // Super Admin sees all companies
        getSalesTotalLastNDays(30),
      ]);

      setTotalUsers(usersData.length);
      setTotalCourses(coursesData.length);
      setTotalCompanies(companiesData.length);
      setTotalRecentSales(salesData);

      const sortedCompanies = companiesData
        .filter(company => company.createdAt) // Ensure createdAt exists
        .sort((a, b) => {
          // Convert ISO strings back to Date objects for comparison
          const dateA = new Date(a.createdAt as string).getTime();
          const dateB = new Date(b.createdAt as string).getTime();
          return dateB - dateA;
        });
      setRecentCompanies(sortedCompanies.slice(0, 3));

      const sortedUsers = usersData
        .filter(user => user.createdAt) // Ensure createdAt exists
        .sort((a, b) => {
          const dateA = new Date(a.createdAt as string).getTime();
          const dateB = new Date(b.createdAt as string).getTime();
          return dateB - dateA;
        });
      setRecentUsers(sortedUsers.slice(0, 3));

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
      <div className="container mx-auto">
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
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
        <div className="container mx-auto text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-xl font-semibold text-destructive">Access Denied</p>
            <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
    );
  }

  const formatDateForDisplay = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPpp'); // Example: May 15, 2024, 10:30:00 PM
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return "Invalid Date";
    }
  };

  return (
    <div className="container mx-auto">
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
            <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
            <Building className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">Registered brands</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales (Last 30 Days)</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRecentSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">From new paid checkouts</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Navigate to key management areas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => router.push('/admin/companies')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Building className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Brands
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/users')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Users className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Users
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/courses')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <BookOpen className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Courses
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/checkout')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <CreditCard className="mr-2 h-4 w-4 flex-shrink-0" /> New Customer Checkout
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/settings')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Cog className="mr-2 h-4 w-4 flex-shrink-0" /> System Settings
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/revenue-share-report')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Percent className="mr-2 h-4 w-4 flex-shrink-0" /> Revenue Share Report
                </Button>
            </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <CardTitle>Recent Platform Additions</CardTitle>
                <CardDescription>Latest brands and users added to the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-md font-semibold mb-2 text-muted-foreground flex items-center"><Building className="mr-2 h-4 w-4"/>Recent Brands</h3>
                    {recentCompanies.length > 0 ? (
                        <ul className="space-y-2">
                            {recentCompanies.map(company => (
                                <li key={company.id} className="text-sm p-2 border-b border-border last:border-b-0">
                                    <span className="font-medium text-primary">{company.name}</span>
                                    <span className="text-xs text-muted-foreground block">
                                        <CalendarDays className="inline mr-1 h-3 w-3"/>
                                        Added: {formatDateForDisplay(company.createdAt)}
                                    </span>
                                     {company.saleAmount !== null && company.saleAmount !== undefined && (
                                        <span className="text-xs text-green-600 block">
                                            Sale: ${company.saleAmount.toFixed(2)}
                                        </span>
                                     )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No new brands recently.</p>
                    )}
                </div>
                <div>
                    <h3 className="text-md font-semibold mb-2 text-muted-foreground flex items-center"><Users className="mr-2 h-4 w-4"/>Recent Users</h3>
                    {recentUsers.length > 0 ? (
                        <ul className="space-y-2">
                            {recentUsers.map(user => (
                                <li key={user.id} className="text-sm p-2 border-b border-border last:border-b-0">
                                    <span className="font-medium text-primary">{user.name}</span> ({user.email})
                                    <span className="text-xs text-muted-foreground block">Role: {user.role}</span>
                                    <span className="text-xs text-muted-foreground block">
                                       <CalendarDays className="inline mr-1 h-3 w-3"/>
                                       Added: {formatDateForDisplay(user.createdAt)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No new users recently.</p>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
