
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-lg text-center shadow-lg animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader>
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <CardTitle className="text-2xl font-bold text-primary">
            Welcome to Gymramp!
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Your account has been successfully created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            You will be automatically logged in and redirected to your dashboard shortly.
            If you are not redirected, please log in to continue.
          </p>
          <div className="flex justify-center pt-4">
            <Button asChild>
                <Link href="/dashboard">
                    Go to My Dashboard
                </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
