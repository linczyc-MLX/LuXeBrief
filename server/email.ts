import nodemailer from "nodemailer";

// SMTP Configuration for IONOS
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.ionos.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || "advisor@not-4.sale",
    pass: process.env.SMTP_PASS || "",
  },
};

// Create transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Email templates
interface LuXeBriefInvitationParams {
  clientName: string;
  clientEmail: string;
  projectName: string;
  invitationUrl: string;
  principalType: "principal" | "secondary";
}

export async function sendLuXeBriefInvitation(params: LuXeBriefInvitationParams): Promise<boolean> {
  const { clientName, clientEmail, projectName, invitationUrl, principalType } = params;

  const roleLabel = principalType === "principal" ? "Principal" : "Secondary Stakeholder";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LuXeBrief Lifestyle Questionnaire</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">N4S</h1>
                    <p style="margin: 5px 0 0; color: #c9a227; font-size: 14px;">Luxury Residential Advisory</p>
                  </td>
                  <td align="right">
                    <p style="margin: 0; color: #ffffff; font-size: 12px; opacity: 0.8;">LuXeBrief</p>
                    <p style="margin: 0; color: #ffffff; font-size: 12px; opacity: 0.8;">Lifestyle Questionnaire</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e3a5f; font-size: 22px; font-weight: 600;">
                Welcome, ${clientName}
              </h2>

              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                You've been invited to complete a LuXeBrief lifestyle questionnaire as the <strong>${roleLabel}</strong> for the <strong>${projectName}</strong> project.
              </p>

              <p style="margin: 0 0 30px; color: #666666; font-size: 15px; line-height: 1.6;">
                This voice-guided experience will help us understand your daily routines, preferences, and lifestyle needs to create a residence that truly reflects how you live.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Begin Your Questionnaire
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #999999; font-size: 13px; line-height: 1.5;">
                This questionnaire takes approximately 15-20 minutes. You can pause and resume at any time.
              </p>

              <p style="margin: 20px 0 0; color: #999999; font-size: 13px; line-height: 1.5;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <a href="${invitationUrl}" style="color: #1e3a5f; word-break: break-all;">${invitationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.5;">
                This email was sent by N4S Luxury Residential Advisory.<br>
                Your responses are confidential and will only be shared with your project team.
              </p>
              <p style="margin: 15px 0 0; color: #999999; font-size: 11px;">
                © 2026 N4S Luxury Residential Advisory. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const textContent = `
Welcome, ${clientName}

You've been invited to complete a LuXeBrief lifestyle questionnaire as the ${roleLabel} for the ${projectName} project.

This voice-guided experience will help us understand your daily routines, preferences, and lifestyle needs to create a residence that truly reflects how you live.

Click here to begin: ${invitationUrl}

This questionnaire takes approximately 15-20 minutes. You can pause and resume at any time.

---
This email was sent by N4S Luxury Residential Advisory.
Your responses are confidential and will only be shared with your project team.
© 2026 N4S Luxury Residential Advisory. All rights reserved.
`;

  try {
    const info = await transporter.sendMail({
      from: '"N4S Luxury Residential Advisory" <advisor@not-4.sale>',
      to: clientEmail,
      subject: `LuXeBrief Lifestyle Questionnaire - ${projectName}`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Email] Sent invitation to ${clientEmail}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send invitation to ${clientEmail}:`, error);
    return false;
  }
}

// Verify SMTP connection on startup
export async function verifySmtpConnection(): Promise<boolean> {
  if (!SMTP_CONFIG.auth.pass) {
    console.warn("[Email] SMTP_PASS not configured - emails will not be sent");
    return false;
  }

  try {
    await transporter.verify();
    console.log("[Email] SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("[Email] SMTP connection failed:", error);
    return false;
  }
}
