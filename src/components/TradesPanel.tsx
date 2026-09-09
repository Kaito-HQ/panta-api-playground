"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type { Json, TradeReportResponse, TradeStatusResponse } from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

export function TradesPanel() {
  const { settings } = useSettings();
  const { publicKey } = useWallet();
  const { tradePreset, clearTradePreset } = useTabNav();

  const [signature, setSignature] = useState("");
  const [wallet, setWallet] = useState("");
  const [marketId, setMarketId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [clientOrderId, setClientOrderId] = useState("");
  const [userId, setUserId] = useState(settings.userId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRaw, setReportRaw] = useState<Json>();
  const [statusRaw, setStatusRaw] = useState<Json>();

  useEffect(() => {
    if (!tradePreset) return;
    if (tradePreset.signature) setSignature(tradePreset.signature);
    if (tradePreset.wallet) setWallet(tradePreset.wallet);
    if (tradePreset.marketId) setMarketId(tradePreset.marketId);
    if (tradePreset.quoteId) setQuoteId(tradePreset.quoteId);
    if (tradePreset.clientOrderId) setClientOrderId(tradePreset.clientOrderId);
    clearTradePreset();
  }, [tradePreset, clearTradePreset]);

  useEffect(() => {
    if (!wallet && publicKey) setWallet(publicKey.toBase58());
  }, [publicKey, wallet]);

  const requireKey = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
  };

  const runReport = async () => {
    setBusy(true);
    setError(null);
    try {
      requireKey();
      if (!signature.trim() || !wallet.trim() || !marketId.trim()) {
        throw new Error("signature, wallet, and marketId are required");
      }
      const body: Record<string, string> = {
        signature: signature.trim(),
        wallet: wallet.trim(),
        marketId: marketId.trim(),
      };
      if (quoteId.trim()) body.quoteId = quoteId.trim();
      if (clientOrderId.trim()) body.clientOrderId = clientOrderId.trim();
      if (userId.trim()) body.userId = userId.trim();

      const { raw } = await pantaFetch<TradeReportResponse>("/trades/", {
        method: "POST",
        apiKey: settings.apiKey,
        userId: userId.trim() || undefined,
        body,
      });
      setReportRaw(raw);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      requireKey();
      if (!signature.trim()) throw new Error("signature required");
      const query: Record<string, string> = {};
      if (userId.trim()) query.userId = userId.trim();
      const { raw } = await pantaFetch<TradeStatusResponse>(
        `/trades/${encodeURIComponent(signature.trim())}/`,
        {
          apiKey: settings.apiKey,
          query: Object.keys(query).length ? query : undefined,
        },
      );
      setStatusRaw(raw);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <h2>Trades</h2>
          <p className="muted">
            Explicit attribution: <code>POST /trades/</code> and{" "}
            <code>GET /trades/&#123;signature&#125;/</code>.
          </p>

          <label className="field">
            <span>signature</span>
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Base58 tx signature"
            />
          </label>
          <label className="field">
            <span>wallet</span>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
          </label>
          <label className="field">
            <span>marketId</span>
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
            />
          </label>
          <div className="row">
            <label className="field">
              <span>quoteId (optional)</span>
              <input
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
              />
            </label>
            <label className="field">
              <span>clientOrderId (optional)</span>
              <input
                value={clientOrderId}
                onChange={(e) => setClientOrderId(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>userId / X-User-Id (optional)</span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={settings.userId || "usr_…"}
            />
          </label>

          <div className="actions">
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy}
              onClick={() => void runReport()}
            >
              Report trade
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void runStatus()}
            >
              Get status
            </button>
          </div>
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="POST /trades/" value={reportRaw} />
          <JsonPanel title="GET /trades/{signature}/" value={statusRaw} />
        </aside>
      </div>
    </div>
  );
}
