
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

// Default values for HSL theme variables from globals.css
// These are used if a brand has white-labeling enabled but is missing a specific color setting.
const DEFAULT_BACKGROUND_HSL = "0 0% 100%"; // White
const DEFAULT_FOREGROUND_HSL = "0 0% 3.9%"; // Near Black
const DEFAULT_CARD_HSL = "0 0% 100%";
const DEFAULT_CARD_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_POPOVER_HSL = "0 0% 100%";
const DEFAULT_POPOVER_FOREGROUND_HSL = "0 0% 3.9%";
const DEFAULT_PRIMARY_HSL = "0 0% 3.9%";
const DEFAULT_PRIMARY_FOREGROUND_HSL = "0 0% 98%"; // For primary button text
const DEFAULT_SECONDARY_HSL = "0 0% 96.1%";
const DEFAULT_SECONDARY_FOREGROUND_HSL = "0 0% 9%"; // For secondary button text
const DEFAULT_MUTED_HSL = "0 0% 96.1%";
const DEFAULT_MUTED_FOREGROUND_HSL = "0 0% 45.1%";
const DEFAULT_ACCENT_HSL = "226 71% 56%";
const DEFAULT_ACCENT_FOREGROUND_HSL = "0 0% 98%"; // For accent button text
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
    // icons: { icon: company?.faviconUrl || '/favicon.ico' } // Future enhancement
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
  console.log('[RootLayout] Company fetched:', company ? { name: company.name, whiteLabelEnabled: company.whiteLabelEnabled, primaryColor: company.primaryColor, brandBackgroundColor: company.brandBackgroundColor } : null);

  let themeStyles: React.CSSProperties = {};
  let brandLogoUrl: string | null = null;
  let brandName: string | null = null;

  if (company && company.whiteLabelEnabled) {
    brandLogoUrl = company.logoUrl || null;
    brandName = company.name || null;

    const addStyle = (variableName: string, hexColor: string | null | undefined, defaultHsl?: string) => {
      if (hexColor) {
        const hsl = hexToHslString(hexColor);
        if (hsl) {
          themeStyles[variableName as any] = hsl;
        } else if (defaultHsl) {
          // Use default if brand color is invalid but whitelabeling is on
          // This case might be rare if HEX validation is good in admin UI
          themeStyles[variableName as any] = defaultHsl;
        }
      } else if (defaultHsl) {
        // This ensures that if a brand has white-labeling enabled but *doesn't* set a specific color (e.g. brandBackgroundColor),
        // it will still get a coherent set of defaults rather than a mix.
        // However, for a pure override system, we might only want to set if brand provides it.
        // For now, let's ensure all core theme vars are set if whiteLabelEnabled is true.
         // themeStyles[variableName as any] = defaultHsl; // Re-evaluating this: better to let globals.css handle if not set
      }
    };

    // Only set CSS variables if the brand has provided them. Otherwise, globals.css will apply.
    if (company.brandBackgroundColor) addStyle('--background', company.brandBackgroundColor);
    if (company.brandForegroundColor) addStyle('--foreground', company.brandForegroundColor);
    
    // For components, if a brand sets a background, they might need to consider text contrast.
    // Card and Popover often follow the main background/foreground.
    if (company.brandBackgroundColor) addStyle('--card', company.brandBackgroundColor); else addStyle('--card', DEFAULT_CARD_HSL);
    if (company.brandForegroundColor) addStyle('--card-foreground', company.brandForegroundColor); else addStyle('--card-foreground', DEFAULT_CARD_FOREGROUND_HSL);
    if (company.brandBackgroundColor) addStyle('--popover', company.brandBackgroundColor); else addStyle('--popover', DEFAULT_POPOVER_HSL);
    if (company.brandForegroundColor) addStyle('--popover-foreground', company.brandForegroundColor); else addStyle('--popover-foreground', DEFAULT_POPOVER_FOREGROUND_HSL);

    if (company.primaryColor) addStyle('--primary', company.primaryColor);
    // We intentionally DO NOT set --primary-foreground from brandForegroundColor,
    // let globals.css handle contrast based on the new --primary.
    
    if (company.secondaryColor) addStyle('--secondary', company.secondaryColor);
    // DO NOT set --secondary-foreground from brandForegroundColor.
    
    // Muted usually follows secondary or background. If secondary is set, use it, else default.
    if (company.secondaryColor) addStyle('--muted', company.secondaryColor); 
    // else if (company.brandBackgroundColor) addStyle('--muted', company.brandBackgroundColor);
    // DO NOT set --muted-foreground from brandForegroundColor.

    if (company.accentColor) addStyle('--accent', company.accentColor);
    // DO NOT set --accent-foreground from brandForegroundColor.

    // Destructive, Border, Input, Ring will use their defaults from globals.css
    // unless specific brand fields are added for them.
    console.log('[RootLayout] Applied themeStyles for Brand:', company.name, themeStyles);
  } else {
    console.log('[RootLayout] No specific brand theme applied. Using default from globals.css.');
    // No inline styles will be set if no brand or whiteLabeling is disabled; globals.css rules.
  }

  const bodyClasses = "flex flex-col h-full font-sans antialiased";

  return (
    <html lang="en" className={cn("h-full", GeistSans.variable)}>
      <body
        className={bodyClasses}
        style={Object.keys(themeStyles).length > 0 ? themeStyles : undefined}
      >
        <Navbar brandLogoUrl={brandLogoUrl} brandName={brandName} />
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
