import { NextResponse } from "next/server";
import { deleteSessionCookie, getSessionFromCookie } from "@/lib/session";
import { isAllowedLoginEmail } from "@/lib/auth-domain";

export async function GET(): Promise<NextResponse> {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAllowedLoginEmail(session.email)) {
    await deleteSessionCookie();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ email: session.email });
}
