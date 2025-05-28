
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, BookOpen, Users, Building, ShoppingCart, Cog, DatabaseZap, LayoutDashboard, BarChartBig, Percent, UserPlus, Gift, TestTube2, MapPin, Settings as SettingsIcon, Award, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, UserRole } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface HelpTopic {
  title: string;
  icon?: React.ElementType;
  content: React.ReactNode;
}

const helpData: Record<UserRole, HelpTopic[]> = {
  'Super Admin': [
    {
      title: "Managing Brands",
      icon: Building,
      content: (
        <>
          <p>As a Super Admin, you can create, edit, and manage all brands on the platform.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Navigate to <strong>Admin &gt; Brands</strong> from the main sidebar.</li>
            <li>Use the <strong>Add New Brand</strong> button to create new client accounts (Parent Brands). This involves setting brand details, max users, and optionally, their logo, subdomain, custom domain, and white-label settings.</li>
            <li>From the brand list, you can <strong>Edit Brand & Settings</strong> to modify details, manage assigned Programs, enable/disable white-labeling, set custom colors, enable course management for the brand, update trial status, and adjust user limits.</li>
            <li>You can also manage specific <strong>Locations</strong> and <strong>Users</strong> for each brand from the brand list actions.</li>
            <li>View the <Link href="/admin/revenue-share-report" className="text-primary hover:underline">Revenue Share Report</Link> for insights on checkouts that included revenue share agreements.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Global User Management",
      icon: Users,
      content: (
        <>
          <p>You have full control over all user accounts across the platform.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Go to <strong>Admin &gt; Users</strong> to view and manage users. Use the Brand and Location filters to narrow down the user list.</li>
            <li>You can add new users of any role. When adding a user, you must assign them to a Brand and optionally to specific locations within that Brand.</li>
            <li>Activate or deactivate user accounts. Deactivated users cannot log in.</li>
            <li>Edit user details, including their name, role (you can change any user's role), assigned Brand, and assigned locations.</li>
            <li>Assign specific global library courses to individual users if needed, though primary course access comes from Programs assigned to their Brand.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Program & Course Library Management",
      icon: Layers,
      content: (
        <>
          <p>Manage the master library of Programs, Courses, Lessons, and Quizzes. Access these via the <strong>Admin</strong> section in the main sidebar.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Programs:</strong> Create and manage Programs, which are collections of courses. Define a Program's title, description, base price, and optional subscription prices (including Stripe Price IDs for integration). Then, assign specific global library Courses to each Program.</li>
            <li><strong>Courses (Global Library):</strong> Create new global courses, define titles, descriptions, difficulty levels, duration, and select a certificate template. Assign lessons and quizzes to the curriculum from the "Manage Curriculum" page for each course.</li>
            <li><strong>Lessons (Global Library):</strong> Build individual lesson content. You can add text, embed videos, upload featured images, provide exercise file information, and toggle preview availability.</li>
            <li><strong>Quizzes (Global Library):</strong> Create quizzes with titles. Then, manage their questions (multiple-choice, true/false, multiple-select) from the "Manage Questions" page for each quiz.</li>
          </ul>
          <p className="mt-2">Programs are then assigned to Brands to grant access to the courses within them.</p>
        </>
      ),
    },
    {
      title: "Customer Onboarding",
      icon: UserPlus,
      content: (
        <>
          <p>Use the dedicated checkout pages under the <strong>New Customers</strong> dropdown in the main sidebar to onboard new customers:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><Link href="/admin/checkout" className="text-primary hover:underline"><strong>Paid Checkout:</strong></Link> For new customers purchasing a Program. This flow collects Brand and admin details, allows Program selection, applies discounts, processes payment for the Program's base price via Stripe, and optionally records revenue share details.</li>
            <li><Link href="/admin/free-trial-checkout" className="text-primary hover:underline"><strong>Free Trial Checkout:</strong></Link> To set up new customers with a trial period for a selected Program. Collects Brand and admin details and sets a trial duration.</li>
          </ul>
        </>
      ),
    },
    {
      title: "System Settings",
      icon: Cog,
      content: (
        <>
          <p>Configure system-wide settings.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><Link href="/admin/settings" className="text-primary hover:underline"><strong>System Settings:</strong></Link> Configure SMTP mail server settings (primarily Google OAuth 2.0 via environment variables) for application emails like new user welcomes.</li>
          </ul>
        </>
      ),
    },
     {
      title: "Understanding the Dashboard",
      icon: BarChartBig,
      content: (
        <>
          <p>The Super Admin Dashboard provides a high-level overview of the platform.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Key Metrics:</strong> View total users, courses, brands, and recent sales figures (from Program base price sales).</li>
            <li><strong>Quick Actions:</strong> Easily navigate to major administrative sections.</li>
            <li><strong>Recent Platform Additions:</strong> See the latest brands and users added to the system.</li>
          </ul>
        </>
      ),
    },
  ],
  'Admin': [
    {
      title: "Admin Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard provides a snapshot of your Brand's learning activity, employee progress, and active courses. Use the Brand and Location filters to scope your view if you manage Child Brands or multiple locations. Access this via the 'Dashboard' link in your sidebar.",
    },
    {
      title: "Managing Your Brand's Users & Child Brands",
      icon: Building,
      content: (
        <>
         <p>Navigate to 'Brands' from your sidebar to manage your primary Brand and any Child Brands you create. You can edit their settings (like name, logo, course management ability for child brands you create) and manage their locations and users directly from the brand list actions.</p>
         <p className="mt-2">Go to 'Users' from your sidebar to manage employees. You can add new employees (Staff, Managers), assign them to specific Brands (your own or child brands) and Locations, edit their details, and manage their account status. You cannot create users with roles equal to or higher than your own.</p>
        </>
      )
    },
    {
      title: "Managing Locations for Your Brands",
      icon: MapPin,
      content: "From the 'Brands' list, use the 'Manage Locations' action for your primary Brand or a Child Brand. You can add new physical or virtual locations. Users can then be assigned to these locations. The main 'Locations' link in the sidebar will take you to your primary brand's locations, where you can then use the filter to switch to child brands.",
    },
    {
      title: "Brand Course Content Management",
      icon: Package,
      content: (
        <>
        <p>If course management is enabled for your Brand (or a Child Brand you manage), you will see a 'Brand Content' section in your sidebar. From here, you can:</p>
         <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>My Brand's Courses:</strong> Create new courses specific to your brand, define titles, descriptions, levels, and manage their curriculum by adding your brand-specific lessons and quizzes.</li>
            <li><strong>My Brand's Lessons:</strong> Create and manage lessons unique to your brand's training needs.</li>
            <li><strong>My Brand's Quizzes:</strong> Develop quizzes and manage their questions for your brand-specific courses.</li>
          </ul>
          <p className="mt-2">These brand-specific courses can then be assigned to users within your brand or its child brands.</p>
        </>
      )
    },
    {
      title: "Assigning Courses to Users",
      icon: BookOpen,
      content: "From the User Management page (accessed via 'Users' in sidebar), select an employee and use the 'Manage Assigned Courses' option (from the actions dropdown). This allows you to assign courses from the global library (made available through Programs assigned to your Brand by a Super Admin) AND any brand-specific courses your Brand has created.",
    },
  ],
  'Owner': [ // Owner has similar permissions to Admin
    {
      title: "Owner Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard shows your Brand's learning progress, active users, course completion rates, and issued certificates. Use the Brand and Location filters to scope your view if you manage Child Brands or multiple locations. Access via 'Dashboard' in your sidebar.",
    },
    {
      title: "Managing Your Brand's Users & Child Brands",
      icon: Building,
      content: (
         <>
         <p>Navigate to 'Brands' from your sidebar to manage your primary Brand and any Child Brands you create. You can edit their settings and manage their locations and users directly from the brand list actions.</p>
         <p className="mt-2">Go to 'Users' from your sidebar to manage employees. You can add new employees (Staff, Managers), assign them to Brands (your own or child brands) and Locations, edit their details, and manage their account status. You cannot create users with roles equal to or higher than your own.</p>
        </>
      ),
    },
    {
      title: "Managing Locations for Your Brands",
      icon: MapPin,
      content: "From the 'Brands' list, use the 'Manage Locations' action for your primary Brand or a Child Brand. You can add new locations. The main 'Locations' link in the sidebar will take you to your primary brand's locations, where you can then use the filter to switch to child brands.",
    },
     {
      title: "Brand Course Content Management",
      icon: Package,
      content: (
        <>
        <p>If course management is enabled for your Brand, you will see a 'Brand Content' section in your sidebar. From here, you can manage courses, lessons, and quizzes specific to your brand, similar to an Admin.</p>
         <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>My Brand's Courses:</strong> Create and manage courses.</li>
            <li><strong>My Brand's Lessons:</strong> Create and manage lessons.</li>
            <li><strong>My Brand's Quizzes:</strong> Create and manage quizzes.</li>
          </ul>
        </>
      )
    },
    {
      title: "Assigning Courses to Users",
      icon: BookOpen,
      content: "Assign relevant courses to your employees via the 'Manage Assigned Courses' option on the User Management page. You can assign global courses (from Programs assigned to your Brand) and any brand-specific courses your Brand has created.",
    },
  ],
  'Manager': [
    {
      title: "Manager Dashboard",
      icon: LayoutDashboard,
      content: "Your dashboard focuses on your team's progress within your assigned location(s) and brand. Track completion rates for assigned courses and view issued certificates. Use the Location filter to narrow your view if you manage multiple locations. Access via 'Dashboard' in your sidebar.",
    },
    {
      title: "Managing Your Team (Staff & Other Managers)",
      icon: Users,
      content: "You can manage Staff and other Manager users within your brand and assigned locations. This includes adding new staff/managers (they will be automatically assigned your locations if applicable), editing their details, and managing their account status. Navigate to 'Users' from your sidebar.",
    },
    {
      title: "Assigning Courses to Your Team",
      icon: BookOpen,
      content: "Ensure your team has access to the right training by assigning them courses through the 'Manage Assigned Courses' option in the User Management section for each team member. You can assign any course made available to your brand (global or brand-specific).",
    },
  ],
  'Staff': [
    {
      title: "Accessing My Learning",
      icon: BookOpen,
      content: "Navigate to 'My Learning' from your sidebar. This page lists all courses assigned to you. Click on a course to start or continue your learning journey.",
    },
    {
      title: "Taking Courses & Quizzes",
      icon: HelpCircle,
      content: "Inside a course, you'll find lessons and quizzes. Follow the curriculum, watch videos, read lesson content, and complete quizzes as required. Your progress is saved automatically. For quizzes, you typically need to achieve a passing score to proceed.",
    },
    {
      title: "Viewing My Certificates",
      icon: Award,
      content: "Once you successfully complete a course, you'll earn a certificate. You can view all your earned certificates by navigating to 'My Certificates' from your sidebar or user dropdown menu. These serve as a record of your achievements and can usually be printed.",
    },
    {
      title: "Updating My Account",
      icon: SettingsIcon,
      content: "You can update your profile information, such as your name and profile picture (if enabled), by going to 'My Account' from the user dropdown menu. You can also reset your password from this page.",
    }
  ],
};

export default function SiteHelpPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                try {
                    const userDetails = await getUserByEmail(firebaseUser.email);
                    setCurrentUser(userDetails);
                } catch (error) {
                    console.error("Error fetching user details:", error);
                    toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [toast, router]);

    const relevantHelpTopics = currentUser?.role ? helpData[currentUser.role] : [];

    if (isLoading) {
        return (
            <div className="container mx-auto">
                <div className="mb-8 text-center">
                    <Skeleton className="h-12 w-1/3 mx-auto" />
                    <Skeleton className="h-6 w-1/2 mx-auto mt-4" />
                </div>
                <div className="space-y-4 max-w-3xl mx-auto">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                            <CardContent><Skeleton className="h-16 w-full" /></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto">
            <div className="mb-12 text-center">
                <HelpCircle className="h-16 w-16 mx-auto text-primary mb-4" />
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary">
                    Site Help & Guides
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-muted-foreground md:text-xl">
                    Find answers and guidance for using GYMRAMP based on your role.
                </p>
            </div>

            {currentUser && relevantHelpTopics.length > 0 ? (
                <Card className="max-w-3xl mx-auto shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl">Help for {currentUser.role}s</CardTitle>
                        <CardDescription>Expand the topics below to learn more about your available features.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" className="w-full">
                            {relevantHelpTopics.map((topic, index) => (
                                <AccordionItem value={`item-${index}`} key={topic.title}>
                                    <AccordionTrigger className="text-lg hover:no-underline">
                                        <div className="flex items-center gap-2">
                                            {topic.icon && <topic.icon className="h-5 w-5 text-primary" />}
                                            {topic.title}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none pt-2 text-muted-foreground">
                                        {topic.content}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            ) : (
                <div className="text-center py-16">
                    <HelpCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-foreground">Help Information Not Available</p>
                    <p className="text-muted-foreground mt-2">
                        {currentUser ? `No specific help topics found for the ${currentUser.role} role.` : "Please log in to view role-specific help."}
                    </p>
                    {!currentUser && (
                        <Button variant="link" asChild className="mt-4">
                            <Link href="/">Go to Login</Link>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

    