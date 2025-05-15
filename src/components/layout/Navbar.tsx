
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
import { Menu, LogOut, User as UserIcon, LayoutDashboard, Settings, Users, BookOpen, FileText, ListChecks, Building, ShoppingCart, Award, MapPin, DatabaseZap, BarChartBig, Gift, TestTube2 } from 'lucide-react'; 
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import type { User } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

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
         // toast({ title: "Error", description: "Could not load user profile.", variant: "destructive" });
      }
    } else {
      setCurrentUser(null);
    }
  }, [toast]);

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

  const getNavItems = (user: User | null) => {
    const baseItems: { href: string; label: string }[] = [];

    if (!user) return baseItems; // No items if not logged in

    const roleSpecificItems: { href: string; label: string }[] = [];
    if (user.role === 'Super Admin') {
      roleSpecificItems.push(
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/companies', label: 'Companies' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/courses', label: 'Courses' },
        { href: '/admin/lessons', label: 'Lessons' },
        { href: '/admin/quizzes', label: 'Quizzes' },
        { href: '/admin/checkout', label: 'Checkout' },
        { href: '/admin/free-trial-checkout', label: 'Free Trial' },
        { href: '/admin/test-checkout', label: 'Test Checkout'} 
      );
    } else if (user.role === 'Admin' || user.role === 'Owner') {
        roleSpecificItems.push(
            { href: '/dashboard', label: 'Dashboard' },
             { href: '/admin/users', label: 'Users' },
             ...(user.companyId ? [{ href: `/admin/companies/${user.companyId}/locations`, label: 'Locations' }] : []),
            { href: '/courses/my-courses', label: 'My Learning'},
        );
    } else if (user.role === 'Manager') {
        roleSpecificItems.push(
             { href: '/dashboard', label: 'Dashboard' },
             { href: '/admin/users', label: 'Users' },
             { href: '/courses/my-courses', label: 'My Learning'},
         );
    } else if (user.role === 'Staff') {
        roleSpecificItems.push(
            { href: '/courses/my-courses', label: 'My Learning' },
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
          { href: '/admin/courses', label: 'Courses', icon: BookOpen },
          { href: '/admin/lessons', label: 'Lessons', icon: FileText },
          { href: '/admin/quizzes', label: 'Quizzes', icon: ListChecks },
          { href: '/admin/checkout', label: 'Paid Checkout', icon: ShoppingCart },
          { href: '/admin/free-trial-checkout', label: 'Free Trial Checkout', icon: Gift }, 
          { href: '/admin/test-checkout', label: 'Test Checkout', icon: TestTube2 }, 
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
  ] : [];

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={cn("container flex h-14 items-center justify-between", "mx-auto")}>
        <div className="flex items-center">
           {isMounted && isLoggedIn && navItems.length > 0 && ( // Only show menu if logged in AND has items
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
                 <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
                    <SheetHeader className="p-4 border-b">
                    <SheetTitle className="text-left">Menu</SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-4 p-4">
                    {navItems.map((item) => (
                        <Link
                        key={item.label}
                        href={item.href}
                        className="block px-2 py-1 text-lg transition-colors hover:text-foreground/80 text-foreground/60"
                        onClick={() => setIsMobileMenuOpen(false)}
                        >
                        {item.label}
                        </Link>
                    ))}
                    <hr className="my-2"/>
                    {currentUser && (
                        <div className="flex flex-col gap-2 mt-auto">
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{currentUser.email}</div>
                            <DropdownMenuSeparator className="-mx-2"/>
                            {userMenuItems.map((item) => (
                                <DropdownMenuItem key={item.label} asChild className="cursor-pointer">
                                    <Link
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <span>{item.label}</span>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="-mx-2"/>
                            <DropdownMenuItem onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="cursor-pointer flex justify-start items-center gap-2 px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </div>
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

        <nav className="hidden md:flex items-center justify-center space-x-4 text-sm font-medium flex-grow">
          {isMounted && isLoggedIn && navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                 "px-3 py-1 rounded-md transition-colors",
                 "text-foreground/60 hover:text-foreground/80 hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
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
                        <Button asChild size="sm" variant="outline">
                            <Link href="/">Login</Link> {/* Changed from /login to / */}
                        </Button>
                        <Button asChild size="sm">
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
