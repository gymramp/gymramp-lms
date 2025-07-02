'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import type { CustomerPurchaseRecord } from '@/types/customer';
import { getCustomerPurchaseRecordByBrandId, getAllCustomerPurchaseRecords } from '@/lib/customer-data';
import { getPartnerById, Partner } from '@/lib/partner-data';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function PartnerCustomersPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [purchaseRecords, setPurchaseRecords] = useState<CustomerPurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const fetchPartnerAndCustomers = useCallback(async () => {
    if (!partnerId) return;
    setIsLoading(true);
    try {
      const partnerData = await getPartnerById(partnerId);
      if (!partnerData) {
        toast({ title: "Partner not found", variant: "destructive" });
        router.push('/admin/partners');
        return;
      }
      setPartner(partnerData);

      // This is inefficient but necessary without a direct link.
      // A better solution would be to store partnerId on the purchase record.
      // For now, we filter client-side based on the partner's name.
      const allRecords = await getAllCustomerPurchaseRecords();
      const partnerRecords = allRecords.filter(record => 
        record.revenueSharePartners?.some(p => p.name === partnerData.name && p.percentage === partnerData.percentage)
      );
      setPurchaseRecords(partnerRecords);

    } catch (error) {
      toast({ title: "Error", description: "Could not load partner customers.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, toast, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/admin/dashboard');
        } else {
          fetchPartnerAndCustomers();
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchPartnerAndCustomers]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    // Timestamps from server might be objects, handle them
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (isLoading || !partner) {
    return <div className="container mx-auto"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/admin/partners')} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Back to Partners</Button>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Customers for {partner.name}</h1>
        <p className="text-muted-foreground">List of all paid checkouts associated with this partner.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer Purchase Records</CardTitle>
          <CardDescription>
            Found {purchaseRecords.length} record(s) linked to {partner.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchaseRecords.length === 0 ? (
            <div className="text-center py-8">No customer records found for this partner.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Brand Name</TableHead><TableHead>Program Sold</TableHead><TableHead>Admin Email</TableHead><TableHead>Purchase Date</TableHead><TableHead className="text-right">Amount Paid</TableHead></TableRow></TableHeader>
              <TableBody>
                {purchaseRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium"><Link href={`/admin/companies/${record.brandId}/edit`} className="hover:underline text-primary flex items-center gap-1"><Building className="h-4 w-4"/>{record.brandName}</Link></TableCell>
                    <TableCell>{record.selectedProgramTitle || 'N/A'}</TableCell>
                    <TableCell>{record.adminUserEmail}</TableCell>
                    <TableCell>{formatDate(record.purchaseDate)}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">${record.totalAmountPaid.toFixed(2)}</Badge></TableCell>
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
