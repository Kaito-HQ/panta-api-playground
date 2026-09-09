import { ApiError } from "@/lib/api";

export function describeErr(e: unknown): string {
  if (e instanceof ApiError) {
    return `${e.message} · HTTP ${e.status}\n${JSON.stringify(e.body, null, 2)}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}