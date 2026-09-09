"use client";

import { pantaFetch } from "@/lib/api";
import type {
  Account,
  AccountDashboard,
  AccountMetricsResponse,
  AdminUser,
  AdminUserDetail,
  ApiKeyRow,
  CreateMetricRow,
  PlatformMetrics,
  TradeMetricRow,
} from "@/lib/types";

export async function fetchAccount(apiKey: string): Promise<Account> {
  const { data } = await pantaFetch<Account>("/account/", { apiKey });
  return data;
}

export async function fetchWhoami(apiKey: string): Promise<Account> {
  const { data } = await pantaFetch<Account>("/whoami/", { apiKey });
  return data;
}

export async function patchAccount(
  auth: { apiKey?: string; accessToken?: string },
  name: string,
): Promise<Account> {
  const { data } = await pantaFetch<Account>("/account/", {
    method: "PATCH",
    apiKey: auth.apiKey,
    accessToken: auth.accessToken,
    body: { name },
  });
  return data;
}

export async function fetchDashboard(auth: {
  apiKey?: string;
  accessToken?: string;
}): Promise<AccountDashboard> {
  const { data } = await pantaFetch<AccountDashboard>("/account/dashboard/", {
    apiKey: auth.apiKey,
    accessToken: auth.accessToken,
  });
  return data;
}

export async function fetchAccountMetrics(
  auth: { apiKey?: string; accessToken?: string },
  limit = 50,
): Promise<AccountMetricsResponse> {
  const { data } = await pantaFetch<AccountMetricsResponse>(
    "/account/metrics/",
    {
      apiKey: auth.apiKey,
      accessToken: auth.accessToken,
      query: { limit: String(limit) },
    },
  );
  return data;
}

/** Soft check — uses playground /api/admin-probe so non-admins don't get a browser 403. */
export async function probeIsAdmin(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin-probe", {
      headers: { Accept: "application/json", "X-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { isAdmin?: boolean };
    return Boolean(body.isAdmin);
  } catch {
    return false;
  }
}

export async function listKeys(accessToken: string): Promise<ApiKeyRow[]> {
  const { data } = await pantaFetch<{ keys: ApiKeyRow[] }>("/account/keys/", {
    accessToken,
  });
  return data.keys || [];
}

export async function createKey(
  accessToken: string,
  body: { env: string; name?: string; revokeOthers?: boolean },
): Promise<ApiKeyRow> {
  const { data } = await pantaFetch<ApiKeyRow>("/account/keys/", {
    method: "POST",
    accessToken,
    body,
  });
  return data;
}

export async function revokeKey(
  accessToken: string,
  keyId: string,
): Promise<ApiKeyRow> {
  const { data } = await pantaFetch<ApiKeyRow>(
    `/account/keys/${encodeURIComponent(keyId)}/revoke/`,
    { method: "POST", accessToken },
  );
  return data;
}

export async function listAdminUsers(apiKey: string): Promise<AdminUser[]> {
  const { data } = await pantaFetch<{ users: AdminUser[] }>("/admin/users/", {
    apiKey,
  });
  return data.users || [];
}

export async function fetchAdminMetrics(
  apiKey: string,
): Promise<PlatformMetrics> {
  const { data } = await pantaFetch<PlatformMetrics>("/admin/metrics/", {
    apiKey,
  });
  return data;
}

export async function fetchAdminCreates(
  apiKey: string,
  limit = 50,
): Promise<CreateMetricRow[]> {
  const { data } = await pantaFetch<{ creates: CreateMetricRow[] }>(
    "/admin/metrics/creates/",
    { apiKey, query: { limit: String(limit) } },
  );
  return data.creates || [];
}

export async function fetchAdminTrades(
  apiKey: string,
  limit = 50,
): Promise<TradeMetricRow[]> {
  const { data } = await pantaFetch<{ trades: TradeMetricRow[] }>(
    "/admin/metrics/trades/",
    { apiKey, query: { limit: String(limit) } },
  );
  return data.trades || [];
}

export async function fetchAdminUserDetail(
  apiKey: string,
  userId: string,
): Promise<AdminUserDetail> {
  const { data } = await pantaFetch<AdminUserDetail>(
    `/admin/users/${encodeURIComponent(userId)}/`,
    { apiKey },
  );
  return data;
}

/** Grant/revoke create-market permission. Requires backend PATCH support. */
export async function updateAdminUser(
  apiKey: string,
  userId: string,
  body: {
    canCreateMarkets?: boolean;
    isAdmin?: boolean;
    status?: string;
    name?: string;
  },
): Promise<AdminUser> {
  const { data } = await pantaFetch<{ user?: AdminUser } & AdminUser>(
    `/admin/users/${encodeURIComponent(userId)}/`,
    { method: "PATCH", apiKey, body },
  );
  return (data.user ?? data) as AdminUser;
}
