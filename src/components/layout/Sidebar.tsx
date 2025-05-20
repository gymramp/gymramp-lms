
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getNavigationStructure, NavItemType } from '@/lib/nav-config';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import type { User } from '@/types/user';
import { Skeleton } from '@/components/ui/skeleton';

export function Sidebar() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
        } catch (error) {
          console.error("Error fetching user data for sidebar:", error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <aside className="hidden md:flex flex-col w-64 border-r bg-background p-4 h-full">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-8 w-full" />
              {i % 2 === 0 && (
                <div className="pl-4 space-y-1">
                  <Skeleton className="h-6 w-5/6" />
                  <Skeleton className="h-6 w-4/6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (!currentUser) {
    return null;
  }

  const navItems = getNavigationStructure(currentUser);

  const renderNavItem = (item: NavItemType, isSubItem = false) => {
    const isActive = item.href && pathname === item.href;
    const LinkIcon = item.icon;

    return (
      <Button
        key={item.label}
        asChild
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start h-auto py-2",
          isSubItem ? "pl-8 pr-2 text-sm" : "px-3 text-base",
          isActive && "font-semibold"
        )}
      >
        <Link href={item.href || '#'}>
          {LinkIcon && <LinkIcon className={cn("mr-2 h-4 w-4", isSubItem && "h-3.5 w-3.5")} />}
          {item.label}
        </Link>
      </Button>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-background h-full"> {/* Removed fixed, top, z-index; set h-full */}
      <ScrollArea className="flex-1 p-4"> {/* flex-1 helps ScrollArea fill the parent height */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) =>
            item.isDropdown && item.subItems ? (
              <Accordion type="multiple" key={item.label} className="w-full">
                <AccordionItem value={item.label} className="border-b-0">
                  <AccordionTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-base font-medium hover:bg-muted hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center gap-2">
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-0">
                    <div className="flex flex-col gap-0.5 pl-1">
                      {item.subItems.map((subItem) => renderNavItem(subItem, true))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              item.href && renderNavItem(item)
            )
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
