"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import { instructionsToVersionedTx } from "@/lib/solana";
import type { DisputeBuildResponse, Json } from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import { StepBadge } from "@/components/StepBadge";

export function DisputeFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { disputePreset } = useTabNav();

  const [marketId, setMarketId] = useState("");
  const [appliedPreset, setAppliedPreset] = useState(0);
  if (disputePreset && disputePreset.nonce !== appliedPreset) {
    setAppliedPreset(disputePreset.nonce);
    setMarketId(disputePreset.marketId);
  }
  const [side, setSide] = useState<"yes" | "no">("no");
  const [reason, setReason] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<DisputeBuildResponse | undefined>();
  const [buildRaw, setBuildRaw] = useState<Json>();
  const [signature, setSignature] = useState<string | undefined>();
  const [submitRaw, setSubmitRaw] = useState<Json>();
  const [statusRaw, setStatusRaw] = useState<Json>();

  const requireKey = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
  };

  const requireReady = () => {
    requireKey();
    if (!publicKey) throw new Error("Connect a wallet");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");
  };

  const evidence = evidenceText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const runBuild = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim()) throw new Error("marketId required");
      if (!reason.trim()) throw new Error("reason is required");
      if (evidence.length < 1 || evidence.length > 5) {
        throw new Error("Provide 1 to 5 evidence URLs, one per line");
      }
      const { data, raw } = await pantaFetch<DisputeBuildResponse>(
        `/markets/${encodeURIComponent(marketId.trim())}/dispute/build/`,
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: {
            wallet: publicKey!.toBase58(),
            reason: reason.trim(),
            evidence,
            side,
          },
        },
      );
      setBuild(data);
      setBuildRaw(raw);
      setSignature(undefined);
      setSubmitRaw(undefined);
      setStatusRaw(undefined);
      setStep(data.instructions?.length ? 1 : 3);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runSign = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!build?.instructions?.length || !build.recentBlockhash) {
        throw new Error(
          "No instructions to sign. A pk_test_ key returns sandbox fixtures, or this wallet already has a verified dispute.",
        );
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
      if (build.lastValidBlockHeight) {
        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: build.recentBlockhash,
            lastValidBlockHeight: build.lastValidBlockHeight,
          },
          "confirmed",
        );
      }
      setSignature(sig);
      setStep(2);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!build?.disputeId || !signature) {
        throw new Error("Build and broadcast first");
      }
      const { data, raw } = await pantaFetch<DisputeBuildResponse>(
        `/markets/${encodeURIComponent(marketId.trim())}/dispute/`,
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: {
            disputeId: build.disputeId,
            wallet: publicKey!.toBase58(),
            signature,
          },
        },
      );
      setSubmitRaw(raw);
      setStatusRaw(raw);
      setBuild((prev) => ({ ...prev, ...data }));
      setStep(3);
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
      const wallet = publicKey?.toBase58();
      if (!marketId.trim() || !wallet) {
        throw new Error("marketId and a connected wallet are required");
      }
      const { data, raw } = await pantaFetch<DisputeBuildResponse>(
        `/markets/${encodeURIComponent(marketId.trim())}/dispute/`,
        {
          apiKey: settings.apiKey,
          query: { wallet },
        },
      );
      setStatusRaw(raw);
      setBuild((prev) => ({ ...prev, ...data, marketId: data.marketId || marketId.trim() }));
      setStep(Math.max(step, 3));
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow">
      <div className="flow__steps">
        <StepBadge n={1} label="Build" active={step === 0} done={step >= 1} />
        <StepBadge n={2} label="Sign + send" active={step === 1} done={step >= 2} />
        <StepBadge n={3} label="Submit" active={step === 2} done={step >= 3} />
        <StepBadge n={4} label="Status" active={step >= 3} done={Boolean(statusRaw)} />
      </div>

      {!settings.useStaging && (
        <div className="banner banner--warn">
          Dispute routes are on the staging URL. Turn <strong>Staging on</strong>{" "}
          in the bar.
        </div>
      )}
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <h2>Dispute</h2>
          <p className="muted">
            File a dispute after the oracle proposes an outcome and before that
            proposal is finalized. The wallet must hold shares, and{" "}
            <code>side</code> must oppose the proposal. One dispute per market.
            Reason and evidence stay off-chain.
          </p>

          <label className="field">
            <span>marketId (event PDA)</span>
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
            />
          </label>
          <label className="field">
            <span>side (opposite of the oracle)</span>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as "yes" | "no")}
            >
              <option value="no">no</option>
              <option value="yes">yes</option>
            </select>
          </label>
          <label className="field">
            <span>reason</span>
            <textarea
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why the proposed outcome is wrong"
            />
          </label>
          <label className="field">
            <span>evidence URLs (1–5, one per line)</span>
            <textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder={"https://source.example/report"}
            />
          </label>

          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={runBuild}>
              1 · Build
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !build?.instructions?.length}
              onClick={runSign}
            >
              2 · Sign &amp; broadcast
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy || !signature || !build?.disputeId}
              onClick={runSubmit}
            >
              3 · Submit
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy || !marketId.trim()}
              onClick={runStatus}
            >
              Status
            </button>
          </div>

          {build?.disputeId && (
            <div className="callout">
              <strong>disputeId</strong> <code>{build.disputeId}</code>
              {build.status && (
                <div>
                  status {build.status}
                  {build.outcome ? ` · outcome ${build.outcome}` : ""}
                </div>
              )}
              {!build.instructions?.length && (
                <div className="muted">
                  No instructions in this response. If status is already set,
                  do not sign again.
                </div>
              )}
            </div>
          )}
          {signature && (
            <div className="callout">
              <strong>Signature</strong> <code>{signature}</code>
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="POST /markets/{id}/dispute/build/" value={buildRaw} />
          <JsonPanel
            title="Broadcast"
            value={signature ? { signature } : undefined}
            empty="Sign and broadcast to see the signature"
          />
          <JsonPanel title="POST /markets/{id}/dispute/" value={submitRaw} />
          <JsonPanel title="GET /markets/{id}/dispute/" value={statusRaw} />
        </aside>
      </div>
    </div>
  );
}
