
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const user = {
  name: "Alex Johnson",
  email: "alex.johnson@example.com",
  avatarUrl: "https://placehold.co/200x200.png",
  bio: "Lifelong learner and aspiring full-stack developer. Passionate about technology and design.",
  joinedDate: "March 15, 2023",
};

const enrolledCourses = [
  { id: "1", title: "Ultimate Web Development Bootcamp", progress: 75, category: "Programming" },
  { id: "2", title: "UI/UX Design Essentials", progress: 40, category: "Design" },
  { id: "3", title: "Digital Marketing Masterclass", progress: 95, category: "Marketing" },
];

export default function ProfilePage() {
  return (
    <div className="container mx-auto space-y-8">
      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/20 to-accent/20 p-8 flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-32 w-32 border-4 border-background shadow-md">
            <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user profile" />
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-center md:text-left">
            <CardTitle className="text-3xl font-bold text-primary">{user.name}</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">{user.email}</CardDescription>
            <Badge variant="secondary" className="mt-2">Joined: {user.joinedDate}</Badge>
          </div>
          <Button variant="outline" className="ml-auto mt-4 md:mt-0">
            <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-2">About Me</h3>
          <p className="text-muted-foreground">{user.bio}</p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary flex items-center">
            <BookOpen className="mr-3 h-6 w-6" /> My Enrolled Courses
          </CardTitle>
          <CardDescription>Track your learning journey and progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {enrolledCourses.length > 0 ? (
            enrolledCourses.map((course, index) => (
              <div key={course.id}>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-medium">{course.title}</h4>
                    <span className="text-sm font-semibold text-accent">{course.progress}% Complete</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{course.category}</p>
                  <Progress value={course.progress} className="h-3" indicatorClassName="bg-accent" />
                </div>
                {index < enrolledCourses.length - 1 && <Separator />}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
          )}
        </CardContent>
      </Card>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary flex items-center">
            <CheckCircle className="mr-3 h-6 w-6" /> Achievements
          </CardTitle>
          <CardDescription>Milestones and certificates you've earned.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {['Course Completion: Web Dev', 'Top 10% Quiz Score', '5 Courses Enrolled'].map(ach => (
            <Badge key={ach} variant="outline" className="p-3 text-center justify-center text-sm border-accent text-accent-foreground bg-accent/10">
              {ach}
            </Badge>
          ))}
           <p className="text-muted-foreground col-span-full text-center">More achievements coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}

    