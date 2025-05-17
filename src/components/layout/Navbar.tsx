
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Menu, LogOut, User as UserIcon, LayoutDashboard, Settings, Users, BookOpen, FileText,
    ListChecks, Building, ShoppingCart, Award, MapPin, BarChartBig, Gift,
    TestTube2, ChevronDown, UserPlus, Percent, HelpCircle, Layers // Added Layers icon
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import type { User } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

// Define a more flexible type for navigation items
type NavItemType = {
  label: string;
  href?: string;
  isDropdown?: boolean;
  subItems?: Array<{ href: string; label: string; icon?: React.ElementType }>;
  icon?: React.ElementType; // For top-level dropdown icon
};

export function Navbar() {
  const router = useRouter();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isLoggedIn = !!currentUser;

  const fetchUserData = useCallback(async (firebaseUser: import('firebase/auth').User | null) => {
    if (firebaseUser && firebaseUser.email) {
      try {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      fetchUserData(firebaseUser);
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
      }
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out.", variant: "destructive" });
    }
  };

  const getNavItems = (user: User | null): NavItemType[] => {
    const baseItems: NavItemType[] = [];

    if (!user) return baseItems;

    const roleSpecificItems: NavItemType[] = [];
    if (user.role === 'Super Admin') {
      roleSpecificItems.push(
        { href: '/admin/dashboard', label: 'Dashboard', icon: BarChartBig },
        { href: '/admin/companies', label: 'Companies', icon: Building },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/programs', label: 'Programs', icon: Layers }, // Added Programs link
        {
          label: 'Course Admin',
          isDropdown: true,
          icon: BookOpen,
          subItems: [
            { href: '/admin/courses', label: 'Courses', icon: BookOpen },
            { href: '/admin/lessons', label: 'Lessons', icon: FileText },
            { href: '/admin/quizzes', label: 'Quizzes', icon: ListChecks },
          ],
        },
        {
          label: 'New Customers',
          isDropdown: true,
          icon: UserPlus,
          subItems: [
            { href: '/admin/checkout', label: 'Paid Checkout', icon: ShoppingCart },
            { href: '/admin/free-trial-checkout', label: 'Free Trial', icon: Gift },
            { href: '/admin/test-checkout', label: 'Test Checkout', icon: TestTube2},
          ],
        },
        { href: '/admin/revenue-share-report', label: 'Rev Share Report', icon: Percent }
      );
    } else if (user.role === 'Admin' || user.role === 'Owner') {
        roleSpecificItems.push(
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
             { href: '/admin/users', label: 'Users', icon: Users },
             ...(user.companyId ? [{ href: `/admin/companies/${user.companyId}/locations`, label: 'Locations', icon: MapPin }] : []),
            { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen},
        );
    } else if (user.role === 'Manager') {
        roleSpecificItems.push(
             { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
             { href: '/admin/users', label: 'Users', icon: Users },
             { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen},
         );
    } else if (user.role === 'Staff') {
        roleSpecificItems.push(
            { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
         );
    }

    return [...baseItems, ...roleSpecificItems];
  };

  const navItems = getNavItems(currentUser);

  const userMenuItems = isLoggedIn && currentUser ? [
    { href: '/account', label: 'My Account', icon: Settings },
    ...(currentUser.role === 'Admin' || currentUser.role === 'Owner' || currentUser.role === 'Manager'
      ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
    ...(currentUser.role === 'Super Admin'
      ? [
          { href: '/admin/dashboard', label: 'Super Admin Dashboard', icon: BarChartBig },
          { href: '/admin/companies', label: 'Companies', icon: Building },
          { href: '/admin/users', label: 'Users', icon: Users },
          { href: '/admin/programs', label: 'Programs', icon: Layers }, // Added Programs to dropdown too
          { href: '/admin/settings', label: 'Settings', icon: Settings },
        ]
      : []),
      ...(currentUser.role === 'Admin' || currentUser.role === 'Owner'
        ? [
             { href: '/admin/users', label: 'Manage Users', icon: Users },
             ...(currentUser.companyId ? [{ href: `/admin/companies/${currentUser.companyId}/locations`, label: 'Manage Locations', icon: MapPin }] : []),
          ]
        : []),
      ...(currentUser.role === 'Manager'
        ? [
            { href: '/admin/users', label: 'Manage Users', icon: Users },
          ] : []),
    { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
    { href: '/badges', label: 'My Badges', icon: Award },
    { href: '/site-help', label: 'Site Help', icon: HelpCircle },
  ] : [];

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

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
                            <React.Fragment key={item.label}>
                              <div className="px-2 py-1.5 mt-2 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                {item.icon && <item.icon className="h-4 w-4" />}
                                {item.label}
                              </div>
                              {item.subItems.map((subItem) => (
                                <Link
                                  key={subItem.label}
                                  href={subItem.href}
                                  className="flex items-center gap-3 pl-4 pr-2 py-2 text-base transition-colors hover:text-foreground/80 text-foreground/60 hover:bg-muted rounded-md"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {subItem.icon && <subItem.icon className="h-5 w-5" />}
                                  {subItem.label}
                                </Link>
                              ))}
                            </React.Fragment>
                          ) : item.href ? (
                            <Link
                              key={item.label}
                              href={item.href}
                              className="flex items-center gap-3 px-2 py-2 text-base transition-colors hover:text-foreground/80 text-foreground/60 hover:bg-muted rounded-md"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {item.icon && <item.icon className="h-5 w-5" />}
                              {item.label}
                            </Link>
                          ) : null
                    ))}
                    {currentUser && (
                        <>
                            <hr className="my-3"/>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">User Account</div>
                            {userMenuItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-3 pl-4 pr-2 py-2 text-base text-foreground/60 hover:text-foreground/80 hover:bg-muted rounded-md w-full"
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                            <hr className="my-3"/>
                            <Button
                                variant="ghost"
                                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                className="w-full flex justify-start items-center gap-3 pl-4 pr-2 py-2 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                    src="/images/newlogo.png"
                    alt="GYMRAMP Logo"
                    width={150}
                    height={45}
                    priority
                />
            </Link>
        </div>

        <nav className="hidden md:flex items-center justify-center space-x-1 text-sm font-medium flex-grow">
          {isMounted && isLoggedIn && navItems.map((item) => (
            item.isDropdown && item.subItems ? (
                <DropdownMenu key={item.label}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="px-3 py-1 text-foreground/60 hover:text-foreground/80 hover:bg-muted h-auto flex items-center gap-1">
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label} <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.subItems.map((subItem) => (
                      <DropdownMenuItem key={subItem.label} asChild className="cursor-pointer">
                        <Link href={subItem.href} className="flex items-center gap-2">
                          {subItem.icon && <subItem.icon className="h-4 w-4 text-muted-foreground" />}
                          <span>{subItem.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md transition-colors flex items-center gap-2",
                    "text-foreground/60 hover:text-foreground/80 hover:bg-muted",
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              ) : null
          ))}
        </nav>

        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
                {isMounted ? (
                  isLoggedIn && currentUser ? (
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
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
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
                ) : (
                     <>
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/">Login</Link>
                        </Button>
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                          <Link href="/contact">Schedule A Call</Link>
                        </Button>
                     </>
                )) : (
                     <>
                         <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
                         <div className="h-8 w-24 rounded-md bg-muted animate-pulse"></div>
                     </>
                 )}
            </div>
        </div>
      </div>
    </header>
  );
}
