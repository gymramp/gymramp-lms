import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Users } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  dataAiHint: string;
  category: string;
  author: string;
  price?: number;
  rating?: number;
  reviews?: number;
}

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg">
      <CardHeader className="p-0 relative">
        <Image
          src={course.imageUrl}
          alt={course.title}
          width={600}
          height={400}
          className="object-cover w-full h-48"
          data-ai-hint={course.dataAiHint}
        />
         <Badge variant="secondary" className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur-sm">
          {course.category}
        </Badge>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="text-xl font-semibold mb-2 line-clamp-2">{course.title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground mb-3 line-clamp-3">{course.description}</CardDescription>
        <p className="text-xs text-muted-foreground">By {course.author}</p>
      </CardContent>
      <CardFooter className="p-6 pt-0 flex flex-col items-start gap-3">
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
          {course.rating && course.reviews && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>{course.rating.toFixed(1)}</span>
              <span>({course.reviews.toLocaleString()})</span>
            </div>
          )}
          {course.price && (
             <span className="text-lg font-semibold text-primary">${course.price.toFixed(2)}</span>
          )}
        </div>
        <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          View Course
        </Button>
      </CardFooter>
    </Card>
  );
}
