
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

export interface BadgeInfo {
  name: string;
  description: string;
  Icon: LucideIcon;
  color: string; // e.g., 'text-amber-500' or 'text-blue-500'
  dateAwarded: Date | null;
}

interface BadgeCardProps {
  badge: BadgeInfo;
}

export function BadgeCard({ badge }: BadgeCardProps) {
  const { name, description, Icon, color, dateAwarded } = badge;
  const isAwarded = dateAwarded !== null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Card className={cn(
              "text-center transition-all duration-300 ease-in-out h-full flex flex-col justify-between",
              isAwarded ? 'border-2 shadow-lg card-lift-hover' : 'bg-muted opacity-60',
              isAwarded && badge.color.replace('text-', 'border-') // Dynamically set border color
            )}>
              <CardHeader className="p-4 items-center flex-grow">
                <div className={cn(
                  "flex items-center justify-center h-20 w-20 rounded-full mb-2",
                  isAwarded ? badge.color.replace('text-', 'bg-') + '/10' : 'bg-secondary'
                )}>
                  <Icon className={cn("h-10 w-10", isAwarded ? color : 'text-muted-foreground')} />
                </div>
                <CardTitle className="text-base font-semibold leading-tight">{name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  {isAwarded ? `Awarded: ${dateAwarded.toLocaleDateString()}` : 'Not yet earned'}
                </p>
              </CardContent>
            </Card>
            {!isAwarded && (
                <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                    <Lock className="h-8 w-8 text-white/70" />
                </div>
            )}
           </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
