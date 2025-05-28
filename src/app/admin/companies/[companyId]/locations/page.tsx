
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Loader2, ArrowLeft, MapPin, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, Location as LocationType, User } from '@/types/user';
import { getCompanyById, getLocationsByCompanyId, addLocation, updateLocation, deleteLocation, getAllCompanies } from '@/lib/company-data';
import { AddEditLocationDialog } from '@/components/admin/AddEditLocationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminCompanyLocationsPage() {
  const params = useParams();
  const router = useRouter();
  const brandIdFromUrl = params.companyId as string;

  const [brandForPageTitle, setBrandForPageTitle] = useState<Company | null>(null);
  const [locationsToDisplay, setLocationsToDisplay] = useState<LocationType[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const [accessibleBrandsForFilter, setAccessibleBrandsForFilter] = useState<Company[]>([]);
  const [selectedBrandIdInFilter, setSelectedBrandIdInFilter] = useState<string>(brandIdFromUrl);
  const [isLoadingAccessibleBrands, setIsLoadingAccessibleBrands] = useState(true);

  const authorizeAndFetchData = useCallback(async (user: User | null) => {
    if (!user || !brandIdFromUrl) {
      setIsLoadingLocations(false);
      setIsLoadingAccessibleBrands(false);
      if (!user) router.push('/');
      return;
    }
    
    setIsLoadingLocations(true);
    setIsLoadingAccessibleBrands(true);
    try {
      const initialBrandData = await getCompanyById(brandIdFromUrl);
      if (!initialBrandData) {
        toast({ title: "Error", description: "Brand specified in URL not found.", variant: "destructive" });
        router.push('/admin/companies');
        return;
      }

      let authorized = false;
      if (user.role === 'Super Admin') {
        authorized = true;
      } else if ((user.role === 'Admin' || user.role === 'Owner') && user.companyId) {
        if (initialBrandData.id === user.companyId || initialBrandData.parentBrandId === user.companyId) {
          authorized = true;
        }
      }

      if (!authorized) {
        toast({ title: "Access Denied", description: "You do not have permission to manage locations for this brand.", variant: "destructive" });
        router.push(user.role === 'Super Admin' ? '/admin/companies' : '/dashboard');
        return;
      }
      
      setBrandForPageTitle(initialBrandData);
      
      const allAccessibleBrands = await getAllCompanies(user);
      setAccessibleBrandsForFilter(allAccessibleBrands);
      
      const initialFilterId = allAccessibleBrands.some(b => b.id === brandIdFromUrl) ? brandIdFromUrl : (user.companyId || allAccessibleBrands[0]?.id || '');
      setSelectedBrandIdInFilter(initialFilterId);

      if (initialFilterId) {
        const locationsData = await getLocationsByCompanyId(initialFilterId);
        setLocationsToDisplay(locationsData);
      } else {
        setLocationsToDisplay([]);
      }

    } catch (error) {
      console.error("Failed to fetch initial brand/locations data:", error);
      toast({ title: "Error", description: "Could not load initial brand or location data.", variant: "destructive" });
    } finally {
      setIsLoadingLocations(false);
      setIsLoadingAccessibleBrands(false);
    }
  }, [brandIdFromUrl, toast, router]);

  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails) {
          authorizeAndFetchData(userDetails);
        } else {
          router.push('/'); // Should not happen if firebaseUser is present
        }
      } else {
        setCurrentUser(null);
        router.push('/');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [authorizeAndFetchData, router]);

  useEffect(() => {
    if (!selectedBrandIdInFilter || isAuthLoading || !currentUser || isLoadingAccessibleBrands) return;

    const fetchLocationsForSelectedBrand = async () => {
      setIsLoadingLocations(true);
      try {
        const locationsData = await getLocationsByCompanyId(selectedBrandIdInFilter);
        setLocationsToDisplay(locationsData);
      } catch (error) {
        console.error("Failed to fetch locations for selected brand:", error);
        toast({ title: "Error", description: `Could not load locations for the selected brand.`, variant: "destructive" });
        setLocationsToDisplay([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocationsForSelectedBrand();
  }, [selectedBrandIdInFilter, isAuthLoading, currentUser, isLoadingAccessibleBrands, toast]);


  const handleAddLocationClick = () => {
    if (!selectedBrandIdInFilter) {
        toast({ title: "Brand Not Selected", description: "Please select a brand from the filter to add a location.", variant: "destructive"});
        return;
    }
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
    setIsLoadingLocations(true); 
    try {
      const success = await deleteLocation(locationToDelete.id);
      if (success) {
        const locationsData = await getLocationsByCompanyId(selectedBrandIdInFilter);
        setLocationsToDisplay(locationsData);
        toast({ title: 'Location Deleted', description: `Location "${locationToDelete.name}" has been successfully deleted.` });
      } else {
        throw new Error('Delete operation returned false.');
      }
    } catch (error) {
      toast({ title: 'Error Deleting Location', description: `Could not delete location "${locationToDelete.name}".`, variant: 'destructive' });
    } finally {
      setIsLoadingLocations(false);
      setIsDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleSaveLocation = async (locationData: { name: string }) => {
    if (!selectedBrandIdInFilter || !currentUser) return;
    let savedLocation: LocationType | null = null;
    setIsLoadingLocations(true);
    try {
      if (editingLocation) {
        savedLocation = await updateLocation(editingLocation.id, { name: locationData.name });
      } else {
        const newLocationData = { name: locationData.name, companyId: selectedBrandIdInFilter, createdBy: currentUser.id };
        savedLocation = await addLocation(newLocationData);
      }
      if (savedLocation) {
        toast({ title: editingLocation ? "Location Updated" : "Location Added", description: `"${savedLocation.name}" saved successfully.` });
        const locationsData = await getLocationsByCompanyId(selectedBrandIdInFilter); 
        setLocationsToDisplay(locationsData);
      } else {
        throw new Error("Failed to save location.");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save location.", variant: "destructive" });
    } finally {
        setIsLoadingLocations(false);
    }
    setIsAddEditDialogOpen(false);
    setEditingLocation(null);
  };

  const selectedBrandForDisplay = accessibleBrandsForFilter.find(b => b.id === selectedBrandIdInFilter);

  if (isAuthLoading || (isLoadingAccessibleBrands && !brandForPageTitle)) {
    return ( 
      <div className="container mx-auto"> 
        <Skeleton className="h-8 w-1/4 mb-6" /> 
        <Skeleton className="h-10 w-1/2 mb-4" /> 
        <Skeleton className="h-10 w-1/3 mb-8" /> 
        <Card><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card> 
      </div> 
    );
  }
  if (!currentUser || !brandForPageTitle) { 
    return <div className="container mx-auto text-center">Brand data not available or access denied.</div>; 
  }

  return (
    <div className="container mx-auto">
      <Button variant="outline" onClick={() => router.push('/admin/companies')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Brands
      </Button>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2"> <MapPin className="h-7 w-7" /> Manage Locations </h1>
          <p className="text-muted-foreground">For initial context: <span className="font-semibold text-foreground">{brandForPageTitle.name}</span></p>
        </div>
        <Button onClick={handleAddLocationClick} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={!selectedBrandIdInFilter}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Location
        </Button>
      </div>

      <div className="mb-6 p-4 border rounded-lg bg-background shadow">
        <Label htmlFor="brand-filter-locations" className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <Building className="h-4 w-4"/> Viewing Locations for Brand:
        </Label>
        {isLoadingAccessibleBrands ? (
            <Skeleton className="h-10 w-full max-w-sm"/>
        ) : (
            <Select
                value={selectedBrandIdInFilter}
                onValueChange={(value) => setSelectedBrandIdInFilter(value)}
            >
                <SelectTrigger id="brand-filter-locations" className="w-full max-w-sm">
                     <SelectValue placeholder="Select a brand..." />
                </SelectTrigger>
                <SelectContent>
                    {accessibleBrandsForFilter.length === 0 ? (
                        <SelectItem value="no-brands" disabled>No accessible brands found.</SelectItem>
                    ) : (
                        accessibleBrandsForFilter.map(brand => (
                            <SelectItem key={brand.id} value={brand.id}>
                                {brand.name} {brand.parentBrandId ? "(Child)" : ""}
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
        )}
      </div>

      <Card>
        <CardHeader> 
            <CardTitle>
                Location List for {selectedBrandForDisplay?.name || 'Selected Brand'}
            </CardTitle> 
            <CardDescription>Manage physical or virtual locations for the selected brand.</CardDescription> 
        </CardHeader>
        <CardContent>
          {isLoadingLocations && locationsToDisplay.length === 0 ? ( <div className="space-y-4 py-4"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-10 w-full" /> </div>
          ) : locationsToDisplay.length === 0 ? ( <div className="text-center text-muted-foreground py-8">No locations found for this brand. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader> <TableRow> <TableHead>Location Name</TableHead> <TableHead className="text-right">Actions</TableHead> </TableRow> </TableHeader>
              <TableBody>
                {locationsToDisplay.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span>
                              <span className="sr-only">Open menu for {location.name}</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
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
      <AddEditLocationDialog isOpen={isAddEditDialogOpen} setIsOpen={setIsAddEditDialogOpen} initialData={editingLocation} onSave={handleSaveLocation} />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently delete the location "{locationToDelete?.name}". Users assigned only to this location may lose access if not reassigned. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel onClick={() => setLocationToDelete(null)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={confirmDeleteLocation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoadingLocations}> {isLoadingLocations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Yes, delete location </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    