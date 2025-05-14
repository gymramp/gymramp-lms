import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TitleGenerationForm from "@/components/course/title-generation-form";
import { Wand2 } from "lucide-react";

export default function GenerateTitlePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <Wand2 className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold text-primary">AI Course Title Generator</h1>
        <p className="text-muted-foreground mt-2">
          Let our AI craft compelling and creative titles for your next course.
          Simply provide a category and topic to get started.
        </p>
      </div>

      <Card className="shadow-xl border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">Generate Course Titles</CardTitle>
          <CardDescription>
            Enter the category and topic for your course, and our AI will suggest some catchy titles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TitleGenerationForm />
        </CardContent>
      </Card>
    </div>
  );
}
