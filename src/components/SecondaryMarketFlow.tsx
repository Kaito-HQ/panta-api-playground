"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import { instructionsToVersionedTx } from "@/lib/solana";
import type {
  BuiltInstruction,
  Json,
  SecondaryBuildResponse,
  SecondaryListing,
  SecondaryListingsResponse,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import { StepBadge } from "@/components/StepBadge";

type Mode = "list" | "fill" | "cancel" | "book";

function shortId(id: string | undefined, n = 8): string {
  if (!id) return "—";
  return id.length <= n + 1 ? id : `${id.slice(0, n)}…`;
}

async function signAndSend(
  instructions: BuiltInstruction[],
  recentBlockhash: string,
  lastValidBlockHeight: number | undefined,
  publicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  connection: Connection,
): Promise<string> {
  if (!instructions.length) {
    throw new Error(
      "No instructions to sign. A pk_test_ key returns sandbox fixtures. Use a live key on staging.",
    );
  }
  const tx = instructionsToVersionedTx(
    instructions,
    publicKey,
    recentBlockhash,
  );
  const signed = await signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  if (lastValidBlockHeight) {
    await connection.confirmTransaction(
      { signature, blockhash: recentBlockhash, lastValidBlockHeight },
      "confirmed",
    );
  }
  return signature;
}

export function SecondaryMarketFlow() {
  const { settings } = useSettings();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { openTrades, secondaryPreset } = useTabNav();

  const [mode, setMode] = useState<Mode>("list");
  const [marketId, setMarketId] = useState("");
  const [appliedPreset, setAppliedPreset] = useState(0);
  if (secondaryPreset && secondaryPreset.nonce !== appliedPreset) {
    setAppliedPreset(secondaryPreset.nonce);
    setMarketId(secondaryPreset.marketId);
  }
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [listIntent, setListIntent] = useState<"sell" | "buy">("sell");
  const [price, setPrice] = useState("0.42");
  const [shares, setShares] = useState("1.00");
  const [listingId, setListingId] = useState("");
  const [fillShares, setFillShares] = useState("");
  const [bookSide, setBookSide] = useState("");
  const [bookIntent, setBookIntent] = useState("");
  const [userId, setUserId] = useState(settings.userId || "");

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<SecondaryBuildResponse | undefined>();
  const [buildRaw, setBuildRaw] = useState<Json>();
  const [signature, setSignature] = useState<string | undefined>();
  const [listings, setListings] = useState<SecondaryListing[]>([]);
  const [listingsRaw, setListingsRaw] = useState<Json>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const requireReady = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
    if (!publicKey) throw new Error("Connect a wallet");
    if (!signTransaction) throw new Error("Wallet cannot sign transactions");
  };

  const attributionUserId = userId.trim() || settings.userId || undefined;

  const resetTx = () => {
    setBuild(undefined);
    setBuildRaw(undefined);
    setSignature(undefined);
    setStep(0);
    setError(null);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    resetTx();
  };

  const runList = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim()) throw new Error("marketId required");
      if (!price.trim() || !shares.trim()) {
        throw new Error("price and shares are required");
      }
      const body: Record<string, string> = {
        wallet: publicKey!.toBase58(),
        marketId: marketId.trim(),
        side,
        price: price.trim(),
        shares: shares.trim(),
      };
      if (attributionUserId) body.userId = attributionUserId;
      const { data, raw } = await pantaFetch<SecondaryBuildResponse>(
        listIntent === "buy" ? "/secondary/bid/" : "/secondary/list/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          userId: attributionUserId,
          body,
        },
      );
      setBuild(data);
      setBuildRaw(raw);
      setListingId(data.listingId || "");
      setSignature(undefined);
      setStep(1);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const runFill = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim() || !listingId.trim()) {
        throw new Error("marketId and listingId are required");
      }
      const body: Record<string, string> = {
        wallet: publicKey!.toBase58(),
        marketId: marketId.trim(),
        listingId: listingId.trim(),
      };
      if (fillShares.trim()) body.shares = fillShares.trim();
      if (attributionUserId) body.userId = attributionUserId;
      const { data, raw } = await pantaFetch<SecondaryBuildResponse>(
        "/secondary/fill/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          userId: attributionUserId,
          body,
        },
      );
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

  const runCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!marketId.trim() || !listingId.trim()) {
        throw new Error("marketId and listingId are required");
      }
      const { data, raw } = await pantaFetch<SecondaryBuildResponse>(
        "/secondary/cancel/",
        {
          method: "POST",
          apiKey: settings.apiKey,
          body: {
            wallet: publicKey!.toBase58(),
            marketId: marketId.trim(),
            listingId: listingId.trim(),
          },
        },
      );
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

  const runSign = async () => {
    setBusy(true);
    setError(null);
    try {
      requireReady();
      if (!build?.recentBlockhash) throw new Error("Build first");
      const sig = await signAndSend(
        build.instructions || [],
        build.recentBlockhash,
        build.lastValidBlockHeight,
        publicKey!,
        signTransaction!,
        connection,
      );
      setSignature(sig);
      setStep(2);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const loadBook = async (cursor?: string | null) => {
    setBusy(true);
    setError(null);
    try {
      if (!settings.apiKey) throw new Error("Set an API key in the bar above");
      if (!marketId.trim()) throw new Error("marketId required");
      const query: Record<string, string> = {
        marketId: marketId.trim(),
        limit: "100",
      };
      if (bookSide) query.side = bookSide;
      if (bookIntent) query.intent = bookIntent;
      if (cursor) query.cursor = cursor;
      const { data, raw } = await pantaFetch<SecondaryListingsResponse>(
        "/secondary/listings/",
        { apiKey: settings.apiKey, query },
      );
      const rows = data.items || [];
      setListings(cursor ? (prev) => [...prev, ...rows] : rows);
      setListingsRaw(raw);
      setNextCursor(data.nextCursor || null);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const buildPath =
    mode === "list"
      ? listIntent === "buy"
        ? "POST /secondary/bid/"
        : "POST /secondary/list/"
      : mode === "fill"
        ? "POST /secondary/fill/"
        : "POST /secondary/cancel/";

  return (
    <div className="flow">
      <div className="flow__steps">
        <StepBadge n={1} label="Build" active={step === 0} done={step >= 1} />
        <StepBadge n={2} label="Sign + send" active={step === 1} done={step >= 2} />
        {mode === "fill" && (
          <StepBadge n={3} label="Report trade" active={step === 2} done={false} />
        )}
      </div>

      {!settings.useStaging && (
        <div className="banner banner--warn">
          Secondary routes are on staging. Turn <strong>Staging on</strong> in
          the bar. A live key from this host will not work on the other.
        </div>
      )}
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <div className="tabs" role="tablist" style={{ marginBottom: "1rem" }}>
            {(
              [
                ["list", "List"],
                ["fill", "Fill"],
                ["cancel", "Cancel"],
                ["book", "Book"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tab ${mode === id ? "tab--on" : ""}`}
                onClick={() => switchMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <h2>Secondary market</h2>
          <p className="muted">
            USDC markets after graduation. Sell calls{" "}
            <code>POST /secondary/list/</code> and needs shares you already
            hold. Buy calls <code>POST /secondary/bid/</code>, locks USDC, and
            does not need shares. Fill takes an open order: an ask needs USDC,
            a bid needs shares. This app signs with the connected wallet and
            broadcasts on the Solana RPC in the bar. Use a mainnet RPC while
            Staging is on.
          </p>

          <label className="field">
            <span>marketId (event PDA)</span>
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              placeholder="Graduated market"
            />
          </label>

          {mode === "list" && (
            <>
              <div className="row">
                <label className="field">
                  <span>Order</span>
                  <select
                    value={listIntent}
                    onChange={(e) =>
                      setListIntent(e.target.value as "sell" | "buy")
                    }
                  >
                    <option value="sell">sell (needs shares)</option>
                    <option value="buy">buy (needs USDC)</option>
                  </select>
                </label>
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
                  <span>price (USDC / share)</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.42"
                  />
                </label>
                <label className="field">
                  <span>shares</span>
                  <input
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span>userId (optional)</span>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={settings.userId || "usr_…"}
                />
              </label>
            </>
          )}

          {(mode === "fill" || mode === "cancel") && (
            <label className="field">
              <span>listingId</span>
              <input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder="Open bid or ask from the book"
              />
            </label>
          )}

          {mode === "fill" && (
            <>
              <label className="field">
                <span>shares (optional, defaults to the remainder)</span>
                <input
                  value={fillShares}
                  onChange={(e) => setFillShares(e.target.value)}
                  placeholder="4.00"
                />
              </label>
              <label className="field">
                <span>userId (optional)</span>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={settings.userId || "usr_…"}
                />
              </label>
            </>
          )}

          {mode === "book" && (
            <div className="row">
              <label className="field">
                <span>side</span>
                <select
                  value={bookSide}
                  onChange={(e) => setBookSide(e.target.value)}
                >
                  <option value="">(any)</option>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
              <label className="field">
                <span>intent</span>
                <select
                  value={bookIntent}
                  onChange={(e) => setBookIntent(e.target.value)}
                >
                  <option value="">(any)</option>
                  <option value="buy">buy</option>
                  <option value="sell">sell</option>
                </select>
              </label>
            </div>
          )}

          <div className="actions">
            {mode === "list" && (
              <button type="button" className="btn" disabled={busy} onClick={runList}>
                {listIntent === "buy" ? "1 · Build bid" : "1 · Build sell"}
              </button>
            )}
            {mode === "fill" && (
              <button type="button" className="btn" disabled={busy} onClick={runFill}>
                1 · Build fill
              </button>
            )}
            {mode === "cancel" && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={runCancel}
              >
                1 · Build cancel
              </button>
            )}
            {mode !== "book" && (
              <button
                type="button"
                className="btn btn--accent"
                disabled={busy || !build}
                onClick={runSign}
              >
                2 · Sign &amp; broadcast
              </button>
            )}
            {mode === "fill" && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!signature || !build}
                onClick={() =>
                  openTrades({
                    signature,
                    wallet: publicKey?.toBase58(),
                    marketId: build?.marketId || marketId.trim(),
                    quoteId: build?.orderId,
                    clientOrderId: build?.orderId,
                  })
                }
              >
                Report fill
              </button>
            )}
            {mode === "book" && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void loadBook(null)}
              >
                {busy ? "Loading…" : "Load book"}
              </button>
            )}
          </div>

          {build && (
            <div className="callout">
              <strong>{build.status || "built"}</strong>
              <div>
                orderId <code>{build.orderId}</code>
              </div>
              <div>
                listingId <code>{build.listingId}</code>
              </div>
              <div>
                {build.intent ? `${build.intent} · ` : ""}
                {build.side} · {build.shares} shares @ {build.price}
                {build.maxCostUsdc ? ` · max cost ${build.maxCostUsdc} USDC` : ""}
                {build.proceedsUsdc ? ` · proceeds ${build.proceedsUsdc} USDC` : ""}
                {build.feeUsdc ? ` · fee ${build.feeUsdc}` : ""}
              </div>
              {build.orderAccount && (
                <div>
                  order account <code>{build.orderAccount}</code>
                </div>
              )}
            </div>
          )}
          {signature && (
            <div className="callout">
              <strong>Signature</strong> <code>{signature}</code>
              {mode === "fill" && (
                <div className="muted">
                  Report this fill with quoteId set to the orderId above. The
                  stored amount is the matched USDC only.
                </div>
              )}
            </div>
          )}

          {mode === "book" && listings.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>listing</th>
                    <th>side</th>
                    <th>intent</th>
                    <th>price</th>
                    <th>shares</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((row) => (
                    <tr key={row.listingId}>
                      <td title={row.listingId}>
                        <code>{shortId(row.listingId, 6)}</code>
                      </td>
                      <td>{row.side}</td>
                      <td>{row.intent || "—"}</td>
                      <td>{row.price}</td>
                      <td>{row.shares}</td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn--accent"
                            onClick={() => {
                              setListingId(row.listingId);
                              setFillShares(row.shares);
                              switchMode("fill");
                            }}
                          >
                            Fill
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              setListingId(row.listingId);
                              switchMode("cancel");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {mode === "book" && nextCursor && (
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void loadBook(nextCursor)}
              >
                Load more
              </button>
            </div>
          )}
        </section>

        <aside className="panel panel--stack">
          {mode !== "book" && (
            <JsonPanel title={buildPath} value={buildRaw} />
          )}
          {mode !== "book" && (
            <JsonPanel
              title="Broadcast"
              value={signature ? { signature } : undefined}
              empty="Sign and broadcast to see the signature"
            />
          )}
          <JsonPanel
            title="GET /secondary/listings/"
            value={listingsRaw}
            empty="Open Book and load listings"
          />
        </aside>
      </div>
    </div>
  );
}
