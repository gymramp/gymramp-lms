
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

// Default HSL values from globals.css (light mode for reference)
const DEFAULT_BACKGROUND_HSL = "0 0% 100%";
const DEFAULT_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_CARD_HSL = "0 0% 100%";
const DEFAULT_CARD_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_POPOVER_HSL = "0 0% 100%";
const DEFAULT_POPOVER_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_PRIMARY_HSL = "0 0% 3.9%";
const DEFAULT_SECONDARY_HSL = "0 0% 96.1%";
const DEFAULT_MUTED_HSL = "0 0% 96.1%";
const DEFAULT_MUTED_FOREGROUND_HSL = "0 0% 45.1%";
const DEFAULT_ACCENT_HSL = "226 71% 56%";
// Note: Component-specific foregrounds like --primary-foreground will always come from globals.css

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host');
  const company = await getUserCompany(host);

  return {
    title: company?.name || 'GYMRAMP',
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
  const host = headers().get('host');
  const company = await getUserCompany(host);

  let themeStyles: React.CSSProperties = {};
  let bodyClasses = "flex flex-col h-full font-sans antialiased";

  if (company && company.whiteLabelEnabled) {
    console.log(`[RootLayout] White-labeling enabled for brand: ${company.name}`);

    if (company.brandBackgroundColor) {
      const bgHsl = hexToHslString(company.brandBackgroundColor);
      if (bgHsl) {
        themeStyles['--background'] = bgHsl;
        themeStyles['--card'] = bgHsl;
        themeStyles['--popover'] = bgHsl;
      }
    }

    if (company.brandForegroundColor) {
      const fgHsl = hexToHslString(company.brandForegroundColor);
      if (fgHsl) {
        themeStyles['--foreground'] = fgHsl;
        themeStyles['--card-foreground'] = fgHsl;
        themeStyles['--popover-foreground'] = fgHsl;
        // Explicitly do NOT set --muted-foreground here from brandForegroundColor,
        // let it default unless the brand has a specific muted foreground setting.
      }
    }

    if (company.primaryColor) {
      const primaryHsl = hexToHslString(company.primaryColor);
      if (primaryHsl) themeStyles['--primary'] = primaryHsl;
    }

    if (company.secondaryColor) {
      const secondaryHsl = hexToHslString(company.secondaryColor);
      if (secondaryHsl) {
        themeStyles['--secondary'] = secondaryHsl;
        themeStyles['--muted'] = secondaryHsl; // Muted background often follows secondary
      }
    }

    if (company.accentColor) {
      const accentHsl = hexToHslString(company.accentColor);
      if (accentHsl) themeStyles['--accent'] = accentHsl;
    }
    // All component-specific foregrounds (e.g., --primary-foreground, --accent-foreground)
    // and other theme variables (--border, --input, --ring, --destructive, --muted-foreground unless explicitly set by brand)
    // will rely on their definitions in globals.css to ensure proper contrast and theming.
  } else {
    // Fallback to ensure CSS variables are defined if no brand or white-labeling is off
    // This section is mostly for completeness, as globals.css should provide these.
    // However, explicitly setting them here ensures they are on the body style if needed.
    themeStyles['--background'] = DEFAULT_BACKGROUND_HSL;
    themeStyles['--foreground'] = DEFAULT_FOREGROUND_HSL;
    themeStyles['--card'] = DEFAULT_CARD_HSL;
    themeStyles['--card-foreground'] = DEFAULT_CARD_FOREGROUND_HSL;
    themeStyles['--popover'] = DEFAULT_POPOVER_HSL;
    themeStyles['--popover-foreground'] = DEFAULT_POPOVER_FOREGROUND_HSL;
    themeStyles['--primary'] = DEFAULT_PRIMARY_HSL;
    themeStyles['--secondary'] = DEFAULT_SECONDARY_HSL;
    themeStyles['--muted'] = DEFAULT_MUTED_HSL;
    themeStyles['--muted-foreground'] = DEFAULT_MUTED_FOREGROUND_HSL;
    themeStyles['--accent'] = DEFAULT_ACCENT_HSL;
  }

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={bodyClasses}
        style={Object.keys(themeStyles).length > 0 ? themeStyles : undefined}
      >
        <Navbar brandLogoUrl={company?.logoUrl} brandName={company?.name} />
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
