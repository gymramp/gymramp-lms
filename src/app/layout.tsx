
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
import { hexToHslString } from '@/lib/utils'; // Import the new utility

// Default values for HSL theme variables from globals.css
const DEFAULT_BACKGROUND_HSL = "0 0% 100%";
const DEFAULT_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_CARD_HSL = "0 0% 100%";
const DEFAULT_CARD_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_POPOVER_HSL = "0 0% 100%";
const DEFAULT_POPOVER_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_PRIMARY_HSL = "0 0% 3.9%";
const DEFAULT_PRIMARY_FOREGROUND_HSL = "0 0% 98%";
const DEFAULT_SECONDARY_HSL = "0 0% 96.1%";
const DEFAULT_SECONDARY_FOREGROUND_HSL = "0 0% 9%";
const DEFAULT_MUTED_HSL = "0 0% 96.1%";
const DEFAULT_MUTED_FOREGROUND_HSL = "0 0% 45.1%";
const DEFAULT_ACCENT_HSL = "226 71% 56%";
const DEFAULT_ACCENT_FOREGROUND_HSL = "0 0% 98%";
const DEFAULT_DESTRUCTIVE_HSL = "0 84.2% 60.2%";
const DEFAULT_DESTRUCTIVE_FOREGROUND_HSL = "0 0% 98%";
const DEFAULT_BORDER_HSL = "0 0% 89.8%";
const DEFAULT_INPUT_HSL = "0 0% 89.8%";
const DEFAULT_RING_HSL = "0 0% 3.9%";


export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host');
  console.log('[RootLayout generateMetadata] Host:', host);
  const company = await getUserCompany(host);
  console.log('[RootLayout generateMetadata] Company for title:', company?.name);
  return {
    title: company?.name || 'GYMRAMP',
    description: company?.shortDescription || 'Sales training for gym employees',
    // Add dynamic favicon logic here if/when implemented
    // icons: { icon: company?.faviconUrl || '/favicon.ico' }
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
  const host = headers().get('host');
  console.log('[RootLayout] Host from headers():', host);

  const company = await getUserCompany(host);
  console.log('[RootLayout] Company fetched:', company ? { name: company.name, whiteLabelEnabled: company.whiteLabelEnabled, colors: { p: company.primaryColor, s: company.secondaryColor, a: company.accentColor, bg: company.brandBackgroundColor, fg: company.brandForegroundColor } } : null);

  let themeStyles: React.CSSProperties = {};
  let bodyClasses = "flex flex-col h-full font-sans antialiased"; // Ensured h-full here

  if (company && company.whiteLabelEnabled) {
    console.log(`[RootLayout] White-labeling enabled for brand: ${company.name}`);

    const primaryHsl = company.primaryColor ? hexToHslString(company.primaryColor) : null;
    const secondaryHsl = company.secondaryColor ? hexToHslString(company.secondaryColor) : null;
    const accentHsl = company.accentColor ? hexToHslString(company.accentColor) : null;
    const brandBgHsl = company.brandBackgroundColor ? hexToHslString(company.brandBackgroundColor) : null;
    const brandFgHsl = company.brandForegroundColor ? hexToHslString(company.brandForegroundColor) : null;

    // Apply brand colors or fall back to defaults
    themeStyles['--background'] = brandBgHsl || DEFAULT_BACKGROUND_HSL;
    themeStyles['--foreground'] = brandFgHsl || DEFAULT_FOREGROUND_HSL;
    themeStyles['--card'] = brandBgHsl || DEFAULT_CARD_HSL; // Card background often follows main background
    themeStyles['--card-foreground'] = brandFgHsl || DEFAULT_CARD_FOREGROUND_HSL;
    themeStyles['--popover'] = brandBgHsl || DEFAULT_POPOVER_HSL; // Popover background often follows main background
    themeStyles['--popover-foreground'] = brandFgHsl || DEFAULT_POPOVER_FOREGROUND_HSL;
    
    themeStyles['--primary'] = primaryHsl || DEFAULT_PRIMARY_HSL;
    // --primary-foreground will use its default from globals.css for contrast

    themeStyles['--secondary'] = secondaryHsl || DEFAULT_SECONDARY_HSL;
    // --secondary-foreground will use its default
    
    themeStyles['--muted'] = secondaryHsl || DEFAULT_MUTED_HSL; // Muted often follows secondary
    // --muted-foreground will use its default (or could be tied to brandFgHsl if desired, but defaults provide contrast)

    themeStyles['--accent'] = accentHsl || DEFAULT_ACCENT_HSL;
    // --accent-foreground will use its default

    // Destructive, Border, Input, Ring will use their defaults from globals.css
    // This ensures they maintain functional contrast unless explicitly themed by brand.
    console.log('[RootLayout] Applied themeStyles:', themeStyles);

  } else {
    console.log('[RootLayout] Applying default GYMRAMP theme.');
    // Apply default GYMRAMP theme if no brand or white-labeling disabled
    themeStyles['--background'] = DEFAULT_BACKGROUND_HSL;
    themeStyles['--foreground'] = DEFAULT_FOREGROUND_HSL;
    themeStyles['--card'] = DEFAULT_CARD_HSL;
    themeStyles['--card-foreground'] = DEFAULT_CARD_FOREGROUND_HSL;
    themeStyles['--popover'] = DEFAULT_POPOVER_HSL;
    themeStyles['--popover-foreground'] = DEFAULT_POPOVER_FOREGROUND_HSL;
    themeStyles['--primary'] = DEFAULT_PRIMARY_HSL;
    themeStyles['--primary-foreground'] = DEFAULT_PRIMARY_FOREGROUND_HSL;
    themeStyles['--secondary'] = DEFAULT_SECONDARY_HSL;
    themeStyles['--secondary-foreground'] = DEFAULT_SECONDARY_FOREGROUND_HSL;
    themeStyles['--muted'] = DEFAULT_MUTED_HSL;
    themeStyles['--muted-foreground'] = DEFAULT_MUTED_FOREGROUND_HSL;
    themeStyles['--accent'] = DEFAULT_ACCENT_HSL;
    themeStyles['--accent-foreground'] = DEFAULT_ACCENT_FOREGROUND_HSL;
    themeStyles['--destructive'] = DEFAULT_DESTRUCTIVE_HSL;
    themeStyles['--destructive-foreground'] = DEFAULT_DESTRUCTIVE_FOREGROUND_HSL;
    themeStyles['--border'] = DEFAULT_BORDER_HSL;
    themeStyles['--input'] = DEFAULT_INPUT_HSL;
    themeStyles['--ring'] = DEFAULT_RING_HSL;
  }

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={bodyClasses}
        style={Object.keys(themeStyles).length > 0 ? themeStyles : undefined}
      >
        <Navbar brandLogoUrl={company?.logoUrl} brandName={company?.name} />
        <div className="flex flex-1 overflow-hidden"> {/* Removed pt-14 here as Navbar is not fixed */}
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
