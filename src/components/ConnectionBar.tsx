"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { fetchAccount, probeIsAdmin } from "@/lib/accountApi";
import { ApiError } from "@/lib/api";
import { useState } from "react";
import Image from "next/image";

export function ConnectionBar() {
  const { settings, setSettings } = useSettings();
  const { publicKey } = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const testKey = async () => {
    setBusy(true);
    setErr(null);
    try {
      const account = await fetchAccount(settings.apiKey);
      const isAdmin = await probeIsAdmin(settings.apiKey);
      setSettings({ ...settings, account, isAdmin });
    } catch (e) {
      setSettings({ ...settings, account: null, isAdmin: false });
      if (e instanceof ApiError) {
        setErr(`${e.message} (${e.status})`);
      } else {
        setErr(e instanceof Error ? e.message : "failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const walletLabel = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : "not connected";

  return (
    <header className="conn-bar">
      <div className="conn-bar__brand">
        <div className="conn-bar__mark" aria-hidden>
          <Image
            src="/logomark.svg"
            alt=""
            width={18}
            height={18}
            priority
          />
        </div>
        <div>
          <div className="conn-bar__title">Panta API Playground</div>
          <div className="conn-bar__sub">
            Sign in · mint a key · quote → build → sign → broadcast
          </div>
        </div>
      </div>

      <div className="conn-bar__fields">
        <label className="field">
          <span>API key</span>
          <input
            type="password"
            autoComplete="off"
            placeholder="pk_test_… (for product routes)"
            value={settings.apiKey}
            onChange={(e) =>
              setSettings({
                ...settings,
                apiKey: e.target.value.trim(),
                account: null,
                isAdmin: false,
              })
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
          onClick={() => void testKey()}
        >
          {busy ? "Checking…" : "Test key"}
        </button>
        <WalletMultiButton />
      </div>

      <div className="conn-bar__meta">
        <span className="conn-bar__chip" title={publicKey?.toBase58()}>
          Wallet <code>{walletLabel}</code>
        </span>
        {settings.accessToken && (
          <span className="conn-bar__chip ok">
            JWT <code>{settings.email || "signed in"}</code>
          </span>
        )}
        {err && <span className="err">{err}</span>}
        {settings.account && (
          <span className="conn-bar__chip ok">
            Account <code>{settings.account.name}</code>
            {settings.account.canCreateMarkets ? " · create" : ""}
            {settings.isAdmin ? " · admin" : ""}
          </span>
        )}
      </div>
    </header>
  );
}
