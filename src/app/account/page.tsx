// src/app/account/page.tsx
'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { getUserByEmail, updateUser } from '@/lib/user-data';
import { getCompanyById } from '@/lib/company-data';
import { uploadImage, STORAGE_PATHS } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, updateEmail } from 'firebase/auth';
import { Building, Mail, User as UserIcon, Upload, Trash2, Loader2, Save, Languages, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BadgeCard, type BadgeInfo } from '@/components/gamification/BadgeCard';
import { getBadgesForUser } from '@/lib/gamification';

const SUPPORTED_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
];

const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  preferredLocale: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function AccountBasicsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<BadgeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      preferredLocale: 'en',
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const userDetails = await getUserByEmail(firebaseUser.email);
          setCurrentUser(userDetails);
          if (userDetails) {
            form.reset({
              name: userDetails.name,
              email: userDetails.email,
              preferredLocale: userDetails.preferredLocale || 'en',
            });
            if (userDetails.companyId) {
              const company = await getCompanyById(userDetails.companyId);
              setBrandName(company?.name || 'N/A');
            } else {
              setBrandName('N/A');
            }
            const badges = await getBadgesForUser(userDetails);
            setEarnedBadges(badges);
          }
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
  }, [router, toast, form]);

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

  const onSubmit = (data: ProfileFormValues) => {
    if (!currentUser) return;
    startTransition(async () => {
      try {
        let updateData: Partial<User> = {
            name: data.name,
            preferredLocale: data.preferredLocale,
        };
        
        if (data.email.toLowerCase() !== currentUser.email.toLowerCase()) {
           if (!auth.currentUser) throw new Error("Not authenticated.");
           await updateEmail(auth.currentUser, data.email);
           updateData.email = data.email;
           toast({ title: "Email Verification Required", description: `A verification link was sent to ${data.email}. Please verify to complete the change.` });
        }
        
        const updatedUser = await updateUser(currentUser.id, updateData);
        if (updatedUser) {
          setCurrentUser(updatedUser);
          form.reset(data); // Re-sync form with submitted data
          toast({ title: "Profile Updated", description: "Your details have been saved." });
        } else {
          throw new Error("Failed to update profile in database.");
        }
      } catch (error: any) {
        console.error("Profile update error:", error);
        toast({ title: "Update Failed", description: error.message || "Could not update your profile.", variant: "destructive" });
        // Re-sync form with original data on failure
        form.reset({ name: currentUser.name, email: currentUser.email, preferredLocale: currentUser.preferredLocale || 'en' });
      }
    });
  };
  
  const getInitials = (name?: string | null): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
            <Card className="w-full">
                <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                <CardContent className="space-y-6"><div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-4 w-3/4" /></div></div><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div></CardContent>
            </Card>
        </div>
        <div className="md:col-span-1">
            <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><div className="flex gap-4"><Skeleton className="h-24 w-24" /><Skeleton className="h-24 w-24" /></div></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <p className="text-center text-muted-foreground">Could not load user details.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <Card className="w-full shadow-lg lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Profile Information</CardTitle>
        <CardDescription>View and manage your personal details.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <FormLabel className="text-base font-semibold">Profile Image</FormLabel>
              <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-2 border-primary/20">
                    <AvatarImage src={currentUser.profileImageUrl || undefined} alt={currentUser.name || 'User Avatar'} />
                    <AvatarFallback className="text-2xl">{getInitials(currentUser.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-fit"><Upload className="mr-2 h-4 w-4" />{isUploading ? 'Uploading...' : 'Upload Image'}</Button>
                      {currentUser.profileImageUrl && (<Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 w-fit" onClick={handleRemoveProfileImage} disabled={isUploading}><Trash2 className="mr-2 h-4 w-4" /> Remove Image</Button>)}
                      <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} disabled={isUploading} />
                        {isUploading && (<div className="w-full max-w-xs mt-2"><Progress value={uploadProgress} className="h-2" /><p className="text-xs text-muted-foreground text-center mt-1">{Math.round(uploadProgress)}%</p></div>)}
                        {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                </div>
              </div>
            </div>

            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-muted-foreground"><UserIcon className="h-4 w-4" /> Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" /> Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
             <FormField control={form.control} name="preferredLocale" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1 text-muted-foreground"><Languages className="h-4 w-4" /> Language Preference</FormLabel><Select onValueChange={field.onChange} value={field.value || 'en'}><FormControl><SelectTrigger><SelectValue placeholder="Select your preferred language" /></SelectTrigger></FormControl><SelectContent>{SUPPORTED_LOCALES.map(locale => ( <SelectItem key={locale.value} value={locale.value}>{locale.label}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem>)} />
            <div className="space-y-2"><Label htmlFor="brand" className="flex items-center gap-1 text-muted-foreground"><Building className="h-4 w-4" /> Brand</Label><Input id="brand" value={brandName || 'Loading...'} readOnly disabled /></div>
            <div className="space-y-2"><Label htmlFor="role" className="flex items-center gap-1 text-muted-foreground"><UserIcon className="h-4 w-4" /> Role</Label><Input id="role" value={currentUser.role} readOnly disabled /></div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <div className="lg:col-span-1">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-400" /> My Badges</CardTitle>
                <CardDescription>Your recently earned achievements.</CardDescription>
            </CardHeader>
            <CardContent>
                {earnedBadges.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {earnedBadges.slice(0, 4).map((badge, index) => (
                            <BadgeCard key={index} badge={badge} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground italic">No badges earned yet. Start a course to get your first one!</p>
                )}
            </CardContent>
        </Card>
    </div>
    </div>
  );
}
