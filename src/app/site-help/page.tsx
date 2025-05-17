
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, BookOpen, Users, Building, ShoppingCart, Cog, DatabaseZap, LayoutDashboard, BarChartBig, Percent, UserPlus, Gift, TestTube2, MapPin, Settings as SettingsIcon, Award } from "lucide-react";
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
            <li>Navigate to <strong>Admin &gt; Brands</strong> from the main menu (via your user dropdown or direct link if you add one later).</li>
            <li>Use the <strong>Add New Brand</strong> button to create new client accounts. This involves setting brand details, max users, and optionally, their logo and a short description.</li>
            <li>From the brand list, you can <strong>Edit Brand & Settings</strong> to modify details, manage assigned courses (from the global library), update trial status, and adjust user limits.</li>
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
            <li>Go to <strong>Admin &gt; Users</strong> to view and manage users.</li>
            <li>You can add new users of any role (including other Super Admins, though this should be done with caution).</li>
            <li>Assign users to specific brands and locations.</li>
            <li>Activate or deactivate user accounts.</li>
            <li>Edit user details, including their name and role (except for other Super Admins).</li>
          </ul>
        </>
      ),
    },
    {
      title: "Course Library Management",
      icon: BookOpen,
      content: (
        <>
          <p>Manage the master library of courses, lessons, and quizzes. Access these via the <strong>Course Admin</strong> dropdown in the main navigation.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Courses:</strong> Create new courses, define titles, descriptions, pricing, difficulty levels, and duration. Assign lessons and quizzes to the curriculum from the "Manage Curriculum" page for each course.</li>
            <li><strong>Lessons:</strong> Build individual lesson content. You can add text, embed videos (YouTube, Vimeo, or direct URL), upload featured images, provide exercise file information, and toggle preview availability.</li>
            <li><strong>Quizzes:</strong> Create quizzes with titles. Then, manage their questions (multiple-choice or true/false) from the "Manage Questions" page for each quiz.</li>
            <li>These library items can then be assigned to specific brands, making them available to that brand's users.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Customer Onboarding",
      icon: UserPlus,
      content: (
        <>
          <p>Use the dedicated checkout pages under the <strong>New Customers</strong> dropdown in the main navigation to onboard new customers:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><Link href="/admin/checkout" className="text-primary hover:underline"><strong>Paid Checkout:</strong></Link> For new customers making a purchase. This flow collects brand and admin details, allows course selection, applies discounts, processes payment via Stripe, and optionally records revenue share details.</li>
            <li><Link href="/admin/free-trial-checkout" className="text-primary hover:underline"><strong>Free Trial Checkout:</strong></Link> To set up new customers with a trial period. Collects brand and admin details, allows course selection for the trial, and sets a trial duration.</li>
            <li><Link href="/admin/test-checkout" className="text-primary hover:underline"><strong>Test Checkout:</strong></Link> A dedicated page for testing the Stripe payment integration with a sample amount.</li>
          </ul>
        </>
      ),
    },
    {
      title: "System Settings & Data",
      icon: Cog,
      content: (
        <>
          <p>Configure system-wide settings and manage data integrity.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><Link href="/admin/settings" className="text-primary hover:underline"><strong>System Settings:</strong></Link> Configure SMTP mail server settings for application emails (currently focuses on Google OAuth 2.0 setup via environment variables).</li>
            <li><Link href="/admin/migrate-data" className="text-primary hover:underline"><strong>Data Migration:</strong></Link> Run scripts for data updates (e.g., adding `isDeleted: false` flags to older documents). This should be used with extreme caution and ideally only once after backing up data.</li>
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
            <li><strong>Key Metrics:</strong> View total users, courses, brands, and recent sales figures.</li>
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
      content: "Your dashboard provides a snapshot of your brand's learning activity, employee progress (overall completion, certificates), and active courses. Use it to monitor overall performance and identify areas needing attention. Access this via the 'Dashboard' link in your user menu or main navigation.",
    },
    {
      title: "Managing Brand Users",
      icon: Users,
      content: "Navigate to 'Manage Users' from your user menu or main navigation. Here you can add new employees (Staff, Managers), assign them to locations within your brand, edit their details (name, locations), and activate/deactivate their accounts. You cannot create users with roles equal to or higher than your own.",
    },
    {
      title: "Managing Brand Locations",
      icon: MapPin,
      content: "From the 'Manage Locations' link in your user menu (if you have brand context) or via 'Brands' > 'Manage Locations' if that path exists. You can add new physical or virtual locations for your brand. Users can then be assigned to these locations.",
    },
    {
      title: "Assigning Courses to Users",
      icon: BookOpen,
      content: "From the User Management page, select an employee and use the 'Manage Assigned Courses' option (from the actions dropdown). This allows you to give them access to specific courses that have been made available to your brand by a Super Admin.",
    },
  ],
  'Owner': [
    {
      title: "Owner Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard shows your brand's learning progress, active users, course completion rates, and issued certificates. Keep an eye on these metrics to ensure your team is on track. Access via 'Dashboard' in your user menu or main navigation.",
    },
    {
      title: "Managing Brand Users & Locations",
      icon: Users,
      content: "As an Owner, you can manage users (Managers, Staff) and locations for your brand. Access these through the 'Manage Users' and 'Manage Locations' sections in your user menu or main navigation. You can add/edit users and assign them to locations. You cannot create users with roles equal to or higher than your own.",
    },
    {
      title: "Course Assignment",
      icon: BookOpen,
      content: "Assign relevant courses to your employees via the 'Manage Assigned Courses' option on the User Management page. This helps equip them with necessary skills. Courses available for assignment are those enabled for your brand by a Super Admin.",
    },
  ],
  'Manager': [
    {
      title: "Manager Dashboard",
      icon: LayoutDashboard,
      content: "Your dashboard focuses on your team's progress within your assigned location(s). Track completion rates for assigned courses, view issued certificates, and identify team members who might need support. Access via 'Dashboard' in your user menu or main navigation.",
    },
    {
      title: "Managing Your Team (Staff)",
      icon: Users,
      content: "You can manage Staff users within your assigned locations. This includes adding new staff (they will be automatically assigned your locations), editing their details (name, location re-assignment within your accessible locations), and activating/deactivating their accounts. Navigate to 'Manage Users' from your user menu or main navigation.",
    },
    {
      title: "Assigning Courses to Staff",
      icon: BookOpen,
      content: "Ensure your staff have access to the right training by assigning them courses through the 'Manage Assigned Courses' option in the User Management section for each staff member. You can assign any course made available to your brand.",
    },
  ],
  'Staff': [
    {
      title: "Accessing My Learning",
      icon: BookOpen,
      content: "Navigate to 'My Learning' from your user menu or main navigation. This page lists all courses assigned to you. Click on a course to start or continue your learning journey.",
    },
    {
      title: "Taking Courses & Quizzes",
      icon: HelpCircle,
      content: "Inside a course, you'll find lessons and quizzes. Follow the curriculum, watch videos, read lesson content, and complete quizzes as required. Your progress (e.g., completed lessons/quizzes) is saved automatically. For quizzes, you typically need to achieve a passing score to proceed.",
    },
    {
      title: "Viewing My Badges",
      icon: Award,
      content: "Once you successfully complete a course (finish all required items, including passing quizzes), you'll earn a badge or certificate. You can view all your earned badges by navigating to 'My Badges' from your user menu. These serve as a record of your achievements.",
    },
    {
      title: "Updating My Account",
      icon: SettingsIcon,
      content: "You can update your profile information, such as your name and profile picture (if enabled), by going to 'My Account' from the user menu. You can also reset your password from this page.",
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
            <div className="container mx-auto py-12 md:py-16 lg:py-20">
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
        <div className="container mx-auto py-12 md:py-16 lg:py-20">
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
