
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { getUnassignedUsers, getTargetCompanies, runUserBrandMigration } from '@/actions/data-migration';
import { Loader2, DatabaseZap, Users, Building, ShieldCheck, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User, Company } from '@/types/user';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function MigrateDataPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [unassignedUsers, setUnassignedUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [usersData, companiesData] = await Promise.all([
          getUnassignedUsers(),
          getTargetCompanies()
        ]);
        setUnassignedUsers(usersData);
        setCompanies(companiesData);
        if (companiesData.length > 0) {
          // Find Gymramp default if it exists, otherwise use the first company
          const defaultGymramp = companiesData.find(c => c.name.toLowerCase() === 'gymramp');
          setTargetCompanyId(defaultGymramp ? defaultGymramp.id : companiesData[0].id);
        }
      } catch (error) {
        toast({ title: 'Error Loading Data', description: 'Could not fetch users or companies.', variant: 'destructive' });
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [toast]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(unassignedUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUserIds(prev =>
      checked ? [...prev, userId] : prev.filter(id => id !== userId)
    );
  };

  const handleMigration = () => {
    if (selectedUserIds.length === 0) {
      toast({ title: "No users selected", description: "Please select at least one user to migrate.", variant: "destructive" });
      return;
    }
    if (!targetCompanyId) {
      toast({ title: "No target company selected", description: "Please choose a company to assign the users to.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await runUserBrandMigration(selectedUserIds, targetCompanyId);
      if (result.success) {
        toast({ title: 'Migration Complete', description: `Successfully assigned ${result.count} users.` });
        // Refresh data
        const usersData = await getUnassignedUsers();
        setUnassignedUsers(usersData);
        setSelectedUserIds([]);
      } else {
        toast({ title: 'Migration Failed', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><DatabaseZap className="h-6 w-6"/> Interactive Data Migration</CardTitle>
          <CardDescription>
            Assign users who are missing a brand to the correct account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-secondary">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Users className="h-5 w-5"/> Users Without a Brand</h3>
            {isLoadingData ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : unassignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unassigned users found. All users have a brand assigned.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedUserIds.length > 0 && selectedUserIds.length === unassignedUsers.length}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all"
                                />
                            </TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {unassignedUsers.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedUserIds.includes(user.id)}
                                        onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                                        aria-label={`Select ${user.name}`}
                                    />
                                </TableCell>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell><Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1"/>{user.role}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-background">
              <h3 className="font-semibold mb-2 flex items-center gap-2"><Building className="h-5 w-5"/> Migration Target</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="target-company">Assign Selected Users to Company:</Label>
                     {isLoadingData ? (
                        <Skeleton className="h-10 w-full"/>
                     ) : (
                        <Select value={targetCompanyId} onValueChange={setTargetCompanyId} disabled={companies.length === 0}>
                            <SelectTrigger id="target-company">
                                <SelectValue placeholder="Select a target company..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map(company => (
                                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <Button onClick={handleMigration} disabled={isPending || selectedUserIds.length === 0 || !targetCompanyId || isLoadingData}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isPending ? 'Migrating...' : `Assign ${selectedUserIds.length} User(s)`}
                </Button>
              </div>
               {companies.length === 0 && !isLoadingData && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Companies Available</AlertTitle>
                    <AlertDescription>
                        There are no companies in the system to assign users to. Please create a company first.
                    </AlertDescription>
                </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
