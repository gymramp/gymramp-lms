
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image'; // Import Image
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail, updateUser } from '@/lib/user-data'; // Import updateUser
import { uploadImage, STORAGE_PATHS } from '@/lib/storage'; // Import storage functions
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { Building, Mail, User as UserIcon, Upload, Image as ImageIconLucide, Loader2, Trash2 } from 'lucide-react'; // Import necessary icons
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components

export default function AccountPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // State for upload loading
  const [uploadProgress, setUploadProgress] = useState(0); // State for upload progress
  const [uploadError, setUploadError] = useState<string | null>(null); // State for upload error
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
          } else {
            console.error("Authenticated user profile not found in Firestore.");
            toast({ title: "Error", description: "Could not load your profile details.", variant: "destructive" });
            setCurrentUser(null);
            // router.push('/login'); // Redirect if profile is essential
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
             // Optionally delete the image from storage here if needed (requires backend logic or more complex setup)
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


  // Function to get initials from name
  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
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
              {/* Skeleton Loader */}
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
               {/* Profile Image Section */}
               <div className="space-y-4">
                 <Label className="text-base font-semibold">Profile Image</Label>
                 <div className="flex items-center gap-6">
                     <Avatar className="h-20 w-20 border-2 border-primary/20">
                        <AvatarImage src={currentUser.profileImageUrl || undefined} alt={currentUser.name} />
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
                         {/* Hidden file input */}
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

              {/* Other Fields */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1 text-muted-foreground"><UserIcon className="h-4 w-4" /> Name</Label>
                <Input id="name" value={currentUser.name} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" /> Email</Label>
                <Input id="email" value={currentUser.email} readOnly disabled />
              </div>
               <div className="space-y-2">
                 <Label htmlFor="company" className="flex items-center gap-1 text-muted-foreground"><Building className="h-4 w-4" /> Company</Label>
                 {/* Display company name if available, otherwise ID or 'N/A' */}
                 <Input id="company" value={currentUser.company || currentUser.companyId || 'N/A'} readOnly disabled />
               </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-1 text-muted-foreground"><Building className="h-4 w-4" /> Role</Label>
                <Input id="role" value={currentUser.role} readOnly disabled />
              </div>
              <Button variant="outline" onClick={handlePasswordReset} className="mt-4">
                Reset Password
              </Button>
            </>
          ) : (
             <p className="text-center text-muted-foreground py-8">Could not load user details.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}