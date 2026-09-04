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
import { SettingsContext } from "@/components/SettingsContext";

export function Providers({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<PlaygroundSettings>(() =>
    loadSettings(),
  );

  const setSettings = (next: PlaygroundSettings) => {
    setSettingsState(next);
    saveSettings(next);
  };

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <ConnectionProvider endpoint={settings.rpcUrl}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </SettingsContext.Provider>
  );
}
