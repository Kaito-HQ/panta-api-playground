/** The browser may only choose a name. The URL comes from the env file. */

export type PantaTarget = "live" | "staging";

export const PANTA_TARGET_HEADER = "x-panta-target";

export const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

function cleanUrl(value: string | undefined): string {
  return (value || "").trim().replace(/\/$/, "");
}

export const PANTA_TARGETS: Record<PantaTarget, string> = {
  live: cleanUrl(process.env.NEXT_PUBLIC_PANTA_LIVE_API_URL),
  staging: cleanUrl(process.env.NEXT_PUBLIC_PANTA_STAGING_API_URL),
};

export function envNameForTarget(target: PantaTarget): string {
  return target === "staging"
    ? "NEXT_PUBLIC_PANTA_STAGING_API_URL"
    : "NEXT_PUBLIC_PANTA_LIVE_API_URL";
}

export function apiHost(url: string): string {
  if (!url) return "unset";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

let current: PantaTarget = "live";

export function setApiTarget(next: PantaTarget) {
  current = next;
}

export function getApiTarget(): PantaTarget {
  return current;
}

export function upstreamForTarget(
  target: string | null | undefined,
): { target: PantaTarget; url: string } {
  const key = (target || "").trim().toLowerCase();
  const name: PantaTarget = key === "staging" ? "staging" : "live";
  return { target: name, url: PANTA_TARGETS[name] };
}
