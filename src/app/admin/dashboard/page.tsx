
// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, Building, CreditCard, Loader2, AlertTriangle, Cog, List, CalendarDays, Percent, UserPlus, BarChartBig, TestTube2, Gift, DatabaseZap, Layers } from 'lucide-react';
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
import { format, subDays } from 'date-fns';
import { StatCard } from '@/components/dashboard/StatCard';

// Helper function to generate mock chart data
const generateChartData = (baseValue: number) => {
  if (baseValue === 0) {
      return Array(30).fill(null).map((_, i) => ({
          date: format(subDays(new Date(), 29 - i), 'MMM d'),
          value: 0
      }));
  }
  const data = [];
  let currentValue = baseValue * 0.8; // Start at 80% of the final value
  const today = new Date();
  for (let i = 29; i >= 0; i--) { // Iterate from 29 days ago to today
    const fluctuation = (Math.random() - 0.45) * (currentValue * 0.1); // Fluctuate by up to 10%
    currentValue += fluctuation + (baseValue * 0.2 / 30); // Add a small upward trend
    
    const date = subDays(today, i);
    data.push({ 
        date: format(date, 'MMM d'),
        value: Math.max(0, Math.round(currentValue)) 
    });
  }
  return data;
};

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
        getAllCompanies(currentUser), // Pass current user for role-based fetching
        getSalesTotalLastNDays(30),
      ]);

      setTotalUsers(usersData.length);
      setTotalCourses(coursesData.length);
      setTotalCompanies(companiesData.length);
      setTotalRecentSales(salesData);

      const sortedCompanies = companiesData
        .filter(company => company.createdAt) 
        .sort((a, b) => {
          const dateA = new Date(a.createdAt as string).getTime();
          const dateB = new Date(b.createdAt as string).getTime();
          return dateB - dateA;
        });
      setRecentCompanies(sortedCompanies.slice(0, 3));

      const sortedUsers = usersData
        .filter(user => user.createdAt) 
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
  }, [toast, currentUser]); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails?.role === 'Super Admin') {
            setCurrentUser(userDetails);
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
  }, [router, toast]);

  useEffect(() => {
    if (currentUser && !isAuthLoading) {
      fetchData();
    }
  }, [currentUser, isAuthLoading, fetchData]);


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
                 <Skeleton className="h-20 w-full mt-4" />
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
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
      return 'N/A';
    }
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) { 
        console.error("Error formatting date: Invalid date string received", dateString);
        return "Invalid Date";
      }
      return format(dateObj, 'PPpp'); 
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
        <StatCard
          title="Total Users"
          value={totalUsers}
          description="All registered users"
          icon={Users}
          chartData={generateChartData(totalUsers)}
          chartColor="hsl(var(--chart-1))"
          change="+5.2%"
          changeVariant="default"
        />
        <StatCard
          title="Total Courses"
          value={totalCourses}
          description="Courses in the library"
          icon={BookOpen}
          chartData={generateChartData(totalCourses)}
          chartColor="hsl(var(--chart-2))"
          change="+2.1%"
          changeVariant="default"
        />
        <StatCard
          title="Total Accounts"
          value={totalCompanies}
          description="Registered customer accounts"
          icon={Building}
          chartData={generateChartData(totalCompanies)}
          chartColor="hsl(var(--chart-3))"
          change="+1.5%"
          changeVariant="default"
        />
        <StatCard
          title="Sales (30 Days)"
          value={`$${totalRecentSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description="From new paid checkouts"
          icon={CreditCard}
          chartData={generateChartData(totalRecentSales)}
          chartColor="hsl(var(--chart-5))"
          change="+12%"
          changeVariant="default"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-lift-hover">
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Navigate to key management areas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => router.push('/admin/companies')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Building className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Accounts
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/users')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Users className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Users
                </Button>
                 <Button variant="outline" onClick={() => router.push('/admin/programs')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Layers className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Programs
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/courses')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <BookOpen className="mr-2 h-4 w-4 flex-shrink-0" /> Manage Courses (Global Library)
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/checkout')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <CreditCard className="mr-2 h-4 w-4 flex-shrink-0" /> New Paid Checkout
                </Button>
                 <Button variant="outline" onClick={() => router.push('/admin/free-trial-checkout')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Gift className="mr-2 h-4 w-4 flex-shrink-0" /> New Free Trial
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/settings')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Cog className="mr-2 h-4 w-4 flex-shrink-0" /> System Settings
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/revenue-share-report')} className="justify-start text-left h-auto whitespace-normal px-3 py-2">
                    <Percent className="mr-2 h-4 w-4 flex-shrink-0" /> Revenue Share Report
                </Button>
            </CardContent>
        </Card>

         <Card className="card-lift-hover">
            <CardHeader>
                <CardTitle>Recent Platform Additions</CardTitle>
                <CardDescription>Latest accounts and users added to the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-md font-semibold mb-2 text-muted-foreground flex items-center"><Building className="mr-2 h-4 w-4"/>Recent Accounts</h3>
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
                        <p className="text-sm text-muted-foreground italic">No new accounts recently.</p>
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
