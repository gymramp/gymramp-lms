
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface CourseCertificateProps {
    courseName: string;
    userName: string;
    completionDate: Date;
    brandName?: string | null;
    brandLogoUrl?: string | null;
}

export function CourseCertificate({ courseName, userName, completionDate, brandName, brandLogoUrl }: CourseCertificateProps) {
    const formattedDate = completionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="certificate-container p-4 bg-secondary/30 print:bg-white print:p-0">
            <div className="w-full max-w-4xl mx-auto bg-background shadow-2xl print:shadow-none font-serif">
                <div className="relative border-4 border-primary p-8">
                     {/* Decorative Borders */}
                    <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-accent"></div>
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-accent"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-accent"></div>
                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-accent"></div>

                    <div className="text-center space-y-4">
                        {brandLogoUrl ? (
                            <Image src={brandLogoUrl} alt={`${brandName} Logo`} width={120} height={50} className="mx-auto h-auto max-h-[50px] object-contain mb-2"/>
                        ) : (
                             <Image src="/images/newlogo.png" alt="Gymramp Logo" width={150} height={45} className="mx-auto opacity-80" />
                        )}

                        <p className="text-lg uppercase tracking-widest text-muted-foreground">Certificate of Completion</p>
                        
                        <div className="py-2">
                             <Award className="h-24 w-24 text-accent mx-auto" strokeWidth={1} />
                        </div>
                        
                        <p className="text-base text-foreground">This certificate is proudly presented to</p>
                        <h1 className="text-5xl font-bold text-primary tracking-tighter">{userName}</h1>
                        <p className="text-base text-foreground">for successfully completing the course</p>
                        <h2 className="text-3xl font-semibold text-accent">{courseName}</h2>
                        <p className="text-base text-muted-foreground pt-4">Awarded on this day, {formattedDate}</p>

                        <div className="pt-12 flex justify-around items-end">
                            <div className="text-center">
                                <p className="font-sans text-lg font-semibold border-b border-muted-foreground pb-1 px-8">{brandName || 'Gymramp'}</p>
                                <p className="text-sm text-muted-foreground pt-1">Issuing Organization</p>
                            </div>
                            <div className="text-center">
                                <p className="font-sans text-lg font-semibold border-b border-muted-foreground pb-1 px-8">Management</p>
                                <p className="text-sm text-muted-foreground pt-1">Authorized Signature</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-center mt-6 print-hide">
                <Button onClick={handlePrint}>Print Certificate</Button>
            </div>
        </div>
    );
}

