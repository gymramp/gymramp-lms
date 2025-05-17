
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
import { Loader2, ArrowLeft, Percent, FileText, Search, CalendarDays } from 'lucide-react'; // Added CalendarDays
import { useToast } from '@/hooks/use-toast';
import type { Company, User } from '@/types/user';
import { getAllCompanies } from '@/lib/company-data';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets'; // Import DatePicker
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

interface RevenueShareEntry extends Company {
  calculatedRevShareAmount: number;
  // Add original partner details if needed for multiple partners from one company
  partnerName: string;
  partnerCompany?: string | null;
  partnerPercentage: number;
}

export default function RevenueShareReportPage() {
  const [allCompaniesWithRevShare, setAllCompaniesWithRevShare] = useState<Company[]>([]);
  const [reportData, setReportData] = useState<RevenueShareEntry[]>([]);
  const [filteredReportData, setFilteredReportData] = useState<RevenueShareEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | null | undefined>(null); // Updated type for DatePicker
  const [endDate, setEndDate] = useState<Date | null | undefined>(null);   // Updated type for DatePicker
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
      // Filter companies that have revenue share partners
      const relevantCompanies = companies.filter(company =>
        !company.isTrial &&
        company.saleAmount && company.saleAmount > 0 &&
        Array.isArray(company.revenueSharePartners) && company.revenueSharePartners.length > 0
      );
      setAllCompaniesWithRevShare(relevantCompanies);
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
    // Flatten the data: one entry per partner
    const flatData = allCompaniesWithRevShare.flatMap(company =>
      (company.revenueSharePartners || []).map(partner => ({
        ...company, // Spread company details
        partnerName: partner.name,
        partnerCompany: partner.company,
        partnerPercentage: partner.percentage,
        calculatedRevShareAmount: (company.saleAmount! * partner.percentage) / 100,
      }))
    );
    setReportData(flatData);
  }, [allCompaniesWithRevShare]);


  useEffect(() => {
    let filtered = reportData;

    // Filter by search term
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.name.toLowerCase().includes(lowercasedFilter) ||
        (entry.partnerName && entry.partnerName.toLowerCase().includes(lowercasedFilter)) ||
        (entry.partnerCompany && entry.partnerCompany.toLowerCase().includes(lowercasedFilter))
      );
    }

    // Filter by date range
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      filtered = filtered.filter(entry => {
        const entryDate = entry.createdAt instanceof Timestamp ? entry.createdAt.toDate() : entry.createdAt;
        return entryDate && new Date(entryDate) >= startOfDay;
      });
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(entry => {
        const entryDate = entry.createdAt instanceof Timestamp ? entry.createdAt.toDate() : entry.createdAt;
        return entryDate && new Date(entryDate) <= endOfDay;
      });
    }

    setFilteredReportData(filtered);
  }, [searchTerm, reportData, startDate, endDate]);

  const totalRevShareSum = useMemo(() => {
    return filteredReportData.reduce((sum, entry) => sum + entry.calculatedRevShareAmount, 0);
  }, [filteredReportData]);

  const totalSaleAmountSumForDisplayedEntries = useMemo(() => {
    // To avoid double counting sales if a company has multiple partners,
    // we sum unique company sale amounts from the filtered entries.
    const uniqueCompanySales = new Map<string, number>();
    filteredReportData.forEach(entry => {
      if (entry.id && entry.saleAmount !== undefined && entry.saleAmount !== null) {
        uniqueCompanySales.set(entry.id, entry.saleAmount);
      }
    });
    return Array.from(uniqueCompanySales.values()).reduce((sum, amount) => sum + amount, 0);
  }, [filteredReportData]);

  const formatDate = (dateInput: Timestamp | Date | undefined | null): string => {
    if (!dateInput) return 'N/A';
    const date = dateInput instanceof Timestamp ? dateInput.toDate() : dateInput;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate(null);
    setEndDate(null);
  };


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
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-grow_ sm:flex-grow-0_">
          <label htmlFor="search-report" className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <Search className="h-4 w-4" /> Search
          </label>
          <Input
            id="search-report"
            type="text"
            placeholder="Brand or Partner Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm h-10"
          />
        </div>
        <div>
            <label htmlFor="start-date-picker" className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <CalendarDays className="h-4 w-4" /> Start Date
            </label>
            <DatePickerWithPresets date={startDate} setDate={setStartDate} />
        </div>
         <div>
            <label htmlFor="end-date-picker" className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                 <CalendarDays className="h-4 w-4" /> End Date
            </label>
            <DatePickerWithPresets date={endDate} setDate={setEndDate} />
        </div>
        <Button variant="outline" onClick={handleResetFilters} className="h-10">Reset Filters</Button>
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
              {searchTerm || startDate || endDate ? `No entries found matching your filters.` : "No revenue share entries found."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer Brand</TableHead>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Partner Brand</TableHead>
                    <TableHead className="text-center">Share %</TableHead>
                    <TableHead className="text-right">Total Sale (Brand)</TableHead>
                    <TableHead className="text-right">Rev Share Amount (Partner)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.map((entry, index) => ( // Added index for unique key
                    <TableRow key={`${entry.id}-${entry.partnerName}-${index}`}>
                      <TableCell>{formatDate(entry.createdAt)}</TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>{entry.partnerName}</TableCell>
                      <TableCell>{entry.partnerCompany || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {entry.partnerPercentage?.toFixed(1)}%
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
                  <p className="text-sm text-muted-foreground">Total Sales (Filtered Brands)</p>
                  <p className="text-lg font-bold">${totalSaleAmountSumForDisplayedEntries.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rev Share (Filtered Partners)</p>
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

