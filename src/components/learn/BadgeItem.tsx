'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, CheckCircle } from 'lucide-react'; // Import icons
import Image from 'next/image';
import { cn } from '@/lib/utils'; // Import cn

interface BadgeItemProps {
    courseName: string;
    userName: string;
    completionDate: Date;
    imageUrl?: string | null; // Keep imageUrl for potential future use or background
}

export function BadgeItem({ courseName, userName, completionDate, imageUrl }: BadgeItemProps) {
    const formattedDate = completionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <Card
            className={cn(
                "w-full border border-primary/10 bg-card shadow-md overflow-hidden rounded-lg", // Simpler styling
                "transition-transform hover:shadow-lg"
            )}
        >
            {/* Optional Header for image or background */}
            {imageUrl && (
                 <CardHeader className="p-0 relative aspect-video">
                      <Image
                         src={imageUrl}
                         alt={`${courseName} background`}
                         fill
                         style={{ objectFit: 'cover' }}
                         className="bg-muted"
                         onError={(e) => {
                             const target = e.target as HTMLImageElement;
                             target.src = `https://picsum.photos/seed/${encodeURIComponent(courseName)}/600/350`;
                         }}
                      />
                      {/* Optional: Overlay */}
                      {/* <div className="absolute inset-0 bg-black/20"></div> */}
                 </CardHeader>
            )}
            <CardContent className="p-4 text-center space-y-2">
                {/* Seal/Marker */}
                 <div className="flex justify-center mb-3">
                    <div className="bg-accent p-2 rounded-full border border-primary/30 shadow">
                        <Award className="h-8 w-8 text-accent-foreground" />
                    </div>
                 </div>

                {/* Course Name */}
                <h3 className="text-lg font-semibold text-primary">{courseName}</h3>

                {/* Completion Details */}
                <div className="text-sm text-muted-foreground">
                    <p>
                        Completed by: <span className="font-medium text-foreground">{userName}</span>
                    </p>
                    <p className="text-xs mt-1">
                        On: {formattedDate}
                    </p>
                 </div>

                 {/* Optional: Link or action */}
                 {/* <Button variant="outline" size="sm" className="mt-4">View Details</Button> */}
            </CardContent>
        </Card>
    );
}
