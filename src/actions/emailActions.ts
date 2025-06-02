'use server';

import { sendNewUserWelcomeEmail } from '@/lib/email';
import { generateRandomPassword } from '@/lib/utils';
import * as z from 'zod';

const SendTestEmailSchema = z.object({
  recipientEmail: z.string().email({ message: "Invalid email address." }),
  recipientName: z.string().min(1, { message: "Recipient name is required." }),
});

interface SendTestWelcomeEmailResult {
  success: boolean;
  message: string;
  tempPasswordUsed?: string;
}

export async function sendTestWelcomeEmailAction(formData: FormData): Promise<SendTestWelcomeEmailResult> {
  const validatedFields = SendTestEmailSchema.safeParse({
    recipientEmail: formData.get('recipientEmail'),
    recipientName: formData.get('recipientName'),
  });

  if (!validatedFields.success) {
    // Prioritize email error message if both are present
    let errorMessage = "Invalid input.";
    if (validatedFields.error.formErrors.fieldErrors.recipientEmail) {
        errorMessage = validatedFields.error.formErrors.fieldErrors.recipientEmail[0];
    } else if (validatedFields.error.formErrors.fieldErrors.recipientName) {
        errorMessage = validatedFields.error.formErrors.fieldErrors.recipientName[0];
    }
    return {
      success: false,
      message: errorMessage,
    };
  }

  const { recipientEmail, recipientName } = validatedFields.data;
  const tempPassword = generateRandomPassword();

  try {
    const emailSent = await sendNewUserWelcomeEmail(recipientEmail, recipientName, tempPassword);
    if (emailSent) {
      return {
        success: true,
        message: `Test welcome email successfully sent to ${recipientEmail}.`,
        tempPasswordUsed: tempPassword,
      };
    } else {
      return {
        success: false,
        message: `Failed to send test welcome email to ${recipientEmail}. Check server logs for details on email configuration.`,
      };
    }
  } catch (error: any) {
    console.error("[sendTestWelcomeEmailAction] Error:", error);
    return {
      success: false,
      message: error.message || "An unexpected error occurred while sending the email.",
    };
  }
}
