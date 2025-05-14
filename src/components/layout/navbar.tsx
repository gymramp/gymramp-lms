'use client';

import Link from 'next/link';
import { Dumbbell, Home, User, LayoutDashboard, Wand2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/mode-toggle';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/manage-courses', label: 'Manage Courses', icon: LayoutDashboard },
  { href: '/generate-title', label: 'Generate Title', icon: Wand2 },
];

export default function Navbar() {
  const pathname = usePathname();

  const NavLinks = ({isMobile = false}: {isMobile?: boolean}) => (
    <>
     {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-2 transition-colors hover:text-primary",
            pathname === item.href ? "text-primary font-semibold" : "text-muted-foreground",
            isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-sm"
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Dumbbell className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">Gymramp LMS</span>
        </Link>

        <nav className="hidden items-center space-x-6 md:flex">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-2">
           <ModeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-4">
              <div className="mb-6 flex items-center gap-2">
                <Dumbbell className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">Gymramp LMS</span>
              </div>
              <nav className="flex flex-col space-y-3">
                <NavLinks isMobile={true} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
