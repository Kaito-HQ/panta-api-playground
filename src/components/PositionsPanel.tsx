"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type {
  Json,
  MarketCatalogItem,
  PositionRow,
  PositionsResponse,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

type PriceMap = Record<string, MarketCatalogItem>;

function pickSpotPrice(
  market: MarketCatalogItem | undefined,
  side: string,
): number | null {
  if (!market) return null;
  const s = side.toLowerCase();
  const raw =
    s === "yes"
      ? market.yesPrice ??
        market.secondaryYesPrice ??
        market.primaryYesPrice
      : market.noPrice ??
        market.secondaryNoPrice ??
        market.primaryNoPrice;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function estimateValueUsdc(
  position: PositionRow,
  market: MarketCatalogItem | undefined,
): { usdc: number | null; label: string; hint: string } {
  const shares = Number(position.shares);
  if (!Number.isFinite(shares)) {
    return { usdc: null, label: "—", hint: "" };
  }

  if (position.claimable) {
    return {
      usdc: shares,
      label: `~${shares.toFixed(2)} USDC`,
      hint: "claimable ≈ $1 / share",
    };
  }

  if (position.outcome) {
    const won = position.outcome.toLowerCase() === position.side.toLowerCase();
    if (!won) {
      return { usdc: 0, label: "0.00 USDC", hint: "losing side" };
    }
    return {
      usdc: shares,
      label: `~${shares.toFixed(2)} USDC`,
      hint: "resolved winner ≈ $1 / share",
    };
  }

  const price = pickSpotPrice(market, position.side);
  if (price == null) {
    return { usdc: null, label: "—", hint: "no spot price" };
  }
  const usdc = shares * price;
  return {
    usdc,
    label: `~${usdc.toFixed(2)} USDC`,
    hint: `@ ${price.toFixed(4)}`,
  };
}

export function PositionsPanel() {
  const { settings } = useSettings();
  const { publicKey } = useWallet();
  const { openClaim } = useTabNav();
  const [walletOverride, setWalletOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [raw, setRaw] = useState<Json>();
  const [pricesRaw, setPricesRaw] = useState<Json>();

  const wallet =
    walletOverride.trim() || (publicKey ? publicKey.toBase58() : "");

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!settings.apiKey) throw new Error("Set an API key in the bar above");
      if (!wallet) throw new Error("Connect a wallet or paste one");
      const { data, raw: body } = await pantaFetch<PositionsResponse>(
        "/positions/",
        {
          apiKey: settings.apiKey,
          query: { wallet },
        },
      );
      const positions = data.positions || [];
      setRows(positions);
      setRaw(body);

      const ids = [...new Set(positions.map((p) => p.marketId))];
      const next: PriceMap = {};
      const detailBodies: Json[] = [];
      await Promise.all(
        ids.map(async (id) => {
          try {
            const { data: m, raw: mRaw } = await pantaFetch<MarketCatalogItem>(
              `/markets/${encodeURIComponent(id)}/`,
              { apiKey: settings.apiKey },
            );
            next[id] = m;
            detailBodies.push(mRaw);
          } catch {
            /* keep row; value shows "—" */
          }
        }),
      );
      setPrices(next);
      setPricesRaw(
        ids.length
          ? { fetched: Object.keys(next).length, of: ids.length, samples: detailBodies.slice(0, 3) }
          : undefined,
      );
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const totalEst = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const p of rows) {
      const { usdc } = estimateValueUsdc(p, prices[p.marketId]);
      if (usdc != null) {
        sum += usdc;
        any = true;
      }
    }
    return any ? sum : null;
  }, [rows, prices]);

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <div className="panel__head-row">
            <h2>Positions</h2>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void load()}
            >
              {busy ? "Loading…" : "Load"}
            </button>
          </div>
          <p className="muted">
            <code>GET /positions/</code> for shares, then{" "}
            <code>GET /markets/&#123;id&#125;/</code> for spot prices. Est. value
            ≈ shares × yes/no price (client-side). Claimable ≈ $1 / winning share.
          </p>

          <label className="field">
            <span>Wallet (defaults to connected)</span>
            <input
              value={walletOverride}
              onChange={(e) => setWalletOverride(e.target.value)}
              placeholder={publicKey?.toBase58() || "Base58 pubkey"}
            />
          </label>

          {totalEst != null && rows.length > 0 && (
            <div className="callout">
              <strong>Est. portfolio</strong> ~{totalEst.toFixed(2)} USDC
              <div className="muted" style={{ margin: 0 }}>
                Mark-to-market + claimable at face; not a settlement guarantee.
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Est. value</th>
                  <th>Phase</th>
                  <th>Claimable</th>
                  <th>Outcome</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const market = prices[p.marketId];
                  const spot = pickSpotPrice(market, p.side);
                  const est = estimateValueUsdc(p, market);
                  return (
                    <tr key={`${p.marketId}-${p.side}`}>
                      <td>
                        <code title={p.marketId}>
                          {p.marketId.slice(0, 8)}…
                        </code>
                        {p.category ? (
                          <div className="muted" style={{ margin: 0 }}>
                            {p.category}
                          </div>
                        ) : null}
                      </td>
                      <td>{p.side}</td>
                      <td>{p.shares}</td>
                      <td>
                        {p.claimable || p.outcome
                          ? "—"
                          : spot != null
                            ? spot.toFixed(4)
                            : "—"}
                      </td>
                      <td>
                        {est.label}
                        {est.hint ? (
                          <div className="muted" style={{ margin: 0 }}>
                            {est.hint}
                          </div>
                        ) : null}
                      </td>
                      <td>{p.phase}</td>
                      <td>{p.claimable ? "yes" : "no"}</td>
                      <td>{p.outcome ?? "—"}</td>
                      <td>
                        {p.claimable && (
                          <button
                            type="button"
                            className="btn btn--accent"
                            onClick={() => openClaim(p.marketId)}
                          >
                            Claim
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      {busy ? "Loading…" : "No positions loaded"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="GET /positions/" value={raw} />
          <JsonPanel
            title="GET /markets/{id}/ (prices)"
            value={pricesRaw}
            empty="Load positions to fetch spot prices"
          />
        </aside>
      </div>
    </div>
  );
}
