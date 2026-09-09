"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { formatUsdcBase, pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import { uploadMarketImage } from "@/lib/marketImageUpload";
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

/** Unix seconds → value for `<input type="datetime-local">` (local timezone). */
function unixToDatetimeLocal(unix: number): string {
  if (!Number.isFinite(unix)) return "";
  const d = new Date(unix * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` string → Unix seconds (local timezone). */
function datetimeLocalToUnix(value: string): number {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return NaN;
  return Math.floor(t / 1000);
}

export function CreateMarketFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { openBuy, setTab } = useTabNav();
  const times = useMemo(() => defaultTimes(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState(
    "Will ETH be above $5,000 on 2027-01-01?",
  );
  const [resolutionRule, setResolutionRule] = useState(
    "CoinGecko daily close UTC ≥ 5000",
  );
  const [sources, setSources] = useState("https://www.coingecko.com");
  const [category, setCategory] = useState<string>("crypto");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadRaw, setUploadRaw] = useState<Json>();
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState(() =>
    unixToDatetimeLocal(times.start),
  );
  const [endLocal, setEndLocal] = useState(() => unixToDatetimeLocal(times.end));
  const [resolutionLocal, setResolutionLocal] = useState(() =>
    unixToDatetimeLocal(times.resolution),
  );
  const [marketType, setMarketType] = useState<"standard" | "breaking">(
    "standard",
  );
  const [eventInProgress, setEventInProgress] = useState(false);
  const [region, setRegion] = useState("Global");
  const [oracle, setOracle] = useState("");

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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const requireReady = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
    if (!publicKey) throw new Error("Connect a wallet");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");
  };

  const onPickFile = (file: File | null) => {
    setImageFile(file);
    setUploadedPublicId(null);
    setUploadRaw(undefined);
    if (file) setImageUrl("");
  };

  const runImageUpload = async () => {
    setUploadBusy(true);
    setError(null);
    try {
      if (!settings.apiKey) throw new Error("Set an API key in the bar above");
      if (!imageFile) throw new Error("Choose an image file first");
      const { secureUrl, upload } = await uploadMarketImage({
        apiKey: settings.apiKey,
        file: imageFile,
      });
      setImageUrl(secureUrl);
      setUploadedPublicId(upload.publicId);
      setUploadRaw(upload as unknown as Json);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setUploadBusy(false);
    }
  };

  const runQuote = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!imageUrl.trim()) {
        throw new Error(
          "Upload a market image (or paste a public https imageUrl) before quoting",
        );
      }
      const startTime = datetimeLocalToUnix(startLocal);
      const endTime = datetimeLocalToUnix(endLocal);
      const resolutionTime = datetimeLocalToUnix(resolutionLocal);
      if (
        !Number.isFinite(startTime) ||
        !Number.isFinite(endTime) ||
        !Number.isFinite(resolutionTime)
      ) {
        throw new Error("Pick valid start, end, and resolution date/times");
      }
      if (!(startTime < endTime && endTime <= resolutionTime)) {
        throw new Error("Require startTime < endTime ≤ resolutionTime");
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const minStartDelaySec = 3600;
      if (
        !(marketType === "breaking" && eventInProgress) &&
        startTime < nowSec + minStartDelaySec
      ) {
        const needBy = unixToDatetimeLocal(nowSec + minStartDelaySec + 60);
        throw new Error(
          `startTime must be at least ${minStartDelaySec}s (~1 hour) ahead of now. Pick a start at or after ${needBy} (local).`,
        );
      }
      if (marketType === "breaking" && eventInProgress) {
        if (startTime > nowSec) {
          throw new Error(
            "eventInProgress requires startTime ≤ now (the event has already started). Uncheck it for a future start, or move start into the past.",
          );
        }
        if (endTime <= nowSec) {
          throw new Error(
            "With eventInProgress, endTime must still be in the future",
          );
        }
      }
      if (marketType === "breaking" && !eventInProgress && startTime <= nowSec) {
        throw new Error(
          "Breaking markets with eventInProgress off require startTime in the future (on-chain flash window).",
        );
      }
      const body: Record<string, unknown> = {
        wallet: publicKey!.toBase58(),
        question,
        resolutionRule,
        sourcesOfTruth: sources
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        category,
        startTime,
        endTime,
        resolutionTime,
        marketType,
        title: title || question,
        description,
        imageUrl: imageUrl.trim(),
        region: region.trim() || "Global",
      };
      if (oracle.trim()) body.oracle = oracle.trim();
      if (marketType === "breaking") body.eventInProgress = eventInProgress;
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
      if (!quote?.createId || !signature)
        throw new Error("Need createId + signature");
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

  const previewSrc = imageUrl.trim() || imagePreview;

  return (
    <div className="flow">
      <div className="flow__steps">
        <StepBadge
          n={0}
          label="Image"
          active={step === 0 && !imageUrl}
          done={Boolean(imageUrl)}
        />
        <StepBadge
          n={1}
          label="Quote"
          active={step === 0 && Boolean(imageUrl)}
          done={step >= 1}
        />
        <StepBadge n={2} label="Build" active={step === 1} done={step >= 2} />
        <StepBadge
          n={3}
          label="Sign + send"
          active={step === 2}
          done={step >= 3}
        />
        <StepBadge
          n={4}
          label="Register"
          active={step === 3}
          done={step >= 4}
        />
      </div>

      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <h2>Market details</h2>
          <p className="muted">
            Upload a catalog image via{" "}
            <code>POST /markets/create/image-upload/</code> (bytes go to
            Cloudinary), then quote → build → sign → register. Prefer a square{" "}
            <strong>1024×1024</strong> asset.
          </p>

          <div className="image-upload">
            <div className="image-upload__row">
              <div className="image-upload__controls">
                <label className="field">
                  <span>Market image</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn--accent"
                    disabled={
                      uploadBusy || busy || !imageFile || !settings.apiKey
                    }
                    onClick={() => void runImageUpload()}
                  >
                    {uploadBusy ? "Uploading…" : "0 · Upload to Cloudinary"}
                  </button>
                  {(imageFile || imageUrl) && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={uploadBusy || busy}
                      onClick={() => {
                        onPickFile(null);
                        setImageUrl("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {uploadedPublicId && (
                  <p className="hint ok">
                    Uploaded · <code>{uploadedPublicId}</code>
                  </p>
                )}
              </div>
              <div className="image-upload__preview">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="Market catalog preview" />
                ) : (
                  <div className="image-upload__placeholder">No image yet</div>
                )}
              </div>
            </div>
            <label className="field">
              <span>imageUrl (from upload, or paste https…)</span>
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setUploadedPublicId(null);
                }}
                placeholder="https://res.cloudinary.com/…/market-1024.png"
              />
            </label>
          </div>

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
            <label className="field">
              <span>Region</span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </label>
          </div>
          {marketType === "breaking" && (
            <div className="field">
              <label className="field--check">
                <input
                  type="checkbox"
                  checked={eventInProgress}
                  onChange={(e) => setEventInProgress(e.target.checked)}
                />
                <span>eventInProgress</span>
              </label>
              <p className="hint">
                Only check if the real-world event has{" "}
                <strong>already started</strong>. Then startTime must be ≤ now
                and endTime in the future. Leave unchecked for a future start.
              </p>
            </div>
          )}
          <label className="field">
            <span>Oracle (optional — defaults to sourcesOfTruth)</span>
            <input
              value={oracle}
              onChange={(e) => setOracle(e.target.value)}
              placeholder="Leave blank to join sourcesOfTruth"
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
              <span>Start (≥ 1 hour from now)</span>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
              <span className="field__hint">
                Unix {datetimeLocalToUnix(startLocal) || "—"} (local tz)
              </span>
            </label>
            <label className="field">
              <span>End</span>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
              <span className="field__hint">
                Unix {datetimeLocalToUnix(endLocal) || "—"} (local tz)
              </span>
            </label>
            <label className="field">
              <span>Resolution</span>
              <input
                type="datetime-local"
                value={resolutionLocal}
                onChange={(e) => setResolutionLocal(e.target.value)}
              />
              <span className="field__hint">
                Unix {datetimeLocalToUnix(resolutionLocal) || "—"} (local tz)
              </span>
            </label>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy || uploadBusy || !imageUrl.trim()}
              onClick={() => void runQuote()}
            >
              1 · Quote
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !quote}
              onClick={() => void runBuild()}
            >
              2 · Build
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !build}
              onClick={() => void runSignBroadcast()}
            >
              3 · Sign &amp; broadcast
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy || !signature}
              onClick={() => void runRegister()}
            >
              4 · Register
            </button>
          </div>

          {quote && (
            <div className="callout">
              <strong>Quote</strong>
              <div>
                Fee: {formatUsdcBase(quote.paymentUsdc)}
                {quote.liquidityInjectionUsdc != null && (
                  <>
                    {" "}
                    · liq {formatUsdcBase(quote.liquidityInjectionUsdc)} ·
                    platform {formatUsdcBase(quote.platformRevenueUsdc)}
                  </>
                )}{" "}
                · createId <code>{quote.createId}</code>
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
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => openBuy(register.marketId)}
                >
                  Buy on this market
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setTab("markets")}
                >
                  Browse markets
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel
            title="POST /markets/create/image-upload/"
            value={uploadRaw}
            empty="Upload an image to see signed Cloudinary fields"
          />
          <JsonPanel title="POST /markets/create/quote/" value={quoteRaw} />
          <JsonPanel title="POST /markets/create/build/" value={buildRaw} />
          <JsonPanel
            title="Broadcast"
            value={
              signature ? { signature, rpc: settings.rpcUrl } : undefined
            }
            empty="Sign & broadcast to see signature"
          />
          <JsonPanel title="POST /markets/register/" value={registerRaw} />
        </aside>
      </div>
    </div>
  );
}
