import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";

const managedCourses = [
  { id: "1", title: "Advanced JavaScript Techniques", status: "Published", students: 120, revenue: 1200.00, createdDate: "2023-01-15" },
  { id: "2", title: "Introduction to Docker and Kubernetes", status: "Draft", students: 0, revenue: 0.00, createdDate: "2023-03-01" },
  { id: "3", title: "Responsive Web Design with Tailwind CSS", status: "Published", students: 85, revenue: 850.00, createdDate: "2022-11-20" },
  { id: "4", title: "Python for Automation", status: "Pending Review", students: 30, revenue: 300.00, createdDate: "2023-05-10" },
];

export default function ManageCoursesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Course Management</h1>
          <p className="text-muted-foreground">Oversee, create, and edit your course offerings.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/manage-courses/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Course
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Courses</CardTitle>
          <CardDescription>A list of all courses you have created or are managing.</CardDescription>
        </CardHeader>
        <CardContent>
          {managedCourses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managedCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          course.status === "Published" ? "default" : 
                          course.status === "Draft" ? "secondary" : 
                          "outline"
                        }
                        className={
                          course.status === "Published" ? "bg-green-500 text-white" :
                          course.status === "Pending Review" ? "bg-yellow-500 text-white" : ""
                        }
                      >
                        {course.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{course.students}</TableCell>
                    <TableCell className="text-right">${course.revenue.toFixed(2)}</TableCell>
                    <TableCell>{course.createdDate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="hover:text-primary">
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="hover:text-accent">
                          <Edit className="h-4 w-4" />
                           <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">You haven't created any courses yet.</p>
              <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/manage-courses/new">
                  <PlusCircle className="mr-2 h-5 w-5" /> Create Your First Course
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Courses</p>
                <p className="text-2xl font-bold text-primary">{managedCourses.length}</p>
            </div>
            <div className="p-4 bg-accent/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-accent">{managedCourses.reduce((sum, c) => sum + c.students, 0).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-secondary-foreground">${managedCourses.reduce((sum, c) => sum + c.revenue, 0).toFixed(2)}</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
