
// src/lib/email.ts
'use server';

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

async function createTransporter(): Promise<Transporter | null> {
  try {
    // These should be server-side environment variables
    const smtpUser = process.env.SMTP_USER;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!smtpUser || !googleClientId || !googleClientSecret || !googleRefreshToken) {
      console.error('Missing Google OAuth2 credentials for email. Please check environment variables.');
      return null;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: smtpUser,
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        refreshToken: googleRefreshToken,
      },
    });
    return transporter;
  } catch (error) {
    console.error('Failed to create Nodemailer transporter:', error);
    return null;
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = await createTransporter();
  if (!transporter) {
    console.error('Email not sent: Transporter could not be created.');
    return false;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || `"Your App Name" <${process.env.SMTP_USER}>`, // Fallback if SMTP_FROM is not explicitly set
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>?/gm, ''), // Basic text version
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.to} with subject "${options.subject}"`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${options.to}:`, error);
    return false;
  }
}

export async function sendNewUserWelcomeEmail(to: string, name: string, temporaryPassword: string): Promise<boolean> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'GYMRAMP';
  const subject = `Welcome to ${appName}!`;
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  const appLogoUrlEmail = process.env.NEXT_PUBLIC_APP_LOGO_URL_EMAIL || `${loginUrl}/images/newlogo.png`;
  const accentColor = '#000000'; // Black for buttons and accents

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f3f4f6; font-family: 'Inter', Arial, sans-serif; color: #000000; }
            .email-container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { padding: 40px 30px; text-align: center; }
            .header img { max-height: 45px; width: auto; }
            .content { padding: 20px 30px 40px; }
            .headline { font-size: 28px; font-weight: 700; color: #000000; margin: 0 0 10px; text-align: center;}
            .greeting { font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px; text-align: center; }
            .credentials-box { background-color: #f8f8f8; border: 1px solid #eeeeee; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
            .credentials-box p { margin: 8px 0; font-size: 15px; color: #1f2937; }
            .credentials-box strong { font-weight: 600; }
            .button-container { text-align: center; }
            .button-cta { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .password-note { font-size: 14px; color: #666666; text-align: center; }
            .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #999999; background-color: #f8f8f8; border-top: 1px solid #eeeeee;}
            a { color: ${accentColor}; text-decoration: underline; }
        </style>
    </head>
    <body style="margin: 0; padding: 0; width: 100% !important; background-color: #f3f4f6; font-family: 'Inter', Arial, sans-serif; color: #000000;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <div class="email-container" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                        <div class="header" style="padding: 40px 30px; text-align: center;">
                            <a href="${loginUrl}" style="text-decoration: none;">
                                <img src="${appLogoUrlEmail}" alt="${appName} Logo" style="max-height: 45px; width: auto; border: 0;" />
                            </a>
                        </div>
                        <div class="content" style="padding: 20px 30px 40px;">
                            <h1 class="headline" style="font-size: 28px; font-weight: 700; color: #000000; margin: 0 0 10px; text-align: center;">Welcome, ${name}!</h1>
                            
                            <p class="greeting" style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px; text-align: center;">Your account has been successfully created. You can now log in using the credentials below:</p>
                            
                            <div class="credentials-box" style="background-color: #f8f8f8; border: 1px solid #eeeeee; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                                <p style="margin: 8px 0; font-size: 15px; color: #1f2937;"><strong style="font-weight: 600;">Email:</strong> ${to}</p>
                                <p style="margin: 8px 0; font-size: 15px; color: #1f2937;"><strong style="font-weight: 600;">Temporary Password:</strong> ${temporaryPassword}</p>
                            </div>
                            
                            <div class="button-container" style="text-align: center;">
                                <a href="${loginUrl}" class="button-cta" style="display: inline-block; background-color: ${accentColor}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0;">Login to Your Account</a>
                            </div>
                            
                            <p class="password-note" style="font-size: 14px; color: #666666; text-align: center;">For your security, you will be required to change this temporary password upon your first login.</p>
                        </div>
                        <div class="footer" style="padding: 20px 30px; text-align: center; font-size: 12px; color: #999999; background-color: #f8f8f8; border-top: 1px solid #eeeeee;">
                            <p>If you have any questions, please contact support. <br> &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}
