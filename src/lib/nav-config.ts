
// src/lib/nav-config.ts
import type { User, UserRole } from '@/types/user';
import {
    BarChartBig, Building, Layers, CreditCard, BookOpen, FileText,
    ListChecks, UserPlus, ShoppingCart, Gift, TestTube2, Percent,
    LayoutDashboard, Users, MapPin, Settings, Award, HelpCircle, LogOut
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItemType {
  label: string;
  href?: string;
  icon?: LucideIcon;
  isDropdown?: boolean;
  subItems?: NavItemType[];
  requiresCompanyId?: boolean; // To conditionally show links like "Manage Locations"
}

export function getNavigationStructure(user: User | null): NavItemType[] {
  const baseItems: NavItemType[] = [];
  if (!user) return baseItems;

  const roleSpecificItems: NavItemType[] = [];

  if (user.role === 'Super Admin') {
    roleSpecificItems.push(
      { href: '/admin/dashboard', label: 'Dashboard', icon: BarChartBig },
      { href: '/admin/companies', label: 'Brands', icon: Building },
      { href: '/admin/programs', label: 'Programs', icon: Layers },
      { href: '/admin/customers', label: 'Customers', icon: CreditCard },
      {
        label: 'Course Admin',
        isDropdown: true,
        icon: BookOpen,
        subItems: [
          { href: '/admin/courses', label: 'Courses', icon: BookOpen },
          { href: '/admin/lessons', label: 'Lessons', icon: FileText },
          { href: '/admin/quizzes', label: 'Quizzes', icon: ListChecks },
        ],
      },
      {
        label: 'New Customers',
        isDropdown: true,
        icon: UserPlus,
        subItems: [
          { href: '/admin/checkout', label: 'Paid Checkout', icon: ShoppingCart },
          { href: '/admin/free-trial-checkout', label: 'Free Trial', icon: Gift },
          { href: '/admin/test-checkout', label: 'Test Checkout', icon: TestTube2 },
        ],
      },
      { href: '/admin/revenue-share-report', label: 'Rev Share Report', icon: Percent }
      // Users link is intentionally removed from main nav for Super Admin as per recent request
    );
  } else if (user.role === 'Admin' || user.role === 'Owner') {
    roleSpecificItems.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: `/admin/companies/${user.companyId}/locations`, label: 'Locations', icon: MapPin, requiresCompanyId: true },
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
    );
  } else if (user.role === 'Manager') {
    roleSpecificItems.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
    );
  } else if (user.role === 'Staff') {
    roleSpecificItems.push(
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
    );
  }

  // Filter out items that require a companyId if the user doesn't have one (relevant for Admin/Owner)
  const filteredRoleSpecificItems = roleSpecificItems.filter(item => {
    if (item.requiresCompanyId) {
      return !!user.companyId;
    }
    return true;
  });
  
  if (user.role !== 'Super Admin') { // Super Admin user menu is more extensive
    filteredRoleSpecificItems.push({ href: '/badges', label: 'My Badges', icon: Award });
  }

  return [...baseItems, ...filteredRoleSpecificItems];
}


export function getUserDropdownItems(user: User | null): NavItemType[] {
    if (!user) return [];
    const items: NavItemType[] = [
        { href: '/account', label: 'My Account', icon: Settings },
    ];

    if (user.role === 'Super Admin') {
        items.push(
            { href: '/admin/dashboard', label: 'Super Admin Dashboard', icon: BarChartBig },
            { href: '/admin/companies', label: 'Brands', icon: Building },
            { href: '/admin/users', label: 'Users', icon: Users },
            { href: '/admin/programs', label: 'Programs', icon: Layers },
            { href: '/admin/customers', label: 'Customers', icon: CreditCard },
            { href: '/admin/settings', label: 'Settings', icon: Settings }
        );
    } else if (user.role === 'Admin' || user.role === 'Owner') {
        items.push(
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/admin/users', label: 'Manage Users', icon: Users },
            { href: `/admin/companies/${user.companyId}/locations`, label: 'Manage Locations', icon: MapPin, requiresCompanyId: true }
        );
    } else if (user.role === 'Manager') {
         items.push(
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/admin/users', label: 'Manage Users', icon: Users }
         );
    }
    
    // Common items for most logged-in users
    items.push(
        { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
        { href: '/badges', label: 'My Badges', icon: Award }
    );

    items.push({ href: '/site-help', label: 'Site Help', icon: HelpCircle });
    
    // Filter out items that require a companyId if the user doesn't have one
    return items.filter(item => {
        if (item.requiresCompanyId) {
            return !!user.companyId;
        }
        return true;
    });
}
