
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Menu, LogOut, User as UserIcon, LayoutDashboard, Settings, Users, BookOpen, FileText,
    ListChecks, Building, ShoppingCart, Award, MapPin, BarChartBig, Gift,
    TestTube2, UserPlus, Percent, HelpCircle, Layers, CreditCard, Cog, Package
} from 'lucide-react'; // Added Cog, Package
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import type { User } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getNavigationStructure, getUserDropdownItems, NavItemType } from '@/lib/nav-config';
import { Skeleton } from '../ui/skeleton';

interface NavbarProps {
  brandLogoUrl?: string | null;
  brandName?: string | null;
}

export function Navbar({ brandLogoUrl, brandName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [navItems, setNavItems] = useState<NavItemType[]>([]);
  const [userMenuItems, setUserMenuItems] = useState<NavItemType[]>([]);
  const [isLoadingNav, setIsLoadingNav] = useState(true);

  const isLoggedIn = !!currentUser;

  const fetchNavAndUserData = useCallback(async (firebaseUser: import('firebase/auth').User | null) => {
    setIsLoadingNav(true);
    if (firebaseUser && firebaseUser.email) {
      try {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails) {
          const mainNav = await getNavigationStructure(userDetails);
          const userNav = await getUserDropdownItems(userDetails);
          setNavItems(mainNav);
          setUserMenuItems(userNav);
        } else {
          setNavItems([]);
          setUserMenuItems([]);
        }
      } catch (error) {
        console.error("Error fetching user data for Navbar:", error);
        setCurrentUser(null);
        setNavItems([]);
        setUserMenuItems([]);
      }
    } else {
      setCurrentUser(null);
      const publicNav = await getNavigationStructure(null); // Get public nav items if any
      setNavItems(publicNav);
      setUserMenuItems([]); // No user items if not logged in
    }
    setIsLoadingNav(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      fetchNavAndUserData(firebaseUser);
    });
    return () => unsubscribe();
  }, [fetchNavAndUserData]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // No need to manually set currentUser to null, onAuthStateChanged will handle it
      if (typeof window !== 'undefined') {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
      }
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/'); // Redirect to login page
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out.", variant: "destructive" });
    }
  };

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const renderMobileNavItem = (item: NavItemType, isSubItem = false) => {
    const isActive = item.href && pathname === item.href;
    const LinkIcon = item.icon;

    return (
      <Button
        key={item.label}
        asChild
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start h-auto py-2 text-base",
          isSubItem ? "pl-10 pr-2" : "px-3",
          isActive && "font-semibold"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Link href={item.href || '#'}>
          {LinkIcon && <LinkIcon className="mr-2 h-5 w-5" />}
          {item.label}
        </Link>
      </Button>
    );
  };
  
  const displayLogoUrl = brandLogoUrl || "/images/newlogo.png";
  const displayLogoAlt = brandName ? `${brandName} Logo` : "GYMRAMP Logo";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={cn("container flex h-14 items-center justify-between", "mx-auto")}>
        <div className="flex items-center">
           {isMounted && isLoggedIn && navItems.length > 0 && (
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                    <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden mr-2"
                    aria-label="Toggle Menu"
                    >
                    <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                 <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 overflow-y-auto">
                    <SheetHeader className="p-4 border-b">
                    <SheetTitle className="text-left">Menu</SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-1 p-4">
                    {navItems.map((item) => (
                        item.isDropdown && item.subItems ? (
                            <Accordion type="single" collapsible className="w-full" key={item.label}>
                                <AccordionItem value={item.label} className="border-b-0">
                                    <AccordionTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-base font-medium hover:bg-muted hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                        <div className="flex items-center gap-2">
                                            {item.icon && <item.icon className="h-5 w-5" />}
                                            {item.label}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-1 pb-0">
                                         <div className="flex flex-col gap-0.5 pl-1">
                                            {item.subItems.map((subItem) => renderMobileNavItem(subItem, true))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                          ) : item.href ? (
                            renderMobileNavItem(item)
                          ) : null
                    ))}
                    {currentUser && userMenuItems.length > 0 && (
                        <>
                            <hr className="my-3"/>
                            <div className="px-3 py-1.5 text-sm font-semibold text-muted-foreground">User Account</div>
                            {userMenuItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href || '#'} // Ensure href has a fallback
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 text-base text-foreground/80 hover:text-foreground hover:bg-muted rounded-md w-full"
                                >
                                   {item.icon && <item.icon className="h-5 w-5" />}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                            <hr className="my-3"/>
                            <Button
                                variant="ghost"
                                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                className="w-full flex justify-start items-center gap-3 px-3 py-2 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <LogOut className="h-5 w-5" />
                                <span>Logout</span>
                            </Button>
                        </>
                    )}
                    </nav>
                 </SheetContent>
                </Sheet>
           )}
            <Link href={isLoggedIn && currentUser ? (currentUser.role === 'Staff' ? "/courses/my-courses" : (currentUser.role === 'Super Admin' ? "/admin/dashboard" : "/dashboard")) : "/"} className="flex items-center">
                <Image
                    src={displayLogoUrl}
                    alt={displayLogoAlt}
                    width={150}
                    height={45}
                    priority
                    className="max-h-[30px] object-contain" // Ensure logo fits nicely
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/newlogo.png'; }}
                />
            </Link>
        </div>

        <nav className="hidden md:flex items-center justify-center space-x-1 text-sm font-medium flex-grow">
          {/* Main desktop nav items are now in Sidebar.tsx */}
        </nav>

        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
                {isLoadingNav ? (
                     <>
                         <Skeleton className="h-8 w-8 rounded-full" />
                         <Skeleton className="h-8 w-24 rounded-md" />
                     </>
                 ) : isMounted && isLoggedIn && currentUser && userMenuItems.length > 0 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={currentUser.profileImageUrl || undefined} alt={currentUser.name || 'User Avatar'} />
                                    <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {currentUser.email}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground pt-1">
                                       Role: <span className="font-medium text-foreground">{currentUser.role}</span>
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
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
                ) : isMounted && !isLoggedIn ? (
                     <>
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/">Login</Link>
                        </Button>
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                          <Link href="/contact">Schedule A Call</Link>
                        </Button>
                     </>
                 ) : null /* Handles the case where isMounted is true but still loading nav, or no user */
                }
            </div>
        </div>
      </div>
    </header>
  );
}
