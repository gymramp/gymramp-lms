"use client";

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
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual password reset logic (e.g., API call to send reset link)
    console.log("Password reset request for:", email);
    toast({
      title: "Password Reset Requested",
      description: `If an account exists for ${email}, you will receive a password reset link shortly.`,
    });
     // Optionally redirect or clear form
     setEmail("");
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)] py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Forgot Your Password?</CardTitle>
          <CardDescription>Enter your email address below and we'll send you a link to reset your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              Send Reset Link
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
                Return to Login
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
