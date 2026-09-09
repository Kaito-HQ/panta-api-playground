"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSettings } from "@/components/SettingsContext";
import { useTabNav } from "@/components/TabNavContext";
import { pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type {
  CatalogTradeRow,
  CategoriesResponse,
  Json,
  MarketCatalogItem,
  MarketsListResponse,
  MarketTradesResponse,
  WalletTradesResponse,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

const PHASES = ["", "primary", "secondary", "resolved", "cancelled"] as const;

export function MarketsPanel() {
  const { settings } = useSettings();
  const { publicKey } = useWallet();
  const { openBuy, openClaim } = useTabNav();

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
  const [marketTrades, setMarketTrades] = useState<CatalogTradeRow[]>([]);
  const [marketTradesRaw, setMarketTradesRaw] = useState<Json>();

  const [walletOverride, setWalletOverride] = useState("");
  const [walletTrades, setWalletTrades] = useState<CatalogTradeRow[]>([]);
  const [walletTradesRaw, setWalletTradesRaw] = useState<Json>();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextCursor(data.nextCursor || null);
      setListRaw(raw);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const loadDetail = async (marketId: string) => {
    setBusy(true);
    setError(null);
    setSelectedId(marketId);
    try {
      requireKey();
      const { data, raw } = await pantaFetch<MarketCatalogItem>(
        `/markets/${encodeURIComponent(marketId)}/`,
        { apiKey: settings.apiKey },
      );
      setDetail(data);
      setDetailRaw(raw);

      const trades = await pantaFetch<MarketTradesResponse>(
        `/markets/${encodeURIComponent(marketId)}/trades/`,
        {
          apiKey: settings.apiKey,
          query: { limit: "50" },
        },
      );
      setMarketTrades(trades.data.items || []);
      setMarketTradesRaw(trades.raw);
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
            <code>/categories/</code>
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
                  <th>Volume</th>
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
                      <div>{m.title || "—"}</div>
                      <code title={m.marketId}>{m.marketId.slice(0, 10)}…</code>
                    </td>
                    <td>{m.phase}</td>
                    <td>{m.category}</td>
                    <td>{m.volumeUsdc ?? "—"}</td>
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
                    <td colSpan={6} className="muted">
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

          {detail && (
            <div className="callout">
              <strong>{detail.title}</strong>
              <div>
                marketId <code>{detail.marketId}</code>
              </div>
              <div>
                phase {detail.phase} · type {detail.marketType} · region{" "}
                {detail.region} · status {detail.status}
              </div>
              {(detail.yesPrice != null || detail.primaryYesPrice != null) && (
                <div>
                  prices yes {detail.yesPrice ?? detail.primaryYesPrice ?? "—"} / no{" "}
                  {detail.noPrice ?? detail.primaryNoPrice ?? "—"}
                </div>
              )}
              {detail.description && (
                <div className="muted">{detail.description}</div>
              )}
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

          {marketTrades.length > 0 && (
            <>
              <h3>Market trades</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Signature</th>
                      <th>Wallet</th>
                      <th>Primary</th>
                      <th>YES / NO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketTrades.map((t, i) => (
                      <tr key={`${t.signature || i}`}>
                        <td>
                          <code>
                            {(t.signature || "—").slice(0, 10)}
                            {t.signature ? "…" : ""}
                          </code>
                        </td>
                        <td>
                          <code>
                            {(t.wallet || "—").slice(0, 8)}
                            {t.wallet ? "…" : ""}
                          </code>
                        </td>
                        <td>{t.isPrimary ? "yes" : "no"}</td>
                        <td>
                          {String(t.yesAmount ?? "—")} / {String(t.noAmount ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Signature</th>
                    <th>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {walletTrades.map((t, i) => (
                    <tr key={`${t.signature || i}-w`}>
                      <td>
                        <code>
                          {(t.marketId || "—").slice(0, 8)}
                          {t.marketId ? "…" : ""}
                        </code>
                      </td>
                      <td>
                        <code>
                          {(t.signature || "—").slice(0, 10)}
                          {t.signature ? "…" : ""}
                        </code>
                      </td>
                      <td>{t.isPrimary ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            title="GET /wallets/{wallet}/trades/"
            value={walletTradesRaw}
          />
        </aside>
      </div>
    </div>
  );
}
