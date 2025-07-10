
import type { Metadata, Viewport } from 'next';
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
import { Sheet, SheetTrigger } from '@/components/ui/sheet';

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
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
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
                 <h1 className="flex-1 text-lg font-semibold truncate">Gymramp</h1>
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
