"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { ApiError, pantaFetch } from "@/lib/api";
import { instructionsToVersionedTx } from "@/lib/solana";
import type {
  Json,
  PrimaryBuildResponse,
  PrimaryQuoteResponse,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import { StepBadge } from "@/components/StepBadge";

export function PrimaryBuyFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amountUsdc, setAmountUsdc] = useState("20.00");
  const [maxSlippageBps, setMaxSlippageBps] = useState(100);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quote, setQuote] = useState<PrimaryQuoteResponse | undefined>();
  const [quoteRaw, setQuoteRaw] = useState<Json>();
  const [build, setBuild] = useState<PrimaryBuildResponse | undefined>();
  const [buildRaw, setBuildRaw] = useState<Json>();
  const [signature, setSignature] = useState<string | undefined>();
  const [submitRaw, setSubmitRaw] = useState<Json>();
  const [verifyRaw, setVerifyRaw] = useState<Json>();

  const requireReady = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
    if (!publicKey) throw new Error("Connect a wallet");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");
  };

  const runQuote = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim()) throw new Error("marketId required");
      const { data, raw } = await pantaFetch<PrimaryQuoteResponse>(
        "/primaryorderquote/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: {
            wallet: publicKey!.toBase58(),
            marketId: marketId.trim(),
            side,
            amountUsdc,
          },
        },
      );
      setQuote(data);
      setQuoteRaw(raw);
      setBuild(undefined);
      setBuildRaw(undefined);
      setSignature(undefined);
      setSubmitRaw(undefined);
      setVerifyRaw(undefined);
      setStep(1);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runBuild = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!quote?.quoteId) throw new Error("Quote first");
      const { data, raw } = await pantaFetch<PrimaryBuildResponse>(
        "/primaryorderbuild/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: {
            quoteId: quote.quoteId,
            wallet: publicKey!.toBase58(),
            maxSlippageBps: Number(maxSlippageBps),
          },
        },
      );
      setBuild(data);
      setBuildRaw(raw);
      setSignature(undefined);
      setSubmitRaw(undefined);
      setVerifyRaw(undefined);
      setStep(2);
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
      setStep(3);
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
      if (!build?.orderId || !signature) throw new Error("Need orderId + signature");
      const { raw } = await pantaFetch<Json>("/primaryordersubmit/", {
        method: "POST",
        apiKey: settings.apiKey,
        body: {
          orderId: build.orderId,
          signature,
          wallet: publicKey!.toBase58(),
        },
      });
      setSubmitRaw(raw);
      setStep(4);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!build?.orderId) throw new Error("Build first");
      const { raw } = await pantaFetch<Json>("/primaryorderverify/", {
        method: "POST",
        apiKey: settings.apiKey,
        body: {
          orderId: build.orderId,
          signature,
          wallet: publicKey!.toBase58(),
        },
      });
      setVerifyRaw(raw);
      setStep(Math.max(step, 4));
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow">
      <div className="flow__steps">
        <StepBadge n={1} label="Quote" active={step === 0} done={step >= 1} />
        <StepBadge n={2} label="Build" active={step === 1} done={step >= 2} />
        <StepBadge n={3} label="Sign + send" active={step === 2} done={step >= 3} />
        <StepBadge n={4} label="Submit / verify" active={step >= 3} done={step >= 4} />
      </div>

      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <h2>Primary buy</h2>
          <p className="muted">
            Amounts are human-readable USDC strings (e.g. <code>20.00</code>).
            Build returns instructions — this app compiles the versioned tx.
          </p>

          <label className="field">
            <span>marketId (event PDA)</span>
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              placeholder="From create register response"
            />
          </label>
          <div className="row">
            <label className="field">
              <span>Side</span>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as "yes" | "no")}
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label className="field">
              <span>amountUsdc</span>
              <input
                value={amountUsdc}
                onChange={(e) => setAmountUsdc(e.target.value)}
              />
            </label>
            <label className="field">
              <span>maxSlippageBps</span>
              <input
                type="number"
                value={maxSlippageBps}
                onChange={(e) => setMaxSlippageBps(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={runQuote}>
              1 · Quote
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !quote}
              onClick={runBuild}
            >
              2 · Build
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !build}
              onClick={runSignBroadcast}
            >
              3 · Sign &amp; broadcast
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !signature}
              onClick={runSubmit}
            >
              4a · Submit
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy || !build}
              onClick={runVerify}
            >
              4b · Verify
            </button>
          </div>

          {quote && (
            <div className="callout">
              <strong>Quote</strong>
              <div>
                {quote.shares} shares @ avg {quote.avgPrice} · fee {quote.feeUsdc}{" "}
                USDC
              </div>
              <div>
                quoteId <code>{quote.quoteId}</code>
              </div>
            </div>
          )}
          {build && (
            <div className="callout">
              <strong>Build</strong> · expected {build.expectedShares} shares ·
              orderId <code>{build.orderId}</code>
            </div>
          )}
          {signature && (
            <div className="callout">
              <strong>Signature</strong> <code>{signature}</code>
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="POST /primaryorderquote/" value={quoteRaw} />
          <JsonPanel title="POST /primaryorderbuild/" value={buildRaw} />
          <JsonPanel
            title="Broadcast"
            value={signature ? { signature } : undefined}
            empty="Sign & broadcast to see signature"
          />
          <JsonPanel title="POST /primaryordersubmit/" value={submitRaw} />
          <JsonPanel title="POST /primaryorderverify/" value={verifyRaw} />
        </aside>
      </div>
    </div>
  );
}

function describeErr(e: unknown): string {
  if (e instanceof ApiError) {
    return `${e.message} · HTTP ${e.status}\n${JSON.stringify(e.body, null, 2)}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}
