"use client";

import { ApiError, pantaFetch } from "@/lib/api";
import type { Account, AdminUser, ApiKeyRow } from "@/lib/types";

export async function fetchAccount(apiKey: string): Promise<Account> {
  const { data } = await pantaFetch<Account>("/account/", { apiKey });
  return data;
}

export async function probeIsAdmin(apiKey: string): Promise<boolean> {
  try {
    await pantaFetch("/admin/metrics/", { apiKey });
    return true;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      return false;
    }
    // Network / 404 — treat as not admin for nav purposes
    return false;
  }
}

export async function listKeys(apiKey: string): Promise<ApiKeyRow[]> {
  const { data } = await pantaFetch<{ keys: ApiKeyRow[] }>("/account/keys/", {
    apiKey,
  });
  return data.keys || [];
}

export async function createKey(
  apiKey: string,
  body: { env: string; name?: string; revokeOthers?: boolean },
): Promise<ApiKeyRow> {
  const { data } = await pantaFetch<ApiKeyRow>("/account/keys/", {
    method: "POST",
    apiKey,
    body,
  });
  return data;
}

export async function revokeKey(apiKey: string, keyId: string): Promise<ApiKeyRow> {
  const { data } = await pantaFetch<ApiKeyRow>(
    `/account/keys/${encodeURIComponent(keyId)}/revoke/`,
    { method: "POST", apiKey },
  );
  return data;
}

export async function listAdminUsers(apiKey: string): Promise<AdminUser[]> {
  const { data } = await pantaFetch<{ users: AdminUser[] }>("/admin/users/", {
    apiKey,
  });
  return data.users || [];
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
