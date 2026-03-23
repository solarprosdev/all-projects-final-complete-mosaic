import sgMail from "@sendgrid/mail";

export function isSendGridConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_FROM_EMAIL
  );
}

function initSendGrid(): void {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(key);
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  initSendGrid();

  const from = {
    email: process.env.SENDGRID_FROM_EMAIL!,
    name: process.env.SENDGRID_FROM_NAME || "Pros App",
  };
  const subject = process.env.SENDGRID_SUBJECT_LOGIN || "Verify your Pros App Portal login";
  const templateId = process.env.SENDGRID_TEMPLATE_ID_LOGIN;

  if (templateId) {
    const codeVar = process.env.SENDGRID_TEMPLATE_CODE_VAR;
    const dynamicData: Record<string, string> = {
      code,
      verification_code: code,
      otp: code,
      token: code,
      verificationCode: code,
      login_code: code,
      loginCode: code,
      one_time_code: code,
      oneTimeCode: code,
      value: code,
    };
    if (codeVar) {
      dynamicData[codeVar] = code;
    }

    await sgMail.send({
      to,
      from,
      subject,
      templateId,
      dynamicTemplateData: dynamicData,
    });
  } else {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d0d;color:#fff;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff;">Verify your login</h2>
        <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Enter the code below to sign in to your Pros App Portal.</p>
        <div style="background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-family:monospace;font-size:28px;letter-spacing:0.3em;color:#fff;font-weight:700;">${code}</span>
        </div>
        <p style="color:#71717a;font-size:12px;margin:0;">This code expires in 10 minutes and can only be used once.</p>
      </div>
    `;

    await sgMail.send({
      to,
      from,
      subject,
      text: `Your Pros App Portal login code is: ${code}\n\nThis code expires in 10 minutes.`,
      html,
    });
  }
}
