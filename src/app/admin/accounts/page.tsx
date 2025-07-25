
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Search, Building, Users, MoreHorizontal, Briefcase, ChevronsUpDown, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, User } from '@/types/user';
import { getParentAccounts } from '@/lib/account-data';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type SortKey = keyof Company | 'childBrandCount' | 'userCount';
type SortDirection = 'asc' | 'desc';


export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<Company[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'name', direction: 'asc' });
  const { toast } = useToast();
  const router = useRouter();

  const fetchAccounts = useCallback(async (user: User | null) => {
    if (!user || user.role !== 'Super Admin') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const parentAccountsData = await getParentAccounts();
      setAccounts(parentAccountsData);
      setFilteredAccounts(parentAccountsData);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
      toast({ title: "Error", description: "Could not load accounts.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role === 'Super Admin') {
          fetchAccounts(userDetails);
        } else {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchAccounts]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = accounts.filter(account =>
      account.name.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredAccounts(filtered);
  }, [searchTerm, accounts]);
  
  const sortedAccounts = useMemo(() => {
    let sortableItems = [...filteredAccounts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Company];
        const bValue = b[sortConfig.key as keyof Company];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredAccounts, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="ml-2 h-4 w-4" />;
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto text-center"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Briefcase className="h-7 w-7" /> Account Management
        </h1>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/admin/companies/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Account
          </Link>
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input type="text" placeholder="Search accounts by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm"/>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Parent Accounts</CardTitle>
          <CardDescription>This list shows all parent accounts. Each account can have multiple brands.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedAccounts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No accounts found matching "${searchTerm}".` : "No parent accounts found."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Button variant="ghost" onClick={() => requestSort('name')}>Account Name {getSortIcon('name')}</Button></TableHead>
                  <TableHead className="text-center"><Button variant="ghost" onClick={() => requestSort('childBrandCount')}>Brands {getSortIcon('childBrandCount')}</Button></TableHead>
                  <TableHead className="text-center"><Button variant="ghost" onClick={() => requestSort('userCount')}>Users (Total) {getSortIcon('userCount')}</Button></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={account.logoUrl || undefined} alt={`${account.name} logo`} className="object-contain" />
                          <AvatarFallback className="text-xs">{account.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{account.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline">{account.childBrandCount ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline">{account.userCount === undefined ? 'N/A' : account.userCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu for {account.name}</span>
                                  <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/companies/${account.id}/edit`}>
                                        <Settings className="mr-2 h-4 w-4" /> Account Details
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/companies?parent=${account.id}`}>
                                        <Building className="mr-2 h-4 w-4" /> View Brands
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/users?companyId=${account.id}`}>
                                        <Users className="mr-2 h-4 w-4" /> View Users
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
