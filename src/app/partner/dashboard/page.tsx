
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User, Company } from '@/types/user';
import type { Partner } from '@/types/partner';
import { getUserByEmail, getUserCountByCompanyId } from '@/lib/user-data';
import { getPartnerByEmail } from '@/lib/partner-data';
import { getAllCompanies } from '@/lib/company-data';
import { Skeleton } from '@/components/ui/skeleton';
import { Handshake, Users, Building, Copy, ExternalLink, Search, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ReferredCompany = Company & {
    userCount: number;
};

export default function PartnerDashboardPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [partnerDetails, setPartnerDetails] = useState<Partner | null>(null);
    const [referredCompanies, setReferredCompanies] = useState<ReferredCompany[]>([]);
    const [filteredCompanies, setFilteredCompanies] = useState<ReferredCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const fetchPartnerData = useCallback(async (user: User) => {
        setIsLoading(true);
        if (!user.email) return;

        try {
            const partner = await getPartnerByEmail(user.email);
            if (!partner) {
                toast({ title: "Partner Account Not Found", description: "Your user account is not linked to a partner profile.", variant: "destructive" });
                router.push('/');
                return;
            }
            setPartnerDetails(partner);

            const allCompanies = await getAllCompanies(user);
            const partnerCompanies = allCompanies.filter(c => c.partnerId === partner.id);
            
            const companiesWithCounts = await Promise.all(
              partnerCompanies.map(async (company) => ({
                ...company,
                userCount: await getUserCountByCompanyId(company.id),
              }))
            );
            
            setReferredCompanies(companiesWithCounts);
            setFilteredCompanies(companiesWithCounts);

        } catch (error) {
            console.error("Error fetching partner data:", error);
            toast({ title: "Error Loading Dashboard", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, router]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user?.email) {
                const userDetails = await getUserByEmail(user.email);
                if (userDetails?.role === 'Partner') {
                    setCurrentUser(userDetails);
                    fetchPartnerData(userDetails);
                } else {
                    toast({ title: "Access Denied", variant: "destructive" });
                    router.push(userDetails?.role === 'Staff' ? '/courses/my-courses' : '/');
                }
            } else {
                router.push('/');
            }
        });
        return () => unsubscribe();
    }, [fetchPartnerData, router, toast]);

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const filtered = referredCompanies.filter(company =>
          company.name.toLowerCase().includes(lowercasedFilter)
        );
        setFilteredCompanies(filtered);
    }, [searchTerm, referredCompanies]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Copied to Clipboard!", description: "Your unique signup link has been copied." });
        }, (err) => {
            toast({ title: "Copy Failed", variant: "destructive" });
        });
    };

    const signupUrl = useMemo(() => {
        if (typeof window !== 'undefined' && partnerDetails) {
            return `${window.location.origin}/signup/${partnerDetails.id}`;
        }
        return '';
    }, [partnerDetails]);

    if (isLoading || !partnerDetails || !currentUser) {
        return (
            <div className="container mx-auto">
                 <div className="mb-8"><Skeleton className="h-10 w-1/3" /> <Skeleton className="h-4 w-1/2 mt-2" /></div>
                 <div className="grid md:grid-cols-2 gap-6 mb-8"><Skeleton className="h-40" /> <Skeleton className="h-40" /></div>
                 <Skeleton className="h-64" />
            </div>
        );
    }
    
    const totalCustomers = referredCompanies.length;
    const totalUsers = referredCompanies.reduce((sum, company) => sum + (company.userCount || 0), 0);
    const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'P';


    return (
        <div className="container mx-auto">
            <div className="mb-8">
                 <div className="flex items-center gap-4 mb-2">
                    <Avatar className="h-14 w-14 border-2">
                        <AvatarImage src={partnerDetails.logoUrl || undefined} alt={`${partnerDetails.name} logo`} className="object-contain" />
                        <AvatarFallback className="text-xl bg-muted">{getInitials(partnerDetails.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">Partner Dashboard</h1>
                        <p className="text-muted-foreground">Welcome, {currentUser.name}! Here is an overview of your referrals.</p>
                    </div>
                </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Referred Customers</CardTitle><Building className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totalCustomers}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Users Under Your Referrals</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totalUsers}</div></CardContent>
                </Card>
            </div>
            
            <Card className="mb-8">
                <CardHeader><CardTitle>Your Signup Link</CardTitle><CardDescription>Share this link with potential customers. They will be associated with you upon signup.</CardDescription></CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Input value={signupUrl} readOnly />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(signupUrl)}><Copy className="h-4 w-4"/></Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Referred Customers</CardTitle>
                    <div className="flex justify-between items-center">
                        <CardDescription>A list of all customers who signed up using your link.</CardDescription>
                         <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground"/>
                            <Input placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead className="text-center">Users</TableHead><TableHead className="text-center">Trial Status</TableHead><TableHead>Date Joined</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredCompanies.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No referred customers yet.</TableCell></TableRow>
                            ) : (
                                filteredCompanies.map(company => (
                                    <TableRow key={company.id}>
                                        <TableCell className="font-medium">{company.name}</TableCell>
                                        <TableCell className="text-center"><Badge variant="secondary">{company.userCount}</Badge></TableCell>
                                        <TableCell className="text-center">
                                            {company.isTrial ? 
                                                <Badge variant="outline" className="text-amber-600 border-amber-500">Trial</Badge> : 
                                                <Badge>Paid</Badge>
                                            }
                                        </TableCell>
                                        <TableCell>{company.createdAt ? formatDistanceToNow(new Date(company.createdAt as string), { addSuffix: true }) : 'N/A'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
