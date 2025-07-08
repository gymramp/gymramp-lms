
'use server';

/**
 * @fileOverview AI-powered support assistant.
 *
 * This file contains a Genkit flow that answers user questions based on their role
 * and the provided help documentation context.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { helpData } from '@/lib/help-data';
import type { UserRole } from '@/types/user';

const SiteSupportInputSchema = z.object({
  query: z.string().describe("The user's question about the site."),
  userRole: z.string().describe("The role of the user asking the question (e.g., Super Admin, Staff)."),
});
export type SiteSupportInput = z.infer<typeof SiteSupportInputSchema>;

const SiteSupportOutputSchema = z.object({
  response: z.string().describe('A helpful and relevant answer to the user query.'),
});
export type SiteSupportOutput = z.infer<typeof SiteSupportOutputSchema>;


const siteSupportPrompt = ai.definePrompt({
  name: 'siteSupportPrompt',
  input: { schema: z.object({ query: z.string(), context: z.string() }) },
  output: { schema: SiteSupportOutputSchema },
  prompt: `You are a helpful and friendly support assistant for an application called GYMRAMP.
  Your goal is to answer a user's question based *only* on the context provided.
  The context provided is the official help documentation for the user's specific role.

  Analyze the user's question and the documentation. Provide a clear, concise answer drawn directly from the documentation.
  
  If the documentation does not contain the answer, you MUST state that you do not have information on that topic. Then, you MUST suggest contacting human support by providing a markdown link to email them. The link should look exactly like this: [contact our support team](mailto:support@gymramp.com).

  Do not make up answers or provide information not present in the context.

  USER'S QUESTION:
  "{{{query}}}"

  AVAILABLE DOCUMENTATION CONTEXT:
  ---
  {{{context}}}
  ---
  `,
});

const siteSupportFlow = ai.defineFlow(
  {
    name: 'siteSupportFlow',
    inputSchema: SiteSupportInputSchema,
    outputSchema: SiteSupportOutputSchema,
  },
  async (input) => {
    const userRole = input.userRole as UserRole;
    const relevantHelpTopics = helpData[userRole] || [];

    if (relevantHelpTopics.length === 0) {
      return { response: "I'm sorry, I don't have any specific help documentation for your role right now. Please [contact our support team](mailto:support@gymramp.com) for assistance." };
    }

    // Convert the array of help topics into a single markdown string
    const contextString = relevantHelpTopics
      .map(topic => `## ${topic.title}\n\n${topic.content}`)
      .join('\n\n---\n\n');

    const { output } = await siteSupportPrompt({ query: input.query, context: contextString });
    return output!;
  }
);


export async function askSiteSupport(input: SiteSupportInput): Promise<SiteSupportOutput> {
  return siteSupportFlow(input);
}
