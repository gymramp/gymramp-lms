// src/components/layout/AccountNav.tsx
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/account", label: "Basics" },
  { href: "/account/security", label: "Security" },
  // Add more items here as needed
  // { href: "/account/billing", label: "Billing" },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6" aria-label="Account navigation">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary relative",
            pathname === item.href
              ? "text-primary active-account-nav-link"
              : "text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
