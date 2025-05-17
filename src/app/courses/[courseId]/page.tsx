
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { CheckCircle, Clock, BarChart, BookOpen, FileText, HelpCircle } from "lucide-react"; // Added FileText, HelpCircle
import Link from "next/link";
import { getCourseById, getLessonById, getQuizById } from '@/lib/firestore-data'; 
import type { Lesson, Quiz } from '@/types/course'; // Import Lesson and Quiz types

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const course = await getCourseById(params.courseId); 

  if (!course) {
    return <div className="container mx-auto py-12 text-center">Course not found.</div>;
  }

  // Fetch details of curriculum items
  const curriculumItemDetails = await Promise.all(
    (course.curriculum || []).map(async (itemId) => {
      const [type, id] = itemId.split('-');
      if (type === 'lesson') {
        return getLessonById(id);
      }
      if (type === 'quiz') {
        return getQuizById(id);
      }
      return null;
    })
  );

  const validCurriculumItems = curriculumItemDetails.filter(Boolean) as (Lesson | Quiz)[];


  return (
    <div className="container mx-auto py-12 md:py-16 lg:py-20">
       <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
        <div className="md:col-span-1 space-y-6">
           <Image
            src={course.featuredImageUrl || course.imageUrl} // Prefer featuredImageUrl
            alt={`Image for ${course.title}`}
            width={800}
            height={450}
            className="w-full rounded-lg shadow-md object-cover aspect-video"
            data-ai-hint="course cover" 
             onError={(e) => {
                 const target = e.target as HTMLImageElement;
                 target.onerror = null; 
                 target.src = course.imageUrl || `https://picsum.photos/seed/${course.id}/800/450`; 
             }}
          />
           <Card>
            <CardHeader>
                <CardTitle className="text-xl">Course Details</CardTitle>
            </CardHeader>
             <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-primary" />
                    <span>Level: <Badge variant="secondary">{course.level}</Badge></span>
                </div>
                 <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>Duration: {course.duration}</span>
                </div>
                 <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> 
                    <span>Items: {course.curriculum?.length || 0}</span>
                </div>
                <div className="pt-4">
                    <span className="text-3xl font-bold text-primary">{course.price}</span>
                    <p className="text-xs text-muted-foreground">One-time purchase per team license</p>
                </div>
                 <Button size="lg" className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90">
                    Enroll Team Now
                 </Button>
             </CardContent>
           </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-primary">{course.title}</h1>
            <p className="text-lg text-muted-foreground">{course.description}</p>

            <div className="prose prose-lg max-w-none text-foreground">
                <h2 className="text-2xl font-semibold text-primary border-b pb-2">About This Course</h2>
                <p>{course.longDescription}</p>
            </div>

            {validCurriculumItems.length > 0 && (
                <div>
                    <h2 className="text-2xl font-semibold text-primary mb-4 border-b pb-2">What You'll Learn (Key Topics)</h2>
                    <ul className="space-y-3">
                    {validCurriculumItems.map((item, index) => {
                        const Icon = (item as Lesson).content ? FileText : HelpCircle; // Differentiate by checking for 'content' property
                        return (
                        <li key={item.id || index} className="flex items-start gap-3">
                            <Icon className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                            <span className="text-muted-foreground">{item.title}</span>
                        </li>
                        );
                    })}
                    </ul>
                </div>
            )}
             <div className="pt-6">
                 <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 mr-4">
                    Enroll Team Now
                 </Button>
                 <Button size="lg" variant="outline" asChild>
                    <Link href="/contact">Contact Sales (Enterprise)</Link>
                 </Button>
             </div>
        </div>
       </div>
    </div>
  );
}

