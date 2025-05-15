
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smile } from 'lucide-react'; // Import Smile icon
import Image from 'next/image';

interface CourseCertificateProps {
    courseName: string;
    userName: string;
    completionDate: Date;
}

export function CourseCertificate({ courseName, userName, completionDate }: CourseCertificateProps) {
    const formattedDate = completionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
     const formattedTime = completionDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        // second: '2-digit', // Optional: include seconds
        // timeZoneName: 'short' // Optional: include timezone
    });

    return (
        <Card className="w-full max-w-lg border-2 border-primary/50 bg-gradient-to-br from-background to-secondary/30 shadow-xl overflow-hidden my-12">
            <CardHeader className="text-center p-6 border-b-2 border-primary/20">
                 <Smile className="h-20 w-20 mx-auto text-accent mb-4 animate-pulse" /> {/* Added animation */}
                <CardTitle className="text-2xl font-bold text-primary">
                    Course Completed!
                </CardTitle>
                 <CardDescription className="text-md text-muted-foreground">
                    Congratulations, {userName}!
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 text-center space-y-4">
                <p className="text-lg text-foreground">
                    You have successfully completed the course:
                </p>
                <h3 className="text-xl font-semibold text-primary">{courseName}</h3>
                <p className="text-sm text-muted-foreground">
                    Completed on: <span className="font-medium">{formattedDate} at {formattedTime}</span>
                </p>
                 <div className="flex justify-center pt-4">
                     <Image
                         src="/images/newlogo.png" // Path to your logo in public/images
                         alt="GYMRAMP Logo"
                         width={120} // Slightly smaller logo
                         height={36}
                         className="opacity-70"
                     />
                 </div>
            </CardContent>
        </Card>
    );
}
