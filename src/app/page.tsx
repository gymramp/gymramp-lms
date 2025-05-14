import CourseCard from '@/components/course/course-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const courses = [
  {
    id: '1',
    title: 'Ultimate Web Development Bootcamp',
    description: 'Learn full-stack web development with HTML, CSS, JavaScript, React, Node.js, and more. From zero to hero!',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'web development',
    category: 'Programming',
    author: 'Dr. Angela Yu',
    price: 49.99,
    rating: 4.8,
    reviews: 12500,
  },
  {
    id: '2',
    title: 'Digital Marketing Masterclass',
    description: 'Master SEO, content marketing, social media, email marketing, and analytics to grow any business online.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'digital marketing',
    category: 'Marketing',
    author: 'Neil Patel',
    price: 79.99,
    rating: 4.7,
    reviews: 8200,
  },
  {
    id: '3',
    title: 'UI/UX Design Essentials',
    description: 'A comprehensive guide to user interface and user experience design. Learn Figma, prototyping, and design thinking.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'ui ux design',
    category: 'Design',
    author: 'Sarah Doody',
    price: 59.99,
    rating: 4.9,
    reviews: 9500,
  },
   {
    id: '4',
    title: 'Python for Data Science and Machine Learning',
    description: 'Learn Python for data analysis, visualization, and machine learning. Includes hands-on projects.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'data science',
    category: 'Data Science',
    author: 'Jose Portilla',
    price: 69.99,
    rating: 4.6,
    reviews: 15300,
  },
  {
    id: '5',
    title: 'Graphic Design Fundamentals',
    description: 'Explore the core principles of graphic design including typography, color theory, and layout composition.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'graphic design',
    category: 'Design',
    author: 'Ellen Lupton',
    price: 39.99,
    rating: 4.5,
    reviews: 7800,
  },
  {
    id: '6',
    title: 'The Complete Guide to Photography',
    description: 'Master your camera and learn to take stunning photos with this comprehensive photography course.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'photography landscape',
    category: 'Photography',
    author: 'Peter McKinnon',
    price: 89.99,
    rating: 4.9,
    reviews: 11200,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-16 bg-gradient-to-r from-primary/10 via-background to-accent/10 rounded-lg shadow-sm">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl md:text-7xl">
          Welcome to <span className="text-accent">Gymramp LMS</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-foreground/80 sm:text-xl">
          Unlock your potential with our expert-led courses. Start learning today and achieve your goals.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link href="/#courses">Explore Courses</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-primary text-primary hover:bg-primary/10">
            <Link href="/manage-courses">Create a Course</Link>
          </Button>
        </div>
      </section>

      <section id="courses" className="space-y-8">
        <h2 className="text-3xl font-bold text-center text-primary">Featured Courses</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>
    </div>
  );
}
