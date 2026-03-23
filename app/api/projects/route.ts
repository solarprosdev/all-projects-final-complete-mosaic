import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.PROJECTS_API_URL ||
  "https://e7ttokr7mf.execute-api.us-west-1.amazonaws.com/rdsReports/";

const API_KEY =
  process.env.PROJECTS_API_KEY || "us1uAdlvDO9ivFHHS4bTRMqSpyxuE8U5MY1Cj4be";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit  = searchParams.get("limit")  ?? "25";
  const offset = searchParams.get("offset") ?? "0";
  const input  = searchParams.get("input")  ?? "";

  // Forward limit and offset exactly as the spec requires.
  // Lambda correctly maps: queryStringParameters.limit → event.limit → SQL LIMIT
  //                        queryStringParameters.offset → event.offset → SQL OFFSET
  const qs = `limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&input=${encodeURIComponent(input)}&data=all-projects-complete-mosaic`;
  const upstreamUrl = `${API_BASE}?${qs}`;

  console.log(`[projects] → ${upstreamUrl}`);

  try {
    // Do NOT send Accept-Encoding — let Node.js handle content negotiation
    // automatically. Manually requesting gzip can cause silent truncation.
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "x-api-key": API_KEY,
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      console.error(`[projects] upstream ${upstream.status}`);
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const raw = await upstream.json();

    // AWS API Gateway often serialises `body` as a JSON string — parse it if so
    let body = raw.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* leave as-is */ }
    }

    const rowCount = Array.isArray(body?.data) ? body.data.length : "?";
    console.log(`[projects] ← rows=${rowCount} count=${body?.count ?? "?"}`);

    return NextResponse.json({ ...raw, body });
  } catch (err) {
    console.error("[projects] error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
