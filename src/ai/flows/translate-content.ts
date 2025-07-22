
'use server';

/**
 * @fileOverview AI-powered content translation flow.
 *
 * This file contains a Genkit flow that translates lesson content
 * from English to a specified target language.
 */

import { ai } from '@/ai/genkit';
import {
  TranslateContentInputSchema,
  type TranslateContentInput,
  TranslateContentOutputSchema,
  type TranslateContentOutput
} from '@/types/course';


// Export the main function to trigger the translation flow
export async function translateContent(input: TranslateContentInput): Promise<TranslateContentOutput> {
  return translateContentFlow(input);
}

// Define the prompt for the AI model
const translateContentPrompt = ai.definePrompt({
  name: 'translateContentPrompt',
  input: { schema: TranslateContentInputSchema },
  output: { schema: TranslateContentOutputSchema },
  prompt: `You are a professional translator specializing in educational content.
  Translate the following lesson title and content from English to the target language identified by the locale code: {{targetLocale}}.

  **IMPORTANT INSTRUCTIONS:**
  1.  Do NOT translate or alter any HTML tags. Preserve the original HTML structure exactly.
  2.  Translate the text content within the HTML tags accurately and naturally for the target language.
  3.  Translate all text, including text found inside single ('') or double ("") quotation marks. Do not treat quoted text as code or as a placeholder that should be ignored.
  4.  Return the translated title and content in the specified JSON format.

  **Original Title:**
  {{{sourceTitle}}}

  **Original HTML Content:**
  {{{sourceContent}}}

  Translate the above into language code: {{targetLocale}}.
  `,
});

// Define the Genkit flow
const translateContentFlow = ai.defineFlow(
  {
    name: 'translateContentFlow',
    inputSchema: TranslateContentInputSchema,
    outputSchema: TranslateContentOutputSchema,
  },
  async (input) => {
    // Call the prompt and return the output
    const { output } = await translateContentPrompt(input);
    return output!;
  }
);
