
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { CheckCircle, Clock, BarChart, BookOpen, FileText, HelpCircle } from "lucide-react";
import Link from "next/link";
import { getCourseById, getLessonById, getQuizById } from '@/lib/firestore-data'; 
import type { Lesson, Quiz } from '@/types/course';

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const course = await getCourseById(params.courseId); 

  if (!course) {
    return <div className="container mx-auto text-center">Course not found.</div>;
  }

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
    <div className="container mx-auto">
       <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
        <div className="md:col-span-1 space-y-6">
           <Image
            src={course.featuredImageUrl || course.imageUrl}
            alt={`Image for ${course.title}`}
            width={800}
            height={450}
            className="w-full rounded-lg shadow-md object-cover aspect-video"
            data-ai-hint="course cover" 
             onError={(e) => {
                 const target = e.target as HTMLImageElement;
                 target.onerror = null; 
                 target.src = course.imageUrl || `https://placehold.co/800x450.png`; 
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
                 <p className="text-xs text-muted-foreground pt-4">Pricing and enrollment are managed at the Program level.</p>
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
                        const Icon = (item as Lesson).content ? FileText : HelpCircle;
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
                 <p className="text-muted-foreground">This course is typically included as part of a Program. Check available Programs for enrollment options.</p>
                 <Button size="lg" variant="outline" asChild className="mt-2">
                    <Link href="/#programs">View Programs</Link> 
                 </Button>
             </div>
        </div>
       </div>
    </div>
  );
}

    