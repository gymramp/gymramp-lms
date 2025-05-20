
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
import { getCompanyById, getCompanyBySubdomainSlug } from '@/lib/company-data'; // Imports for company data
import { getUserByEmail } from '@/lib/user-data'; // Corrected import for user data
import { Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";

// Interface for conceptual brand props
interface LoginPageProps {
  brandName?: string | null;
  brandLogoUrl?: string | null;
}

// Main component logic
function LoginPageContent({ brandName: initialBrandName, brandLogoUrl: initialBrandLogoUrl }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [displayBrandName, setDisplayBrandName] = useState(initialBrandName || "GYMRAMP");
  const [displayBrandLogoUrl, setDisplayBrandLogoUrl] = useState(initialBrandLogoUrl || "/images/newlogo.png"); // Default GYMRAMP logo
  const { toast } = useToast();
  const router = useRouter();
  const [isClientLoadingBrand, setIsClientLoadingBrand] = useState(true); // Manage loading state for client-side brand fetching

  // This effect attempts to derive brand from subdomain if running client-side
  useEffect(() => {
    // Only run if no initial brand name (meaning not from server prop)
    // and if window is defined (client-side)
    if (typeof window !== 'undefined' && !initialBrandName) {
      const hostnameParts = window.location.hostname.split('.');
      // Basic check for subdomain (e.g., brand.example.com, not www.example.com or example.com or localhost)
      // Adjust this condition based on your actual domain structure and needs.
      // This check ensures it doesn't run for 'localhost' or simple TLDs without clear subdomains.
      if (hostnameParts.length > 2 && hostnameParts[0] !== 'www' && hostnameParts[0] !== 'localhost' && !hostnameParts[0].startsWith('gymramp-lms')) {
        const slug = hostnameParts[0];
        setIsClientLoadingBrand(true); // Start loading brand info
        getCompanyBySubdomainSlug(slug).then(company => {
          if (company) {
            setDisplayBrandName(company.name);
            if (company.logoUrl) {
              setDisplayBrandLogoUrl(company.logoUrl);
            }
          }
        }).catch(err => console.error("Error fetching brand by subdomain:", err))
        .finally(() => setIsClientLoadingBrand(false)); // Finish loading
      } else {
        setIsClientLoadingBrand(false); // No relevant subdomain found, finish loading
      }
    } else {
        setIsClientLoadingBrand(false); // Already has initial props or not client-side, finish loading
    }
  }, [initialBrandName]);


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
                    : new Date(companyDetails.trialEndsAt);

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

  // Show loading state for brand logo only during client-side fetching.
  // isLoading covers the login process itself.
  if (isClientLoadingBrand && !initialBrandName && typeof window !== 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12 px-4 sm:px-6 lg:px-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12 px-4 sm:px-6 lg:px-8">
       <div className="mb-8 h-[45px] flex items-center justify-center"> {/* Added fixed height for logo area to prevent layout shift */}
         <Image
            src={displayBrandLogoUrl}
            alt={`${displayBrandName} Logo`}
            width={150}
            height={45}
            priority
            className="max-h-[45px] object-contain" // Ensure image respects height
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/newlogo.png'; }} // Fallback to default logo
        />
       </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            {displayBrandName === "GYMRAMP" || !displayBrandName ? "Welcome Back!" : `Welcome to ${displayBrandName}!`}
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

// New default export that wraps content in Suspense
export default function LoginPage() {
  // For a true SSR white-labeling solution, brandName and brandLogoUrl
  // would be fetched server-side (e.g., in a parent Server Component or layout
  // based on hostname) and passed as props to LoginPageContent.
  // Since this page is a client component and `useSearchParams` for brandId was removed,
  // we'll rely on client-side detection or pass nulls.
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <LoginPageContent brandName={null} brandLogoUrl={null} />
    </Suspense>
  );
}
