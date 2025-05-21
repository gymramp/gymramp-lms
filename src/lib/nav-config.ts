
// src/lib/nav-config.ts
import type { User, UserRole, Company } from '@/types/user';
import {
    BarChartBig, Building, Layers, CreditCard, BookOpen, FileText,
    ListChecks, UserPlus, ShoppingCart, Gift, TestTube2, Percent,
    LayoutDashboard, Users, MapPin, Settings, Award, HelpCircle, LogOut, Package // Added Package
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCompanyById } from '@/lib/company-data'; // Corrected import path

export interface NavItemType {
  label: string;
  href?: string;
  icon?: LucideIcon;
  isDropdown?: boolean;
  subItems?: NavItemType[];
  requiresCompanyId?: boolean; 
  requiresCanManageCourses?: boolean; // New flag
}

export async function getNavigationStructure(user: User | null): Promise<NavItemType[]> {
  const baseItems: NavItemType[] = [];
  if (!user) return baseItems;

  let userCompany: Company | null = null;
  if (user.companyId) {
      try {
          userCompany = await getCompanyById(user.companyId);
      } catch (error) {
          console.error("Error fetching company details for nav config:", error);
      }
  }

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
    );
  } else if (user.role === 'Admin' || user.role === 'Owner') {
    roleSpecificItems.push(
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: `/admin/companies/${user.companyId}/locations`, label: 'Locations', icon: MapPin, requiresCompanyId: true },
      {
        label: 'Brand Content',
        isDropdown: true,
        icon: Package, // Using Package icon for Brand Content
        requiresCanManageCourses: true, // This dropdown requires the flag
        subItems: [
            { href: '/brand-admin/courses', label: "My Brand's Courses", icon: BookOpen },
            { href: '/brand-admin/lessons', label: "My Brand's Lessons", icon: FileText },
            // { href: '/brand-admin/quizzes', label: "My Brand's Quizzes", icon: ListChecks }, // Placeholder for quizzes
        ]
      },
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

  const filteredRoleSpecificItems = roleSpecificItems.filter(item => {
    if (item.requiresCompanyId && !user.companyId) {
      return false;
    }
    if (item.requiresCanManageCourses && !(userCompany?.canManageCourses === true)) {
        return false;
    }
    // Filter subItems as well
    if (item.subItems) {
        item.subItems = item.subItems.filter(subItem => {
             if (subItem.requiresCompanyId && !user.companyId) return false;
             if (subItem.requiresCanManageCourses && !(userCompany?.canManageCourses === true)) return false;
             return true;
        });
        // If all subItems are filtered out, don't show the parent dropdown if it's only purpose was the subItems
        if (item.isDropdown && item.subItems.length === 0 && item.requiresCanManageCourses) return false;
    }
    return true;
  });
  
  if (user.role !== 'Super Admin') { 
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
    
    items.push(
        { href: '/courses/my-courses', label: 'My Learning', icon: BookOpen },
        { href: '/badges', label: 'My Badges', icon: Award }
    );

    items.push({ href: '/site-help', label: 'Site Help', icon: HelpCircle });
    
    return items.filter(item => {
        if (item.requiresCompanyId) {
            return !!user.companyId;
        }
        return true;
    });
}
