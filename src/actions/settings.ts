'use server';

import nodemailer from 'nodemailer';

// Note: Settings are now primarily read from environment variables in the relevant actions (e.g., checkout).
// This file might be used for actions related to settings *if* they were stored elsewhere,
// or for testing connections like below.

/**
 * Attempts to verify the SMTP connection using credentials from environment variables.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function testSmtpConnection(): Promise<{success: boolean; message?: string; error?: string}> {
    console.log("[Server Action] Attempting to test SMTP connection...");

    // Read SMTP configuration from environment variables securely on the server
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
        console.error("[SMTP Test Error] Missing required SMTP environment variables.");
        return { success: false, error: "Missing required SMTP environment variables (HOST, PORT, USER, PASSWORD) on the server." };
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
            user: smtpUser,
            pass: smtpPassword,
        },
        tls: {
            // Do not fail on invalid certs if needed for specific environments (e.g., local testing),
            // but generally keep this true for production.
             rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
    });

    try {
        // Verify connection configuration
        await transporter.verify();
        console.log("[SMTP Test] Connection successful!");
        return { success: true, message: "SMTP connection verified successfully." };
    } catch (error: any) {
        console.error("[SMTP Test Error] Connection failed:", error);
        // Provide a more helpful error message if possible
        let errorMessage = `Connection failed: ${error.message}`;
        if (error.code === 'EAUTH') {
            errorMessage = "Authentication failed. Check SMTP_USER and SMTP_PASSWORD.";
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = `Connection refused. Check SMTP_HOST (${smtpHost}) and SMTP_PORT (${smtpPort}).`;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = `Connection timed out. Check SMTP_HOST (${smtpHost}) and SMTP_PORT (${smtpPort}).`;
        }
        // Consider logging the full error server-side but not sending sensitive details to the client
        return { success: false, error: errorMessage };
    }
}

// Removed saveMailSettings function as settings are now managed via environment variables.
