
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { getUserByEmail } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data'; // Import getCompanyById
import { Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore"; // Import Timestamp

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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

        // Check company trial status if user has a companyId
        if (userDetails && userDetails.companyId) {
            const companyDetails = await getCompanyById(userDetails.companyId);
            if (companyDetails?.isTrial && companyDetails.trialEndsAt) {
                const trialEndDate = companyDetails.trialEndsAt instanceof Timestamp
                    ? companyDetails.trialEndsAt.toDate()
                    : new Date(companyDetails.trialEndsAt); // Fallback if not Timestamp (should be)

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

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12 px-4 sm:px-6 lg:px-8">
       <div className="mb-8">
         <Image src="/images/newlogo.png" alt="GYMRAMP Logo" width={150} height={45} priority />
       </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Welcome Back!</CardTitle>
          <CardDescription>Log in to access your GYMRAMP account.</CardDescription>
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