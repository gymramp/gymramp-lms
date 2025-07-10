
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Building, Users, Globe, Link as LinkIcon, Gift, AlertTriangle, Infinity, PlusCircle } from 'lucide-react';
import type { Company, User } from '@/types/user';
import { getCompanyById, getChildBrandsByParentId } from '@/lib/company-data';
import { getUserByEmail, getUsersByCompanyId } from '@/lib/user-data'; // Import getUsersByCompanyId
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [childBrands, setChildBrands] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]); // State for users
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCompanyData = useCallback(async (user: User | null) => {
    if (!user || !['Super Admin', 'Admin', 'Owner'].includes(user.role) || !companyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [companyData, childBrandsData, usersData] = await Promise.all([
        getCompanyById(companyId),
        getChildBrandsByParentId(companyId),
        getUsersByCompanyId(companyId) // Fetch users for the parent company
      ]);

      if (!companyData || (user.role !== 'Super Admin' && user.companyId !== companyData.id)) {
        toast({ title: "Error", description: "Account not found or access denied.", variant: "destructive" });
        router.push('/admin/accounts');
        return;
      }
      setCompany(companyData);
      setChildBrands(childBrandsData);
      setUsers(usersData); // Set the users state
    } catch (error) {
      console.error("Failed to fetch company data:", error);
      toast({ title: "Error", description: "Could not load account details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, router, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails && ['Super Admin', 'Admin', 'Owner'].includes(userDetails.role)) {
          fetchCompanyData(userDetails);
        } else {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchCompanyData]);

  const trialStatusDisplay = () => {
    if (!company) return null;
    if (company.isTrial && company.trialEndsAt) {
      const endsAt = new Date(company.trialEndsAt as string);
      if (endsAt < new Date()) {
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Trial Ended: {endsAt.toLocaleDateString()}</Badge>;
      } else {
        return <Badge variant="default" className="bg-green-100 text-green-700 flex items-center gap-1"><Gift className="h-3 w-3" />Active Trial: Ends {endsAt.toLocaleDateString()}</Badge>;
      }
    } else if (company.isTrial) {
      return <Badge variant="secondary">Trial (No End Date)</Badge>;
    } else {
      return <span className="text-sm text-muted-foreground">Not a Trial Account</span>;
    }
  };

  if (isLoading || !company || !currentUser) {
    return (
      <div className="container mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-10 w-1/2" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3 mt-2" /></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full md:col-span-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/admin/accounts')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
      </Button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Building className="h-7 w-7" /> Account Details
        </h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{company.name}</CardTitle>
            <CardDescription>
              This page shows read-only information for the parent brand/account.
            </CardDescription>
          </div>
           <Button asChild>
              <Link href={`/admin/companies/${companyId}/edit-form`}>Edit Account</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8 pt-6">
          <div className="space-y-1">
            <Label htmlFor="subdomain" className="text-muted-foreground flex items-center gap-1"><Globe className="h-4 w-4" /> Subdomain</Label>
            <Input id="subdomain" value={company.subdomainSlug || 'Not set'} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="domain" className="text-muted-foreground flex items-center gap-1"><LinkIcon className="h-4 w-4" /> Custom Domain</Label>
            <Input id="domain" value={company.customDomain || 'Not set'} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="max-users" className="text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4" /> Max Users</Label>
            <div className="flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {company.maxUsers === null || company.maxUsers === undefined ? <Infinity className="h-5 w-5"/> : company.maxUsers}
            </div>
          </div>
           <div className="space-y-1">
            <Label className="text-muted-foreground flex items-center gap-1"><Gift className="h-4 w-4" /> Trial Status</Label>
            <div className="flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                 {trialStatusDisplay()}
            </div>
          </div>
           <div className="md:col-span-2 space-y-1">
            <Label htmlFor="description" className="text-muted-foreground">Short Description</Label>
            <p id="description" className="text-sm text-foreground p-3 border rounded-md min-h-[60px] bg-muted/50">
              {company.shortDescription || 'No description provided.'}
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Brands</CardTitle>
                <Button asChild variant="outline" size="sm">
                   <Link href={`/admin/companies/new?parent=${company.id}`}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Brand
                   </Link>
                </Button>
            </CardHeader>
            <CardContent>
              {childBrands.length > 0 ? (
                <ul className="space-y-2">
                  {childBrands.map(brand => (
                    <li key={brand.id} className="text-sm p-2 border rounded-md flex justify-between items-center">
                      <span>{brand.name}</span>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/companies/${brand.id}/edit`}>Manage</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No child brands associated with this account.</p>
              )}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Users in this Account</CardTitle>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/new?companyId=${company.id}`}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
              {users.length > 0 ? (
                <ul className="space-y-2">
                  {users.map(user => (
                    <li key={user.id} className="text-sm p-2 border rounded-md flex justify-between items-center">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant="secondary">{user.role}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No users are directly assigned to this parent account.</p>
              )}
            </CardContent>
          </Card>
      </div>

    </div>
  );
}
