
import Link from 'next/link';
import Image from 'next/image'; // Import Image

export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          {/* Replaced Flame icon with Image component for logo */}
          <Image
            src="/images/gymramp-logo.png" // Path to your logo
            alt="GYMRAMP Logo"
            width={120}
            height={30}
          />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by GYMRAMP. © {new Date().getFullYear()} All rights reserved. {/* Updated App Name */}
          </p>
        </div>
        <nav className="flex gap-4 sm:gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
           <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
