
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
  const appLogoUrlEmail = process.env.NEXT_PUBLIC_APP_LOGO_URL_EMAIL; // Optional: URL for email logo

  // Inspired by Google AI Studio email
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #121212; color: #E8EAED; font-family: Arial, sans-serif; }
            .email-container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #202124; padding: 0; }
            .header { padding: 20px 30px; text-align: left; border-bottom: 1px solid #3c4043; }
            .header-app-name { font-size: 20px; font-weight: bold; color: #E8EAED; text-decoration: none; }
            .header-logo { max-height: 30px; width: auto; margin-bottom: 10px; }
            .content { padding: 30px; text-align: center; }
            .welcome-text { font-size: 28px; font-weight: bold; color: #FFFFFF; margin-top: 0; margin-bottom: 10px; }
            .sub-heading { font-size: 18px; color: #bdc1c6; margin-bottom: 30px; }
            .greeting { font-size: 16px; color: #E8EAED; text-align: left; margin-bottom: 15px; }
            .credentials-intro { font-size: 16px; color: #E8EAED; text-align: left; margin-bottom: 20px; }
            .credentials-box { background-color: #2d2e30; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: left; }
            .credentials-box p { margin: 8px 0; font-size: 15px; color: #E8EAED; }
            .credentials-box strong { color: #bdc1c6; }
            .button-cta { display: inline-block; background-color: #1a73e8; color: #FFFFFF !important; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; margin-top: 10px; margin-bottom: 20px; }
            .password-note { font-size: 14px; color: #bdc1c6; margin-bottom: 30px; }
            .footer { padding: 20px 30px; text-align: center; font-size: 14px; color: #9aa0a6; border-top: 1px solid #3c4043; }
            .view-online { text-align: right; font-size: 12px; padding: 10px 20px; background-color: #000000; color: #9aa0a6; }
            .view-online a { color: #9aa0a6; text-decoration: underline; }
            a { color: #8ab4f8; text-decoration: none; }
        </style>
    </head>
    <body style="margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #121212; color: #E8EAED; font-family: Arial, sans-serif;">
        <div class="view-online" style="text-align: right; font-size: 12px; padding: 10px 20px; background-color: #000000; color: #9aa0a6;">
            Email not displaying correctly? <a href="${loginUrl}" style="color: #9aa0a6; text-decoration: underline;">View it online</a>
        </div>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" style="padding: 0;">
                    <div class="email-container" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #202124; padding: 0;">
                        <div class="header" style="padding: 20px 30px; text-align: left; border-bottom: 1px solid #3c4043;">
                            ${appLogoUrlEmail ? `<img src="${appLogoUrlEmail}" alt="${appName} Logo" class="header-logo" style="max-height: 30px; width: auto; margin-bottom: 10px;" />` : `<a href="${loginUrl}" class="header-app-name" style="font-size: 20px; font-weight: bold; color: #E8EAED; text-decoration: none;">${appName}</a>`}
                        </div>
                        <div class="content" style="padding: 40px 30px; text-align: center;">
                            <h1 class="welcome-text" style="font-size: 28px; font-weight: bold; color: #FFFFFF; margin-top: 0; margin-bottom: 10px;">Welcome to ${appName}, ${name}!</h1>
                            <p class="sub-heading" style="font-size: 18px; color: #bdc1c6; margin-bottom: 30px;">Your training journey starts now.</p>
                            
                            <p class="greeting" style="font-size: 16px; color: #E8EAED; text-align: left; margin-bottom: 15px;">Hello ${name},</p>
                            <p class="credentials-intro" style="font-size: 16px; color: #E8EAED; text-align: left; margin-bottom: 20px;">Your account has been successfully created. You can now log in using the credentials below:</p>
                            
                            <div class="credentials-box" style="background-color: #2d2e30; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: left;">
                                <p style="margin: 8px 0; font-size: 15px; color: #E8EAED;"><strong style="color: #bdc1c6;">Email:</strong> ${to}</p>
                                <p style="margin: 8px 0; font-size: 15px; color: #E8EAED;"><strong style="color: #bdc1c6;">Temporary Password:</strong> ${temporaryPassword}</p>
                            </div>
                            
                            <a href="${loginUrl}" class="button-cta" style="display: inline-block; background-color: #1a73e8; color: #FFFFFF !important; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; margin-top: 10px; margin-bottom: 20px;">Login to Your Account</a>
                            
                            <p class="password-note" style="font-size: 14px; color: #bdc1c6; margin-bottom: 30px;">For your security, you will be required to change this temporary password upon your first login.</p>
                            
                            <p style="font-size: 16px; color: #E8EAED; margin-top: 30px; text-align: left;">If you have any questions or need assistance, please don't hesitate to contact support.</p>
                        </div>
                        <div class="footer" style="padding: 20px 30px; text-align: center; font-size: 14px; color: #9aa0a6; border-top: 1px solid #3c4043;">
                            <p>Thanks,<br>The ${appName} Team</p>
                            <p style="font-size: 12px;">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
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

