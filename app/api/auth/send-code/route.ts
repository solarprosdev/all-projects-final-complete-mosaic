import { NextRequest, NextResponse } from "next/server";
import { isSendGridConfigured, sendOtpEmail } from "@/lib/sendgrid";
import { setOtp } from "@/lib/otp-store";
import { isAllowedLoginEmail } from "@/lib/auth-domain";
const OTP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
const OTP_LENGTH = 7;

function generateOtp(): string {
  const array = new Uint8Array(OTP_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => OTP_CHARS[byte % OTP_CHARS.length])
    .join("");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSendGridConfigured()) {
    return NextResponse.json(
      { error: "Email service is not configured" },
      { status: 503 }
    );
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (!isAllowedLoginEmail(email)) {
    return NextResponse.json(
      { error: "Only @solarpros.io email addresses are allowed" },
      { status: 403 }
    );
  }

  const code = generateOtp();
  setOtp(email, code);

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
