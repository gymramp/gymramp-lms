// src/app/account/layout.tsx
import { AccountNav } from '@/components/layout/AccountNav';
import { Separator } from '@/components/ui/separator';

interface AccountLayoutProps {
  children: React.ReactNode;
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <div className="container mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <AccountNav />
      <Separator />
      <div className="pt-6">
        {children}
      </div>
    </div>
  );
}
