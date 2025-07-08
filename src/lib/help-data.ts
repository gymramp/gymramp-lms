
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
As a Super Admin, you can create, edit, and manage all brands (companies) on the platform.

*   Navigate to [**Admin > Brands**](/admin/companies) from the main sidebar.
*   Use the **Add New Brand** button to create new client accounts. These are considered "Parent Brands".
*   From the brand list, you can **Edit Brand & Settings** to modify details like name, logo, user limits, and trial status. This is also where you manage which Programs are assigned to a brand.
*   You can also manage specific **Locations** and **Users** for each brand directly from the brand list actions.
      `,
    },
    {
        title: "Partners & Revenue Share",
        icon: Handshake,
        content: `
You can manage referral partners and track revenue share from sales.

*   **Manage Partners:** Go to [**Admin > Partners**](/admin/partners) to create new partners, define their revenue share percentage, and get their unique signup link.
*   **Revenue Share Report:** Navigate to [**Admin > Rev Share Report**](/admin/revenue-share-report) to view a detailed breakdown of all sales that included a revenue share agreement. You can filter this report by date and search for specific partners or brands.
        `
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

*   [**Paid Checkout**](/admin/checkout): For new customers purchasing a Program. This flow collects Brand and admin details, processes payment via Stripe, and optionally records revenue share details.
*   [**Free Trial Checkout**](/admin/free-trial-checkout): To set up new customers with a trial period for a selected Program.
      `,
    },
    {
      title: "System Settings",
      icon: Cog,
      content: `
Configure system-wide settings.

*   [**System Settings**](/admin/settings): Configure email sending (primarily Google OAuth 2.0 via environment variables) for application emails like new user welcomes. You can also send test emails from this page to verify your configuration.
      `,
    },
    {
      title: "Resetting User Passwords",
      icon: KeyRound,
      content: `
Users can reset their own password by clicking the **'Forgot password?'** link on the login screen. This will send a reset link to their email address.

As a Super Admin, you can also force a password reset by setting a new temporary password for any non-Super Admin user. To do this, navigate to the [**Users**](/admin/users) page, click 'Edit' for the desired user, and enter a new password in the 'Set New Temporary Password' field. The user will be required to change this temporary password on their next login.
      `,
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Even Super Admins can earn certificates! If you complete any courses, you can view your certificates by navigating to [**My Certificates**](/certificates) from the user dropdown menu in the sidebar.",
    }
  ],
  'Admin': [
    {
      title: "Admin Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard provides a snapshot of your Brand's learning activity, employee progress, and active courses. Use the Brand and Location filters to scope your view if you manage Child Brands or multiple locations. Access this via the [**Dashboard**](/dashboard) link in your sidebar.",
    },
    {
      title: "Managing Your Brands & Locations",
      icon: Building,
      content: "Navigate to [**Brands**](/admin/companies) from your sidebar to manage your primary Brand and any Child Brands you create. From the Brand list, you can edit details and manage a brand's specific **Locations**.",
    },
    {
      title: "Managing Your Users",
      icon: Users,
      content: "Go to [**Dashboard**](/dashboard) to see your user list. From there you can add new employees (Staff, Managers), edit their details, assign them to locations, and manage their account status. You cannot create users with a role equal to or higher than your own."
    },
    {
      title: "Brand Course Content Management",
      icon: Package,
      content: `
If course management is enabled for your Brand, you will see a **My Content** section in your sidebar. This allows you to create courses, lessons, and quizzes that are exclusive to your organization.

*   [**My Courses**](/brand-admin/courses): Create courses specific to your brand.
*   [**My Lessons**](/brand-admin/lessons): Create and manage lessons unique to your brand.
*   [**My Quizzes**](/brand-admin/quizzes): Develop quizzes and manage their questions.
      `,
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Once you successfully complete a course, you'll earn a certificate. You can view all your earned certificates by navigating to [**My Certificates**](/certificates) from your sidebar or user dropdown menu.",
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
      title: "Managing Your Brands & Locations",
      icon: Building,
      content: "Navigate to [**Brands**](/admin/companies) from your sidebar to manage your primary Brand and any Child Brands you create. From the Brand list, you can edit details and manage a brand's specific **Locations**.",
    },
    {
      title: "Managing Your Users",
      icon: Users,
      content: "Go to [**Dashboard**](/dashboard) to see your user list. From there you can add new employees (Staff, Managers), edit their details, assign them to locations, and manage their account status. You cannot create users with a role equal to or higher than your own."
    },
    {
      title: "Brand Course Content Management",
      icon: Package,
      content: `
If course management is enabled for your Brand, you will see a **My Content** section in your sidebar. This allows you to create courses, lessons, and quizzes that are exclusive to your organization.

*   [**My Courses**](/brand-admin/courses): Create courses specific to your brand.
*   [**My Lessons**](/brand-admin/lessons): Create and manage lessons unique to your brand.
*   [**My Quizzes**](/brand-admin/quizzes): Develop quizzes and manage their questions.
      `,
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Once you successfully complete a course, you'll earn a certificate. You can view all your earned certificates by navigating to [**My Certificates**](/certificates) from your sidebar or user dropdown menu.",
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
      content: "You can manage Staff and other Manager users within your brand and specifically within the locations you are assigned to. From the [**Dashboard**](/dashboard), you can add new staff/managers, edit their details, and manage their account status.",
    },
    {
      title: "Viewing My Learning & Certificates",
      icon: Award,
      content: "You can take courses just like your staff. Go to [**My Learning**](/courses/my-courses) to see your assigned courses. When you complete a course, your certificate will appear in [**My Certificates**](/certificates).",
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
      content: "Navigate to [**My Learning**](/courses/my-courses) from your sidebar. This page lists all courses assigned to you. Click on a course to start or continue your learning journey. Your progress is saved automatically.",
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Once you successfully complete a course and pass all required quizzes, you'll earn a certificate. You can view all your earned certificates by navigating to [**My Certificates**](/certificates) from the user dropdown menu in the sidebar.",
    },
    {
      title: "Updating My Account",
      icon: Settings,
      content: "You can update your profile information, such as your name and profile picture, by going to [**My Account**](/account) from the user dropdown menu. You can also request a password reset from this page.",
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
