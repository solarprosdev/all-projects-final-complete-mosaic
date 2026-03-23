import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/session";

export async function POST(): Promise<NextResponse> {
  await deleteSessionCookie();
  return NextResponse.json({ success: true });
}
