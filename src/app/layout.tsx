
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
import { hexToHslString } from '@/lib/utils';

// Default values from globals.css (light mode)
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
  const company = await getUserCompany(host);

  return {
    title: company?.name || 'GYMRAMP',
    description: company?.shortDescription || 'Sales training for gym employees',
    // icons: { icon: company?.faviconUrl || '/favicon.ico' }, // TODO: Implement favicon upload for brands
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
  const company = await getUserCompany(host);

  let themeStyles: React.CSSProperties = {
    // Initialize with defaults that will be applied if no brand theming occurs
    // These are effectively placeholders here as globals.css already defines them.
    // The important part is overriding them if a brand has settings.
  };

  if (company && company.whiteLabelEnabled) {
    console.log(`[RootLayout] White-labeling enabled for brand: ${company.name}`);
    if (company.brandBackgroundColor) {
      const bgHsl = hexToHslString(company.brandBackgroundColor);
      if (bgHsl) {
        themeStyles['--background'] = bgHsl;
        themeStyles['--card'] = bgHsl; // Often card background matches page background
        themeStyles['--popover'] = bgHsl; // Often popover background matches page background
        console.log(`[RootLayout] Applied brand background: ${bgHsl}`);
      }
    }
    if (company.brandForegroundColor) {
      const fgHsl = hexToHslString(company.brandForegroundColor);
      if (fgHsl) {
        themeStyles['--foreground'] = fgHsl;
        themeStyles['--card-foreground'] = fgHsl;
        themeStyles['--popover-foreground'] = fgHsl;
        // DO NOT set --primary-foreground, --secondary-foreground etc. here
        // Let them rely on globals.css defaults for contrast with their specific backgrounds
        console.log(`[RootLayout] Applied brand foreground: ${fgHsl}`);
      }
    }
    if (company.primaryColor) {
      const primaryHsl = hexToHslString(company.primaryColor);
      if (primaryHsl) {
        themeStyles['--primary'] = primaryHsl;
        console.log(`[RootLayout] Applied brand primary color: ${primaryHsl}`);
      }
    }
    if (company.secondaryColor) {
      const secondaryHsl = hexToHslString(company.secondaryColor);
      if (secondaryHsl) {
        themeStyles['--secondary'] = secondaryHsl;
        themeStyles['--muted'] = secondaryHsl; // Often muted matches secondary
        console.log(`[RootLayout] Applied brand secondary color: ${secondaryHsl}`);
      }
    }
    if (company.accentColor) {
      const accentHsl = hexToHslString(company.accentColor);
      if (accentHsl) {
        themeStyles['--accent'] = accentHsl;
        console.log(`[RootLayout] Applied brand accent color: ${accentHsl}`);
      }
    }
    // Note: --border, --input, --ring, and component-specific foregrounds
    // like --primary-foreground, --secondary-foreground, --accent-foreground,
    // --destructive-foreground will use their defaults from globals.css.
    // This ensures better default contrast for buttons if only background colors are changed.
  } else {
    console.log(`[RootLayout] No brand identified or white-labeling disabled. Using default theme.`);
  }

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={cn("flex flex-col h-full font-sans antialiased")}
        style={themeStyles} // Apply dynamic styles
      >
        <Navbar brandLogoUrl={company?.logoUrl} brandName={company?.name} />
        <div className="flex flex-1 overflow-hidden"> {/* Removed pt-14 as Navbar is part of normal flow */}
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
