
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
    Menu, LogOut, User as UserIcon, Settings, Cog, Package, HelpCircle, Award
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; // For fetching brand details
import type { User, Company } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getNavigationStructure, getUserDropdownItems, NavItemType } from '@/lib/nav-config';
import { Skeleton } from '../ui/skeleton';
import { hexToHslString } from '@/lib/utils'; // Import hexToHslString

// Default theme HSL values (from globals.css - ensure these match your defaults)
const DEFAULT_THEME_VALUES: Record<string, string> = {
  '--background': "0 0% 100%",
  '--foreground': "0 0% 3.9%",
  '--card': "0 0% 100%",
  '--card-foreground': "0 0% 3.9%",
  '--popover': "0 0% 100%",
  '--popover-foreground': "0 0% 3.9%",
  '--primary': "0 0% 3.9%",
  '--primary-foreground': "0 0% 98%",
  '--secondary': "0 0% 96.1%",
  '--secondary-foreground': "0 0% 9%",
  '--muted': "0 0% 96.1%",
  '--muted-foreground': "0 0% 45.1%",
  '--accent': "226 71% 56%",
  '--accent-foreground': "0 0% 98%",
  '--destructive': "0 84.2% 60.2%",
  '--destructive-foreground': "0 0% 98%",
  '--border': "0 0% 89.8%",
  '--input': "0 0% 89.8%",
  '--ring': "0 0% 3.9%",
};

const DARK_DEFAULT_THEME_VALUES: Record<string, string> = {
  '--background': "0 0% 3.9%",
  '--foreground': "0 0% 98%",
  '--card': "0 0% 3.9%",
  '--card-foreground': "0 0% 98%",
  '--popover': "0 0% 3.9%",
  '--popover-foreground': "0 0% 98%",
  '--primary': "0 0% 98%",
  '--primary-foreground': "0 0% 3.9%",
  '--secondary': "0 0% 14.9%",
  '--secondary-foreground': "0 0% 98%",
  '--muted': "0 0% 14.9%",
  '--muted-foreground': "0 0% 63.9%",
  '--accent': "226 71% 65%",
  '--accent-foreground': "0 0% 98%",
  '--destructive': "0 62.8% 30.6%",
  '--destructive-foreground': "0 0% 98%",
  '--border': "0 0% 14.9%",
  '--input': "0 0% 14.9%",
  '--ring': "0 0% 98%",
};


export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [navItems, setNavItems] = useState<NavItemType[]>([]);
  const [userMenuItems, setUserMenuItems] = useState<NavItemType[]>([]);
  const [isLoadingNav, setIsLoadingNav] = useState(true);

  const [currentBrandLogoUrl, setCurrentBrandLogoUrl] = useState<string | null>("/images/newlogo.png");
  const [currentBrandName, setCurrentBrandName] = useState<string | null>("Gymramp");

  const isLoggedIn = !!currentUser;

  const applyTheme = (brand: Company | null) => {
    const root = document.documentElement;
    const isDarkMode = root.classList.contains('dark');
    const defaults = isDarkMode ? DARK_DEFAULT_THEME_VALUES : DEFAULT_THEME_VALUES;

    const themeColorsToApply: Record<string, string | null | undefined> = {
      '--primary': brand?.primaryColor,
      '--secondary': brand?.secondaryColor,
      '--accent': brand?.accentColor,
      '--background': brand?.brandBackgroundColor,
      '--foreground': brand?.brandForegroundColor,
      // Card and Popover will use background/foreground logic
      '--card': brand?.brandBackgroundColor,
      '--card-foreground': brand?.brandForegroundColor,
      '--popover': brand?.brandBackgroundColor,
      '--popover-foreground': brand?.brandForegroundColor,
      // Muted often follows secondary or background
      '--muted': brand?.secondaryColor || brand?.brandBackgroundColor,
    };

    if (brand && brand.whiteLabelEnabled) {
      console.log('[Navbar] Applying theme for brand:', brand.name, brand.primaryColor);
      setCurrentBrandLogoUrl(brand.logoUrl || "/images/newlogo.png");
      setCurrentBrandName(brand.name || "Gymramp");

      Object.entries(themeColorsToApply).forEach(([cssVar, hexColor]) => {
        if (hexColor) {
          const hslColor = hexToHslString(hexColor);
          if (hslColor) {
            root.style.setProperty(cssVar, hslColor);
            console.log(`[Navbar] Set ${cssVar} to ${hslColor} (from ${hexColor})`);
          } else {
            // If conversion fails or color not provided for this var, revert to default
            if (defaults[cssVar]) {
              root.style.setProperty(cssVar, defaults[cssVar]);
            } else {
              root.style.removeProperty(cssVar);
            }
          }
        } else {
          // If brand doesn't have this specific color defined, revert to default
           if (defaults[cssVar]) {
              root.style.setProperty(cssVar, defaults[cssVar]);
            } else {
              root.style.removeProperty(cssVar);
            }
        }
      });
      // Explicitly ensure component foregrounds use their standard contrasts, not brandForegroundColor
      if(defaults['--primary-foreground']) root.style.setProperty('--primary-foreground', defaults['--primary-foreground']);
      if(defaults['--secondary-foreground']) root.style.setProperty('--secondary-foreground', defaults['--secondary-foreground']);
      if(defaults['--accent-foreground']) root.style.setProperty('--accent-foreground', defaults['--accent-foreground']);

    } else {
      console.log('[Navbar] Reverting to default theme.');
      setCurrentBrandLogoUrl("/images/newlogo.png");
      setCurrentBrandName("Gymramp");
      Object.keys(themeColorsToApply).forEach(cssVar => {
         if (defaults[cssVar]) {
            root.style.setProperty(cssVar, defaults[cssVar]);
          } else {
            root.style.removeProperty(cssVar);
          }
      });
       // Ensure all other defaults are also set
      Object.entries(defaults).forEach(([cssVar, hslValue]) => {
        root.style.setProperty(cssVar, hslValue);
      });
    }
  };


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
          if (userDetails.companyId) {
            const brandDetails = await getCompanyById(userDetails.companyId);
            applyTheme(brandDetails);
          } else {
            applyTheme(null); // No company, apply default theme
          }
        } else {
          setNavItems([]); setUserMenuItems([]); applyTheme(null);
        }
      } catch (error) {
        console.error("[Navbar] Error fetching user/brand data:", error);
        setCurrentUser(null); setNavItems([]); setUserMenuItems([]); applyTheme(null);
      }
    } else {
      setCurrentUser(null);
      const publicNav = await getNavigationStructure(null);
      setNavItems(publicNav); setUserMenuItems([]); applyTheme(null);
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

  // Re-apply theme if system dark mode changes
  useEffect(() => {
    if (!isMounted || !currentUser?.companyId) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = async () => {
      if (currentUser && currentUser.companyId) {
        const brandDetails = await getCompanyById(currentUser.companyId);
        applyTheme(brandDetails);
      } else {
        applyTheme(null);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isMounted, currentUser, applyTheme]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof window !== 'undefined') {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
      }
      applyTheme(null); // Revert to default theme on logout
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/');
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

  const displayLogoAlt = currentBrandName ? `${currentBrandName} Logo` : "Gymramp Logo";

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
                                    href={item.href || '#'}
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
                    src={currentBrandLogoUrl || "/images/newlogo.png"}
                    alt={displayLogoAlt}
                    width={150}
                    height={45}
                    priority
                    className="max-h-[30px] object-contain"
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
                         {/* <Skeleton className="h-8 w-24 rounded-md" /> User name removed from here */}
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
                 ) : null
                }
            </div>
        </div>
      </div>
    </header>
  );
}
