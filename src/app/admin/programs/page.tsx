
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PlusCircle, MoreHorizontal, Trash2, Edit, BookOpen, Search, Layers, Loader2, DollarSign } from 'lucide-react'; // Added DollarSign
import { useToast } from '@/hooks/use-toast';
import type { Program } from '@/types/course';
import type { User } from '@/types/user';
import { getAllPrograms, deleteProgram } from '@/lib/firestore-data';
import { AddEditProgramDialog } from '@/components/admin/AddEditProgramDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserByEmail } from '@/lib/user-data';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const fetchPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const programsData = await getAllPrograms();
      setPrograms(programsData);
      setFilteredPrograms(programsData);
    } catch (error) {
      console.error("Failed to fetch programs:", error);
      toast({ title: "Error", description: "Could not load programs.", variant: "destructive" });
      setPrograms([]);
      setFilteredPrograms([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
        if (userDetails?.role !== 'Super Admin') {
          toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
          router.push('/');
        } else {
          fetchPrograms();
        }
      } else {
        setCurrentUser(null);
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, toast, fetchPrograms]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = programs.filter(program =>
      program.title.toLowerCase().includes(lowercasedFilter) ||
      program.description.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredPrograms(filtered);
  }, [searchTerm, programs]);

  const handleAddProgramClick = () => {
    setEditingProgram(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditProgramClick = (program: Program) => {
    setEditingProgram(program);
    setIsAddEditDialogOpen(true);
  };

  const openDeleteDialog = (program: Program) => {
    setProgramToDelete(program);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProgram = async () => {
    if (!programToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteProgram(programToDelete.id);
      if (success) {
        fetchPrograms(); // Refresh list
        toast({
          title: 'Program Deleted',
          description: `Program "${programToDelete.title}" has been successfully deleted.`,
        });
      } else {
        throw new Error('Delete operation returned false.');
      }
    } catch (error) {
      console.error("Failed to delete program:", error);
      toast({ title: 'Error Deleting Program', description: `Could not delete program "${programToDelete.title}".`, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setProgramToDelete(null);
    }
  };

  const handleSaveProgram = (savedProgram: Program) => {
    fetchPrograms(); // Refresh list
    setIsAddEditDialogOpen(false);
    setEditingProgram(null);
  };

  if (!currentUser || currentUser.role !== 'Super Admin') {
    return <div className="container mx-auto py-12 text-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Layers className="h-7 w-7" /> Program Management
        </h1>
        <Button onClick={handleAddProgramClick} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Program
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search programs by title or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Program List</CardTitle>
          <CardDescription>Manage collections of courses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? `No programs found matching "${searchTerm}".` : "No programs created yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Courses</TableHead>
                  <TableHead><DollarSign className="inline h-4 w-4 mr-1" />Price</TableHead>
                  <TableHead><DollarSign className="inline h-4 w-4 mr-1" />Subscription Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {program.description}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{program.courseIds?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>{program.price}</TableCell>
                    <TableCell>{program.subscriptionPrice || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu for {program.title}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditProgramClick(program)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Edit Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/programs/manage/${program.id}`}>
                              <BookOpen className="mr-2 h-4 w-4" />
                              <span>Manage Courses</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => openDeleteDialog(program)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Program</span>
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

      <AddEditProgramDialog
        isOpen={isAddEditDialogOpen}
        setIsOpen={setIsAddEditDialogOpen}
        initialData={editingProgram}
        onSave={handleSaveProgram}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the program
              "{programToDelete?.title}". It will not delete the courses themselves, only their association with this program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProgramToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProgram}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isDeleting ? 'Deleting...' : 'Yes, delete program'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
