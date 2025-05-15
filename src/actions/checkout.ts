
'use server';

import type { CheckoutFormData } from '@/types/user';
import { addCompany, createDefaultLocation } from '@/lib/company-data';
import { addUser } from '@/lib/user-data';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// --- Process Paid Checkout Function ---
export async function processCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processCheckout (Paid) for company:", data.companyName);
  if (data.paymentIntentId) {
    console.log("[Server Action] Payment Intent ID received:", data.paymentIntentId);
  } else {
    console.warn("[Server Action] No Payment Intent ID received. Assuming pre-verified payment or simulation.");
  }
  const originalAdminEmail = auth.currentUser?.email;
  // !! IMPORTANT: Storing admin password like this is insecure !!
  // !! This is a placeholder and needs a secure mechanism in production !!
  const originalAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "password"; 

  if (!originalAdminEmail) {
    console.error("[Server Action] Critical: Current admin email not found in auth state for processCheckout.");
    return { success: false, error: "Admin session error. Please log in again." };
  }

  try {
    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: data.selectedCourseIds || [],
        maxUsers: data.maxUsers ?? null,
        isTrial: false, 
        trialEndsAt: null,
        revSharePartnerName: data.revSharePartnerName || null,
        revSharePartnerCompany: data.revSharePartnerCompany || null,
        revSharePartnerPercentage: data.revSharePartnerPercentage ?? null,
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the company in the database.");
    }
    console.log(`[Server Action] Company "${newCompany.name}" (Paid) created with ID: ${newCompany.id}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = data.password || "password"; 
    let authUserUid: string;
    try {
        // Temporarily sign out current admin if different from new admin email to avoid conflicts
        if (auth.currentUser && auth.currentUser.email !== data.adminEmail) {
            // No need to sign out, createUserWithEmailAndPassword uses a separate auth instance context
        }
        const userCredential = await createUserWithEmailAndPassword(auth, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail} (Paid)`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create admin user in Firebase Auth (Paid):", authError);
        // Attempt to sign back in as original admin before throwing
        if (auth.currentUser?.email !== originalAdminEmail) {
          console.log(`[Server Action] Attempting to sign back in as ${originalAdminEmail} after Auth creation failure...`);
          await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword)
              .catch(e => console.error("Failed to sign back in as original admin after Auth creation error", e));
        }
        throw new Error(`Failed to create authentication account: ${authError.message}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      // Attempt to delete orphaned Auth user if Firestore add fails
      const userToDelete = auth.currentUser; // This would be the newly created user if auth flow worked
      if (userToDelete && userToDelete.uid === authUserUid) {
          await userToDelete.delete().catch(delErr => console.error("Failed to delete orphaned Auth user:", delErr));
      }
      // Attempt to sign back in as original admin before throwing
      if (auth.currentUser?.email !== originalAdminEmail) {
        console.log(`[Server Action] Attempting to sign back in as ${originalAdminEmail} after Firestore user creation failure...`);
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword)
          .catch(e => console.error("Failed to sign back in as original admin after Firestore user creation error", e));
      }
      throw new Error("Failed to create the admin user account in Firestore (Paid).");
    }
    console.log(`[Server Action] Admin user "${newAdminUser.name}" (Paid) created in Firestore`);

    // Email sending now handled by Firebase Cloud Function triggered on user creation
    // No direct call to sendWelcomeEmail here.

    // Sign back in as original admin
    if (auth.currentUser?.email !== originalAdminEmail) {
        console.log(`[Server Action] Attempting to sign back in as original admin ${originalAdminEmail} after successful paid checkout...`);
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword)
             .catch(e => console.error("Failed to sign back in as admin after paid checkout", e));
        console.log(`[Server Action] Successfully signed back in as ${originalAdminEmail}`);
    }


    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any) {
    console.error("[Server Action] Error during paid checkout processing:", error);
    // Attempt to sign back in as original admin on error
    if (auth.currentUser?.email !== originalAdminEmail) {
        console.log(`[Server Action] Attempting to sign back in as ${originalAdminEmail} after paid checkout error...`);
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword)
            .catch(e => console.error("Failed to sign back in as admin after paid checkout error", e));
    }
    return { success: false, error: error.message || "An unexpected error occurred during paid checkout." };
  }
}


// --- Process Free Trial Checkout Function ---
export async function processFreeTrialCheckout(data: CheckoutFormData): Promise<
  { success: boolean; companyId?: string; adminUserId?: string; error?: undefined }
| { success: boolean; error: string }
> {
  console.log("[Server Action] Starting processFreeTrialCheckout for company:", data.companyName);
  const originalAdminEmail = auth.currentUser?.email;
  const originalAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "password"; 

  if (!originalAdminEmail) {
    console.error("[Server Action] Critical: Current admin email not found in auth state for processFreeTrialCheckout.");
    return { success: false, error: "Admin session error. Please log in again." };
  }

  try {
    const trialDurationDays = data.trialDurationDays || 7; 
    const trialEndsDate = new Date();
    trialEndsDate.setDate(trialEndsDate.getDate() + trialDurationDays);
    const trialEndsAtTimestamp = Timestamp.fromDate(trialEndsDate);

    const newCompanyData = {
        name: data.companyName,
        assignedCourseIds: data.selectedCourseIds || [],
        maxUsers: data.maxUsers ?? null,
        isTrial: true,
        trialEndsAt: trialEndsAtTimestamp,
        revSharePartnerName: null,
        revSharePartnerCompany: null,
        revSharePartnerPercentage: null,
    };
    const newCompany = await addCompany(newCompanyData);
    if (!newCompany) {
      throw new Error("Failed to create the trial company in the database.");
    }
    console.log(`[Server Action] Trial Company "${newCompany.name}" created with ID: ${newCompany.id}, ends: ${trialEndsDate.toLocaleDateString()}`);

    const defaultLocation = await createDefaultLocation(newCompany.id);
    const defaultLocationId = defaultLocation ? [defaultLocation.id] : [];

    const tempPassword = "password"; // Default password for trial admin
    let authUserUid: string;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.adminEmail, tempPassword);
        authUserUid = userCredential.user.uid;
        console.log(`[Server Action] Trial Admin user created in Firebase Auth with UID: ${authUserUid} for email ${data.adminEmail}`);
    } catch (authError: any) {
        console.error("[Server Action] Failed to create trial admin user in Firebase Auth:", authError);
        if (auth.currentUser?.email !== originalAdminEmail) {
            await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword).catch(e => console.error("Failed to sign back in as admin after trial Auth creation error", e));
        }
        throw new Error(`Failed to create trial authentication account: ${authError.message}`);
    }

    const newAdminUserData = {
        name: data.customerName,
        email: data.adminEmail,
        role: 'Admin' as const,
        companyId: newCompany.id,
        assignedLocationIds: defaultLocationId,
    };
    const newAdminUser = await addUser(newAdminUserData);
    if (!newAdminUser) {
      const userToDelete = auth.currentUser; 
      if (userToDelete && userToDelete.uid === authUserUid) {
          await userToDelete.delete().catch(delErr => console.error("Failed to delete orphaned Auth user for trial:", delErr));
      }
      if (auth.currentUser?.email !== originalAdminEmail) {
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword).catch(e => console.error("Failed to sign back in as admin after trial Firestore user creation error", e));
      }
      throw new Error("Failed to create the trial admin user account in Firestore.");
    }
    console.log(`[Server Action] Trial Admin user "${newAdminUser.name}" created in Firestore`);

    // Email sending now handled by Firebase Cloud Function triggered on user creation

    // Sign back in as original admin
    if (auth.currentUser?.email !== originalAdminEmail) {
        console.log(`[Server Action] Attempting to sign back in as original admin ${originalAdminEmail} after successful trial checkout...`);
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword)
            .catch(e => console.error("Failed to sign back in as admin after free trial checkout", e));
        console.log(`[Server Action] Successfully signed back in as ${originalAdminEmail}`);
    }


    return { success: true, companyId: newCompany.id, adminUserId: newAdminUser.id };

  } catch (error: any) {
    console.error("[Server Action] Error during free trial checkout processing:", error);
    if (auth.currentUser?.email !== originalAdminEmail) {
        await signInWithEmailAndPassword(auth, originalAdminEmail, originalAdminPassword).catch(e => console.error("Failed to sign back in as admin after free trial checkout error", e));
    }
    return { success: false, error: error.message || "An unexpected error occurred during free trial checkout." };
  }
}


// --- Send Welcome Email Function (using Google OAuth 2.0) ---
// This function can be removed or kept for reference, but it's not called by processCheckout anymore.
// Email sending is expected to be handled by a Firebase Cloud Function triggered on user creation.
export async function sendWelcomeEmail(email: string, name: string, temporaryPassword: string): Promise<void> {
    console.log(`[sendWelcomeEmail - OAuth] Preparing to send email to ${email}`);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const mailUser = process.env.SMTP_USER;
    const mailFrom = process.env.SMTP_FROM || `"GYMRAMP" <${mailUser}>`;

    if (!clientId || !clientSecret || !refreshToken || !redirectUri || !mailUser) {
        const missingVars = [
            !clientId && "GOOGLE_CLIENT_ID",
            !clientSecret && "GOOGLE_CLIENT_SECRET",
            !refreshToken && "GOOGLE_REFRESH_TOKEN",
            !redirectUri && "GOOGLE_REDIRECT_URI",
            !mailUser && "SMTP_USER"
        ].filter(Boolean).join(", ");
        console.error(`[sendWelcomeEmail OAuth Error] Missing required Google OAuth environment variables: ${missingVars}.`);
        throw new Error("Mail server OAuth configuration is incomplete on the server. Cannot send email.");
    }

    try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        console.log("[sendWelcomeEmail - OAuth] Fetching access token...");
        const { token: accessToken } = await oauth2Client.getAccessToken();
        
        if (!accessToken) {
            console.error("[sendWelcomeEmail - OAuth] Failed to retrieve access token using refresh token. Is the refresh token valid and has the Gmail API been consented for this app?");
            throw new Error("Failed to retrieve access token using refresh token.");
        }
        console.log("[sendWelcomeEmail - OAuth] Access token fetched successfully.");

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: mailUser,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                accessToken: accessToken,
            },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
        const dashboardLink = `${appUrl}/`; // Link to the login page, which will redirect based on role


        const mailOptions = {
            from: mailFrom,
            to: email,
            subject: "Welcome to GYMRAMP!",
            text: `Hello ${name},\n\nWelcome to GYMRAMP! Your account has been created.\n\nYour email: ${email}\nYour temporary password is: ${temporaryPassword}\n\nPlease log in at ${dashboardLink} and change your password.\n\nBest regards,\nThe GYMRAMP Team`,
            html: `
                <p>Hello ${name},</p>
                <p>Welcome to GYMRAMP! Your account has been created.</p>
                <p>Your email: <strong>${email}</strong></p>
                <p>Your temporary password is: <strong>${temporaryPassword}</strong></p>
                <p>Please log in using the link below and change your password upon first login:</p>
                <p><a href="${dashboardLink}" style="background-color: #000000; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to GYMRAMP</a></p>
                <p>Best regards,<br/>The GYMRAMP Team</p>
            `,
        };

        console.log(`[sendWelcomeEmail - OAuth] Sending email via Gmail OAuth to ${email}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log("[sendWelcomeEmail - OAuth] Message sent: %s", info.messageId);

    } catch (error: any) {
        console.error("[sendWelcomeEmail - OAuth] Error sending email:", error);
         if (error.responseCode === 535 || (error.message && error.message.includes('Username and Password not accepted'))) {
            console.error("[sendWelcomeEmail - OAuth] Authentication error: Check Gmail 'App Passwords' if 2FA is enabled, or 'Less Secure App Access' settings. Ensure refresh token is valid and SMTP_USER is correct.");
        } else if (error.message && error.message.includes('invalid_grant')) {
            console.error("[sendWelcomeEmail - OAuth] Likely cause: Refresh token expired or revoked. Re-authenticate and generate a new refresh token.");
        }
        throw new Error(`Failed to send welcome email using OAuth: ${error.message || String(error)}`);
    }
}

