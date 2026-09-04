"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { pantaFetch, ApiError } from "@/lib/api";
import { useState } from "react";
import type { Json } from "@/lib/types";

export function ConnectionBar() {
  const { settings, setSettings } = useSettings();
  const { publicKey } = useWallet();
  const [whoami, setWhoami] = useState<Json | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const testKey = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { raw } = await pantaFetch<Json>("/account/", {
        apiKey: settings.apiKey,
      });
      setWhoami(raw);
    } catch (e) {
      setWhoami(undefined);
      if (e instanceof ApiError) {
        setErr(`${e.message} (${e.status})`);
      } else {
        setErr(e instanceof Error ? e.message : "failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="conn-bar">
      <div className="conn-bar__brand">
        <div className="conn-bar__mark">P</div>
        <div>
          <div className="conn-bar__title">Panta API Playground</div>
          <div className="conn-bar__sub">
            Demo quote → build → sign → broadcast → confirm
          </div>
        </div>
      </div>

      <div className="conn-bar__fields">
        <label className="field">
          <span>API key</span>
          <input
            type="password"
            autoComplete="off"
            placeholder="pk_test_…"
            value={settings.apiKey}
            onChange={(e) =>
              setSettings({ ...settings, apiKey: e.target.value.trim() })
            }
          />
        </label>
        <label className="field">
          <span>Solana RPC</span>
          <input
            value={settings.rpcUrl}
            onChange={(e) =>
              setSettings({ ...settings, rpcUrl: e.target.value.trim() })
            }
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!settings.apiKey || busy}
          onClick={testKey}
        >
          {busy ? "Checking…" : "Test key"}
        </button>
        <WalletMultiButton />
      </div>

      <div className="conn-bar__meta">
        <span>
          Wallet:{" "}
          <code>{publicKey ? publicKey.toBase58() : "not connected"}</code>
        </span>
        {err && <span className="err">{err}</span>}
        {whoami && typeof whoami === "object" && !Array.isArray(whoami) && (
          <span className="ok">
            Authenticated as{" "}
            <code>
              {String(
                (whoami as { name?: string; userId?: string }).name ||
                  (whoami as { userId?: string }).userId,
              )}
            </code>
            {(whoami as { canCreateMarkets?: boolean }).canCreateMarkets
              ? " · canCreateMarkets"
              : ""}
          </span>
        )}
      </div>
    </header>
  );
}
