
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Loader2, Users, ShoppingBag, CreditCard, MoreHorizontal, Search, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import type { CustomerPurchaseRecord } from '@/types/customer';
import { getAllCustomerPurchaseRecords } from '@/lib/customer-data';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';

export default function AdminCustomersPage() {
  const [purchaseRecords, setPurchaseRecords] = useState<CustomerPurchaseRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<CustomerPurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push('/admin/dashboard'); // Or appropriate dashboard
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchPurchaseRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await getAllCustomerPurchaseRecords();
      setPurchaseRecords(records);
      setFilteredRecords(records);
    } catch (error) {
      console.error("Failed to fetch customer purchase records:", error);
      toast({ title: "Error", description: "Could not load customer purchase records.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchPurchaseRecords();
    }
  }, [currentUser, fetchPurchaseRecords]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = purchaseRecords.filter(record =>
      record.brandName.toLowerCase().includes(lowercasedFilter) ||
      record.adminUserEmail.toLowerCase().includes(lowercasedFilter) ||
      (record.paymentIntentId && record.paymentIntentId.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredRecords(filtered);
  }, [searchTerm, purchaseRecords]);

  const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString();
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <ShoppingBag className="h-7 w-7" /> Customer Purchases
        </h1>
        {/* Future: Add button for "New Manual Sale" or similar if needed */}
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by Brand, Email, or Payment ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Paid Checkout Records</CardTitle>
          <CardDescription>List of all completed paid customer checkouts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No records found matching "${searchTerm}".` : "No customer purchase records found."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead>Courses</TableHead>
                  <TableHead>Rev Share</TableHead>
                  <TableHead>Payment ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/companies/${record.brandId}/edit`} className="hover:underline text-primary">
                        {record.brandName}
                      </Link>
                    </TableCell>
                    <TableCell>{record.adminUserEmail}</TableCell>
                    <TableCell>{formatDate(record.purchaseDate)}</TableCell>
                    <TableCell className="text-right">${record.totalAmountPaid.toFixed(2)}</TableCell>
                    <TableCell>
                      {record.selectedCourseTitles && record.selectedCourseTitles.length > 0 ? (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {record.selectedCourseTitles.length} Course{record.selectedCourseTitles.length > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.revenueSharePartners && record.revenueSharePartners.length > 0 ? (
                        <Badge variant="outline">Yes ({record.revenueSharePartners.length})</Badge>
                      ) : (
                        <Badge variant="outline" className="opacity-60">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.paymentIntentId ? `${record.paymentIntentId.substring(0, 10)}...` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {record.brandName}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                           {record.paymentIntentId && (
                            <DropdownMenuItem asChild>
                                <a
                                    href={`https://dashboard.stripe.com/payments/${record.paymentIntentId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    View on Stripe
                                </a>
                            </DropdownMenuItem>
                           )}
                          {/* Add more actions later, e.g., view details, manage subscription (if applicable) */}
                          <DropdownMenuItem onClick={() => router.push(`/admin/companies/${record.brandId}/edit`)}>
                              View Brand Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/users?companyId=${record.brandId}`)}>
                              View Brand Users
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
