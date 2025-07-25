
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CourseCertificateProps {
    courseName: string;
    userName: string;
    completionDate: Date;
    brandName?: string | null;
    brandLogoUrl?: string | null;
}

const CertificateSeal = () => (
    <div className="relative h-28 w-28">
        <svg viewBox="0 0 200 200" className="absolute h-full w-full">
            <circle cx="100" cy="100" r="96" fill="hsl(var(--primary))" fillOpacity="0.05" />
            <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--accent))" strokeOpacity="0.5" strokeWidth="2" />
             <g transform="translate(100,100)">
                {[...Array(12)].map((_, i) => (
                    <line
                        key={i}
                        x1="0"
                        y1="-90"
                        x2="0"
                        y2="-96"
                        stroke="hsl(var(--accent))"
                        strokeWidth="2"
                        strokeOpacity="0.5"
                        transform={`rotate(${i * 30})`}
                    />
                ))}
            </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <Award className="h-8 w-8 text-accent" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                Official
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                Completion
            </p>
        </div>
    </div>
);


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
                    
                    {/* Background Pattern */}
                    <div className="absolute inset-0 -z-10 overflow-hidden">
                        <svg className="absolute inset-0 h-full w-full stroke-gray-200 dark:stroke-gray-800 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]" aria-hidden="true">
                            <defs>
                                <pattern id="83fd4e5a-9d52-4224-a64E-102584570b67" width="200" height="200" x="50%" y="-1" patternUnits="userSpaceOnUse">
                                    <path d="M100 200V.5M.5 .5H200" fill="none" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" strokeWidth="0" fill="url(#83fd4e5a-9d52-4224-a64E-102584570b67)" />
                        </svg>
                    </div>


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
                        <h1 className="text-5xl font-bold text-primary tracking-tighter" style={{fontFamily: "'Garamond', serif"}}>{userName}</h1>
                        <p className="text-base text-foreground">for successfully completing the course</p>
                        <h2 className="text-3xl font-semibold text-accent" style={{fontFamily: "'Garamond', serif"}}>{courseName}</h2>
                        <p className="text-base text-muted-foreground pt-4">Awarded on this day, {formattedDate}</p>

                        <div className="pt-12 flex justify-around items-center">
                            <div className="text-center">
                                <p className="font-sans text-lg font-semibold border-b border-muted-foreground pb-1 px-8">{brandName || 'Gymramp'}</p>
                                <p className="text-sm text-muted-foreground pt-1">Issuing Organization</p>
                            </div>
                            <CertificateSeal />
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
