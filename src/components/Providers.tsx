"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  loadSettings,
  saveSettings,
  type PlaygroundSettings,
} from "@/lib/storage";
import { SettingsContext, useSettings } from "@/components/SettingsContext";

function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<PlaygroundSettings>(() =>
    loadSettings(),
  );

  const setSettings = (next: PlaygroundSettings) => {
    setSettingsState(next);
    saveSettings(next);
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

function WalletTree({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={settings.rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <WalletTree>{children}</WalletTree>
    </SettingsProvider>
  );
}
