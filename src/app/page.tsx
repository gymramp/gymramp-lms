
'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import Image from 'next/image';
import { useState, useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { getCompanyById, getCompanyBySubdomainSlug } from '@/lib/company-data';
import { getUserByEmail } from '@/lib/user-data';
import { Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { Company } from '@/types/user';

// Interface for conceptual brand props
interface LoginPageProps {
  initialBrandName?: string | null;
  initialBrandLogoUrl?: string | null;
}

// Main component logic
function LoginPageContent({ initialBrandName, initialBrandLogoUrl }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [displayBrandName, setDisplayBrandName] = useState(initialBrandName || "Gymramp");
  const [displayBrandLogoUrl, setDisplayBrandLogoUrl] = useState(initialBrandLogoUrl || "/images/gymramp-logo.png");
  const { toast } = useToast();
  const router = useRouter();
  const [isClientLoadingBrand, setIsClientLoadingBrand] = useState(true); // To show loader only on client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !initialBrandName && isMounted) {
      const hostnameParts = window.location.hostname.split('.');
      let potentialSlug: string | null = null;

      if (hostnameParts[0] === 'localhost' || hostnameParts.join('.').startsWith(process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'learn.gymramp.com')) {
        // This handles localhost or the main app URL, no specific brand slug
        potentialSlug = null;
      } else if (hostnameParts.length > 1 && hostnameParts[0] !== 'www') {
        // Assuming [slug].yourdomain.com or [slug].localhost
         potentialSlug = hostnameParts[0];
      }


      if (potentialSlug) {
        setIsClientLoadingBrand(true);
        console.log(`[Login Page] Detected potential slug: ${potentialSlug}, fetching brand...`);
        getCompanyBySubdomainSlug(potentialSlug).then(company => {
          if (company) {
            console.log(`[Login Page] Brand found by slug ${potentialSlug}: ${company.name}`);
            setDisplayBrandName(company.name);
            if (company.logoUrl) {
              setDisplayBrandLogoUrl(company.logoUrl);
            } else {
              setDisplayBrandLogoUrl("/images/gymramp-logo.png"); // Fallback if no logoUrl
            }
          } else {
            console.log(`[Login Page] No brand found for slug ${potentialSlug}, using defaults.`);
            setDisplayBrandName("Gymramp");
            setDisplayBrandLogoUrl("/images/gymramp-logo.png");
          }
        }).catch(err => {
          console.error("[Login Page] Error fetching brand by subdomain:", err);
          setDisplayBrandName("Gymramp");
          setDisplayBrandLogoUrl("/images/gymramp-logo.png");
        })
        .finally(() => setIsClientLoadingBrand(false));
      } else {
        // No potential slug, or it's the main domain, use defaults
        console.log("[Login Page] No specific brand slug detected, using defaults.");
        setDisplayBrandName(initialBrandName || "Gymramp");
        setDisplayBrandLogoUrl(initialBrandLogoUrl || "/images/gymramp-logo.png");
        setIsClientLoadingBrand(false);
      }
    } else if (isMounted) {
        // If initialBrandName is provided (from server props, though currently null), or not client context
        setDisplayBrandName(initialBrandName || "Gymramp");
        setDisplayBrandLogoUrl(initialBrandLogoUrl || "/images/gymramp-logo.png");
        setIsClientLoadingBrand(false);
    }
  }, [initialBrandName, initialBrandLogoUrl, isMounted]);


  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user.email) {
           throw new Error("User email not found after login.");
        }

        const userDetails = await getUserByEmail(user.email);

        if (userDetails && userDetails.requiresPasswordChange === true) {
            toast({
                title: "Password Change Required",
                description: "For your security, please update your temporary password.",
                variant: "default",
                duration: 7000,
            });
            router.push('/account/force-reset-password');
            setIsLoading(false);
            return;
        }

        if (userDetails && userDetails.isActive === false) {
            await signOut(auth);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
            }
            toast({ title: "Login Failed", description: "Your account has been deactivated. Please contact your administrator.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        if (userDetails && userDetails.companyId) {
            const companyDetails = await getCompanyById(userDetails.companyId);
            if (companyDetails?.isTrial && companyDetails.trialEndsAt) {
                const trialEndDate = companyDetails.trialEndsAt instanceof Timestamp
                    ? companyDetails.trialEndsAt.toDate()
                    : companyDetails.trialEndsAt instanceof Date
                        ? companyDetails.trialEndsAt
                        : new Date(companyDetails.trialEndsAt || 0);


                if (trialEndDate < new Date()) {
                    await signOut(auth);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('isLoggedIn');
                        localStorage.removeItem('userEmail');
                    }
                    toast({
                        title: "Trial Ended",
                        description: `The trial period for ${companyDetails.name} has ended. Please contact support.`,
                        variant: "destructive",
                        duration: 7000,
                    });
                    setIsLoading(false);
                    return;
                }
            }
        }


        if (typeof window !== 'undefined') {
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', user.email);
        }

        let redirectPath = '/';
        if (userDetails) {
            switch (userDetails.role) {
                case 'Super Admin': redirectPath = '/admin/dashboard'; break;
                case 'Admin':
                case 'Owner':
                case 'Manager': redirectPath = '/dashboard'; break;
                case 'Staff': redirectPath = '/courses/my-courses'; break;
                default: redirectPath = '/courses/my-courses';
            }
        } else {
             await signOut(auth);
             if (typeof window !== 'undefined') {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
             }
             toast({ title: "Login Error", description: "Could not load user profile. Please contact support.", variant: "destructive" });
             setIsLoading(false);
             return;
        }

        router.push(redirectPath);
        toast({ title: "Login Successful", description: `Welcome!` });

      } catch (error: any) {
          console.error("Login failed:", error);
          let errorMessage = "There was a problem logging in.";
          if(error.code === "auth/invalid-credential" || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'){
             errorMessage = "Invalid email or password.";
          } else if (error.code === 'auth/invalid-email') {
             errorMessage = "Please enter a valid email address.";
          }
          toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
      } finally {
            setIsLoading(false);
      }
  };

  if (isMounted && isClientLoadingBrand) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12 px-4 sm:px-6 lg:px-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12 px-4 sm:px-6 lg:px-8">
       <div className="mb-8 h-[45px] flex items-center justify-center">
         <Image
            src={displayBrandLogoUrl}
            alt={`${displayBrandName} Logo`}
            width={150}
            height={45}
            priority
            className="max-h-[45px] object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/gymramp-logo.png'; }}
        />
       </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            {displayBrandName === "Gymramp" || !displayBrandName ? "Welcome Back!" : `Welcome to ${displayBrandName}!`}
          </CardTitle>
          <CardDescription>Log in to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <Label htmlFor="password">Password</Label>
                 <Link href="/forgot-password" className="text-sm text-primary hover:underline"> Forgot password? </Link>
              </div>
              <Input id="password" type="password" required placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}/>
            </div>
             <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}> {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isLoading ? "Logging in..." : "Login"} </Button>
          </form>
        </CardContent>
         <CardFooter className="flex justify-center text-sm"> </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <LoginPageContent initialBrandName={null} initialBrandLogoUrl={null} />
    </Suspense>
  );
}
