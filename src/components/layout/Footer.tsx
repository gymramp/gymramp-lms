
'use client';

import Link from 'next/link';
import Image from 'next/image'; // Import Image
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function Footer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthCheckComplete(true);
    });

    return () => unsubscribe();
  }, []);
  
  if (!isAuthCheckComplete || isLoggedIn) {
    return null; // Don't render anything if auth is checking or if user is logged in
  }
  
  return (
    <footer className="border-t bg-secondary">
      {/* Adjusted padding classes and removed md:h-24 */}
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:flex-row md:py-8">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Image
            src="/images/gymramp-logo.png" // Path to your logo
            alt="GYMRAMP Logo"
            width={120}
            height={30}
          />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by GYMRAMP. © {new Date().getFullYear()} All rights reserved.
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
