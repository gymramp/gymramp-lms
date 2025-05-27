
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { headers } from 'next/headers';
import { getUserCompany } from '@/lib/user-data';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
// Removed hexToHslString import as it's not directly used here anymore for dynamic style prop

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host');
  console.log('[RootLayout generateMetadata] Host:', host);
  const company = await getUserCompany(host); // Keep for initial title/metadata based on host
  console.log('[RootLayout generateMetadata] Company for title:', company?.name);
  return {
    title: company?.name || 'Gymramp', // Updated App Name
    description: company?.shortDescription || 'Sales training for gym employees',
  };
}

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
  // Hostname-based theming is removed from RootLayout.
  // Dynamic theming for logged-in users will be handled client-side in Navbar.
  console.log('[RootLayout] Rendering with default theme. Dynamic theming based on logged-in user will occur client-side.');

  const bodyClasses = "flex flex-col h-full font-sans antialiased";

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={bodyClasses}
        // No dynamic style prop here; theming handled client-side or by globals.css
      >
        {/* Navbar no longer receives brandLogoUrl/brandName directly from RootLayout's server-side host detection */}
        <Navbar />
        <div className="flex flex-1 overflow-hidden"> {/* pt-14 removed as Navbar might not be fixed height if logo changes height */}
          <Sidebar />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-secondary/30">
            {children}
          </main>
        </div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
