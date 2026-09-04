"use client";

import type { Json } from "@/lib/types";

export function JsonPanel({
  title,
  value,
  empty = "Waiting for response…",
}: {
  title: string;
  value: Json | undefined;
  empty?: string;
}) {
  return (
    <div className="json-panel">
      <div className="json-panel__head">{title}</div>
      <pre className="json-panel__body">
        {value === undefined
          ? empty
          : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
