// src/app/account/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail, updateUser } from '@/lib/user-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Building, Mail, User as UserIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AccountBasicsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
        } catch (error) {
           console.error("Error fetching user profile:", error);
           toast({ title: "Error", description: "Failed to load profile.", variant: "destructive" });
        } finally {
           setIsLoading(false);
        }
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

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

      const updatedUser = await updateUser(currentUser.id, { profileImageUrl: downloadURL });
      if (updatedUser) {
        setCurrentUser(updatedUser);
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

     setIsUploading(true);
     setUploadError(null);
     try {
        const updatedUser = await updateUser(currentUser.id, { profileImageUrl: null });
        if (updatedUser) {
            setCurrentUser(updatedUser);
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
  
  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-4 w-3/4" /></div>
          </div>
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
        </CardContent>
      </Card>
    );
  }

  if (!currentUser) {
    return <p className="text-center text-muted-foreground">Could not load user details.</p>;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Profile Information</CardTitle>
        <CardDescription>View and manage your personal details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
