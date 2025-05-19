
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
import { Loader2, ArrowLeft, Percent, FileText, Search, CalendarDays, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, User, RevenueSharePartner } from '@/types/user';
import { getAllCompanies } from '@/lib/company-data';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Timestamp } from 'firebase/firestore';
import { getAllPrograms } from '@/lib/firestore-data'; // To get program prices
import type { Program } from '@/types/course';

interface RevenueShareEntry {
  brandId: string;
  brandName: string;
  brandCreatedAt?: Timestamp | Date | null;
  partnerName: string;
  partnerCompany?: string | null;
  partnerPercentage: number;
  shareBasis: 'coursePrice' | 'subscriptionPrice'; // This will now refer to Program prices
  // TODO: 'saleAmountForShareCalculation' will depend on program pricing, not company.saleAmount directly.
  // This report needs significant redesign once Program sales are implemented.
  saleAmountForShareCalculation: number;
  calculatedRevShareAmount: number;
}

export default function RevenueShareReportPage() {
  const [allCompaniesWithRevShare, setAllCompaniesWithRevShare] = useState<Company[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]); // Store all programs
  const [reportData, setReportData] = useState<RevenueShareEntry[]>([]);
  const [filteredReportData, setFilteredReportData] = useState<RevenueShareEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | null | undefined>(null);
  const [endDate, setEndDate] = useState<Date | null | undefined>(null);
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
      const [companies, programsData] = await Promise.all([
        getAllCompanies(),
        getAllPrograms() // Fetch programs as well
      ]);
      setAllPrograms(programsData);
      const relevantCompanies = companies.filter(company =>
        !company.isTrial &&
        company.saleAmount && company.saleAmount > 0 && // Still using company.saleAmount for now, but it's based on old course prices
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
    // TODO: This logic needs a major overhaul.
    // 1. The checkout process needs to be updated to sell Programs.
    // 2. The `saleAmount` on the Company record should reflect the Program price paid.
    // 3. The `shareBasis` ('coursePrice' or 'subscriptionPrice') should refer to the Program's one-time or subscription price.
    // For now, this report will likely show incorrect or incomplete data due to the pricing model shift.
    const flatData = allCompaniesWithRevShare.flatMap(company =>
      (company.revenueSharePartners || []).map(partner => {
        // Placeholder: This `saleAmountForShareCalculation` is still based on the old `company.saleAmount`
        // which was derived from course prices. This needs to change based on Program sales.
        // For now, we use company.saleAmount. If a Program was selected, this would be company.programSaleAmount (hypothetical)
        // If shareBasis is subscription, we'd need to find the Program and its subscription price.
        // This part is highly dependent on how program sales are recorded.
        let saleBaseForShare = company.saleAmount || 0;
        if (partner.shareBasis === 'subscriptionPrice') {
          // This is a simplification. In reality, you'd need to know WHICH program's subscription price.
          // Assuming for now the company.saleAmount represents the first month if it was a subscription.
          // Or, find an *associated program* and use its subscription price.
          // This is a placeholder and likely incorrect until program sales are tracked.
          // For demonstration, if a company has assignedCourseIds, we might try to find a program that includes those.
          // This is very speculative.
          console.warn("Revenue share on subscription price is not fully implemented for this report due to pricing model changes.");
          saleBaseForShare = company.saleAmount || 0; // Placeholder for subscription basis
        }

        return {
          brandId: company.id,
          brandName: company.name,
          brandCreatedAt: company.createdAt,
          partnerName: partner.name,
          partnerCompany: partner.company,
          partnerPercentage: partner.percentage,
          shareBasis: partner.shareBasis,
          saleAmountForShareCalculation: saleBaseForShare,
          calculatedRevShareAmount: (saleBaseForShare * partner.percentage) / 100,
        };
      })
    );
    setReportData(flatData);
  }, [allCompaniesWithRevShare, allPrograms]);


  useEffect(() => {
    let filtered = reportData;
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.brandName.toLowerCase().includes(lowercasedFilter) ||
        (entry.partnerName && entry.partnerName.toLowerCase().includes(lowercasedFilter)) ||
        (entry.partnerCompany && entry.partnerCompany.toLowerCase().includes(lowercasedFilter))
      );
    }
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      filtered = filtered.filter(entry => {
        const entryDate = entry.brandCreatedAt instanceof Timestamp ? entry.brandCreatedAt.toDate() : entry.brandCreatedAt;
        return entryDate && new Date(entryDate) >= startOfDay;
      });
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(entry => {
        const entryDate = entry.brandCreatedAt instanceof Timestamp ? entry.brandCreatedAt.toDate() : entry.brandCreatedAt;
        return entryDate && new Date(entryDate) <= endOfDay;
      });
    }
    setFilteredReportData(filtered);
  }, [searchTerm, reportData, startDate, endDate]);

  const totalRevShareSum = useMemo(() => {
    return filteredReportData.reduce((sum, entry) => sum + entry.calculatedRevShareAmount, 0);
  }, [filteredReportData]);

  const totalSaleAmountSumForDisplayedEntries = useMemo(() => {
    const uniqueCompanySales = new Map<string, number>();
    filteredReportData.forEach(entry => {
      if (entry.brandId && entry.saleAmountForShareCalculation !== undefined && entry.saleAmountForShareCalculation !== null) {
         // This sums the base amounts used for share calculation, which might be different per partner if shareBasis varies
        uniqueCompanySales.set(`${entry.brandId}-${entry.partnerName}`, entry.saleAmountForShareCalculation);
      }
    });
    // This total might be misleading if shareBasis differs. A true "total sales" would be unique brand sale amounts.
    // For now, summing the `saleAmountForShareCalculation` to align with `calculatedRevShareAmount`.
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
      <div className="mb-6 p-4 border border-destructive/50 bg-destructive/5 rounded-md">
          <h3 className="text-destructive font-semibold">Report Under Development</h3>
          <p className="text-sm text-destructive/90">
              This report needs to be updated to reflect the new Program-based pricing model.
              The "Total Sale (Brand)" and "Rev Share Amount" columns are currently based on outdated Course pricing logic
              from initial Brand checkout and may not be accurate.
          </p>
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
                    <TableHead className="text-center">Share Basis</TableHead>
                    <TableHead className="text-right">Sale Base for Share</TableHead>
                    <TableHead className="text-right">Rev Share Amount (Partner)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.map((entry, index) => (
                    <TableRow key={`${entry.brandId}-${entry.partnerName}-${index}`}>
                      <TableCell>{formatDate(entry.brandCreatedAt)}</TableCell>
                      <TableCell className="font-medium">{entry.brandName}</TableCell>
                      <TableCell>{entry.partnerName}</TableCell>
                      <TableCell>{entry.partnerCompany || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {entry.partnerPercentage?.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={entry.shareBasis === 'coursePrice' ? 'outline' : 'default'}>
                           {entry.shareBasis === 'coursePrice' ? 'Program Price' : 'Program Subscription'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${entry.saleAmountForShareCalculation?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        ${entry.calculatedRevShareAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 pt-4 border-t flex justify-end space-x-8">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sale Base (Filtered)</p>
                  <p className="text-lg font-bold">${totalSaleAmountSumForDisplayedEntries.toFixed(2)}</p>
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

