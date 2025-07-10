// src/lib/nav-config.ts
import type { User, UserRole, Company } from '@/types/user';
import {
    BarChartBig, Building, Layers, CreditCard, BookOpen, FileText,
    ListChecks, UserPlus, ShoppingCart, Gift,
    TestTube2, Percent, HelpCircle, LayoutDashboard, Users, MapPin, Settings, Award, Cog, Package, Handshake
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCompanyById } from '@/lib/company-data';

export interface NavItemType {
  label: string;
  href?: string;
  icon?: LucideIcon;
  isDropdown?: boolean;
  subItems?: NavItemType[];
  requiresCompanyId?: boolean;
  requiresCanManageCourses?: boolean;
}

export async function getNavigationStructure(user: User | null): Promise<NavItemType[]> {
  const baseItems: NavItemType[] = [];
  if (!user) return baseItems; // No nav items if no user

  let userCompanyDetails: Company | null = null;
  if (user.companyId) {
      try {
          userCompanyDetails = await getCompanyById(user.companyId);
      } catch (error) {
          console.error("[nav-config] Error fetching company details for nav:", error);
      }
  }

  const roleSpecificItems: NavItemType[] = [];

  if (user.role === 'Super Admin') {
    roleSpecificItems.push(
      { href: '/admin/dashboard', label: 'Dashboard', icon: BarChartBig },
      { href: '/admin/companies', label: 'Brands', icon: Building },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/partners', label: 'Partners', icon: Handshake },
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
          // { href: '/admin/test-checkout', label: 'Test Checkout', icon: TestTube2 }, // Removed Test Checkout
        ],
      },
      { href: '/admin/revenue-share-report', label: 'Rev Share Report', icon: Percent }
    );
  } else if (user.role === 'Admin' || user.role === 'Owner') {
    roleSpecificItems.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/companies', label: 'Brands', icon: Building, requiresCompanyId: true },
      { href: `/admin/companies/${user.companyId}/locations`, label: 'Locations', icon: MapPin, requiresCompanyId: true },
      {
        label: 'My Content',
        isDropdown: true,
        icon: Package,
        requiresCanManageCourses: true,
        subItems: [
            { href: '/brand-admin/courses', label: "My Courses", icon: BookOpen },
            { href: '/brand-admin/lessons', label: "My Lessons", icon: FileText },
            { href: '/brand-admin/quizzes', label: "My Quizzes", icon: ListChecks },
        ]
      },
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
      { href: '/certificates', label: 'My Certificates', icon: Award },
    );
  } else if (user.role === 'Manager') {
    roleSpecificItems.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users, requiresCompanyId: true },
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
      { href: '/certificates', label: 'My Certificates', icon: Award },
    );
  } else if (user.role === 'Staff') {
    roleSpecificItems.push(
      { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
      { href: '/certificates', label: 'My Certificates', icon: Award },
    );
  }

  const filteredRoleSpecificItems = roleSpecificItems.filter(item => {
    if (item.requiresCompanyId && !user.companyId) {
      return false;
    }
    if (item.requiresCanManageCourses && !(userCompanyDetails?.canManageCourses === true)) {
        return false;
    }
    if (item.subItems) {
        item.subItems = item.subItems.filter(subItem => {
             if (subItem.requiresCompanyId && !user.companyId) return false;
             if (subItem.requiresCanManageCourses && !(userCompanyDetails?.canManageCourses === true)) return false;
             return true;
        });
        // Hide dropdown if all its sub-items are filtered out due to permissions
        if (item.isDropdown && item.subItems.length === 0 && (item.requiresCanManageCourses || item.requiresCompanyId)) return false;
    }
    return true;
  });

  return [...baseItems, ...filteredRoleSpecificItems];
}


export function getUserDropdownItems(user: User | null): NavItemType[] {
    if (!user) return [];
    const items: NavItemType[] = [
        { href: '/account', label: 'My Account', icon: Settings },
    ];

    if (user.role === 'Super Admin') {
        items.push(
            { href: '/admin/settings', label: 'Settings', icon: Cog }
        );
    }
    items.push({ href: '/certificates', label: 'My Certificates', icon: Award });
    items.push({ href: '/site-help', label: 'Site Help', icon: HelpCircle });

    return items;
}

export async function getQuickAddItems(user: User | null): Promise<NavItemType[]> {
  if (!user) return [];

  const items: NavItemType[] = [];

  // Super Admin can always add users and brands
  if (user.role === 'Super Admin') {
    items.push({ href: '/admin/users/new', label: 'New User', icon: UserPlus });
    items.push({ href: '/admin/companies/new', label: 'New Brand', icon: Building });
  } 
  // Admin/Owner/Manager can add users
  else if (user.role === 'Admin' || user.role === 'Owner' || user.role === 'Manager') {
    items.push({ href: '/admin/users/new', label: 'New User', icon: UserPlus });
  }

  // Admin/Owner can add child brands
  if (user.role === 'Admin' || user.role === 'Owner') {
    items.push({ href: '/admin/companies/new', label: 'New Brand', icon: Building });
  }

  // Check for brand-specific content creation
  if (user.companyId) {
    const company = await getCompanyById(user.companyId);
    if (company?.canManageCourses) {
      if (items.length > 0) { // Add a separator if other items exist
        items.push({ label: 'Separator' }); // This will be handled as a separator in the UI
      }
      items.push({ href: '/brand-admin/courses', label: 'New Course', icon: BookOpen });
      items.push({ href: '/brand-admin/lessons', label: 'New Lesson', icon: FileText });
      items.push({ href: '/brand-admin/quizzes', label: 'New Quiz', icon: ListChecks });
    }
  }

  return items;
}
