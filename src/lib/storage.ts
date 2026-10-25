"use client";

import type { Account } from "./types";

const KEY = "panta-playground";

export type PlaygroundSettings = {
  apiKey: string;
  rpcUrl: string;
  /** When true, every proxied call uses NEXT_PUBLIC_PANTA_STAGING_API_URL. */
  useStaging: boolean;
  account: Account | null;
  isAdmin: boolean;
  /** JWT access from /auth/register or /auth/token */
  accessToken: string;
  refreshToken: string;
  email: string;
  authName: string;
  userId: string;
};

export const defaultRpcUrl =
  process.env.NEXT_PUBLIC_DEFAULT_RPC || "https://api.devnet.solana.com";

const defaultRpc = defaultRpcUrl;

function empty(): PlaygroundSettings {
  return {
    apiKey: "",
    rpcUrl: defaultRpc,
    useStaging: false,
    account: null,
    isAdmin: false,
    accessToken: "",
    refreshToken: "",
    email: "",
    authName: "",
    userId: "",
  };
}

export function loadSettings(): PlaygroundSettings {
  if (typeof window === "undefined") {
    return empty();
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlaygroundSettings>;
      return {
        apiKey: parsed.apiKey || "",
        rpcUrl: parsed.rpcUrl || defaultRpc,
        useStaging: Boolean(parsed.useStaging),
        account: parsed.account ?? null,
        isAdmin: Boolean(parsed.isAdmin),
        accessToken: parsed.accessToken || "",
        refreshToken: parsed.refreshToken || "",
        email: parsed.email || "",
        authName: parsed.authName || "",
        userId: parsed.userId || "",
      };
    }
  } catch {
    /* ignore */
  }
  return empty();
}

export function saveSettings(settings: PlaygroundSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
