"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import {
  fetchAdminCreates,
  fetchAdminMetrics,
  fetchAdminTrades,
  fetchAdminUserDetail,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/accountApi";
import { ApiError, formatUsdcBase } from "@/lib/api";
import { describeErr } from "@/lib/errors";
import type {
  AdminUser,
  AdminUserDetail,
  CreateMetricRow,
  Json,
  PlatformMetrics,
  TradeMetricRow,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

export function AdminPanel() {
  const { settings } = useSettings();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | undefined>();
  const [creates, setCreates] = useState<CreateMetricRow[]>([]);
  const [trades, setTrades] = useState<TradeMetricRow[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | undefined>();
  const [metricsRaw, setMetricsRaw] = useState<Json>();
  const [createsRaw, setCreatesRaw] = useState<Json>();
  const [tradesRaw, setTradesRaw] = useState<Json>();
  const [detailRaw, setDetailRaw] = useState<Json>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    if (!settings.apiKey || !settings.isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const [m, u, c, t] = await Promise.all([
        fetchAdminMetrics(settings.apiKey),
        listAdminUsers(settings.apiKey),
        fetchAdminCreates(settings.apiKey, limit),
        fetchAdminTrades(settings.apiKey, limit),
      ]);
      setMetrics(m);
      setMetricsRaw(m);
      setUsers(u);
      setCreates(c);
      setCreatesRaw({ creates: c });
      setTrades(t);
      setTradesRaw({ trades: t });
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  }, [settings.apiKey, settings.isAdmin, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!settings.apiKey) {
    return (
      <div className="panel">
        <h2>Admin</h2>
        <p className="muted">Paste an admin API key in the bar above.</p>
      </div>
    );
  }

  if (!settings.isAdmin) {
    return (
      <div className="panel">
        <h2>Admin</h2>
        <p className="muted">
          This key is not platform admin. Click <strong>Test key</strong> after
          pasting an admin key, or ask an operator to set <code>is_admin</code>.
        </p>
      </div>
    );
  }

  const toggleCreate = async (user: AdminUser) => {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await updateAdminUser(settings.apiKey, user.userId, {
        canCreateMarkets: !user.canCreateMarkets,
      });
      await load();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        setHint(
          "PATCH /admin/users/{id}/ is not on the API yet. Use Django admin / DB to grant create.",
        );
      }
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      const d = await fetchAdminUserDetail(settings.apiKey, userId);
      setDetail(d);
      setDetailRaw(d);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow">
      {hint && <div className="banner banner--warn">{hint}</div>}
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel">
        <div className="panel__head-row">
          <h2>Platform metrics</h2>
          <div className="row" style={{ margin: 0, alignItems: "center" }}>
            <label className="field" style={{ margin: 0, minWidth: 100 }}>
              <span>limit</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 50)}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </div>
        {metrics && (
          <div className="metric-grid" aria-label="Platform metrics">
            <div className="metric-card">
              <span className="metric-card__label">Platform volume</span>
              <span className="metric-card__value">
                {formatUsdcBase(metrics.trades.volumeUsdcBase)}
              </span>
              <span className="metric-card__hint">
                base {metrics.trades.volumeUsdcBase ?? 0}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Trades</span>
              <span className="metric-card__value">{metrics.trades.total}</span>
              <span className="metric-card__hint">
                {metrics.trades.byKind
                  ? Object.entries(metrics.trades.byKind)
                      .map(([k, n]) => `${k} ${n}`)
                      .join(" · ") || "—"
                  : "all partners"}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Creates</span>
              <span className="metric-card__value">{metrics.creates.total}</span>
              <span className="metric-card__hint">market sessions</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Users</span>
              <span className="metric-card__value">
                {metrics.users.active}/{metrics.users.total}
              </span>
              <span className="metric-card__hint">
                active · admins {metrics.users.admins}
              </span>
            </div>
          </div>
        )}
      </section>

      <div className="flow__grid">
        <section className="panel">
          <h2>Users</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>User ID</th>
                  <th>Volume</th>
                  <th>Trades</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Create</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.name}</td>
                    <td>
                      <code>{u.userId}</code>
                    </td>
                    <td>
                      {formatUsdcBase(u.metrics?.trades?.volumeUsdcBase ?? 0)}
                    </td>
                    <td>{u.metrics?.trades?.total ?? 0}</td>
                    <td>{u.status}</td>
                    <td>{u.isAdmin ? "yes" : "no"}</td>
                    <td>{u.canCreateMarkets ? "yes" : "no"}</td>
                    <td>
                      <div className="actions" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busy}
                          onClick={() => void openDetail(u.userId)}
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          className="btn btn--accent"
                          disabled={busy}
                          onClick={() => void toggleCreate(u)}
                        >
                          {u.canCreateMarkets ? "Revoke" : "Grant"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !error && (
                  <tr>
                    <td colSpan={8} className="muted">
                      {busy ? "Loading…" : "No users"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {detail && (
            <div className="callout">
              <strong>{detail.user.name}</strong> · volume{" "}
              {formatUsdcBase(detail.metrics.trades.volumeUsdcBase)} · trades{" "}
              {detail.metrics.trades.total} · creates{" "}
              {detail.metrics.creates.total}
            </div>
          )}

          <h2>Recent creates</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>createId</th>
                  <th>Status</th>
                  <th>Wallet</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {creates.map((row) => (
                  <tr key={row.createId}>
                    <td>
                      <code>{row.createId.slice(0, 14)}…</code>
                    </td>
                    <td>{row.status}</td>
                    <td>
                      <code>{row.wallet.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <code>{row.eventPda.slice(0, 8)}…</code>
                    </td>
                  </tr>
                ))}
                {creates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      None
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2>Recent trades</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signature</th>
                  <th>Kind</th>
                  <th>Side</th>
                  <th>Amount</th>
                  <th>Market</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((row) => (
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
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      None
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel panel--stack">
          <JsonPanel title="GET /admin/metrics/" value={metricsRaw} />
          <JsonPanel title="GET /admin/metrics/creates/" value={createsRaw} />
          <JsonPanel title="GET /admin/metrics/trades/" value={tradesRaw} />
          <JsonPanel
            title="GET /admin/users/{id}/"
            value={detailRaw}
            empty={
              detail
                ? undefined
                : "Open Detail on a user to load GET /admin/users/{id}/"
            }
          />
        </aside>
      </div>
    </div>
  );
}
