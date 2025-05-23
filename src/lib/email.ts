
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
  const subject = `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME || 'Our Platform'}!`;
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Ensure your app URL is in env

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome aboard, ${name}!</h2>
      <p>Your account has been created on ${process.env.NEXT_PUBLIC_APP_NAME || 'our platform'}.</p>
      <p>You can log in with the following temporary credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${to}</li>
        <li><strong>Temporary Password:</strong> ${temporaryPassword}</li>
      </ul>
      <p>You will be required to change this password upon your first login.</p>
      <p>Please log in here: <a href="${loginUrl}" style="color: #007bff; text-decoration: none;">${loginUrl}</a></p>
      <p>If you have any questions, please don't hesitate to contact support.</p>
      <br>
      <p>Best regards,</p>
      <p>The ${process.env.NEXT_PUBLIC_APP_NAME || 'Platform'} Team</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
}
