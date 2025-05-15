
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
// Assuming you have a way to get the current user and their company.
// This might require server-side logic or context providers depending on your auth setup.
// For this example, we'll assume a placeholder function `getUserCompany` exists.
import { getUserCompany } from '@/lib/user-data'; // Adjust the import path as needed
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/layout/Navbar'; // Added this import

export const metadata: Metadata = {
  title: 'GYMRAMP',
  description: 'Sales training for gym employees',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the current user's company data
  // This is a placeholder and needs to be replaced with your actual data fetching logic
  const company = await getUserCompany();

  // Define default colors
  const defaultPrimary = '#004d40'; // Deep Teal
  const defaultSecondary = '#e0e0e0'; // Light Gray
  const defaultAccent = '#ff9800'; // Bright Orange

  // Determine colors based on white-labeling settings
  const primaryColor = company?.whiteLabelEnabled ? company.primaryColor || defaultPrimary : defaultPrimary;
  const secondaryColor = company?.whiteLabelEnabled ? company.secondaryColor || defaultSecondary : defaultSecondary;
  const accentColor = company?.whiteLabelEnabled ? company.accentColor || defaultAccent : defaultAccent;

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={cn("relative h-full font-sans antialiased")}
        style={{
          '--primary-color': primaryColor,
          '--secondary-color': secondaryColor,
          '--accent-color': accentColor,
        } as React.CSSProperties}>
        {/* Navbar might need adjustments based on whether the root layout can access auth state easily */}
        {/* For now, assuming Navbar handles its own auth state logic */}
        <Navbar />
        <main className="relative flex flex-col min-h-screen">
          <div className="flex-grow flex-1">{children}</div>
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
