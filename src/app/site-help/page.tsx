
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from '@/types/user';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { helpData, HelpTopic } from '@/lib/help-data'; // Import from new source
import ReactMarkdown from 'react-markdown'; // Import Markdown renderer

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
                                        <ReactMarkdown
                                            components={{
                                                a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />,
                                                strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                                            }}
                                        >
                                            {topic.content}
                                        </ReactMarkdown>
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
                            <a href="/">Go to Login</a>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
