"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { formatUsdcBase, pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import { instructionsToVersionedTx } from "@/lib/solana";
import type {
  ClaimBuildResponse,
  CreatorFeesClaimBuildResponse,
  Json,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import { StepBadge } from "@/components/StepBadge";

type ClaimMode = "win" | "creator-fees";

type BuiltClaim = ClaimBuildResponse | CreatorFeesClaimBuildResponse;

function isWinBuild(b: BuiltClaim): b is ClaimBuildResponse {
  return "winningShares" in b;
}

export function ClaimFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { claimPreset, clearClaimPreset, openTrades } = useTabNav();

  const [mode, setMode] = useState<ClaimMode>("win");
  const [marketId, setMarketId] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<BuiltClaim | undefined>();
  const [buildRaw, setBuildRaw] = useState<Json>();
  const [signature, setSignature] = useState<string | undefined>();

  useEffect(() => {
    if (claimPreset?.marketId) {
      setMarketId(claimPreset.marketId);
      setMode("win");
      clearClaimPreset();
    }
  }, [claimPreset, clearClaimPreset]);

  const resetBuild = () => {
    setBuild(undefined);
    setBuildRaw(undefined);
    setSignature(undefined);
    setStep(0);
    setError(null);
  };

  const switchMode = (next: ClaimMode) => {
    if (next === mode) return;
    setMode(next);
    resetBuild();
  };

  const requireReady = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
    if (!publicKey) throw new Error("Connect a wallet");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");
  };

  const runBuild = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim()) throw new Error("marketId required");
      const path =
        mode === "win" ? "/claim/build/" : "/claim/creator-fees/build/";
      const { data, raw } = await pantaFetch<BuiltClaim>(path, {
        method: "POST",
        apiKey: settings.apiKey,
        body: {
          wallet: publicKey!.toBase58(),
          marketId: marketId.trim(),
        },
      });
      setBuild(data);
      setBuildRaw(raw);
      setSignature(undefined);
      setStep(1);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runSignBroadcast = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!build?.instructions?.length || !build.recentBlockhash) {
        throw new Error("Build first");
      }
      const tx = instructionsToVersionedTx(
        build.instructions,
        publicKey!,
        build.recentBlockhash,
      );
      const signed = await signTransaction!(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setSignature(sig);
      setStep(2);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const buildEndpoint =
    mode === "win" ? "POST /claim/build/" : "POST /claim/creator-fees/build/";

  return (
    <div className="flow">
      <div className="flow__steps">
        <StepBadge n={1} label="Build" active={step === 0} done={step >= 1} />
        <StepBadge n={2} label="Sign + send" active={step === 1} done={step >= 2} />
        {mode === "win" && (
          <StepBadge n={3} label="Report trade" active={step === 2} done={step >= 3} />
        )}
      </div>

      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <div className="tabs" role="tablist" style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              className={`tab ${mode === "win" ? "tab--on" : ""}`}
              onClick={() => switchMode("win")}
            >
              Win claim
            </button>
            <button
              type="button"
              className={`tab ${mode === "creator-fees" ? "tab--on" : ""}`}
              onClick={() => switchMode("creator-fees")}
            >
              Creator fees
            </button>
          </div>

          <h2>{mode === "win" ? "Claim winnings" : "Claim creator fees"}</h2>
          <p className="muted">
            {mode === "win" ? (
              <>
                <code>POST /claim/build/</code> after positions show{" "}
                <code>claimable: true</code>. Then sign, broadcast, optionally
                report via Trades.
              </>
            ) : (
              <>
                <code>POST /claim/creator-fees/build/</code> for a market you
                created that has graduated with nonzero fee vault balance.
                Connected wallet must be the on-chain creator. Do not report the
                signature via Trades — attribution only covers buys and win
                claims.
              </>
            )}
          </p>

          <label className="field">
            <span>marketId (event PDA)</span>
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              placeholder="From positions, markets, or register"
            />
          </label>

          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void runBuild()}
            >
              1 · Build
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !build}
              onClick={() => void runSignBroadcast()}
            >
              2 · Sign &amp; broadcast
            </button>
            {mode === "win" && (
              <button
                type="button"
                className="btn btn--accent"
                disabled={!signature || !build}
                onClick={() => {
                  openTrades({
                    signature,
                    wallet: publicKey?.toBase58(),
                    marketId: build?.marketId || marketId.trim(),
                  });
                  setStep(3);
                }}
              >
                3 · Report on Trades
              </button>
            )}
          </div>

          {build && isWinBuild(build) && (
            <div className="callout">
              <strong>Build</strong> · outcome {build.outcome} · winning shares{" "}
              {build.winningShares}
              <div>
                marketId <code>{build.marketId}</code>
              </div>
            </div>
          )}
          {build && !isWinBuild(build) && (
            <div className="callout">
              <strong>Build</strong> · claimable{" "}
              {formatUsdcBase(build.claimableFeesUsdc)} (
              <code>{build.claimableFeesUsdc}</code> base)
              <div>
                marketId <code>{build.marketId}</code>
              </div>
            </div>
          )}
          {signature && (
            <div className="callout">
              <strong>Signature</strong> <code>{signature}</code>
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title={buildEndpoint} value={buildRaw} />
          <JsonPanel
            title="Broadcast"
            value={signature ? { signature } : undefined}
            empty="Sign & broadcast to see signature"
          />
        </aside>
      </div>
    </div>
  );
}
