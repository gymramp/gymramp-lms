
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { runUserBrandMigration } from '@/actions/data-migration';
import { Loader2, DatabaseZap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function MigrateDataPage() {
  const [isPending, startTransition] = useTransition();
  const [migrationResult, setMigrationResult] = useState<{ message: string; count: number } | null>(null);
  const { toast } = useToast();

  const handleMigration = () => {
    startTransition(async () => {
      setMigrationResult(null);
      try {
        const result = await runUserBrandMigration();
        if (result.success) {
          setMigrationResult({ message: `Successfully assigned the default brand to ${result.count} users.`, count: result.count });
          toast({ title: 'Migration Complete', description: `Assigned brand to ${result.count} users.` });
        } else {
          throw new Error(result.error || 'An unknown error occurred.');
        }
      } catch (error: any) {
        toast({ title: 'Migration Failed', description: error.message, variant: 'destructive' });
        setMigrationResult({ message: `Error: ${error.message}`, count: 0 });
      }
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><DatabaseZap className="h-6 w-6"/> Data Migration Utility</CardTitle>
          <CardDescription>
            Use these one-time actions to fix inconsistencies in your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold">Assign Default Brand to Unassigned Users</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              This will find all users who do not have a brand (company) assigned and associate them with the default "Gymramp" brand. This is useful for fixing users who signed up before a brand was correctly assigned.
            </p>
            <Button onClick={handleMigration} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Running...' : 'Run User Brand Migration'}
            </Button>
          </div>

          {migrationResult && (
            <Alert variant={migrationResult.count > 0 ? 'default' : 'destructive'}>
              <AlertTitle>{migrationResult.count > 0 ? 'Migration Result' : 'Migration Note'}</AlertTitle>
              <AlertDescription>
                {migrationResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
