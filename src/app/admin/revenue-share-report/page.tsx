
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ArrowLeft, Percent, FileText, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, User } from '@/types/user';
import { getAllCompanies } from '@/lib/company-data';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface RevenueShareEntry extends Company {
  calculatedRevShareAmount: number;
}

export default function RevenueShareReportPage() {
  const [reportData, setReportData] = useState<RevenueShareEntry[]>([]);
  const [filteredReportData, setFilteredReportData] = useState<RevenueShareEntry[]>([]);
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
          router.push('/');
        } else {
          fetchReportData();
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const companies = await getAllCompanies();
      const relevantCompanies = companies
        .filter(company =>
          !company.isTrial &&
          company.saleAmount && company.saleAmount > 0 &&
          company.revSharePartnerName &&
          typeof company.revSharePartnerPercentage === 'number' && company.revSharePartnerPercentage > 0
        )
        .map(company => ({
          ...company,
          calculatedRevShareAmount: (company.saleAmount! * company.revSharePartnerPercentage!) / 100,
        }));
      setReportData(relevantCompanies);
      setFilteredReportData(relevantCompanies);
    } catch (error) {
      console.error("Failed to fetch revenue share report data:", error);
      toast({ title: "Error", description: "Could not load report data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Super Admin') {
      fetchReportData();
    }
  }, [currentUser]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = reportData.filter(entry =>
      entry.name.toLowerCase().includes(lowercasedFilter) ||
      (entry.revSharePartnerName && entry.revSharePartnerName.toLowerCase().includes(lowercasedFilter)) ||
      (entry.revSharePartnerCompany && entry.revSharePartnerCompany.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredReportData(filtered);
  }, [searchTerm, reportData]);

  const totalRevShareSum = useMemo(() => {
    return filteredReportData.reduce((sum, entry) => sum + entry.calculatedRevShareAmount, 0);
  }, [filteredReportData]);

  const totalSaleAmountSum = useMemo(() => {
    return filteredReportData.reduce((sum, entry) => sum + (entry.saleAmount || 0), 0);
  }, [filteredReportData]);


  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push('/admin/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Revenue Share Report</h1>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by Company or Partner Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Checkout Revenue Share Details</CardTitle>
          <CardDescription>
            List of paid customer checkouts with revenue share agreements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredReportData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No entries found matching "${searchTerm}".` : "No revenue share entries found."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Company</TableHead>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Partner Company</TableHead>
                    <TableHead className="text-center">Share %</TableHead>
                    <TableHead className="text-right">Total Sale</TableHead>
                    <TableHead className="text-right">Rev Share Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>{entry.revSharePartnerName}</TableCell>
                      <TableCell>{entry.revSharePartnerCompany || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {entry.revSharePartnerPercentage?.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${entry.saleAmount?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        ${entry.calculatedRevShareAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 pt-4 border-t flex justify-end space-x-8">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales (Filtered)</p>
                  <p className="text-lg font-bold">${totalSaleAmountSum.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rev Share (Filtered)</p>
                  <p className="text-lg font-bold text-primary">${totalRevShareSum.toFixed(2)}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
