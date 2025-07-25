
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileSidebar } from '@/components/layout/MobileSidebar'; 
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import Image from 'next/image';


export default async function PartnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
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
                <MobileSidebar />
            </Sheet>
             <div className="flex-1 flex justify-center">
                <Link href="/partner/dashboard">
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
  );
}
