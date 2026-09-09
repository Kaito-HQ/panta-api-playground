"use client";

import { ApiError, pantaFetch } from "@/lib/api";
import type { AuthTokenResponse } from "@/lib/types";

export async function registerAccount(body: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthTokenResponse> {
  const { data } = await pantaFetch<AuthTokenResponse>("/auth/register/", {
    method: "POST",
    body,
  });
  return data;
}

export async function loginAccount(body: {
  email: string;
  password: string;
}): Promise<AuthTokenResponse> {
  const { data } = await pantaFetch<AuthTokenResponse>("/auth/token/", {
    method: "POST",
    body,
  });
  return data;
}

export async function refreshAccessToken(
  refresh: string,
): Promise<{ access: string; refresh?: string }> {
  const { data } = await pantaFetch<{ access: string; refresh?: string }>(
    "/auth/token/refresh/",
    { method: "POST", body: { refresh } },
  );
  return data;
}

/** Run a JWT-authenticated call; on 401, refresh once and retry. */
export async function withAccessToken<T>(
  accessToken: string,
  refreshToken: string,
  run: (access: string) => Promise<T>,
  onTokens?: (next: { access: string; refresh: string }) => void,
): Promise<T> {
  try {
    return await run(accessToken);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !refreshToken) {
      throw e;
    }
    const next = await refreshAccessToken(refreshToken);
    const access = next.access;
    const refresh = next.refresh || refreshToken;
    onTokens?.({ access, refresh });
    return run(access);
  }
}
