import { NextRequest, NextResponse } from "next/server";

const UPSTREAM =
  process.env.PANTA_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000/api/v1";

/**
 * Soft admin check for the playground UI.
 * Hits upstream /admin/metrics/ server-side so the browser never sees a 403.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/admin/metrics/`, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });
    return NextResponse.json(
      { isAdmin: upstream.ok },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
