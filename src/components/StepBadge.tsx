"use client";

export function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={`step-badge ${active ? "step-badge--active" : ""} ${done ? "step-badge--done" : ""}`}
    >
      <span className="step-badge__n">{done ? "✓" : n}</span>
      <span className="step-badge__label">{label}</span>
    </div>
  );
}
