/** Allowlisted API hosts. The browser may only choose one of these names. */

export const PANTA_TARGETS = {
  live: "https://live-api.panta.market/api/v1",
  staging: "https://staging-api.panta.market/api/v1",
} as const;

export type PantaTarget = keyof typeof PANTA_TARGETS;

export const PANTA_TARGET_HEADER = "x-panta-target";

export const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

let current: PantaTarget = "live";

export function setApiTarget(next: PantaTarget) {
  current = next;
}

export function getApiTarget(): PantaTarget {
  return current;
}

export function upstreamForTarget(
  target: string | null | undefined,
  fallback?: string,
): string {
  const key = (target || "").trim().toLowerCase();
  if (key === "live" || key === "staging") return PANTA_TARGETS[key];
  const env = (fallback || "").replace(/\/$/, "");
  return env || PANTA_TARGETS.live;
}
