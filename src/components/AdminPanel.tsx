"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  buildPartnerAnalytics,
  formatUsdcHuman,
  resolveMarketTitles,
  shortId,
  tradeUsdcNumber,
  type PartnerAnalytics,
} from "@/lib/partnerAnalytics";
import type {
  AdminUser,
  AdminUserDetail,
  CreateMetricRow,
  Json,
  PlatformMetrics,
  TradeMetricRow,
} from "@/lib/types";
import { JsonPanel } from "@/components/JsonPanel";

type UserFilter = "all" | "admin" | "create" | "suspended";
type UserSort = "volume" | "trades" | "name";

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admins" },
  { id: "create", label: "Can create" },
  { id: "suspended", label: "Suspended" },
];

function userVolume(user: AdminUser): number {
  return Number(user.metrics?.trades?.volumeUsdcBase ?? 0);
}

function userTrades(user: AdminUser): number {
  return user.metrics?.trades?.total ?? 0;
}

function statusLabel(status: string): string {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function MixBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      <h3 className="admin-kpi__label" style={{ marginBottom: "0.65rem" }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No breakdown yet.
        </p>
      ) : (
        <div className="admin-bars" role="list">
          {rows.map((row) => (
            <div key={row.label} role="listitem">
              <div className="admin-bar__meta">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
              <div className="admin-bar__track" aria-hidden>
                <div
                  className="admin-bar__fill"
                  style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Gate({ title, body }: { title: string; body: string }) {
  return (
    <section className="panel admin">
      <h2>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {body}
      </p>
    </section>
  );
}

export function AdminPanel() {
  const { settings } = useSettings();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | undefined>();
  const [creates, setCreates] = useState<CreateMetricRow[]>([]);
  const [trades, setTrades] = useState<TradeMetricRow[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | undefined>();
  const [analytics, setAnalytics] = useState<PartnerAnalytics | undefined>();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [titlesBusy, setTitlesBusy] = useState(false);
  const [metricsRaw, setMetricsRaw] = useState<Json>();
  const [createsRaw, setCreatesRaw] = useState<Json>();
  const [tradesRaw, setTradesRaw] = useState<Json>();
  const [detailRaw, setDetailRaw] = useState<Json>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [hideZeroVolume, setHideZeroVolume] = useState(false);
  const [sort, setSort] = useState<UserSort>("volume");

  const load = useCallback(async () => {
    if (!settings.apiKey || !settings.isAdmin) return;
    setBusy(true);
    setError(null);
    setUsersError(null);
    const [m, u, c, t] = await Promise.allSettled([
      fetchAdminMetrics(settings.apiKey),
      listAdminUsers(settings.apiKey),
      fetchAdminCreates(settings.apiKey, limit),
      fetchAdminTrades(settings.apiKey, limit),
    ]);
    const failures: string[] = [];
    if (m.status === "fulfilled") {
      setMetrics(m.value);
      setMetricsRaw(m.value);
    } else {
      failures.push(describeErr(m.reason));
    }
    if (u.status === "fulfilled") {
      setUsers(u.value);
    } else {
      setUsers([]);
      setUsersError(describeErr(u.reason));
    }
    if (c.status === "fulfilled") {
      setCreates(c.value);
      setCreatesRaw({ creates: c.value });
    } else {
      failures.push(describeErr(c.reason));
    }
    if (t.status === "fulfilled") {
      setTrades(t.value);
      setTradesRaw({ trades: t.value });
    } else {
      failures.push(describeErr(t.reason));
    }
    setError(failures.length ? failures.join("\n\n") : null);
    setBusy(false);
  }, [settings.apiKey, settings.isAdmin, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const marketsWithTitles = useMemo(() => {
    if (!analytics) return [];
    return analytics.markets.map((market) => ({
      ...market,
      title: titles[market.marketId] || market.title || "",
    }));
  }, [analytics, titles]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (filter === "admin" && !user.isAdmin) return false;
      if (filter === "create" && !user.canCreateMarkets) return false;
      if (filter === "suspended" && user.status.toLowerCase() !== "suspended") {
        return false;
      }
      if (hideZeroVolume && userVolume(user) <= 0) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.userId.toLowerCase().includes(needle) ||
        (user.email || "").toLowerCase().includes(needle)
      );
    });
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "trades") return userTrades(b) - userTrades(a);
      return userVolume(b) - userVolume(a);
    });
    return copy;
  }, [users, query, filter, hideZeroVolume, sort]);

  const tradeMix = useMemo(() => {
    const byKind = metrics?.trades.byKind || {};
    return Object.entries(byKind)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  const createMix = useMemo(() => {
    const byStatus = metrics?.creates.byStatus || {};
    return Object.entries(byStatus)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  if (!settings.apiKey) {
    return (
      <Gate
        title="Admin"
        body="Paste an admin API key in the bar above, then choose Test key."
      />
    );
  }

  if (!settings.isAdmin) {
    return (
      <Gate
        title="Admin"
        body="This key is not platform admin. Choose Test key after pasting an admin key, or ask an operator to set is_admin."
      />
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
          "PATCH /admin/users/{id}/ is not on the API yet. Use Django admin or the database to grant create.",
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
    setTitles({});
    setAnalytics(undefined);
    try {
      const next = await fetchAdminUserDetail(settings.apiKey, userId);
      const rolled = buildPartnerAnalytics(next);
      setDetail(next);
      setDetailRaw(next);
      setAnalytics(rolled);
      setTitlesBusy(true);
      try {
        const map = await resolveMarketTitles(
          settings.apiKey,
          rolled.markets.map((market) => market.marketId),
        );
        setTitles(map);
      } finally {
        setTitlesBusy(false);
      }
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  };

  const closeDetail = () => {
    setDetail(undefined);
    setAnalytics(undefined);
    setTitles({});
    setDetailRaw(undefined);
  };

  if (detail && analytics) {
    return (
      <div className="admin">
        {error && (
          <div className="banner banner--err" role="alert">
            {error}
          </div>
        )}

        <section className="panel" aria-labelledby="partner-heading">
          <div className="admin-back" style={{ marginBottom: "0.85rem" }}>
            <button type="button" className="btn" onClick={closeDetail}>
              Back to dashboard
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void openDetail(detail.user.userId)}
            >
              {busy ? "Refreshing…" : "Refresh partner"}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: "0.25rem" }}>
            Partner
          </p>
          <h2 id="partner-heading" style={{ marginBottom: "0.4rem" }}>
            {detail.user.name || detail.user.userId}
          </h2>
          <p className="muted" style={{ marginBottom: "0.65rem" }}>
            <code>{detail.user.userId}</code>
            {detail.user.email ? ` · ${detail.user.email}` : ""}
          </p>
          <div className="admin-pills">
            <span className="admin-pill">{statusLabel(detail.user.status)}</span>
            <span
              className={`admin-pill${detail.user.canCreateMarkets ? " admin-pill--ok" : ""}`}
            >
              {detail.user.canCreateMarkets ? "Can create markets" : "Create off"}
            </span>
            {detail.user.isAdmin && (
              <span className="admin-pill admin-pill--ok">Admin</span>
            )}
          </div>

          <div className="admin-kpis" style={{ marginTop: "1rem" }}>
            <article className="admin-kpi">
              <span className="admin-kpi__label">Volume</span>
              <span className="admin-kpi__value">
                {formatUsdcHuman(analytics.totalVolumeUsdc)}
              </span>
              <span className="admin-kpi__hint">Attributed to this partner</span>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi__label">Trades</span>
              <span className="admin-kpi__value">{analytics.totalTrades}</span>
              <span className="admin-kpi__hint">
                {Object.entries(analytics.tradesByKind)
                  .map(([kind, count]) => `${kind} ${count}`)
                  .join(" · ") || "No kind breakdown"}
              </span>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi__label">Creates</span>
              <span className="admin-kpi__value">{analytics.totalCreates}</span>
              <span className="admin-kpi__hint">
                Registered {analytics.registeredCreates}
              </span>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi__label">Markets</span>
              <span className="admin-kpi__value">{analytics.markets.length}</span>
              <span className="admin-kpi__hint">
                Created {analytics.marketsCreated} · traded {analytics.marketsTraded}
              </span>
            </article>
          </div>

          {analytics.rowCapHint && (
            <div className="banner banner--warn" style={{ marginTop: "0.85rem" }}>
              {analytics.rowCapHint}
            </div>
          )}
          {titlesBusy && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Loading market titles…
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="partner-markets">
          <h2 id="partner-markets">Markets</h2>
          <p className="muted">
            Titles come from the catalog. Volume is this partner&apos;s attributed
            trades on that market.
          </p>
          {marketsWithTitles.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No creates or attributed trades for this partner yet.
            </p>
          ) : (
            <div className="admin-cards">
              {marketsWithTitles.map((market) => (
                <article key={market.marketId} className="admin-card">
                  <h3 className="admin-card__title">
                    {market.title || "Untitled market"}
                  </h3>
                  <code className="admin-card__id">{market.marketId}</code>
                  <dl className="admin-card__stats">
                    <div>
                      <dt>Created</dt>
                      <dd>{market.createdByPartner ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Create status</dt>
                      <dd>{market.createStatus || "—"}</dd>
                    </div>
                    <div>
                      <dt>Volume</dt>
                      <dd>{formatUsdcHuman(market.volumeUsdc)}</dd>
                    </div>
                    <div>
                      <dt>Trades</dt>
                      <dd>
                        {market.tradeCount}
                        {Object.keys(market.byKind).length
                          ? ` · ${Object.entries(market.byKind)
                              .map(([kind, count]) => `${kind} ${count}`)
                              .join(", ")}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="admin-activity">
          <section className="panel" aria-labelledby="partner-creates">
            <h2 id="partner-creates">Creates</h2>
            {(detail.creates || []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                None
              </p>
            ) : (
              <ul className="admin-feed">
                {(detail.creates || []).map((row) => (
                  <li key={row.createId}>
                    <strong>{titles[row.eventPda] || "Market"}</strong>
                    <span>
                      {row.status} · {row.paymentUsdc} USDC
                    </span>
                    <code>{shortId(row.eventPda, 16)}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel" aria-labelledby="partner-trades">
            <h2 id="partner-trades">Trades</h2>
            {(detail.trades || []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                None
              </p>
            ) : (
              <ul className="admin-feed">
                {(detail.trades || []).map((row) => (
                  <li key={row.signature}>
                    <strong>{titles[row.marketId] || "Market"}</strong>
                    <span>
                      {row.kind} · {row.side || "no side"} ·{" "}
                      {formatUsdcHuman(tradeUsdcNumber(row))}
                    </span>
                    <code>{shortId(row.signature, 16)}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="panel" aria-labelledby="partner-keys">
          <h2 id="partner-keys">API keys</h2>
          {(detail.keys || []).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              None
            </p>
          ) : (
            <ul className="admin-feed">
              {(detail.keys || []).map((key) => (
                <li key={key.id}>
                  <strong>{key.name || "Unnamed key"}</strong>
                  <span>
                    {key.env} · {key.status}
                  </span>
                  <code>{key.prefix}</code>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="admin-raw">
          <summary>Raw partner response</summary>
          <JsonPanel title="GET /admin/users/{id}/" value={detailRaw} />
        </details>
      </div>
    );
  }

  const showSkeleton = busy && !metrics && !error;

  return (
    <div className="admin">
      <header className="admin-top">
        <div>
          <h2>Admin</h2>
          <p className="muted">
            Platform volume, partners, and the latest creates and trades.
          </p>
        </div>
        <div className="admin-tools">
          <label className="field">
            <span>Activity limit</span>
            <input
              type="number"
              min={1}
              max={200}
              inputMode="numeric"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 50)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <nav className="admin-jumps" aria-label="Dashboard sections">
        <a href="#admin-overview">Overview</a>
        <a href="#admin-partners">Partners</a>
        <a href="#admin-activity">Activity</a>
      </nav>

      {hint && <div className="banner banner--warn">{hint}</div>}
      {error && (
        <div className="banner banner--err" role="alert">
          {error}
          <div style={{ marginTop: "0.65rem" }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <section id="admin-overview" className="panel" aria-labelledby="overview-heading">
        <h2 id="overview-heading">Overview</h2>
        {showSkeleton ? (
          <div className="admin-kpis" aria-busy="true" aria-label="Loading metrics">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="admin-skel" />
            ))}
          </div>
        ) : metrics ? (
          <>
            <div className="admin-kpis">
              <article className="admin-kpi">
                <span className="admin-kpi__label">Volume</span>
                <span className="admin-kpi__value">
                  {formatUsdcBase(metrics.trades.volumeUsdcBase)}
                </span>
                <span className="admin-kpi__hint">Attributed partner trades</span>
              </article>
              <article className="admin-kpi">
                <span className="admin-kpi__label">Trades</span>
                <span className="admin-kpi__value">{metrics.trades.total}</span>
                <span className="admin-kpi__hint">All partners</span>
              </article>
              <article className="admin-kpi">
                <span className="admin-kpi__label">Creates</span>
                <span className="admin-kpi__value">{metrics.creates.total}</span>
                <span className="admin-kpi__hint">Market sessions</span>
              </article>
              <article className="admin-kpi">
                <span className="admin-kpi__label">Users</span>
                <span className="admin-kpi__value">
                  {metrics.users.active}/{metrics.users.total}
                </span>
                <span className="admin-kpi__hint">Active of total</span>
              </article>
              <article className="admin-kpi">
                <span className="admin-kpi__label">Admins</span>
                <span className="admin-kpi__value">{metrics.users.admins}</span>
                <span className="admin-kpi__hint">
                  Suspended {metrics.users.suspended}
                </span>
              </article>
              <article className="admin-kpi">
                <span className="admin-kpi__label">Keys</span>
                <span className="admin-kpi__value">{metrics.keys.active}</span>
                <span className="admin-kpi__hint">
                  Active · {metrics.keys.revoked} revoked
                </span>
              </article>
            </div>

            <div className="admin-split" style={{ marginTop: "1rem" }}>
              <div className="admin-split" style={{ gridTemplateColumns: "1fr" }}>
                <MixBars title="Trades by kind" rows={tradeMix} />
                <MixBars title="Creates by status" rows={createMix} />
              </div>
              <div>
                <h3 className="admin-kpi__label" style={{ marginBottom: "0.65rem" }}>
                  Keys
                </h3>
                <div className="admin-keys">
                  <div className="admin-key">
                    <strong>{metrics.keys.active}</strong>
                    <span>Active</span>
                  </div>
                  <div className="admin-key">
                    <strong>{metrics.keys.revoked}</strong>
                    <span>Revoked</span>
                  </div>
                  <div className="admin-key">
                    <strong>{metrics.keys.total}</strong>
                    <span>Total</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Metrics did not load. Retry above.
          </p>
        )}
      </section>

      <section id="admin-partners" className="panel" aria-labelledby="partners-heading">
        <h2 id="partners-heading">Partners</h2>
        <p className="muted">
          Open a partner for volume, markets, and keys. The user list is the slow
          call; the overview still loads if it fails.
        </p>

        <div className="admin-toolbar">
          <label className="field admin-search">
            <span>Search</span>
            <input
              type="search"
              value={query}
              placeholder="Name, email, or user id"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="admin-filters" role="group" aria-label="Filter partners">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="admin-chip"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="admin-chip"
              aria-pressed={hideZeroVolume}
              onClick={() => setHideZeroVolume((on) => !on)}
            >
              Hide 0 volume
            </button>
          </div>
          <div className="admin-sort" role="group" aria-label="Sort partners">
            <span>Sort</span>
            {(
              [
                ["volume", "Volume"],
                ["trades", "Trades"],
                ["name", "Name"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="admin-chip"
                aria-pressed={sort === id}
                onClick={() => setSort(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {usersError && (
          <div className="banner banner--err" role="alert">
            {usersError}
          </div>
        )}

        {busy && users.length === 0 && !usersError ? (
          <div className="admin-cards admin-cards--users" aria-busy="true">
            <div className="admin-skel" />
            <div className="admin-skel" />
          </div>
        ) : visibleUsers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {usersError
              ? "Partner list unavailable."
              : users.length === 0
                ? "No partners yet."
                : "No partners match these filters."}
          </p>
        ) : (
          <>
            <div className="admin-cards admin-cards--users">
              {visibleUsers.map((user) => (
                <article key={user.userId} className="admin-card">
                  <h3 className="admin-card__title">{user.name || "Unnamed"}</h3>
                  <span className="admin-card__email">{user.email || "No email"}</span>
                  <code className="admin-card__id">{user.userId}</code>
                  <div className="admin-pills" style={{ marginTop: "0.55rem" }}>
                    <span
                      className={`admin-pill${
                        user.status.toLowerCase() === "active" ? " admin-pill--ok" : ""
                      }${
                        user.status.toLowerCase() === "suspended"
                          ? " admin-pill--warn"
                          : ""
                      }`}
                    >
                      {statusLabel(user.status)}
                    </span>
                    {user.isAdmin && <span className="admin-pill">Admin</span>}
                    <span className="admin-pill">
                      {user.canCreateMarkets ? "Create on" : "Create off"}
                    </span>
                  </div>
                  <dl className="admin-card__stats">
                    <div>
                      <dt>Volume</dt>
                      <dd>{formatUsdcBase(userVolume(user))}</dd>
                    </div>
                    <div>
                      <dt>Trades</dt>
                      <dd>{userTrades(user)}</dd>
                    </div>
                  </dl>
                  <div className="admin-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() => void openDetail(user.userId)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className={`btn ${user.canCreateMarkets ? "btn--danger" : "btn--ghost"}`}
                      disabled={busy}
                      onClick={() => void toggleCreate(user)}
                    >
                      {user.canCreateMarkets ? "Revoke create" : "Grant create"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="table-wrap admin-table-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>User ID</th>
                    <th aria-sort={sort === "volume" ? "descending" : "none"}>
                      Volume
                    </th>
                    <th aria-sort={sort === "trades" ? "descending" : "none"}>
                      Trades
                    </th>
                    <th>Status</th>
                    <th>Access</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.userId}>
                      <td>{user.name || "Unnamed"}</td>
                      <td>{user.email || "—"}</td>
                      <td>
                        <code>{shortId(user.userId, 18)}</code>
                      </td>
                      <td>{formatUsdcBase(userVolume(user))}</td>
                      <td>{userTrades(user)}</td>
                      <td>{statusLabel(user.status)}</td>
                      <td>
                        {user.isAdmin ? "Admin" : "Partner"}
                        {user.canCreateMarkets ? " · create" : ""}
                      </td>
                      <td>
                        <div className="admin-card__actions">
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() => void openDetail(user.userId)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className={`btn ${user.canCreateMarkets ? "btn--danger" : "btn--ghost"}`}
                            disabled={busy}
                            onClick={() => void toggleCreate(user)}
                          >
                            {user.canCreateMarkets ? "Revoke" : "Grant"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section id="admin-activity" aria-labelledby="activity-heading">
        <h2 id="activity-heading">Recent activity</h2>
        <div className="admin-activity">
          <section className="panel" aria-labelledby="recent-creates">
            <h2 id="recent-creates">Creates</h2>
            {creates.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {busy ? "Loading…" : "None"}
              </p>
            ) : (
              <ul className="admin-feed">
                {creates.map((row) => (
                  <li key={row.createId}>
                    <strong>{row.status}</strong>
                    <span>{row.paymentUsdc} USDC</span>
                    <code>{shortId(row.eventPda || row.createId, 18)}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel" aria-labelledby="recent-trades">
            <h2 id="recent-trades">Trades</h2>
            {trades.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {busy ? "Loading…" : "None"}
              </p>
            ) : (
              <ul className="admin-feed">
                {trades.map((row) => (
                  <li key={row.signature}>
                    <strong>
                      {row.kind} · {row.side || "no side"}
                    </strong>
                    <span>{formatUsdcHuman(tradeUsdcNumber(row))}</span>
                    <code>{shortId(row.signature, 18)}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      <details className="admin-raw">
        <summary>Raw API responses</summary>
        <div className="admin-raw__grid">
          <JsonPanel title="GET /admin/metrics/" value={metricsRaw} />
          <JsonPanel title="GET /admin/metrics/creates/" value={createsRaw} />
          <JsonPanel title="GET /admin/metrics/trades/" value={tradesRaw} />
        </div>
      </details>
    </div>
  );
}
