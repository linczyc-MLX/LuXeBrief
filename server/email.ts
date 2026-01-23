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
  sessionType?: "lifestyle" | "living" | "taste";
}

export async function sendLuXeBriefInvitation(params: LuXeBriefInvitationParams): Promise<boolean> {
  const { clientName, clientEmail, projectName, invitationUrl, principalType, sessionType = "lifestyle" } = params;

  const roleLabel = principalType === "principal" ? "Principal" : "Secondary Stakeholder";

  // Conditional content based on questionnaire type
  let questionnaireType: string;
  let questionnaireDescription: string;

  switch (sessionType) {
    case "living":
      questionnaireType = "Living";
      questionnaireDescription = "This form-based questionnaire will help us understand your space requirements and preferences to create a residence that perfectly suits your needs.";
      break;
    case "taste":
      questionnaireType = "Taste Exploration";
      questionnaireDescription = "This visual questionnaire will help us understand your design preferences through a series of image comparisons. Simply choose your favorites and least favorites to reveal your unique design DNA.";
      break;
    default:
      questionnaireType = "Lifestyle";
      questionnaireDescription = "This voice-guided experience will help us understand your daily routines, preferences, and lifestyle needs to create a residence that truly reflects how you live.";
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LuXeBrief ${questionnaireType} Questionnaire</title>
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
                    <p style="margin: 0; color: #ffffff; font-size: 12px; opacity: 0.8;">${questionnaireType} Questionnaire</p>
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
                You've been invited to complete a LuXeBrief ${questionnaireType.toLowerCase()} questionnaire as the <strong>${roleLabel}</strong> for the <strong>${projectName}</strong> project.
              </p>

              <p style="margin: 0 0 30px; color: #666666; font-size: 15px; line-height: 1.6;">
                ${questionnaireDescription}
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

You've been invited to complete a LuXeBrief ${questionnaireType.toLowerCase()} questionnaire as the ${roleLabel} for the ${projectName} project.

${questionnaireDescription}

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
      subject: `LuXeBrief ${questionnaireType} Questionnaire - ${projectName}`,
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

// Dedicated Taste Exploration invitation email
interface TasteInvitationParams {
  clientName: string;
  clientEmail: string;
  projectName: string;
  invitationUrl: string;
  principalType: "principal" | "secondary";
}

export async function sendTasteExplorationInvitation(params: TasteInvitationParams): Promise<boolean> {
  const { clientName, clientEmail, projectName, invitationUrl, principalType } = params;

  const roleLabel = principalType === "principal" ? "Principal" : "Secondary Stakeholder";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>N4S Taste Exploration</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">N4S</h1>
                    <p style="margin: 5px 0 0; color: #C9A962; font-size: 14px; letter-spacing: 1px;">TASTE EXPLORATION</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero section -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 15px; color: #1a365d; font-size: 26px; font-weight: 600;">
                Discover Your Design DNA
              </h2>
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Welcome, ${clientName}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                As the <strong>${roleLabel}</strong> for the <strong>${projectName}</strong> project, we invite you to complete a visual design exploration that will help us understand your aesthetic preferences.
              </p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px; color: #1a365d; font-size: 14px; font-weight: 600;">How It Works:</p>
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.8;">
                  🖼️ View sets of four interior design images<br>
                  ⭐ Select your favorite and second favorite<br>
                  👎 Choose your least preferred option<br>
                  📊 Your choices reveal your unique design DNA
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 25px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #C9A962 0%, #b8943c 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(201,169,98,0.3);">
                      Begin Exploration
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5; text-align: center;">
                ⏱️ Takes approximately 10-15 minutes • Save progress anytime
              </p>

              <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                If the button above doesn't work, copy and paste this link:<br>
                <a href="${invitationUrl}" style="color: #1a365d; word-break: break-all; font-size: 11px;">${invitationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a365d; padding: 25px 40px;">
              <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 12px; line-height: 1.5; text-align: center;">
                Your responses are confidential and will guide your design journey.<br>
                <span style="color: #C9A962;">© 2026 N4S Luxury Residential Advisory</span>
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
TASTE EXPLORATION - Discover Your Design DNA

Welcome, ${clientName}

As the ${roleLabel} for the ${projectName} project, we invite you to complete a visual design exploration that will help us understand your aesthetic preferences.

HOW IT WORKS:
- View sets of four interior design images
- Select your favorite and second favorite
- Choose your least preferred option
- Your choices reveal your unique design DNA

Click here to begin: ${invitationUrl}

Takes approximately 10-15 minutes. You can save your progress and return anytime.

---
Your responses are confidential and will guide your design journey.
© 2026 N4S Luxury Residential Advisory
`;

  try {
    const info = await transporter.sendMail({
      from: '"N4S Luxury Residential Advisory" <advisor@not-4.sale>',
      to: clientEmail,
      subject: `Taste Exploration - ${projectName} | N4S`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Email] Sent Taste Exploration invitation to ${clientEmail}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send Taste Exploration invitation to ${clientEmail}:`, error);
    return false;
  }
}
