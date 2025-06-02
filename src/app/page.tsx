
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
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import Image from 'next/image';
import { useState, useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import { Loader2 } from "lucide-react";
import type { User } from '@/types/user';

interface LoginPageProps {
  // Props are not actually used since white-labeling was removed, but kept for structure
  initialBrandName?: string | null;
  initialBrandLogoUrl?: string | null;
}

function LoginPageContent({ initialBrandName, initialBrandLogoUrl }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuthAndRedirecting, setIsCheckingAuthAndRedirecting] = useState(true);
  const [displayBrandName, setDisplayBrandName] = useState("Gymramp");
  const [displayBrandLogoUrl, setDisplayBrandLogoUrl] = useState("/images/newlogo.png");
  const { toast } = useToast();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Static branding since white-labeling is removed
    setDisplayBrandName("Gymramp");
    setDisplayBrandLogoUrl("/images/newlogo.png");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails) {
            if (userDetails.requiresPasswordChange === true) {
              router.replace('/account/force-reset-password');
              return;
            }
            if (userDetails.isActive === false) {
              await signOut(auth);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
              }
              setIsCheckingAuthAndRedirecting(false);
              return;
            }
            if (userDetails.companyId) {
              const companyDetails = await getCompanyById(userDetails.companyId);
              if (companyDetails?.isTrial && companyDetails.trialEndsAt) {
                // Ensure trialEndsAt is a Date object before comparison
                const trialEndDate = companyDetails.trialEndsAt instanceof Date
                  ? companyDetails.trialEndsAt
                  : new Date(companyDetails.trialEndsAt as string); // Assuming it's an ISO string
                if (trialEndDate < new Date()) {
                  await signOut(auth);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('userEmail');
                  }
                  setIsCheckingAuthAndRedirecting(false);
                  return;
                }
              }
            }

            let redirectPath = '/courses/my-courses';
            switch (userDetails.role) {
              case 'Super Admin': redirectPath = '/admin/dashboard'; break;
              case 'Admin':
              case 'Owner':
              case 'Manager': redirectPath = '/dashboard'; break;
            }
            router.replace(redirectPath);
            return;
          } else {
            await signOut(auth);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('isLoggedIn');
              localStorage.removeItem('userEmail');
            }
          }
        } catch (error) {
          console.error("Error during auth check/redirect:", error);
          await signOut(auth).catch(e => console.error("Sign out error during auth check error:", e));
          if (typeof window !== 'undefined') {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
          }
        }
      }
      setIsCheckingAuthAndRedirecting(false);
    });

    return () => unsubscribe();
  }, [isMounted, router]);


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
                const trialEndDate = companyDetails.trialEndsAt instanceof Date
                    ? companyDetails.trialEndsAt
                    : new Date(companyDetails.trialEndsAt as string); // Assuming ISO string
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

        let redirectPath = '/courses/my-courses';
        if (userDetails) {
            switch (userDetails.role) {
                case 'Super Admin': redirectPath = '/admin/dashboard'; break;
                case 'Admin':
                case 'Owner':
                case 'Manager': redirectPath = '/dashboard'; break;
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
          console.error("Login failed details:", { code: error.code, message: error.message, fullError: error }); // Enhanced logging
          let errorMessage = "There was a problem logging in.";
          if (error.code === "auth/invalid-credential" || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             errorMessage = "Invalid email or password.";
             console.warn(`Firebase Auth Error: ${error.code} - Suggests incorrect email/password or user not found in Firebase Auth.`);
          } else if (error.code === 'auth/invalid-email') {
             errorMessage = "Please enter a valid email address.";
          } else {
            console.error("An unexpected Firebase error occurred during login:", error);
          }
          toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
      } finally {
            setIsLoading(false);
      }
  };

  if (isCheckingAuthAndRedirecting || !isMounted) {
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
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/newlogo.png'; }}
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
    