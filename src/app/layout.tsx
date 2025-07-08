
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
// Removed: import { headers } from 'next/headers';
// Removed: import { getUserCompany } from '@/lib/user-data';
// Removed: import { hexToHslString } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';
import { AiChatAssistant } from '@/components/layout/AiChatAssistant';

const inter = Inter({ subsets: ['latin'] });

// Reverted to static metadata
export const metadata: Metadata = {
  title: 'Gymramp',
  description: 'Sales training for gym employees',
};

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
  console.log('[RootLayout] Rendering with default theme. White-labeling based on hostname/user has been removed.');

  const bodyClasses = "h-full font-sans antialiased";

  return (
    <html lang="en" className={cn("h-full", inter.className)}>
      <body
        className={bodyClasses}
        // Removed dynamic style prop
      >
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-secondary/30 flex flex-col">
            <div className="flex-grow p-4 md:p-6 lg:p-8">
              {children}
            </div>
            <Footer />
          </main>
        </div>
        <Toaster />
        <AiChatAssistant />
      </body>
    </html>
  );
}
