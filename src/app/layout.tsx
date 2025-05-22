
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { headers } from 'next/headers'; // For reading host
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
const DEFAULT_PRIMARY_HSL = "0 0% 3.9%";
const DEFAULT_SECONDARY_HSL = "0 0% 96.1%";
const DEFAULT_ACCENT_HSL = "226 71% 56%";
const DEFAULT_CARD_HSL = "0 0% 100%";
const DEFAULT_CARD_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_POPOVER_HSL = "0 0% 100%";
const DEFAULT_POPOVER_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_MUTED_HSL = "0 0% 96.1%";
const DEFAULT_MUTED_FOREGROUND_HSL = "0 0% 45.1%";
const DEFAULT_DESTRUCTIVE_HSL = "0 84.2% 60.2%";
const DEFAULT_DESTRUCTIVE_FOREGROUND_HSL = "0 0% 98%";
const DEFAULT_BORDER_HSL = "0 0% 89.8%";
const DEFAULT_INPUT_HSL = "0 0% 89.8%";
const DEFAULT_RING_HSL = "0 0% 3.9%";


export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host');
  const company = await getUserCompany(host); // Pass host to identify brand

  return {
    title: company?.name || 'GYMRAMP',
    description: company?.shortDescription || 'Sales training for gym employees',
    // TODO: Add dynamic favicon if brand.faviconUrl is implemented
    // icons: { icon: company?.faviconUrl || '/favicon.ico' },
  };
}

export const viewport: Viewport = {
  themeColor: [ // Example, could also be dynamic
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
  const company = await getUserCompany(host);

  let themeStyles: React.CSSProperties = {
    '--background': DEFAULT_BACKGROUND_HSL,
    '--foreground': DEFAULT_FOREGROUND_HSL,
    '--card': DEFAULT_CARD_HSL,
    '--card-foreground': DEFAULT_CARD_FOREGROUND_HSL,
    '--popover': DEFAULT_POPOVER_HSL,
    '--popover-foreground': DEFAULT_POPOVER_FOREGROUND_HSL,
    '--primary': DEFAULT_PRIMARY_HSL,
    '--primary-foreground': company?.whiteLabelEnabled && company.brandForegroundColor ? hexToHslString(company.brandForegroundColor) || DEFAULT_FOREGROUND_HSL : DEFAULT_FOREGROUND_HSL, // Assuming primary-fg contrasts with primary
    '--secondary': DEFAULT_SECONDARY_HSL,
    '--secondary-foreground': company?.whiteLabelEnabled && company.brandForegroundColor ? hexToHslString(company.brandForegroundColor) || DEFAULT_FOREGROUND_HSL : DEFAULT_FOREGROUND_HSL, // Assuming secondary-fg contrasts
    '--muted': DEFAULT_MUTED_HSL,
    '--muted-foreground': DEFAULT_MUTED_FOREGROUND_HSL,
    '--accent': DEFAULT_ACCENT_HSL,
    '--accent-foreground': company?.whiteLabelEnabled && company.brandForegroundColor ? hexToHslString(company.brandForegroundColor) || DEFAULT_FOREGROUND_HSL : DEFAULT_FOREGROUND_HSL, // Assuming accent-fg contrasts
    '--destructive': DEFAULT_DESTRUCTIVE_HSL,
    '--destructive-foreground': DEFAULT_DESTRUCTIVE_FOREGROUND_HSL,
    '--border': DEFAULT_BORDER_HSL,
    '--input': DEFAULT_INPUT_HSL,
    '--ring': DEFAULT_RING_HSL,
  };

  if (company && company.whiteLabelEnabled) {
    if (company.brandBackgroundColor) {
      const bgHsl = hexToHslString(company.brandBackgroundColor);
      if (bgHsl) themeStyles['--background'] = bgHsl;
    }
    if (company.brandForegroundColor) {
      const fgHsl = hexToHslString(company.brandForegroundColor);
      if (fgHsl) {
        themeStyles['--foreground'] = fgHsl;
        // Update contrasting foregrounds if brand foreground is set
        themeStyles['--primary-foreground'] = fgHsl;
        themeStyles['--secondary-foreground'] = fgHsl;
        themeStyles['--accent-foreground'] = fgHsl;
        themeStyles['--card-foreground'] = fgHsl;
        themeStyles['--popover-foreground'] = fgHsl;
      }
    }
    if (company.primaryColor) {
      const primaryHsl = hexToHslString(company.primaryColor);
      if (primaryHsl) themeStyles['--primary'] = primaryHsl;
    }
    if (company.secondaryColor) {
      const secondaryHsl = hexToHslString(company.secondaryColor);
      if (secondaryHsl) themeStyles['--secondary'] = secondaryHsl;
    }
    if (company.accentColor) {
      const accentHsl = hexToHslString(company.accentColor);
      if (accentHsl) themeStyles['--accent'] = accentHsl;
    }
    // Note: Card, Popover, Muted, Destructive, Border, Input, Ring might need their own brand color fields
    // or derive from the primary/secondary/background/foreground.
    // For simplicity, they currently retain defaults unless the general foreground changes.
  }

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={cn("flex flex-col h-full font-sans antialiased")}
        style={themeStyles}
      >
        <Navbar brandLogoUrl={company?.logoUrl} brandName={company?.name} />
        <div className="flex flex-1 overflow-hidden"> {/* Removed pt-14, Navbar not fixed */}
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
