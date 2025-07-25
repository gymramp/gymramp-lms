

import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileSidebar } from '@/components/layout/MobileSidebar'; // Import the new component
import { AiChatAssistant } from '@/components/layout/AiChatAssistant';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { getLogoHref } from '@/lib/nav-config';
import { auth } from '@/lib/firebase';
import { getUserByEmail } from '@/lib/user-data';


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gymramp',
  description: 'Sales training for gym employees',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log('[RootLayout] Rendering with default theme. White-labeling based on hostname/user has been removed.');

  // This is a server-side approach to get the initial user for the logo link
  const firebaseUser = auth.currentUser;
  let userDetails = null;
  if (firebaseUser?.email) {
      userDetails = await getUserByEmail(firebaseUser.email);
  }
  const logoHref = getLogoHref(userDetails);


  const bodyClasses = "h-full font-sans antialiased";

  return (
    <html lang="en" className={cn("h-full", inter.className)}>
      <body
        className={bodyClasses}
      >
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-secondary/30 flex flex-col">
            {/* Mobile Header */}
            <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 py-2 md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                         <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                          >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation menu</span>
                          </Button>
                    </SheetTrigger>
                    {/* The new MobileSidebar component will render the SheetContent */}
                    <MobileSidebar />
                </Sheet>
                 <div className="flex-1 flex justify-center">
                    <Link href={logoHref}>
                      <Image
                          src="/images/newlogo.png"
                          alt="Gymramp Logo"
                          width={120}
                          height={30}
                          className="max-h-[30px] w-auto"
                      />
                    </Link>
                 </div>
            </header>
            <div className="flex-grow p-4 md:p-6 lg:p-8">
              {children}
            </div>
            <Footer />
          </main>
        </div>
        <Toaster />
        <AiChatAssistant />
      </body>
    </html>
  );
}
