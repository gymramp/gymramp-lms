
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
    brandName?: string | null; // Optional brand name for certificate
    brandLogoUrl?: string | null; // Optional brand logo
    // templateId?: string | null; // For future use if templates have distinct visual styles
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

    // Basic template styling - can be expanded based on templateId
    const certificateStyle = "w-full max-w-2xl border-2 border-primary/50 bg-gradient-to-br from-background to-secondary/10 shadow-xl overflow-hidden my-8 mx-auto";
    const headerStyle = "text-center p-6 border-b-2 border-primary/30";
    const contentStyle = "p-8 text-center space-y-4";
    const issuingEntityStyle = "pt-6 text-sm text-muted-foreground";

    return (
        <div className="certificate-container p-4"> {/* Outer div for print control and some padding */}
            <Card className={certificateStyle}>
                <CardHeader className={headerStyle}>
                     <Award className="h-20 w-20 mx-auto text-accent mb-4" />
                    <CardTitle className="text-3xl font-bold text-primary">
                        Certificate of Completion
                    </CardTitle>
                     <CardDescription className="text-md text-muted-foreground pt-2">
                        This certificate is awarded to
                    </CardDescription>
                </CardHeader>
                <CardContent className={contentStyle}>
                    <h2 className="text-4xl font-semibold text-primary tracking-wide">{userName}</h2>
                    <p className="text-lg text-foreground">
                        for successfully completing the course:
                    </p>
                    <h3 className="text-2xl font-medium text-accent">{courseName}</h3>
                    <p className="text-md text-muted-foreground">
                        Completed on: <span className="font-semibold text-foreground">{formattedDate}</span>
                    </p>
                    <div className={issuingEntityStyle}>
                        <p>Issued by:</p>
                        {brandLogoUrl && brandName ? (
                            <div className="flex flex-col items-center mt-2">
                                <Image src={brandLogoUrl} alt={`${brandName} Logo`} width={100} height={30} className="max-h-[30px] object-contain mb-1" />
                                <p className="font-semibold text-foreground">{brandName}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center mt-2">
                                <Image src="/images/newlogo.png" alt="GYMRAMP Logo" width={120} height={36} className="opacity-70" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <div className="text-center mt-6 print-hide">
                <Button onClick={handlePrint}>Print Certificate</Button>
            </div>
        </div>
    );
}
