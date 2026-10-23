"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import {
  formatPrice,
  formatShareBase,
  formatVolumeUsdc,
  pantaFetch,
} from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type {
  CatalogTradeRow,
  CategoriesResponse,
  Json,
  MarketCatalogItem,
  MarketsListResponse,
  MarketTradesResponse,
  ResolutionSummaryResponse,
  WalletTradesResponse,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";
import {
  displayMarketTitle,
  fetchMarketDetails,
  mergeListWithDetail,
} from "@/lib/marketEnrich";

const PHASES = ["", "primary", "secondary", "resolved", "cancelled"] as const;

function shortId(id: string | undefined, n = 10): string {
  if (!id) return "—";
  return id.length <= n + 1 ? id : `${id.slice(0, n)}…`;
}

function AnalysisReport({ report }: { report: ResolutionSummaryResponse }) {
  const ended = report.phase === "post_resolution";
  const insights = report.insights ?? [];
  const sources = report.sources ?? [];
  const hasIntelligence =
    insights.length > 0 || Boolean(report.historicalContext) || sources.length > 0;

  return (
    <div className="analysis">
      {ended && (
        <div className="callout">
          <strong>Resolution summary · {report.status}</strong>
          {report.outcome && <div>Outcome {report.outcome.toUpperCase()}</div>}
          {report.resolvedAt && (
            <div className="muted">Resolved {report.resolvedAt}</div>
          )}
          {report.headline && <div>{report.headline}</div>}
          {report.summary ? (
            <div>{report.summary}</div>
          ) : (
            <div className="muted">No resolution summary stored yet.</div>
          )}
        </div>
      )}

      <div className="callout">
        <strong>
          Intelligence
          {report.phase ? ` · ${report.phase}` : ""} · {report.status}
        </strong>
        {insights.length > 0 && (
          <div>
            <div className="muted">Insights</div>
            <ul>
              {insights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {report.historicalContext && (
          <div>
            <div className="muted">Historical context</div>
            <div>{report.historicalContext}</div>
          </div>
        )}
        {sources.length > 0 && (
          <div>
            <div className="muted">Sources</div>
            <ul>
              {sources.map((source) => {
                const label = source.title || source.url || "Source";
                return (
                  <li key={`${source.url || ""}-${label}`}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                    {source.publisher ? ` · ${source.publisher}` : ""}
                    {source.publicationDate ? ` · ${source.publicationDate}` : ""}
                    {source.explanation && <div>{source.explanation}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!hasIntelligence && (
          <div className="muted">
            No insights, historical context, or sources stored for this phase yet.
          </div>
        )}
      </div>
    </div>
  );
}

function tradeSideLabel(t: CatalogTradeRow): string {
  if (t.side) return t.side.toUpperCase();
  const yes = Number(t.yesAmount || 0);
  const no = Number(t.noAmount || 0);
  if (yes > 0 && no <= 0) return "YES";
  if (no > 0 && yes <= 0) return "NO";
  return "—";
}

function TradeRows({
  rows,
  mode,
}: {
  rows: CatalogTradeRow[];
  mode: "market" | "wallet";
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {mode === "wallet" && <th>Market</th>}
            <th>Signature</th>
            <th>Wallet</th>
            <th>Side</th>
            <th>Primary</th>
            <th>YES shares</th>
            <th>NO shares</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={`${t.signature || i}-${mode}`}>
              {mode === "wallet" && (
                <td>
                  <code title={t.marketId}>{shortId(t.marketId, 8)}</code>
                </td>
              )}
              <td>
                <code title={t.signature}>{shortId(t.signature, 10)}</code>
              </td>
              <td>
                <code title={t.wallet}>{shortId(t.wallet, 8)}</code>
              </td>
              <td>{tradeSideLabel(t)}</td>
              <td>{t.isPrimary ? "yes" : "no"}</td>
              <td>{formatShareBase(t.yesAmount)}</td>
              <td>{formatShareBase(t.noAmount)}</td>
              <td>{formatShareBase(t.feePaid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketsPanel() {
  const { settings } = useSettings();
  const { publicKey } = useWallet();
  const { openBuy, openClaim, openSecondary, openDispute } = useTabNav();

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [createdByMe, setCreatedByMe] = useState(false);
  const [limit, setLimit] = useState(20);

  const [items, setItems] = useState<MarketCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listRaw, setListRaw] = useState<Json>();
  const [categoriesRaw, setCategoriesRaw] = useState<Json>();

  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<MarketCatalogItem | undefined>();
  const [detailRaw, setDetailRaw] = useState<Json>();
  const [resolution, setResolution] = useState<ResolutionSummaryResponse | undefined>();
  const [resolutionRaw, setResolutionRaw] = useState<Json>();
  const [marketTrades, setMarketTrades] = useState<CatalogTradeRow[]>([]);
  const [marketTradesRaw, setMarketTradesRaw] = useState<Json>();

  const [walletOverride, setWalletOverride] = useState("");
  const [walletTrades, setWalletTrades] = useState<CatalogTradeRow[]>([]);
  const [walletTradesRaw, setWalletTradesRaw] = useState<Json>();

  const [busy, setBusy] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrichGen = useRef(0);
  const detailsById = useRef<Record<string, MarketCatalogItem>>({});

  const requireKey = () => {
    if (!settings.apiKey) throw new Error("Set an API key in the bar above");
  };

  const loadCategories = useCallback(async () => {
    if (!settings.apiKey) return;
    try {
      const { data, raw } = await pantaFetch<CategoriesResponse>("/categories/", {
        apiKey: settings.apiKey,
      });
      setCategories(data.categories || []);
      setCategoriesRaw(raw);
    } catch {
      /* optional — filters still work with typed values */
    }
  }, [settings.apiKey]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadList = async (cursor?: string | null, append = false) => {
    setBusy(true);
    setError(null);
    try {
      requireKey();
      const query: Record<string, string> = {
        limit: String(limit),
      };
      if (category) query.category = category;
      if (status) query.status = status;
      if (createdByMe) query.createdBy = "me";
      if (cursor) query.cursor = cursor;

      const { data, raw } = await pantaFetch<MarketsListResponse>("/markets/", {
        apiKey: settings.apiKey,
        query,
      });
      const page = data.items || [];
      if (!append) {
        enrichGen.current += 1;
        detailsById.current = {};
      }
      const gen = enrichGen.current;
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextCursor(data.nextCursor || null);
      setListRaw(raw);
      setBusy(false);

      const ids = page.map((m) => m.marketId).filter(Boolean);
      if (!ids.length) {
        setEnriching(false);
        return;
      }
      setEnriching(true);
      await fetchMarketDetails(settings.apiKey, ids, (chunk) => {
        if (gen !== enrichGen.current) return false;
        for (const row of chunk) {
          detailsById.current[row.marketId] = row;
        }
        setItems((prev) =>
          prev.map((item) => {
            const extra = detailsById.current[item.marketId];
            return extra ? mergeListWithDetail(item, extra) : item;
          }),
        );
        return true;
      });
      if (gen === enrichGen.current) setEnriching(false);
    } catch (e) {
      setError(describeErr(e));
      setBusy(false);
      setEnriching(false);
    }
  };

  const loadDetail = async (marketId: string) => {
    setBusy(true);
    setError(null);
    setSelectedId(marketId);
    const cached = detailsById.current[marketId];
    if (cached) {
      setDetail(cached);
    }
    try {
      requireKey();
      const { data, raw } = await pantaFetch<MarketCatalogItem>(
        `/markets/${encodeURIComponent(marketId)}/`,
        { apiKey: settings.apiKey },
      );
      detailsById.current[marketId] = data;
      setDetail(data);
      setDetailRaw(raw);
      setItems((prev) =>
        prev.map((item) =>
          item.marketId === marketId ? mergeListWithDetail(item, data) : item,
        ),
      );

      const trades = await pantaFetch<MarketTradesResponse>(
        `/markets/${encodeURIComponent(marketId)}/trades/`,
        {
          apiKey: settings.apiKey,
          query: { limit: "50" },
        },
      );
      setMarketTrades(trades.data.items || []);
      setMarketTradesRaw(trades.raw);
      setResolution(undefined);
      setResolutionRaw(undefined);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const loadResolution = async (marketId: string) => {
    setBusy(true);
    setError(null);
    try {
      requireKey();
      const { data, raw } = await pantaFetch<ResolutionSummaryResponse>(
        `/markets/${encodeURIComponent(marketId)}/resolution-summary/`,
        { apiKey: settings.apiKey },
      );
      setResolution(data);
      setResolutionRaw(raw);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const loadWalletTrades = async () => {
    setBusy(true);
    setError(null);
    try {
      requireKey();
      const wallet =
        walletOverride.trim() || (publicKey ? publicKey.toBase58() : "");
      if (!wallet) throw new Error("Connect a wallet or paste one");
      const { data, raw } = await pantaFetch<WalletTradesResponse>(
        `/wallets/${encodeURIComponent(wallet)}/trades/`,
        {
          apiKey: settings.apiKey,
          query: { limit: "50" },
        },
      );
      setWalletTrades(data.items || []);
      setWalletTradesRaw(raw);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  if (!settings.apiKey) {
    return (
      <div className="panel">
        <h2>Markets</h2>
        <p className="muted">Paste an API key in the bar above to browse the catalog.</p>
      </div>
    );
  }

  const yesPx = detail?.yesPrice ?? detail?.primaryYesPrice;
  const noPx = detail?.noPrice ?? detail?.primaryNoPrice;

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <div className="panel__head-row">
            <h2>Markets</h2>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void loadList(null, false)}
            >
              {busy ? "Loading…" : "Load list"}
            </button>
          </div>
          <p className="muted">
            <code>GET /markets/</code> · <code>/markets/&#123;id&#125;/</code> ·{" "}
            <code>/resolution-summary/</code> · <code>/categories/</code>
            . The table fills names and volume from detail in the background.
            Click <strong>Detail</strong> for the full payload.
          </p>

          <div className="row">
            <label className="field">
              <span>category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">(any)</option>
                {(categories.length
                  ? categories
                  : [
                      "crypto",
                      "sports",
                      "politics",
                      "entertainment",
                      "finance",
                      "science",
                      "world",
                      "other",
                    ]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>status (phase)</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {PHASES.map((p) => (
                  <option key={p || "any"} value={p}>
                    {p || "(any)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>limit</span>
              <input
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 20)}
              />
            </label>
          </div>
          <label className="field field--check">
            <span>createdBy=me</span>
            <input
              type="checkbox"
              checked={createdByMe}
              onChange={(e) => setCreatedByMe(e.target.checked)}
            />
          </label>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Phase</th>
                  <th>Category</th>
                  <th>Active volume</th>
                  <th>Total volume</th>
                  <th>Partner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr
                    key={m.marketId}
                    className={
                      selectedId === m.marketId ? "data-table__row--on" : undefined
                    }
                  >
                    <td>
                      <div>{displayMarketTitle(m) || (enriching ? "Loading…" : "—")}</div>
                      <code title={m.marketId}>{shortId(m.marketId, 10)}</code>
                    </td>
                    <td>{m.phase}</td>
                    <td>{m.category}</td>
                    <td>{formatVolumeUsdc(m.volumeUsdc)}</td>
                    <td>{formatVolumeUsdc(m.totalVolumeUsdc)}</td>
                    <td>{m.createdByPartner ? "yes" : "no"}</td>
                    <td>
                      <div className="actions" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy}
                          onClick={() => void loadDetail(m.marketId)}
                        >
                          Detail
                        </button>
                        {m.phase === "primary" && (
                          <button
                            type="button"
                            className="btn btn--accent"
                            onClick={() => openBuy(m.marketId)}
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {busy ? "Loading…" : "No markets loaded — click Load list"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void loadList(nextCursor, true)}
              >
                Load more
              </button>
            </div>
          )}

          {enriching && (
            <p className="muted">Loading names and volume from GET /markets/{"{id}"}/…</p>
          )}

          {detail && (
            <div className="callout">
              <strong>{displayMarketTitle(detail) || "Untitled market"}</strong>
              <div>
                marketId <code>{detail.marketId}</code>
              </div>
              <div>
                phase {detail.phase} · type {detail.marketType || "—"} · region{" "}
                {detail.region || "—"} · status {detail.status || "—"}
              </div>
              <div>
                active volume {formatVolumeUsdc(detail.volumeUsdc)}
                {detail.totalVolumeUsdc != null && (
                  <>
                    {" "}
                    · total {formatVolumeUsdc(detail.totalVolumeUsdc)}
                  </>
                )}
                {detail.creationFee != null && detail.creationFee !== "" && (
                  <>
                    {" "}
                    · create fee {String(detail.creationFee)} USDC
                  </>
                )}
              </div>
              <div>
                prices yes {formatPrice(yesPx)} / no {formatPrice(noPx)}
              </div>
              {detail.creatorAddress && (
                <div>
                  creator <code>{shortId(detail.creatorAddress, 12)}</code>
                </div>
              )}
              {detail.oracle && (
                <div className="muted">oracle {detail.oracle}</div>
              )}
              {detail.question && detail.question !== detail.title && (
                <div>
                  <span className="muted">Question</span>
                  <div>{detail.question}</div>
                </div>
              )}
              {detail.description ? (
                <div>
                  <span className="muted">Description</span>
                  <div>{detail.description}</div>
                </div>
              ) : null}
              {detail.resolutionRule ? (
                <div>
                  <span className="muted">Resolution rule</span>
                  <div>{detail.resolutionRule}</div>
                </div>
              ) : null}
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                {detail.phase === "primary" && (
                  <button
                    type="button"
                    className="btn btn--accent"
                    onClick={() => openBuy(detail.marketId)}
                  >
                    Primary buy
                  </button>
                )}
                {detail.phase === "secondary" && (
                  <button
                    type="button"
                    className="btn btn--accent"
                    onClick={() => openSecondary(detail.marketId)}
                  >
                    Secondary
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => openDispute(detail.marketId)}
                >
                  Dispute
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void loadResolution(detail.marketId)}
                >
                  Resolution summary
                </button>
                {detail.phase === "resolved" && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => openClaim(detail.marketId)}
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>
          )}

          {resolution && detail && resolution.marketId === detail.marketId && (
            <AnalysisReport report={resolution} />
          )}

          {marketTrades.length > 0 && (
            <>
              <h3>Market trades</h3>
              <p className="muted">
                Share amounts are catalog base units ÷ 1e6 (same scale as USDC
                micro-units).
              </p>
              <TradeRows rows={marketTrades} mode="market" />
            </>
          )}

          <h3>Wallet catalog trades</h3>
          <p className="muted">
            <code>GET /wallets/&#123;wallet&#125;/trades/</code>
          </p>
          <label className="field">
            <span>Wallet (defaults to connected)</span>
            <input
              value={walletOverride}
              onChange={(e) => setWalletOverride(e.target.value)}
              placeholder={publicKey?.toBase58() || "Base58 pubkey"}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void loadWalletTrades()}
            >
              Load wallet trades
            </button>
          </div>
          {walletTrades.length > 0 && (
            <TradeRows rows={walletTrades} mode="wallet" />
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="GET /categories/" value={categoriesRaw} />
          <JsonPanel title="GET /markets/" value={listRaw} />
          <JsonPanel
            title="GET /markets/{id}/"
            value={detailRaw}
            empty="Open Detail on a row"
          />
          <JsonPanel
            title="GET /markets/{id}/trades/"
            value={marketTradesRaw}
            empty="Open Detail to load trades"
          />
          <JsonPanel
            title="GET /markets/{id}/resolution-summary/"
            value={resolutionRaw}
            empty="Open Detail, then Resolution summary"
          />
          <JsonPanel
            title="GET /wallets/{wallet}/trades/"
            value={walletTradesRaw}
          />
        </aside>
      </div>
    </div>
  );
}
