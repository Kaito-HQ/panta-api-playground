"use client";

import type { Json } from "./types";

export class ApiError extends Error {
  status: number;
  body: Json;

  constructor(status: number, body: Json) {
    const code =
      body && typeof body === "object" && !Array.isArray(body) && "code" in body
        ? String((body as { code: unknown }).code)
        : `HTTP ${status}`;
    super(code);
    this.status = status;
    this.body = body;
  }
}

/** Calls the Next.js proxy so the browser never hits CORS on panta-dev. */
export async function pantaFetch<T>(
  path: string,
  options: {
    method?: string;
    apiKey?: string;
    accessToken?: string;
    /** Sent as X-User-Id for attribution-aware product routes. */
    userId?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): Promise<{ data: T; raw: Json }> {
  const method = options.method || "GET";
  const qs = options.query
    ? "?" + new URLSearchParams(options.query).toString()
    : "";
  const url = `/api/panta${path.startsWith("/") ? path : `/${path}`}${qs}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.apiKey) {
    headers["X-Api-Key"] = options.apiKey;
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.userId?.trim()) {
    headers["X-User-Id"] = options.userId.trim();
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsed: Json = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as Json;
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }
  return { data: parsed as T, raw: parsed };
}

export function formatUsdcBase(base: string | number | undefined): string {
  if (base === undefined || base === "") return "—";
  const n = typeof base === "string" ? Number(base) : base;
  if (!Number.isFinite(n)) return String(base);
  return `${(n / 1_000_000).toFixed(2)} USDC`;
}
