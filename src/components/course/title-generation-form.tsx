"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateCourseTitle, type GenerateCourseTitleOutput } from "@/ai/flows/generate-course-title";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  category: z.string().min(3, "Category must be at least 3 characters long."),
  topic: z.string().min(3, "Topic must be at least 3 characters long."),
});

type FormData = z.infer<typeof formSchema>;

export default function TitleGenerationForm() {
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setSuggestedTitles([]);

    try {
      const result: GenerateCourseTitleOutput = await generateCourseTitle(data);
      if (result.titles && result.titles.length > 0) {
        setSuggestedTitles(result.titles);
        toast({
          title: "Titles Generated!",
          description: "AI has successfully suggested some course titles.",
          variant: "default",
        });
      } else {
        setError("The AI couldn't generate titles for this input. Please try different keywords.");
         toast({
          title: "No Titles Generated",
          description: "The AI couldn't generate titles. Try different keywords.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error generating titles:", e);
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error Generating Titles",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="category" className="text-base">Course Category</Label>
          <Input
            id="category"
            placeholder="e.g., Marketing, Programming, Design"
            {...register("category")}
            className={errors.category ? "border-destructive focus-visible:ring-destructive" : ""}
            aria-invalid={errors.category ? "true" : "false"}
          />
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic" className="text-base">Course Topic</Label>
          <Input
            id="topic"
            placeholder="e.g., SEO, React, UI/UX Principles"
            {...register("topic")}
            className={errors.topic ? "border-destructive focus-visible:ring-destructive" : ""}
            aria-invalid={errors.topic ? "true" : "false"}
          />
          {errors.topic && (
            <p className="text-sm text-destructive">{errors.topic.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Titles
            </>
          )}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {suggestedTitles.length > 0 && (
        <Card className="bg-gradient-to-br from-accent/5 to-background shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center text-accent">
              <Lightbulb className="mr-2 h-6 w-6" /> Suggested Titles
            </CardTitle>
            <CardDescription>Here are some AI-powered title suggestions for your course:</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 list-disc list-inside text-foreground/90">
              {suggestedTitles.map((title, index) => (
                <li key={index} className="p-2 rounded-md hover:bg-accent/10 transition-colors">
                  {title}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => {
              setSuggestedTitles([]);
              reset();
              toast({ description: "Suggestions cleared." });
            }}>
              Clear Suggestions & Start Over
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
