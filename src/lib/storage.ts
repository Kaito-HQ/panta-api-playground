"use client";

import type { Account } from "./types";

const KEY = "panta-playground";

export type PlaygroundSettings = {
  apiKey: string;
  rpcUrl: string;
  account: Account | null;
  isAdmin: boolean;
};

const defaultRpc =
  process.env.NEXT_PUBLIC_DEFAULT_RPC || "https://api.devnet.solana.com";

export function loadSettings(): PlaygroundSettings {
  if (typeof window === "undefined") {
    return { apiKey: "", rpcUrl: defaultRpc, account: null, isAdmin: false };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlaygroundSettings>;
      return {
        apiKey: parsed.apiKey || "",
        rpcUrl: parsed.rpcUrl || defaultRpc,
        account: parsed.account ?? null,
        isAdmin: Boolean(parsed.isAdmin),
      };
    }
  } catch {
    /* ignore */
  }
  return { apiKey: "", rpcUrl: defaultRpc, account: null, isAdmin: false };
}

export function saveSettings(settings: PlaygroundSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
