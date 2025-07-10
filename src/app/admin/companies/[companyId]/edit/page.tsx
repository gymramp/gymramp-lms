
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function EditCompanyPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <h1 className="text-3xl font-bold">Account Details Page</h1>
      <p className="text-muted-foreground mt-2">This is a placeholder for the Account Details page. Content will be added here.</p>
    </div>
  );
}
