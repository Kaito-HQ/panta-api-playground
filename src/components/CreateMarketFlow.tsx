"use client";

import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { ApiError, formatUsdcBase, pantaFetch } from "@/lib/api";
import { deserializeVersionedTx } from "@/lib/solana";
import type {
  CreateBuildResponse,
  CreateQuoteResponse,
  CreateRegisterResponse,
  Json,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import { StepBadge } from "@/components/StepBadge";

const CATEGORIES = [
  "crypto",
  "sports",
  "politics",
  "entertainment",
  "finance",
  "science",
  "world",
  "other",
] as const;

function defaultTimes() {
  const now = Math.floor(Date.now() / 1000);
  const start = now + 3600;
  const end = start + 7 * 24 * 3600;
  const resolution = end + 3600;
  return { start, end, resolution };
}

export function CreateMarketFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const times = useMemo(() => defaultTimes(), []);

  const [question, setQuestion] = useState(
    "Will ETH be above $5,000 on 2027-01-01?",
  );
  const [resolutionRule, setResolutionRule] = useState(
    "CoinGecko daily close UTC ≥ 5000",
  );
  const [sources, setSources] = useState("https://www.coingecko.com");
  const [category, setCategory] = useState<string>("crypto");
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(times.start);
  const [endTime, setEndTime] = useState(times.end);
  const [resolutionTime, setResolutionTime] = useState(times.resolution);
  const [marketType, setMarketType] = useState<"standard" | "breaking">(
    "standard",
  );

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quote, setQuote] = useState<CreateQuoteResponse | undefined>();
  const [quoteRaw, setQuoteRaw] = useState<Json>();
  const [build, setBuild] = useState<CreateBuildResponse | undefined>();
  const [buildRaw, setBuildRaw] = useState<Json>();
  const [signature, setSignature] = useState<string | undefined>();
  const [register, setRegister] = useState<CreateRegisterResponse | undefined>();
  const [registerRaw, setRegisterRaw] = useState<Json>();

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
      if (!imageUrl.trim()) throw new Error("imageUrl is required (1024×1024 public URL)");
      const body = {
        wallet: publicKey!.toBase58(),
        question,
        resolutionRule,
        sourcesOfTruth: sources
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        category,
        startTime: Number(startTime),
        endTime: Number(endTime),
        resolutionTime: Number(resolutionTime),
        marketType,
        title: title || question,
        description,
        imageUrl: imageUrl.trim(),
        region: "Global",
      };
      const { data, raw } = await pantaFetch<CreateQuoteResponse>(
        "/markets/create/quote/",
        { method: "POST", apiKey: settings.apiKey, body },
      );
      setQuote(data);
      setQuoteRaw(raw);
      setBuild(undefined);
      setBuildRaw(undefined);
      setSignature(undefined);
      setRegister(undefined);
      setRegisterRaw(undefined);
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
      if (!quote?.createId) throw new Error("Quote first");
      const { data, raw } = await pantaFetch<CreateBuildResponse>(
        "/markets/create/build/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: { createId: quote.createId, wallet: publicKey!.toBase58() },
        },
      );
      setBuild(data);
      setBuildRaw(raw);
      setSignature(undefined);
      setRegister(undefined);
      setRegisterRaw(undefined);
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
      if (!build?.transaction) throw new Error("Build first");
      const tx = deserializeVersionedTx(build.transaction);
      const signed = await signTransaction!(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setSignature(sig);
      setRegister(undefined);
      setRegisterRaw(undefined);
      setStep(3);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!quote?.createId || !signature) throw new Error("Need createId + signature");
      const { data, raw } = await pantaFetch<CreateRegisterResponse>(
        "/markets/register/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: { createId: quote.createId, signature },
        },
      );
      setRegister(data);
      setRegisterRaw(raw);
      setStep(4);
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
        <StepBadge n={4} label="Register" active={step === 3} done={step >= 4} />
      </div>

      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <h2>Market details</h2>
          <p className="muted">
            Wallet from the connected account is sent as <code>wallet</code>.
            Image must be a public 1024×1024 URL the API can fetch.
          </p>

          <label className="field">
            <span>Question</span>
            <textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Resolution rule</span>
            <textarea
              rows={2}
              value={resolutionRule}
              onChange={(e) => setResolutionRule(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Sources of truth (comma or newline)</span>
            <textarea
              rows={2}
              value={sources}
              onChange={(e) => setSources(e.target.value)}
            />
          </label>
          <div className="row">
            <label className="field">
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Market type</span>
              <select
                value={marketType}
                onChange={(e) =>
                  setMarketType(e.target.value as "standard" | "breaking")
                }
              >
                <option value="standard">standard</option>
                <option value="breaking">breaking</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>imageUrl (1024×1024)</span>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.example.com/market-1024.png"
            />
          </label>
          <div className="row">
            <label className="field">
              <span>Title (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <div className="row">
            <label className="field">
              <span>startTime</span>
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>endTime</span>
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEndTime(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>resolutionTime</span>
              <input
                type="number"
                value={resolutionTime}
                onChange={(e) => setResolutionTime(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={runQuote}
            >
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
              className="btn btn--accent"
              disabled={busy || !signature}
              onClick={runRegister}
            >
              4 · Register
            </button>
          </div>

          {quote && (
            <div className="callout">
              <strong>Quote</strong>
              <div>
                Fee: {formatUsdcBase(quote.paymentUsdc)} · createId{" "}
                <code>{quote.createId}</code>
              </div>
              <div>
                Event PDA <code>{quote.expectedEventPda}</code>
              </div>
              <div className="muted">Expires {quote.expiresAt}</div>
            </div>
          )}
          {signature && (
            <div className="callout">
              <strong>Broadcast signature</strong>
              <div>
                <code>{signature}</code>
              </div>
            </div>
          )}
          {register && (
            <div className="callout callout--ok">
              <strong>Registered</strong> · marketId{" "}
              <code>{register.marketId}</code> · {register.status}
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="POST /markets/create/quote/" value={quoteRaw} />
          <JsonPanel title="POST /markets/create/build/" value={buildRaw} />
          <JsonPanel
            title="Broadcast"
            value={
              signature
                ? { signature, rpc: settings.rpcUrl }
                : undefined
            }
            empty="Sign & broadcast to see signature"
          />
          <JsonPanel title="POST /markets/register/" value={registerRaw} />
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
