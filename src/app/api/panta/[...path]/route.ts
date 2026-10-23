import http from "node:http";
import https from "node:https";
import { NextRequest, NextResponse } from "next/server";
import { PANTA_TARGET_HEADER, upstreamForTarget } from "@/lib/target";

function upstreamFor(req: NextRequest): string {
  return upstreamForTarget(
    req.headers.get(PANTA_TARGET_HEADER),
    process.env.PANTA_API_BASE_URL,
  );
}

/**
 * Live API sits behind Cloudflare. Next's patched fetch speaks HTTP/2 and
 * drops slow responses (GET /admin/users/ computes per-user metrics) with
 * TypeError "terminated". Node's http client stays on HTTP/1.1 and waits
 * through a silent upstream, up to the API's ~60s proxy/worker limit.
 */
const UPSTREAM_IDLE_MS = 55_000;

type Ctx = { params: Promise<{ path: string[] }> };

type UpstreamResult = {
  status: number;
  contentType: string;
  text: string;
};

function requestUpstream(
  url: URL,
  method: string,
  headers: Headers,
  body: string | undefined,
): Promise<UpstreamResult> {
  const lib = url.protocol === "https:" ? https : http;
  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method, headers: headerRecord, timeout: UPSTREAM_IDLE_MS },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const rawType = res.headers["content-type"];
          resolve({
            status: res.statusCode ?? 502,
            contentType: Array.isArray(rawType)
              ? rawType[0]
              : rawType || "application/json",
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("upstream_timeout"));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function forward(req: NextRequest, ctx: Ctx) {
  const upstreamBase = upstreamFor(req);
  const { path } = await ctx.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const url = new URL(`${upstreamBase}/${suffix}/`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  console.log(`[panta] ${req.method} ${url.toString()}`);

  const headers = new Headers();
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) headers.set("X-Api-Key", apiKey);
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  const userId = req.headers.get("x-user-id");
  if (userId) headers.set("X-User-Id", userId);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Accept", "application/json");

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    const upstream = await requestUpstream(url, req.method, headers, body);
    return new NextResponse(upstream.text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "proxy_failed";
    return NextResponse.json(
      {
        code: "PROXY_UNREACHABLE",
        detail: message,
        upstream: upstreamBase,
      },
      { status: 502 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
