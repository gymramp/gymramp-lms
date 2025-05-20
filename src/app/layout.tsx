
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
// Import for server-side header access if needed (e.g. in a dynamic Server Component context)
// import { headers } from 'next/headers';
import { getUserCompany } from '@/lib/user-data'; // This function needs to be adapted for server-side hostname detection
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'GYMRAMP', // Default title
  description: 'Sales training for gym employees',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: For true dynamic white-labeling based on hostname for RootLayout styling:
  // 1. This RootLayout, if it remains a Server Component, needs to access request headers
  //    to get the hostname. This is possible in dynamic Server Components or if deployed
  //    to environments (like Node.js server, Vercel, or Cloud Run with custom request handling)
  //    that expose headers. Firebase App Hosting's direct Next.js support might make this tricky
  //    without an intermediary like a Cloud Function.
  //
  // 2. Extract the subdomain or full domain from the hostname.
  //    const host = headers().get('host'); // Example if headers() is available
  //    const subdomainSlug = extractSubdomain(host); // You'd need a utility for this
  //
  // 3. Modify `getUserCompany` to be a server-side function that can take this
  //    `subdomainSlug` (or hostname) and query Firestore for the matching brand.
  //    const company = await getUserCompany(subdomainSlug);
  //
  // 4. If `getUserCompany` successfully returns brand data, use its white-labeling
  //    settings (primaryColor, secondaryColor, accentColor, logoUrl) below.

  // For now, `getUserCompany` is a placeholder and returns null.
  const company = await getUserCompany(null); // Pass null or a placeholder for now

  const defaultPrimary = '#004d40'; // GYMRAMP's default dark teal
  const defaultSecondary = '#e0e0e0'; // GYMRAMP's default light gray
  const defaultAccent = '#ff9800';   // GYMRAMP's default orange

  const primaryColor = (company?.whiteLabelEnabled && company.primaryColor) ? company.primaryColor : defaultPrimary;
  const secondaryColor = (company?.whiteLabelEnabled && company.secondaryColor) ? company.secondaryColor : defaultSecondary;
  const accentColor = (company?.whiteLabelEnabled && company.accentColor) ? company.accentColor : defaultAccent;

  // The title and logo for the browser tab would also ideally be dynamic.
  // `metadata` object above would need to be a `generateMetadata` function.
  // export async function generateMetadata({ params }): Promise<Metadata> {
  //   // Fetch brand data based on params or hostname
  //   // return { title: brand.name || 'GYMRAMP', description: ... , icons: { icon: brand.faviconUrl }}
  // }


  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={cn("flex flex-col h-full font-sans antialiased")}
        style={{
          // These CSS variables will be overridden by globals.css which has HSL values.
          // To make these effective dynamically, globals.css would need to use these
          // direct hex values OR these would need to be converted to HSL strings here.
          // Alternatively, set HSL values here if your brand colors are stored as HSL.
          // For now, this sets the variables, but globals.css might take precedence.
          '--primary-color-hex': primaryColor,
          '--secondary-color-hex': secondaryColor,
          '--accent-color-hex': accentColor,
        } as React.CSSProperties}>
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
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
