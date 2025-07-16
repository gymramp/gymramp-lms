
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
import { Loader2, ArrowLeft, Percent, FileText, Search, CalendarDays, DollarSign, Layers, AlertTriangle, Info } from 'lucide-react'; // Added Layers, AlertTriangle, Info
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
import { getAllPrograms, getCourseById, getProgramById } from '@/lib/firestore-data';
import type { Program, Course } from '@/types/course';
import type { CustomerPurchaseRecord } from '@/types/customer'; // Import CustomerPurchaseRecord
import { getAllCustomerPurchaseRecords } from '@/lib/customer-data'; // Import function to get records


interface RevenueShareReportEntry {
  purchaseRecordId: string;
  brandId: string;
  brandName: string;
  brandPurchaseDate?: string | null; // Changed from brandCreatedAt
  programSoldTitle?: string | null;
  partnerName: string;
  partnerCompany?: string | null;
  partnerPercentage: number;
  shareBasis: 'coursePrice' | 'subscriptionPrice';
  saleAmountForShareCalculation: number; 
  calculatedRevShareAmount: number;
  basisNote?: string; 
}

export default function RevenueShareReportPage() {
  const [allPurchaseRecords, setAllPurchaseRecords] = useState<CustomerPurchaseRecord[]>([]);
  const [allProgramsMap, setAllProgramsMap] = useState<Map<string, Program>>(new Map());
  const [reportData, setReportData] = useState<RevenueShareReportEntry[]>([]);
  const [filteredReportData, setFilteredReportData] = useState<RevenueShareReportEntry[]>([]);
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
      const [purchaseRecordsData, programsData] = await Promise.all([
        getAllCustomerPurchaseRecords(),
        getAllPrograms(),
      ]);
      
      const programsMap = new Map(programsData.map(p => [p.id, p]));
      setAllProgramsMap(programsMap);
      setAllPurchaseRecords(purchaseRecordsData);

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
    const flatData = allPurchaseRecords.flatMap(record => {
      if (!record.revenueSharePartners || record.revenueSharePartners.length === 0) {
        return [];
      }
      const programDetails = record.selectedProgramId ? allProgramsMap.get(record.selectedProgramId) : null;

      return (record.revenueSharePartners).map(partner => {
        let saleBaseForShare = 0;
        let basisNote = "";

        if (partner.shareBasis === 'coursePrice') { 
            saleBaseForShare = record.totalAmountPaid; 
            basisNote = "Program Base Price";
        } else if (partner.shareBasis === 'subscriptionPrice') {
            if (programDetails && programDetails.firstSubscriptionPrice) {
                const subPrice = parseFloat(programDetails.firstSubscriptionPrice.replace(/[$,/mo]/gi, ''));
                saleBaseForShare = isNaN(subPrice) ? 0 : subPrice;
                basisNote = "Program 1st Sub Price (Hypothetical)";
            } else {
                saleBaseForShare = 0; 
                basisNote = "Subscription Price N/A for Program";
            }
        }

        return {
          purchaseRecordId: record.id,
          brandId: record.brandId,
          brandName: record.brandName,
          brandPurchaseDate: record.purchaseDate as string | undefined, 
          programSoldTitle: record.selectedProgramTitle || programDetails?.title || 'Unknown Program',
          partnerName: partner.name,
          partnerCompany: partner.companyName,
          partnerPercentage: partner.percentage,
          shareBasis: partner.shareBasis,
          saleAmountForShareCalculation: saleBaseForShare,
          calculatedRevShareAmount: (saleBaseForShare * partner.percentage) / 100,
          basisNote: basisNote,
        };
      })
    });
    setReportData(flatData);
  }, [allPurchaseRecords, allProgramsMap]);


  useEffect(() => {
    let filtered = reportData;
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.brandName.toLowerCase().includes(lowercasedFilter) ||
        (entry.partnerName && entry.partnerName.toLowerCase().includes(lowercasedFilter)) ||
        (entry.partnerCompany && entry.partnerCompany.toLowerCase().includes(lowercasedFilter)) ||
        (entry.programSoldTitle && entry.programSoldTitle.toLowerCase().includes(lowercasedFilter))
      );
    }
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      filtered = filtered.filter(entry => {
        const entryDate = entry.brandPurchaseDate ? new Date(entry.brandPurchaseDate) : null;
        return entryDate && entryDate >= startOfDay;
      });
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(entry => {
        const entryDate = entry.brandPurchaseDate ? new Date(entry.brandPurchaseDate) : null;
        return entryDate && entryDate <= endOfDay;
      });
    }
    setFilteredReportData(filtered);
  }, [searchTerm, reportData, startDate, endDate]);

  const totalRevShareSum = useMemo(() => {
    return filteredReportData.reduce((sum, entry) => sum + entry.calculatedRevShareAmount, 0);
  }, [filteredReportData]);
  
  const totalSaleAmountSumForDisplayedBrands = useMemo(() => {
    const uniqueBrandSaleAmounts = new Map<string, number>();
    filteredReportData.forEach(entry => {
      const originalPurchaseRecord = allPurchaseRecords.find(pr => pr.id === entry.purchaseRecordId);
      if (originalPurchaseRecord && !uniqueBrandSaleAmounts.has(originalPurchaseRecord.brandId)) {
        uniqueBrandSaleAmounts.set(originalPurchaseRecord.brandId, originalPurchaseRecord.totalAmountPaid);
      }
    });
    return Array.from(uniqueBrandSaleAmounts.values()).reduce((sum, amount) => sum + amount, 0);
  }, [filteredReportData, allPurchaseRecords]);

  const formatDateForDisplay = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      return "Invalid Date";
    }
  };
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate(null);
    setEndDate(null);
  };


  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/admin/dashboard')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Revenue Share Report</h1>
      </div>
      <div className="mb-6 p-4 border border-amber-500 bg-amber-50 rounded-md">
          <h3 className="text-amber-700 font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Report Calculation Notice</h3>
          <p className="text-sm text-amber-600">
              This report reflects revenue share based on the one-time Program base price at checkout.
              For partners with "Program Subscription Price" as their share basis, the calculation uses the Program's first subscription price tier as a hypothetical base.
              Actual recurring subscription charges and revenue share based on them are not yet implemented or tracked. This part of the report is for estimation purposes only.
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
            placeholder="Brand, Partner, or Program..."
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
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Program Checkout Revenue Share Details</CardTitle>
          <CardDescription>
            List of paid Brand checkouts (Program-based) with revenue share agreements.
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
                    <TableHead>Checkout Date</TableHead>
                    <TableHead>Customer Brand</TableHead>
                    <TableHead>Program Sold</TableHead>
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
                    <TableRow key={`${entry.purchaseRecordId}-${entry.partnerName}-${index}`}>
                      <TableCell>{formatDateForDisplay(entry.brandPurchaseDate)}</TableCell>
                      <TableCell className="font-medium">{entry.brandName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.programSoldTitle}</TableCell>
                      <TableCell>{entry.partnerName}</TableCell>
                      <TableCell>{entry.partnerCompany || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {entry.partnerPercentage?.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={entry.shareBasis === 'coursePrice' ? 'outline' : 'default'} title={entry.basisNote}>
                           {entry.shareBasis === 'coursePrice' ? 'Program Base Price' : 'Program Subscription*'}
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
                  <p className="text-sm text-muted-foreground">Total Brand Sales (Filtered, Program Base)</p>
                  <p className="text-lg font-bold">${totalSaleAmountSumForDisplayedBrands.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rev Share (Filtered)</p>
                  <p className="text-lg font-bold text-primary">${totalRevShareSum.toFixed(2)}</p>
                </div>
              </div>
               <p className="text-xs text-muted-foreground mt-4">* Share basis on "Program Subscription" is a hypothetical calculation based on the program's first subscription tier price. Actual recurring subscription revenue share is not yet implemented.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
