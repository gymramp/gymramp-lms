'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { runDataMigration } from '@/actions/data-migration';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { User } from '@/types/user';

export default function MigrateDataPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<Awaited<ReturnType<typeof runDataMigration>> | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails?.role === 'Super Admin') {
            setCurrentUser(userDetails);
          } else {
            toast({ title: "Access Denied", description: "Only Super Admins can access this page.", variant: "destructive" });
            router.push('/');
          }
        } catch (error) {
          console.error("Auth check error:", error);
          toast({ title: "Error", description: "Could not verify user role.", variant: "destructive" });
          router.push('/');
        }
      } else {
        toast({ title: "Authentication Required", description: "Please log in as a Super Admin.", variant: "destructive" });
        router.push('/');
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router, toast]);

  const handleRunMigration = async () => {
    setIsLoading(true);
    setMigrationResult(null);
    try {
      const result = await runDataMigration();
      setMigrationResult(result);
      if (result.success) {
        toast({
          title: 'Migration Successful',
          description: result.message,
          variant: 'default', // Use success variant if available
        });
      } else {
        toast({
          title: 'Migration Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setMigrationResult({ success: false, message: `An unexpected error occurred: ${error.message}` });
      toast({
        title: 'Migration Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth || !currentUser) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Firestore Data Migration</CardTitle>
          <CardDescription>
            This script will add <code>isDeleted: false</code> to existing documents in the specified collections
            (users, companies, locations, courses, lessons, quizzes) if the field is missing or not a boolean.
            This is a one-time operation to ensure compatibility with soft-delete functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-700">Important Notice</h3>
                <p className="text-xs text-yellow-600">
                  Ensure you have backed up your Firestore data before running this migration.
                  This operation will modify existing documents. It is designed to be run only once.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRunMigration}
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Migrating Data...' : 'Run Migration Script'}
          </Button>

          {migrationResult && (
            <div className={`mt-6 p-4 rounded-md ${migrationResult.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <h4 className={`text-sm font-semibold ${migrationResult.success ? 'text-green-700' : 'text-red-700'}`}>
                Migration Status: {migrationResult.success ? 'Success' : 'Failed'}
              </h4>
              <p className={`text-xs ${migrationResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {migrationResult.message}
              </p>
              {migrationResult.details && (
                <div className="mt-2 space-y-1 text-xs">
                  {Object.entries(migrationResult.details).map(([collectionName, stats]) => (
                    <p key={collectionName} className="text-muted-foreground">
                      <strong>{collectionName}:</strong> Total: {stats.total}, Updated: {stats.updated}, Errors: {stats.errors}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}