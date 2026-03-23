import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ email: session.email });
}
