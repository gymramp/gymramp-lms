
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
import { getAllPrograms, getAllCourses, getCourseById } from '@/lib/firestore-data'; // Import course/program getters
import type { Program, Course } from '@/types/course';

interface RevenueShareEntry {
  brandId: string;
  brandName: string;
  brandCreatedAt?: Timestamp | Date | null;
  partnerName: string;
  partnerCompany?: string | null;
  partnerPercentage: number;
  shareBasis: 'coursePrice' | 'subscriptionPrice'; 
  // TODO: This needs to be completely rethought.
  // 'saleAmountForShareCalculation' needs to derive from the selected Program's one-time price
  // OR the relevant subscription tier price. This is very complex with multi-tiered subscriptions.
  saleAmountForShareCalculation: number; 
  calculatedRevShareAmount: number;
  // For future reference, we might need to store which Program was sold:
  // programIdSold?: string;
  // programTitleSold?: string;
}

export default function RevenueShareReportPage() {
  const [allCompaniesWithRevShare, setAllCompaniesWithRevShare] = useState<Company[]>([]);
  const [allProgramsMap, setAllProgramsMap] = useState<Map<string, Program>>(new Map());
  const [allCoursesMap, setAllCoursesMap] = useState<Map<string, Course>>(new Map());
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
      const [companies, programsData, coursesData] = await Promise.all([
        getAllCompanies(),
        getAllPrograms(),
        getAllCourses(),
      ]);
      
      const programsMap = new Map(programsData.map(p => [p.id, p]));
      setAllProgramsMap(programsMap);

      const coursesMap = new Map(coursesData.map(c => [c.id, c]));
      setAllCoursesMap(coursesMap);

      const relevantCompanies = companies.filter(company =>
        !company.isTrial &&
        company.saleAmount && company.saleAmount > 0 && // Still using company.saleAmount from old checkout
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
    // TODO: MAJOR REWORK REQUIRED HERE FOR REVENUE SHARE CALCULATION
    // The current `company.saleAmount` is based on the old Course-based checkout and is likely $0.
    // This report needs to:
    // 1. Identify which Program was sold (this info isn't currently stored on the Company/Brand document from checkout).
    // 2. Based on `partner.shareBasis`:
    //    - If 'coursePrice' (now Program one-time price): Use the sold Program's `price`.
    //    - If 'subscriptionPrice': Determine which subscription tier applies (firstSubscriptionPrice or secondSubscriptionPrice)
    //      and use that Program's specific subscription price. This requires knowing how far into the subscription the sale is,
    //      which isn't tracked yet. This is very complex.
    //
    // For now, this will use `company.saleAmount` as a placeholder, which is incorrect.
    // The report will show misleading data until checkout is redesigned for Program sales.

    const flatData = allCompaniesWithRevShare.flatMap(company =>
      (company.revenueSharePartners || []).map(partner => {
        let saleBaseForShare = company.saleAmount || 0; // THIS IS THE PLACEHOLDER
        let basisNote = "";

        // Attempt to derive a Program price if a Program was involved (hypothetical for now)
        // This requires knowing which program was sold. We don't have this on the company doc yet.
        // We also don't know if it was a one-time or subscription sale directly from company.saleAmount.
        // This is highly speculative until checkout is updated.
        if (partner.shareBasis === 'coursePrice') {
            // Placeholder: Assume company.saleAmount is the one-time price of whatever was sold.
            saleBaseForShare = company.saleAmount || 0;
            basisNote = " (based on Brand's recorded one-time sale value)";
        } else if (partner.shareBasis === 'subscriptionPrice') {
            // Placeholder: Assume company.saleAmount is the relevant subscription price for the first period.
            // This is highly inaccurate for multi-tiered subscriptions.
            saleBaseForShare = company.saleAmount || 0; 
            basisNote = " (based on Brand's recorded sale value, assumed subscription)";
            console.warn(`Revenue share on subscription for Brand ${company.name}, Partner ${partner.name} is using a placeholder value. Actual subscription pricing (first/second tier) needs to be determined based on the Program sold and subscription lifecycle, which is not yet implemented in checkout or this report.`);
        }

        return {
          brandId: company.id,
          brandName: company.name,
          brandCreatedAt: company.createdAt,
          partnerName: partner.name,
          partnerCompany: partner.companyName, // Note: schema uses companyName for partner
          partnerPercentage: partner.percentage,
          shareBasis: partner.shareBasis,
          saleAmountForShareCalculation: saleBaseForShare,
          calculatedRevShareAmount: (saleBaseForShare * partner.percentage) / 100,
          basisNote: basisNote, // For clarity in report
        };
      })
    );
    setReportData(flatData);
  }, [allCompaniesWithRevShare, allProgramsMap, allCoursesMap]);


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
    // Summing the saleAmountForShareCalculation for displayed entries.
    // This sum might be misleading if different partners for the same brand sale have different share bases.
    // A true "total sales from these brands" would require summing unique brand.saleAmount.
    return filteredReportData.reduce((sum, entry) => sum + entry.saleAmountForShareCalculation, 0);
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
      {/* TODO: This warning needs to be more prominent. */}
      <div className="mb-6 p-4 border border-destructive/50 bg-destructive/5 rounded-md">
          <h3 className="text-destructive font-semibold">Report Under Development - Data Accuracy Warning!</h3>
          <p className="text-sm text-destructive/90">
              This report needs a major overhaul to align with Program-based sales and the new multi-tiered subscription pricing.
              The "Sale Base for Share" and "Rev Share Amount" columns are currently using placeholder logic based on the old `Brand.saleAmount` (which itself is based on outdated Course pricing from initial checkout) and may not be accurate.
              This report will provide misleading data until the checkout process is fully updated to handle Program sales and their complex pricing, and this report is updated to consume that new sales data.
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
            List of paid Brand checkouts with revenue share agreements. <strong>Warning: Calculations are based on outdated pricing.</strong>
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
                  <p className="text-sm text-muted-foreground">Total Sale Base (Filtered - Placeholder)</p>
                  <p className="text-lg font-bold">${totalSaleAmountSumForDisplayedEntries.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rev Share (Filtered - Placeholder)</p>
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

