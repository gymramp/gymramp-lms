
import type { UserRole } from '@/types/user';
import type { LucideIcon } from 'lucide-react';
import {
    BarChartBig, Building, Layers, CreditCard, BookOpen, FileText,
    ListChecks, UserPlus, ShoppingCart, Gift,
    TestTube2, Percent, HelpCircle, LayoutDashboard, Users, MapPin, Settings, Award, Cog, Package, Handshake, KeyRound
} from 'lucide-react';

export interface HelpTopic {
  title: string;
  icon?: LucideIcon;
  content: string; // Content is now a Markdown string
}

export const helpData: Record<UserRole, HelpTopic[]> = {
  'Super Admin': [
    {
      title: "Managing Brands",
      icon: Building,
      content: `
As a Super Admin, you can create, edit, and manage all brands on the platform.

*   Navigate to [**Admin > Brands**](/admin/companies) from the main sidebar.
*   Use the **Add New Brand** button to create new client accounts (Parent Brands).
*   From the brand list, you can **Edit Brand & Settings** to modify details, manage assigned Programs, and enable/disable features.
*   You can also manage specific **Locations** and **Users** for each brand from the brand list actions.
*   View the [**Revenue Share Report**](/admin/revenue-share-report) for insights on checkouts with revenue share agreements.
      `,
    },
    {
      title: "Global User Management",
      icon: Users,
      content: `
You have full control over all user accounts across the platform.

*   Go to [**Admin > Users**](/admin/users) to view and manage users. Use the Brand and Location filters to narrow down the user list.
*   You can add new users of any role. When adding a user, you must assign them to a Brand and optionally to specific locations.
*   Activate or deactivate user accounts. Deactivated users cannot log in.
*   Edit user details, including their name, role, assigned Brand, and assigned locations.
      `,
    },
    {
      title: "Program & Course Library Management",
      icon: Layers,
      content: `
Manage the master library of Programs, Courses, Lessons, and Quizzes. Access these via the **Admin** section in the main sidebar.

*   **Programs:** Create and manage Programs, which are collections of courses. Define pricing and assign courses to each Program. You can find this under [**Admin > Programs**](/admin/programs).
*   **Courses:** Create new global courses, define details, and build the curriculum by adding lessons and quizzes. Find this at [**Admin > Course Admin > Courses**](/admin/courses).
*   **Lessons:** Build individual lesson content with text, videos, and images. Find this at [**Admin > Course Admin > Lessons**](/admin/lessons).
*   **Quizzes:** Create quizzes and manage their questions. Find this at [**Admin > Course Admin > Quizzes**](/admin/quizzes).

Programs are then assigned to Brands to grant them access to the courses within.
      `,
    },
    {
      title: "Customer Onboarding",
      icon: UserPlus,
      content: `
Use the dedicated checkout pages under the **New Customers** dropdown to onboard new customers:

*   [**Paid Checkout**](/admin/checkout): For new customers purchasing a Program. This flow collects Brand and admin details, processes payment, and optionally records revenue share details.
*   [**Free Trial Checkout**](/admin/free-trial-checkout): To set up new customers with a trial period for a selected Program.
      `,
    },
    {
      title: "System Settings",
      icon: Cog,
      content: `
Configure system-wide settings.

*   [**System Settings**](/admin/settings): Configure email sending (primarily Google OAuth 2.0 via environment variables) for application emails like new user welcomes.
      `,
    },
    {
      title: "Resetting User Passwords",
      icon: KeyRound,
      content: `
Users can reset their own password by clicking the **'Forgot password?'** link on the login screen. This will send a reset link to their email address.

As a Super Admin, you can also force a password reset by setting a new temporary password for any non-Super Admin user. To do this, navigate to the [**Users**](/admin/users) page, click 'Edit' for the desired user, and enter a new password in the 'Set New Temporary Password' field. The user will be required to change this temporary password on their next login.
      `,
    }
  ],
  'Admin': [
    {
      title: "Admin Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard provides a snapshot of your Brand's learning activity, employee progress, and active courses. Use the Brand and Location filters to scope your view if you manage Child Brands or multiple locations. Access this via the [**Dashboard**](/dashboard) link in your sidebar.",
    },
    {
      title: "Managing Your Brand's Users & Child Brands",
      icon: Building,
      content: "Navigate to [**Brands**](/admin/companies) from your sidebar to manage your primary Brand and any Child Brands you create. Go to [**Users**](/admin/users) to add new employees (Staff, Managers), assign them to Brands and Locations, and manage their account status. You cannot create users with roles equal to or higher than your own.",
    },
    {
      title: "Brand Course Content Management",
      icon: Package,
      content: `
If course management is enabled for your Brand, you will see a **Brand Content** section in your sidebar. From here, you can:

*   [**My Brand's Courses**](/brand-admin/courses): Create courses specific to your brand.
*   [**My Brand's Lessons**](/brand-admin/lessons): Create and manage lessons unique to your brand.
*   [**My Brand's Quizzes**](/brand-admin/quizzes): Develop quizzes and manage their questions.
      `,
    },
    {
      title: "User Password Resets",
      icon: KeyRound,
      content: `
If one of your users forgets their password, they can reset it themselves by using the **'Forgot password?'** link on the login screen. This will send a secure password reset link to their registered email address.

Currently, only Super Admins can manually set temporary passwords for users.
      `,
    }
  ],
  'Owner': [
    {
      title: "Owner Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard shows your Brand's learning progress, active users, course completion rates, and issued certificates. Use the Brand and Location filters to scope your view if you manage Child Brands or multiple locations. Access via [**Dashboard**](/dashboard) in your sidebar.",
    },
    {
      title: "Managing Your Brand's Users & Child Brands",
      icon: Building,
      content: "Navigate to [**Brands**](/admin/companies) from your sidebar to manage your primary Brand and any Child Brands you create. Go to [**Users**](/admin/users) to add new employees (Staff, Managers), assign them to Brands and Locations, and manage their account status. You cannot create users with roles equal to or higher than your own.",
    },
    {
      title: "Brand Course Content Management",
      icon: Package,
      content: `
If course management is enabled for your Brand, you will see a **Brand Content** section in your sidebar. From here, you can manage courses, lessons, and quizzes specific to your brand, similar to an Admin.
      `,
    },
    {
      title: "User Password Resets",
      icon: KeyRound,
      content: `
If one of your users forgets their password, they can reset it themselves by using the **'Forgot password?'** link on the login screen. This will send a secure password reset link to their registered email address.

Currently, only Super Admins can manually set temporary passwords for users.
      `,
    }
  ],
  'Manager': [
    {
      title: "Manager Dashboard",
      icon: LayoutDashboard,
      content: "Your dashboard focuses on your team's progress within your assigned location(s) and brand. Track completion rates for assigned courses and view issued certificates. Access via [**Dashboard**](/dashboard) in your sidebar.",
    },
    {
      title: "Managing Your Team",
      icon: Users,
      content: "You can manage Staff and other Manager users within your brand and assigned locations. This includes adding new staff/managers, editing their details, and managing their account status. Navigate to [**Users**](/admin/users) from your sidebar.",
    },
    {
      title: "User Password Resets",
      icon: KeyRound,
      content: `
If one of your users forgets their password, they can reset it themselves by using the **'Forgot password?'** link on the login screen. This will send a secure password reset link to their registered email address.

Currently, only Super Admins can manually set temporary passwords for users.
      `,
    }
  ],
  'Staff': [
    {
      title: "Accessing My Learning",
      icon: BookOpen,
      content: "Navigate to [**My Learning**](/courses/my-courses) from your sidebar. This page lists all courses assigned to you. Click on a course to start or continue your learning journey.",
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Once you successfully complete a course, you'll earn a certificate. You can view all your earned certificates by navigating to [**My Certificates**](/certificates) from your sidebar or user dropdown menu.",
    },
    {
      title: "Updating My Account",
      icon: Settings,
      content: "You can update your profile information, such as your name and profile picture (if enabled), by going to [**My Account**](/account) from the user dropdown menu. You can also reset your password from this page.",
    },
    {
      title: "How to Reset Your Password",
      icon: KeyRound,
      content: `
If you forget your password, you can easily reset it. Go to the main login page and click the **'Forgot password?'** link located under the password field.

Enter your email address, and you will receive an email with instructions on how to set a new password.
      `,
    }
  ],
};
