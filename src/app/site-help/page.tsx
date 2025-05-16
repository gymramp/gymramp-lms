
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, BookOpen, Users, Building, ShoppingCart, Cog, DatabaseZap, LayoutDashboard, BarChartBig, Percent, UserPlus, Gift, TestTube2, MapPin, Settings, Award } from "lucide-react";
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
      title: "Managing Companies",
      icon: Building,
      content: (
        <>
          <p>As a Super Admin, you can create, edit, and manage all companies on the platform.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Navigate to <strong>Companies</strong> from the main menu.</li>
            <li>Use the <strong>Add New Company</strong> button to create new client accounts.</li>
            <li>Edit company details, assign courses, and manage user limits from the company's edit page.</li>
            <li>View the <Link href="/admin/revenue-share-report" className="text-primary hover:underline">Revenue Share Report</Link> for insights on partnerships.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Global User Management",
      icon: Users,
      content: (
        <>
          <p>You have full control over all user accounts.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Go to <strong>Users</strong> to view and manage users across all companies.</li>
            <li>You can add new users (including other Super Admins), change roles, assign to companies/locations, and activate/deactivate accounts.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Course Library Management",
      icon: BookOpen,
      content: (
        <>
          <p>Manage the master library of courses, lessons, and quizzes.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Courses:</strong> Create new courses, define modules, and set pricing/details.</li>
            <li><strong>Lessons:</strong> Build individual lesson content, add videos, and set preview availability.</li>
            <li><strong>Quizzes:</strong> Create quizzes and manage their questions.</li>
            <li>These library items can then be assigned to companies for their users.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Customer Onboarding",
      icon: UserPlus,
      content: (
        <>
          <p>Use the dedicated checkout pages to onboard new customers:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><Link href="/admin/checkout" className="text-primary hover:underline"><strong>Paid Checkout:</strong></Link> For new customers making a purchase. This flow includes payment processing.</li>
            <li><Link href="/admin/free-trial-checkout" className="text-primary hover:underline"><strong>Free Trial Checkout:</strong></Link> To set up new customers with a trial period.</li>
            <li><Link href="/admin/test-checkout" className="text-primary hover:underline"><strong>Test Checkout:</strong></Link> For testing Stripe payment integration.</li>
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
            <li><Link href="/admin/settings" className="text-primary hover:underline"><strong>System Settings:</strong></Link> Configure SMTP mail server settings.</li>
            <li><Link href="/admin/migrate-data" className="text-primary hover:underline"><strong>Data Migration:</strong></Link> Run scripts for data updates (e.g., adding `isDeleted` flags). Use with caution.</li>
          </ul>
        </>
      ),
    },
  ],
  'Admin': [
    {
      title: "Admin Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard provides a snapshot of your company's learning activity, employee progress, and course engagement. Use it to monitor overall performance and identify areas needing attention.",
    },
    {
      title: "Managing Company Users",
      icon: Users,
      content: "Navigate to 'Users' from the main menu. Here you can add new employees (Staff, Managers), assign them to locations, edit their details, and activate/deactivate their accounts within your company.",
    },
    {
      title: "Managing Company Locations",
      icon: MapPin,
      content: "From the 'Locations' link (often found via Company Management or a direct link if configured), you can add new physical or virtual locations for your company and assign users to them.",
    },
    {
      title: "Assigning Courses to Users",
      icon: BookOpen,
      content: "From the User Management page, you can select an employee and use the 'Manage Assigned Courses' option to give them access to specific courses that have been made available to your company.",
    },
  ],
  'Owner': [ // Owner might have similar permissions to Admin
    {
      title: "Owner Dashboard Overview",
      icon: LayoutDashboard,
      content: "Your dashboard shows your company's learning progress, active users, and course completion rates. Keep an eye on these metrics to ensure your team is on track.",
    },
    {
      title: "Managing Company Users & Locations",
      icon: Users,
      content: "As an Owner, you can add/edit users (Managers, Staff) and locations for your company. Access these through the 'Users' and 'Locations' sections in your navigation.",
    },
    {
      title: "Course Assignment",
      icon: BookOpen,
      content: "Assign relevant courses to your employees via the 'Manage Assigned Courses' option on the User Management page to equip them with necessary skills.",
    },
  ],
  'Manager': [
    {
      title: "Manager Dashboard",
      icon: LayoutDashboard,
      content: "Your dashboard focuses on your team's progress. Track completion rates for assigned courses and identify team members who might need support.",
    },
    {
      title: "Managing Your Team (Staff)",
      icon: Users,
      content: "You can manage Staff users within your assigned locations. This includes adding new staff, editing their details (if permitted), and assigning them to courses. Navigate to 'Users' to manage your team.",
    },
    {
      title: "Assigning Courses to Staff",
      icon: BookOpen,
      content: "Ensure your staff have access to the right training by assigning them courses through the 'Manage Assigned Courses' option in the User Management section for each staff member.",
    },
  ],
  'Staff': [
    {
      title: "Accessing My Learning",
      icon: BookOpen,
      content: "Navigate to 'My Learning' from your user menu to see all courses assigned to you. Click on a course to start or continue learning.",
    },
    {
      title: "Taking Courses & Quizzes",
      icon: HelpCircle,
      content: "Follow the course curriculum, watch videos, read lesson content, and complete quizzes. Your progress is saved automatically.",
    },
    {
      title: "Viewing My Badges",
      icon: Award,
      content: "Once you complete a course, you'll earn a badge (certificate). You can view all your earned badges by navigating to 'My Badges' from your user menu.",
    },
    {
      title: "Updating My Account",
      icon: Settings,
      content: "You can update your profile information, such as your name and profile picture, by going to 'My Account' from the user menu.",
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
                // Optionally redirect if no user, or show generic help
                // router.push('/login'); 
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
