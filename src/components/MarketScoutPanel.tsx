"use client";

import { useMemo, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import { formatPrice, formatVolumeUsdc, pantaFetch } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type { Json, MarketCatalogItem, MarketsListResponse } from "@/lib/types";

type SortKey = "signal" | "volume" | "spread";

type ScoutRow = MarketCatalogItem & {
  spread: number;
  volume: number;
  signal: number;
};

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortId(value: string, length = 12): string {
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

function makeScoutRow(item: MarketCatalogItem): ScoutRow {
  const yes = numeric(item.secondaryYesPrice ?? item.yesPrice ?? item.primaryYesPrice);
  const no = numeric(item.secondaryNoPrice ?? item.noPrice ?? item.primaryNoPrice);
  const spread = Math.abs(yes - no);
  const volume = numeric(item.totalVolumeUsdc ?? item.volumeUsdc);
  const live = item.phase === "primary" || item.phase === "secondary";
  const signal = Math.round(
    Math.min(100, spread * 100 + Math.min(35, Math.log10(volume + 1) * 12) + (live ? 15 : 0)),
  );

  return { ...item, spread, volume, signal };
}

export function MarketScoutPanel() {
  const { settings } = useSettings();
  const [rows, setRows] = useState<ScoutRow[]>([]);
  const [sort, setSort] = useState<SortKey>("signal");
  const [phase, setPhase] = useState("live");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<Json>();

  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const phaseMatch = phase === "all" || (phase === "live" ? ["primary", "secondary"].includes(row.phase) : row.phase === phase);
      return phaseMatch && (!category || row.category === category);
    });
    return [...filtered].sort((a, b) => b[sort] - a[sort]);
  }, [category, phase, rows, sort]);

  const scan = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!settings.apiKey) throw new Error("Añade una API key de Panta en la barra superior");
      const { data, raw: responseRaw } = await pantaFetch<MarketsListResponse>("/markets/", {
        apiKey: settings.apiKey,
        query: { limit: "100" },
      });
      setRows((data.items || []).map(makeScoutRow));
      setRaw(responseRaw);
    } catch (err) {
      setError(describeErr(err));
    } finally {
      setBusy(false);
    }
  };

  const liveCount = rows.filter((row) => ["primary", "secondary"].includes(row.phase)).length;
  const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
  const largestSpread = rows.reduce((max, row) => Math.max(max, row.spread), 0);

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel scout-hero">
        <div>
          <p className="eyebrow">READ-ONLY MARKET INTELLIGENCE</p>
          <h2>Market Scout</h2>
          <p className="muted">
            Scan Panta markets and surface the clearest research opportunities using live prices,
            volume, phase, and a transparent signal score.
          </p>
        </div>
        <div className="scout-hero__action">
          <button type="button" className="btn btn--primary" onClick={() => void scan()} disabled={busy}>
            {busy ? "Scanning…" : "Scan live markets"}
          </button>
          <span className="field__hint">GET /markets/ · no wallet transaction</span>
        </div>
      </section>

      <section className="metric-grid">
        <div className="metric-card"><span className="metric-card__label">Markets scanned</span><strong className="metric-card__value">{rows.length || "—"}</strong><span className="metric-card__hint">Panta catalog</span></div>
        <div className="metric-card"><span className="metric-card__label">Live now</span><strong className="metric-card__value">{rows.length ? liveCount : "—"}</strong><span className="metric-card__hint">primary + secondary</span></div>
        <div className="metric-card"><span className="metric-card__label">Catalog volume</span><strong className="metric-card__value">{rows.length ? `${totalVolume.toFixed(2)} USDC` : "—"}</strong><span className="metric-card__hint">read-only aggregate</span></div>
        <div className="metric-card"><span className="metric-card__label">Largest spread</span><strong className="metric-card__value">{rows.length ? largestSpread.toFixed(4) : "—"}</strong><span className="metric-card__hint">YES vs NO price</span></div>
      </section>

      <section className="panel">
        <div className="panel__head-row">
          <div>
            <h2>Signal board</h2>
            <p className="muted">The score favors live markets with meaningful price separation and observable activity.</p>
          </div>
          <div className="row scout-controls">
            <label className="field"><span>phase</span><select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="live">live</option><option value="all">all</option><option value="primary">primary</option><option value="secondary">secondary</option><option value="resolved">resolved</option></select></label>
            <label className="field"><span>category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">all</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field"><span>sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="signal">signal</option><option value="volume">volume</option><option value="spread">spread</option></select></label>
          </div>
        </div>

        {filteredRows.length ? (
          <div className="table-wrap">
            <table className="data-table scout-table">
              <thead><tr><th>Signal</th><th>Market</th><th>Phase</th><th>YES</th><th>NO</th><th>Spread</th><th>Volume</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.marketId}>
                <td><span className={`signal signal--${row.signal >= 70 ? "hot" : row.signal >= 40 ? "warm" : "cool"}`}>{row.signal}</span></td>
                <td><strong>{row.title}</strong><br /><code title={row.marketId}>{shortId(row.marketId)}</code></td>
                <td><span className="phase-pill">{row.phase || "—"}</span></td>
                <td>{formatPrice(row.secondaryYesPrice ?? row.yesPrice ?? row.primaryYesPrice)}</td>
                <td>{formatPrice(row.secondaryNoPrice ?? row.noPrice ?? row.primaryNoPrice)}</td>
                <td>{row.spread.toFixed(4)}</td>
                <td>{formatVolumeUsdc(row.totalVolumeUsdc ?? row.volumeUsdc)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><strong>{rows.length ? "No markets match the current filters" : "Connect Panta and scan the catalog"}</strong><span>{rows.length ? "Try another phase or category." : "The scout only reads the catalog; it never signs or broadcasts a transaction."}</span></div>
        )}
      </section>

      <section className="panel scout-method">
        <div><p className="eyebrow">METHOD</p><h2>Built for safe exploration</h2></div>
        <p className="muted">Market Scout uses documented catalog endpoints, keeps the API key in the existing local storage flow, and leaves wallet signing to the user. <a href="https://panta.market" target="_blank" rel="noreferrer">Powered by Panta</a>.</p>
      </section>

      {raw !== undefined && <details className="raw-details"><summary>View raw catalog response</summary><pre className="json-panel__body">{JSON.stringify(raw, null, 2)}</pre></details>}
    </div>
  );
}
