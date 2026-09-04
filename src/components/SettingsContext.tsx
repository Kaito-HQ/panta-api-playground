"use client";

import { createContext, useContext } from "react";
import type { PlaygroundSettings } from "@/lib/storage";

type Ctx = {
  settings: PlaygroundSettings;
  setSettings: (s: PlaygroundSettings) => void;
};

export const SettingsContext = createContext<Ctx | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings requires Providers");
  return ctx;
}
