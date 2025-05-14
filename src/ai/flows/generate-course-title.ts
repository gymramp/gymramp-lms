'use server';

/**
 * @fileOverview AI-powered course title generator.
 *
 * This file contains a Genkit flow that suggests course titles based on
 * the provided category and topic.
 *
 * @interface GenerateCourseTitleInput - Defines the input for the title generation.
 * @interface GenerateCourseTitleOutput - Defines the output, containing the suggested titles.
 * @function generateCourseTitle - The main function to trigger the title generation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCourseTitleInputSchema = z.object({
  category: z
    .string()
    .describe('The category of the course (e.g., Marketing, Programming, Design).'),
  topic: z.string().describe('The main topic of the course (e.g., SEO, React, UI/UX).'),
});

export type GenerateCourseTitleInput = z.infer<typeof GenerateCourseTitleInputSchema>;

const GenerateCourseTitleOutputSchema = z.object({
  titles: z
    .array(z.string())
    .describe('An array of suggested course titles that are creative and relevant.'),
});

export type GenerateCourseTitleOutput = z.infer<typeof GenerateCourseTitleOutputSchema>;

export async function generateCourseTitle(input: GenerateCourseTitleInput): Promise<GenerateCourseTitleOutput> {
  return generateCourseTitleFlow(input);
}

const generateCourseTitlePrompt = ai.definePrompt({
  name: 'generateCourseTitlePrompt',
  input: {
    schema: GenerateCourseTitleInputSchema,
  },
  output: {
    schema: GenerateCourseTitleOutputSchema,
  },
  prompt: `You are an expert in creating engaging course titles.

  Based on the category and topic provided, suggest 5 creative and relevant course titles.

  Category: {{{category}}}
  Topic: {{{topic}}}

  Return the titles as a JSON array.
  `,
});

const generateCourseTitleFlow = ai.defineFlow(
  {
    name: 'generateCourseTitleFlow',
    inputSchema: GenerateCourseTitleInputSchema,
    outputSchema: GenerateCourseTitleOutputSchema,
  },
  async input => {
    const {output} = await generateCourseTitlePrompt(input);
    return output!;
  }
);
