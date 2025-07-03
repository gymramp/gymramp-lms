
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image'; // Import Image
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail, updateUser } from '@/lib/user-data'; // Import updateUser
import { uploadImage, STORAGE_PATHS } from '@/lib/storage'; // Import storage functions
import { auth, googleAuthProvider } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail, linkWithPopup, type UserInfo } from 'firebase/auth';
import { Building, Mail, User as UserIcon, Upload, Image as ImageIconLucide, Loader2, Trash2, CheckCircle } from 'lucide-react'; // Import necessary icons
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components

export default function AccountPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // State for upload loading
  const [uploadProgress, setUploadProgress] = useState(0); // State for upload progress
  const [uploadError, setUploadError] = useState<string | null>(null); // State for upload error
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          if (userDetails) {
            setCurrentUser(userDetails);
            // Check for linked providers
            const googleProvider = firebaseUser.providerData.find(
              (provider: UserInfo) => provider.providerId === 'google.com'
            );
            setIsGoogleLinked(!!googleProvider);
          } else {
            console.error("Authenticated user profile not found in Firestore.");
            toast({ title: "Error", description: "Could not load your profile details.", variant: "destructive" });
            setCurrentUser(null);
          }
        } catch (error) {
           console.error("Error fetching user profile:", error);
           toast({ title: "Error", description: "Failed to load profile.", variant: "destructive" });
        } finally {
           setIsLoading(false);
        }
      } else {
        router.push('/'); // Redirect to login if not authenticated
      }
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [router, toast]);

  const handlePasswordReset = async () => {
    if (currentUser?.email) {
      try {
        await sendPasswordResetEmail(auth, currentUser.email);
        toast({
          title: "Password Reset Email Sent",
          description: "Check your inbox for instructions to reset your password.",
        });
      } catch (error: any) {
        console.error("Error sending password reset email:", error);
        toast({
          title: "Error Sending Reset Email",
          description: error.message || "Could not send password reset email.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Error",
        description: "Could not send password reset email. Email address not found.",
        variant: "destructive",
      });
    }
  };

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.id) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const uniqueFileName = `${currentUser.id}-${Date.now()}-${file.name}`;
      const storagePath = `${STORAGE_PATHS.USER_PROFILE_IMAGES}/${uniqueFileName}`;

      const downloadURL = await uploadImage(file, storagePath, setUploadProgress);

      // Update user profile in Firestore
      const updatedUser = await updateUser(currentUser.id, { profileImageUrl: downloadURL });
      if (updatedUser) {
        setCurrentUser(updatedUser); // Update local state with new URL
        toast({
          title: "Profile Image Uploaded",
          description: "Your profile image has been updated.",
        });
      } else {
        throw new Error("Failed to update user profile in database.");
      }
    } catch (error: any) {
      setUploadError(error.message || "Failed to upload image.");
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload the profile image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveProfileImage = async () => {
     if (!currentUser?.id || !currentUser?.profileImageUrl) return;

     setIsUploading(true); // Use uploading state for removal indication
     setUploadError(null);
     try {
        // Set profileImageUrl to null in Firestore
        const updatedUser = await updateUser(currentUser.id, { profileImageUrl: null });
        if (updatedUser) {
            setCurrentUser(updatedUser); // Update local state
            toast({
                title: "Profile Image Removed",
                description: "Your profile image has been removed.",
            });
        } else {
            throw new Error("Failed to remove profile image from database.");
        }
     } catch (error: any) {
         setUploadError(error.message || "Failed to remove image.");
         toast({
             title: "Removal Failed",
             description: error.message || "Could not remove the profile image.",
             variant: "destructive",
         });
     } finally {
         setIsUploading(false);
     }
  };
  
  const handleLinkGoogle = async () => {
    if (!auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to link an account.", variant: "destructive" });
      return;
    }
    setIsLinking(true);
    try {
      await linkWithPopup(auth.currentUser, googleAuthProvider);
      toast({ title: "Success!", description: "Your Google account has been successfully linked." });
      setIsGoogleLinked(true);
    } catch (error: any) {
      let description = "An unexpected error occurred.";
      if (error.code === 'auth/credential-already-in-use') {
        description = "This Google account is already linked to another user's account.";
      }
      console.error("Google account linking error:", error);
      toast({ title: "Linking Failed", description, variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  };

  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="container mx-auto">
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
             <UserIcon className="h-6 w-6" /> My Account
          </CardTitle>
          <CardDescription>Manage your account details and profile image.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <>
               <div className="flex items-center gap-4">
                   <Skeleton className="h-20 w-20 rounded-full" />
                   <div className="space-y-2 flex-1">
                       <Skeleton className="h-10 w-1/2" />
                       <Skeleton className="h-4 w-3/4" />
                   </div>
               </div>
               <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
               <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
               <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
               <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
               <Skeleton className="h-10 w-1/2 mt-4" />
            </>
          ) : currentUser ? (
            <>
               <div className="space-y-4">
                 <Label className="text-base font-semibold">Profile Image</Label>
                 <div className="flex items-center gap-6">
                     <Avatar className="h-20 w-20 border-2 border-primary/20">
                        <AvatarImage src={currentUser.profileImageUrl || undefined} alt={currentUser.name || 'User Avatar'} />
                        <AvatarFallback className="text-2xl">{getInitials(currentUser.name)}</AvatarFallback>
                     </Avatar>
                     <div className="flex flex-col gap-2">
                         <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-fit"
                          >
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            {isUploading ? 'Uploading...' : 'Upload Image'}
                         </Button>
                         {currentUser.profileImageUrl && (
                             <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-fit"
                                onClick={handleRemoveProfileImage}
                                disabled={isUploading}
                             >
                                 <Trash2 className="mr-2 h-4 w-4" /> Remove Image
                             </Button>
                         )}
                         <Input
                           ref={fileInputRef}
                           type="file"
                           accept="image/*"
                           className="hidden"
                           onChange={handleProfileImageChange}
                           disabled={isUploading}
                         />
                          {isUploading && (
                             <div className="w-full max-w-xs mt-2">
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-xs text-muted-foreground text-center mt-1">{Math.round(uploadProgress)}%</p>
                             </div>
                          )}
                          {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                    </div>
                </div>
               </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1 text-muted-foreground"><UserIcon className="h-4 w-4" /> Name</Label>
                <Input id="name" value={currentUser.name || ''} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" /> Email</Label>
                <Input id="email" value={currentUser.email} readOnly disabled />
              </div>
               <div className="space-y-2">
                 <Label htmlFor="brand" className="flex items-center gap-1 text-muted-foreground"><Building className="h-4 w-4" /> Brand</Label>
                 <Input id="brand" value={currentUser.company || currentUser.companyId || 'N/A'} readOnly disabled />
               </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-1 text-muted-foreground"><Building className="h-4 w-4" /> Role</Label>
                <Input id="role" value={currentUser.role} readOnly disabled />
              </div>
              <Button variant="outline" onClick={handlePasswordReset} className="mt-4">
                Reset Password
              </Button>
              
              <Separator className="my-6" />

              <div className="space-y-4">
                <Label className="text-base font-semibold">Linked Accounts</Label>
                <p className="text-sm text-muted-foreground">
                  Connect your Google account for a seamless sign-in experience.
                </p>
                {isGoogleLinked ? (
                   <Button variant="outline" disabled className="w-full justify-start cursor-default">
                    <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.4 56.2L364.6 120C324.4 86.6 289.4 68 248 68c-106 0-192 86-192 192s86 192 192 192c109.7 0 160.1-75.7 162.7-114.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                    Google Account Linked
                    <CheckCircle className="ml-auto h-5 w-5 text-green-500" />
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleLinkGoogle} disabled={isLinking} className="w-full">
                    {isLinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 488 512">
                        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.4 56.2L364.6 120C324.4 86.6 289.4 68 248 68c-106 0-192 86-192 192s86 192 192 192c109.7 0 160.1-75.7 162.7-114.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                      </svg>
                    )}
                    Link Google Account
                  </Button>
                )}
              </div>
            </>
          ) : (
             <p className="text-center text-muted-foreground py-8">Could not load user details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
