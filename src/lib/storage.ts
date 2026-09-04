"use client";

const KEY = "panta-playground";

export type PlaygroundSettings = {
  apiKey: string;
  rpcUrl: string;
};

export function loadSettings(): PlaygroundSettings {
  if (typeof window === "undefined") {
    return {
      apiKey: "",
      rpcUrl: process.env.NEXT_PUBLIC_DEFAULT_RPC || "https://api.devnet.solana.com",
    };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlaygroundSettings>;
      return {
        apiKey: parsed.apiKey || "",
        rpcUrl:
          parsed.rpcUrl ||
          process.env.NEXT_PUBLIC_DEFAULT_RPC ||
          "https://api.devnet.solana.com",
      };
    }
  } catch {
    /* ignore */
  }
  return {
    apiKey: "",
    rpcUrl: process.env.NEXT_PUBLIC_DEFAULT_RPC || "https://api.devnet.solana.com",
  };
}

export function saveSettings(settings: PlaygroundSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
