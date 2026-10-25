import { NextRequest, NextResponse } from "next/server";
import { PANTA_TARGET_HEADER, upstreamForTarget } from "@/lib/target";

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
    const upstreamBase = upstreamForTarget(
      req.headers.get(PANTA_TARGET_HEADER),
    ).url;
    if (!upstreamBase) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }
    const upstream = await fetch(`${upstreamBase}/admin/metrics/`, {
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
