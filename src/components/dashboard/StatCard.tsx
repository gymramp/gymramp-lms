'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  change?: string;
  changeVariant?: "default" | "destructive"; // "default" for green, "destructive" for red
  icon: LucideIcon;
  chartData: any[]; // e.g., [{ name: 'A', value: 400 }]
  chartColor: string; // e.g., "hsl(var(--chart-1))"
}

export function StatCard({
  title,
  value,
  description,
  change,
  changeVariant = "default",
  icon: Icon,
  chartData,
  chartColor,
}: StatCardProps) {
  const chartId = React.useId().replace(/:/g, "");

  const getBadgeClass = () => {
    if (changeVariant === 'destructive') {
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    }
    // Default is positive/green
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
  };
  
  return (
    <Card className="card-lift-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between space-x-2">
          <div className="text-2xl font-bold">{value}</div>
          {change && <Badge className={cn("text-xs font-semibold", getBadgeClass())}>{change}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="h-20 mt-4 -ml-6 -mr-2 -mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 5,
                right: 5,
                left: 5,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px',
                  boxShadow: 'hsl(var(--shadow))',
                }}
                labelStyle={{ display: 'none' }}
                cursor={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${chartId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
