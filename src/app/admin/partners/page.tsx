
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Search, Loader2, Handshake, ExternalLink, Copy, Users, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Partner } from '@/types/partner';
import type { User } from '@/types/user';
import { getAllPartners, deletePartner } from '@/lib/partner-data';
import { AddEditPartnerDialog } from '@/components/admin/AddEditPartnerDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const fetchPartners = useCallback(async () => {
    setIsLoading(true);
    try {
      const partnersData = await getAllPartners();
      setPartners(partnersData);
      setFilteredPartners(partnersData);
    } catch (error) {
      toast({ title: "Error", description: "Could not load partners.", variant: "destructive" });
      setPartners([]);
      setFilteredPartners([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", variant: "destructive" });
          router.push('/admin/dashboard');
        } else {
          fetchPartners();
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchPartners]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = partners.filter(p =>
      p.name.toLowerCase().includes(lowercasedFilter) ||
      p.email.toLowerCase().includes(lowercasedFilter) ||
      (p.companyName && p.companyName.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredPartners(filtered);
  }, [searchTerm, partners]);

  const handleAddPartnerClick = () => {
    setEditingPartner(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditPartnerClick = (partner: Partner) => {
    setEditingPartner(partner);
    setIsAddEditDialogOpen(true);
  };

  const openDeleteDialog = (partner: Partner) => {
    setPartnerToDelete(partner);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePartner = async () => {
    if (!partnerToDelete) return;
    setIsDeleting(true);
    try {
      await deletePartner(partnerToDelete.id);
      fetchPartners();
      toast({ title: 'Partner Deleted', description: `Partner "${partnerToDelete.name}" has been deleted.` });
    } catch (error) {
      toast({ title: 'Error Deleting Partner', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setPartnerToDelete(null);
    }
  };

  const handleSavePartner = () => {
    fetchPartners();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to Clipboard!", description: "Signup link copied." });
    }, (err) => {
      toast({ title: "Copy Failed", description: "Could not copy the link.", variant: "destructive" });
    });
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2"><Handshake className="h-7 w-7" /> Partner Management</h1>
        <Button onClick={handleAddPartnerClick} className="bg-accent text-accent-foreground hover:bg-accent/90"><PlusCircle className="mr-2 h-4 w-4" /> Add Partner</Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input type="text" placeholder="Search partners..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
      </div>
      <Card>
        <CardHeader><CardTitle>Partner List</CardTitle><CardDescription>Manage revenue-sharing partners and their signup links.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : filteredPartners.length === 0 ? (
            <div className="text-center py-8">{searchTerm ? "No partners found." : "No partners created yet."}</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Coupon</TableHead><TableHead>Rev. Share %</TableHead><TableHead>Signup Link</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => {
                  const signupUrl = `${window.location.origin}/signup/${partner.id}`;
                  return (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border">
                               <AvatarImage src={partner.logoUrl || undefined} alt={`${partner.name} logo`} className="object-contain" />
                               <AvatarFallback className="text-xs">{partner.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className='flex flex-col'>
                                <span>{partner.name}</span>
                                <span className="text-xs text-muted-foreground">{partner.companyName || 'N/A'}</span>
                            </div>
                        </div>
                      </TableCell>
                      <TableCell>{partner.email}</TableCell>
                      <TableCell>
                        {partner.couponCode ? (
                            <Badge variant="outline" className='flex gap-1 items-center'>
                                <Tag className='h-3 w-3'/> {partner.couponCode} ({partner.discountPercentage || 0}%)
                            </Badge>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{partner.percentage}%</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input value={signupUrl} readOnly className="h-8 text-xs" />
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(signupUrl)}><Copy className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild><Link href={`/admin/partners/${partner.id}/customers`}><Users className="mr-2 h-4 w-4" />View Customers</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditPartnerClick(partner)}><Edit className="mr-2 h-4 w-4" />Edit Partner</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openDeleteDialog(partner)}><Trash2 className="mr-2 h-4 w-4" />Delete Partner</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditPartnerDialog isOpen={isAddEditDialogOpen} setIsOpen={setIsAddEditDialogOpen} initialData={editingPartner} onSave={handleSavePartner} />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the partner "{partnerToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePartner} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
