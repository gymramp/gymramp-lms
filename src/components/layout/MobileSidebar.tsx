
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { getNavigationStructure, getUserDropdownItems, getQuickAddItems, NavItemType } from '@/lib/nav-config';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import type { User } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, PlusCircle, MoreVertical } from 'lucide-react';

export function MobileSidebar() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [navItems, setNavItems] = useState<NavItemType[]>([]);
  const [userMenuItems, setUserMenuItems] = useState<NavItemType[]>([]);
  const [quickAddItems, setQuickAddItems] = useState<NavItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const currentBrandName = "Gymramp";

  const fetchNavAndUserData = useCallback(async (firebaseUser: import('firebase/auth').User | null) => {
    setIsLoading(true);
    if (firebaseUser?.email) {
      try {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails) {
          const [mainNav, userNav, quickAddNav] = await Promise.all([
            getNavigationStructure(userDetails),
            getUserDropdownItems(userDetails),
            getQuickAddItems(userDetails)
          ]);
          setNavItems(mainNav);
          setUserMenuItems(userNav);
          setQuickAddItems(quickAddNav);
        }
      } catch (error) {
        console.error("[MobileSidebar] Error fetching user data:", error);
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, fetchNavAndUserData);
    return () => unsubscribe();
  }, [fetchNavAndUserData]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Logic from desktop sidebar to clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
      }
      toast({ title: "Logged Out" });
      router.push('/');
    } catch (error) {
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const renderNavItem = (item: NavItemType, isSubItem = false) => {
    const isActive = item.href && pathname === item.href;
    const LinkIcon = item.icon;
    return (
      <Button
        key={`${item.label}-mobile`}
        asChild
        variant={isActive ? "secondary" : "ghost"}
        className={cn("w-full justify-start h-auto py-2", isSubItem ? "pl-8 pr-2 text-sm" : "px-3 text-base", isActive && "font-semibold")}
      >
        <Link href={item.href || '#'}>
          {LinkIcon && <LinkIcon className={cn("mr-2 h-4 w-4", isSubItem && "h-3.5 w-3.5")} />}
          {item.label}
        </Link>
      </Button>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b h-20 flex items-center shrink-0">
        <Link href={currentUser?.role === 'Staff' ? "/courses/my-courses" : "/dashboard"} className="flex items-center w-full text-center">
          <Image
            src="/images/newlogo.png"
            alt={`${currentBrandName} Logo`}
            width={150}
            height={45}
            className="max-h-[45px] w-auto m-auto"
          />
        </Link>
      </div>
      <ScrollArea className="flex-1 px-2 py-4">
        {isLoading ? (
          <div className="space-y-3">
             {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : (
          <nav className="flex flex-col gap-1">
            {navItems.map((item) =>
              item.isDropdown && item.subItems && item.subItems.length > 0 ? (
                <Accordion type="multiple" key={`${item.label}-mobile-accordion`} className="w-full">
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
              ) : item.href ? renderNavItem(item) : null
            )}
          </nav>
        )}
      </ScrollArea>

      <div className="p-2 border-t shrink-0">
        {/* User Info and Dropdown */}
        {currentUser && (
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start gap-2 h-auto px-2 py-2 text-left flex-1 overflow-hidden">
              <Avatar className="h-9 w-9">
                <AvatarImage src={currentUser.profileImageUrl || undefined} alt={currentUser.name || 'User Avatar'} />
                <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-sm truncate">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" side="top">
                {userMenuItems.map((item) => (
                  <DropdownMenuItem key={item.label} asChild className="cursor-pointer">
                    <Link href={item.href || '#'} className="flex items-center gap-2">
                      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
       <SheetHeader className="sr-only">
          <SheetTitle>Main Menu</SheetTitle>
          <SheetDescription>Navigate through the application sections and manage your account.</SheetDescription>
        </SheetHeader>
       {content}
    </SheetContent>
  );
}
