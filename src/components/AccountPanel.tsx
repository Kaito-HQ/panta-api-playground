"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import {
  fetchAccountMetrics,
  fetchDashboard,
  fetchWhoami,
  patchAccount,
} from "@/lib/accountApi";
import { formatUsdcBase } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type {
  Account,
  AccountDashboard,
  AccountMetricsResponse,
  Json,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

export function AccountPanel() {
  const { settings, patchSettings } = useSettings();
  const [name, setName] = useState(settings.account?.name || settings.authName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whoami, setWhoami] = useState<Account | undefined>();
  const [dashboard, setDashboard] = useState<AccountDashboard | undefined>();
  const [metrics, setMetrics] = useState<AccountMetricsResponse | undefined>();
  const [whoamiRaw, setWhoamiRaw] = useState<Json>();
  const [dashboardRaw, setDashboardRaw] = useState<Json>();
  const [metricsRaw, setMetricsRaw] = useState<Json>();
  const [limit, setLimit] = useState(50);

  const auth = {
    apiKey: settings.apiKey || undefined,
    accessToken: settings.accessToken || undefined,
  };

  const hasAuth = Boolean(settings.apiKey || settings.accessToken);

  const refresh = useCallback(async () => {
    if (!hasAuth) return;
    setBusy(true);
    setError(null);
    try {
      if (settings.apiKey) {
        const me = await fetchWhoami(settings.apiKey);
        setWhoami(me);
        setWhoamiRaw(me);
        setName(me.name || "");
        patchSettings({
          account: me,
          userId: me.userId || settings.userId,
          authName: me.name || settings.authName,
        });
      }
      const dash = await fetchDashboard(auth);
      setDashboard(dash);
      setDashboardRaw(dash);
      const m = await fetchAccountMetrics(auth, limit);
      setMetrics(m);
      setMetricsRaw(m);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  }, [hasAuth, settings.apiKey, settings.accessToken, settings.userId, settings.authName, limit, patchSettings]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when auth appears
  }, [settings.apiKey, settings.accessToken]);

  const saveName = async () => {
    if (!hasAuth) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await patchAccount(auth, name.trim());
      setWhoami(updated);
      setWhoamiRaw(updated);
      patchSettings({
        account: updated,
        authName: updated.name,
      });
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const volumeBase =
    metrics?.summary.trades.volumeUsdcBase ??
    dashboard?.metrics.trades.volumeUsdcBase ??
    0;
  const tradeTotal =
    metrics?.summary.trades.total ?? dashboard?.metrics.trades.total ?? 0;
  const createTotal =
    metrics?.summary.creates.total ?? dashboard?.metrics.creates.total ?? 0;
  const keysActive = metrics?.summary.keys.active ?? dashboard?.keys.active ?? 0;
  const keysTotal = metrics?.summary.keys.total ?? dashboard?.keys.total ?? 0;
  const byKind = metrics?.summary.trades.byKind;

  if (!hasAuth) {
    return (
      <div className="panel">
        <h2>Account</h2>
        <p className="muted">
          Sign in for a JWT, or paste an API key in the bar, then open this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <div className="flow__grid">
        <section className="panel">
          <div className="panel__head-row">
            <h2>Account</h2>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
          <p className="muted">
            Your attributed volume from <code>GET /account/metrics/</code> —
            buys (and win claims) reported for this account.
          </p>

          <div className="metric-grid" aria-label="Account metrics">
            <div className="metric-card">
              <span className="metric-card__label">Attributed volume</span>
              <span className="metric-card__value">
                {formatUsdcBase(volumeBase)}
              </span>
              <span className="metric-card__hint">
                base {volumeBase}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Trades</span>
              <span className="metric-card__value">{tradeTotal}</span>
              <span className="metric-card__hint">
                {byKind
                  ? Object.entries(byKind)
                      .map(([k, n]) => `${k} ${n}`)
                      .join(" · ") || "—"
                  : "attributed"}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Creates</span>
              <span className="metric-card__value">{createTotal}</span>
              <span className="metric-card__hint">market sessions</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">API keys</span>
              <span className="metric-card__value">
                {keysActive}/{keysTotal}
              </span>
              <span className="metric-card__hint">active / total</span>
            </div>
          </div>

          <label className="field">
            <span>Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn btn--accent"
              disabled={busy || !name.trim()}
              onClick={() => void saveName()}
            >
              Save name
            </button>
          </div>

          {whoami && (
            <div className="callout">
              <div>
                <strong>{whoami.name}</strong> · {whoami.email || "—"}
              </div>
              <div>
                userId <code>{whoami.userId}</code>
              </div>
              <div>
                status {whoami.status} · canCreateMarkets{" "}
                {whoami.canCreateMarkets ? "yes" : "no"}
              </div>
              {whoami.apiKeyId && (
                <div>
                  apiKeyId <code>{whoami.apiKeyId}</code>
                </div>
              )}
            </div>
          )}

          <label className="field">
            <span>Metrics limit</span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
            />
          </label>

          {metrics && (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Creates</th>
                      <th>Status</th>
                      <th>Event</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.creates.map((row) => (
                      <tr key={row.createId}>
                        <td>
                          <code>{row.createId.slice(0, 12)}…</code>
                        </td>
                        <td>{row.status}</td>
                        <td>
                          <code>{row.eventPda.slice(0, 8)}…</code>
                        </td>
                        <td>{formatUsdcBase(row.paymentUsdc)}</td>
                      </tr>
                    ))}
                    {metrics.creates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          No creates
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trades</th>
                      <th>Kind</th>
                      <th>Side</th>
                      <th>Amount</th>
                      <th>Market</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.trades.map((row) => (
                      <tr key={row.signature}>
                        <td>
                          <code>{row.signature.slice(0, 10)}…</code>
                        </td>
                        <td>{row.kind}</td>
                        <td>{row.side || "—"}</td>
                        <td>{formatUsdcBase(row.amountUsdc)}</td>
                        <td>
                          <code>{row.marketId.slice(0, 8)}…</code>
                        </td>
                      </tr>
                    ))}
                    {metrics.trades.length === 0 && (
                      <tr>
                        <td colSpan={5} className="muted">
                          No attributed trades yet — report buys via Trades
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="GET /whoami/" value={whoamiRaw} />
          <JsonPanel title="GET /account/dashboard/" value={dashboardRaw} />
          <JsonPanel title="GET /account/metrics/" value={metricsRaw} />
        </aside>
      </div>
    </div>
  );
}
