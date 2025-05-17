
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Import useParams and useRouter
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Loader2, ArrowLeft, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, Location as LocationType, User } from '@/types/user'; // Renamed Location to LocationType to avoid conflict
import { getCompanyById, getLocationsByCompanyId, addLocation, updateLocation, deleteLocation } from '@/lib/company-data';
import { AddEditLocationDialog } from '@/components/admin/AddEditLocationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminCompanyLocationsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin' && userDetails?.companyId !== companyId && userDetails?.role !== 'Admin' && userDetails?.role !== 'Owner') {
          toast({ title: "Access Denied", description: "You do not have permission to manage these locations.", variant: "destructive" });
          router.push(userDetails?.role === 'Super Admin' ? '/admin/companies' : '/dashboard');
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, companyId]);


  const fetchCompanyAndLocations = useCallback(async () => {
    if (!companyId || !currentUser) return;
    setIsLoading(true);
    try {
      const companyData = await getCompanyById(companyId);
      if (!companyData) {
        toast({ title: "Error", description: "Brand not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }
      setCompany(companyData);

      const locationsData = await getLocationsByCompanyId(companyId);
      setLocations(locationsData);

    } catch (error) {
      console.error("Failed to fetch brand or locations:", error);
      toast({ title: "Error", description: "Could not load brand or location data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast, router, currentUser]);

  useEffect(() => {
    if (currentUser) { // Only fetch if currentUser is determined
        fetchCompanyAndLocations();
    }
  }, [fetchCompanyAndLocations, currentUser]);


  const handleAddLocationClick = () => {
    setEditingLocation(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditLocationClick = (location: LocationType) => {
    setEditingLocation(location);
    setIsAddEditDialogOpen(true);
  };

  const openDeleteConfirmation = (location: LocationType) => {
    setLocationToDelete(location);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLocation = async () => {
    if (!locationToDelete) return;
    setIsLoading(true); // Indicate loading during delete
    try {
      const success = await deleteLocation(locationToDelete.id);
      if (success) {
        fetchCompanyAndLocations(); // Refresh list
        toast({
          title: 'Location Deleted',
          description: `Location "${locationToDelete.name}" has been successfully deleted.`,
        });
      } else {
        throw new Error('Delete operation returned false.');
      }
    } catch (error) {
      console.error("Failed to delete location:", error);
      toast({ title: 'Error Deleting Location', description: `Could not delete location "${locationToDelete.name}".`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleSaveLocation = async (locationData: { name: string }) => {
    if (!companyId || !currentUser) return;
    let savedLocation: LocationType | null = null;
    try {
      if (editingLocation) {
        savedLocation = await updateLocation(editingLocation.id, { name: locationData.name });
      } else {
        const newLocationData = {
          name: locationData.name,
          companyId: companyId,
          createdBy: currentUser.id, // Or however you track creator
        };
        savedLocation = await addLocation(newLocationData);
      }

      if (savedLocation) {
        toast({ title: editingLocation ? "Location Updated" : "Location Added", description: `"${savedLocation.name}" saved successfully.` });
        fetchCompanyAndLocations(); // Refresh list
      } else {
        throw new Error("Failed to save location.");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save location.", variant: "destructive" });
    }
    setIsAddEditDialogOpen(false);
    setEditingLocation(null);
  };

  if (isLoading && !company) {
    return (
      <div className="container mx-auto py-12">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-10 w-1/2 mb-8" />
        <Card><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!company) {
    return <div className="container mx-auto py-12 text-center">Brand data not available.</div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <MapPin className="h-7 w-7" /> Manage Locations
          </h1>
          <p className="text-muted-foreground">For brand: <span className="font-semibold text-foreground">{company.name}</span></p>
        </div>
        <Button onClick={handleAddLocationClick} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Location
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Location List for {company.name}</CardTitle>
          <CardDescription>Manage physical or virtual locations for this brand.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && locations.length === 0 ? (
            <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> </div>
          ) : locations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No locations found for this brand. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Name</TableHead>
                  {/* Add more relevant columns if needed, e.g., User Count, Address (if stored) */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu for {location.name}</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditLocationClick(location)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Location
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => openDeleteConfirmation(location)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Location
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditLocationDialog
        isOpen={isAddEditDialogOpen}
        setIsOpen={setIsAddEditDialogOpen}
        initialData={editingLocation}
        onSave={handleSaveLocation}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location "{locationToDelete?.name}".
              Users assigned only to this location may lose access if not reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLocationToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteLocation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, delete location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    