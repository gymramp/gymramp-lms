
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { getUserCompany } from '@/lib/user-data';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar'; // Import the new Sidebar

export const metadata: Metadata = {
  title: 'GYMRAMP',
  description: 'Sales training for gym employees',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const company = await getUserCompany();
  const defaultPrimary = '#004d40';
  const defaultSecondary = '#e0e0e0';
  const defaultAccent = '#ff9800';

  const primaryColor = company?.whiteLabelEnabled ? company.primaryColor || defaultPrimary : defaultPrimary;
  const secondaryColor = company?.whiteLabelEnabled ? company.secondaryColor || defaultSecondary : defaultSecondary;
  const accentColor = company?.whiteLabelEnabled ? company.accentColor || defaultAccent : defaultAccent;

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={cn("relative h-full font-sans antialiased flex flex-col")}
        style={{
          '--primary-color': primaryColor,
          '--secondary-color': secondaryColor,
          '--accent-color': accentColor,
        } as React.CSSProperties}>
        <Navbar /> {/* This will be the fixed top bar */}
        <div className="flex flex-1 pt-14"> {/* pt-14 to offset fixed Navbar height */}
          <Sidebar /> {/* Sidebar for logged-in users */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-secondary/30 md:ml-64"> {/* Main content area with md:ml-64 */}
            {children}
          </main>
        </div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
