"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import { listAdminUsers, updateAdminUser } from "@/lib/accountApi";
import { ApiError } from "@/lib/api";
import type { AdminUser } from "@/lib/types";

export function AdminPanel() {
  const { settings } = useSettings();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!settings.apiKey) return;
    setBusy(true);
    setError(null);
    try {
      setUsers(await listAdminUsers(settings.apiKey));
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  }, [settings.apiKey]);

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
          "PATCH /admin/users/{id}/ is not on the API yet. Backend team needs to add it for grant/revoke.",
        );
      }
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
          <h2>Users</h2>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>User ID</th>
                <th>Status</th>
                <th>Admin</th>
                <th>Create markets</th>
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
                  <td>{u.status}</td>
                  <td>{u.isAdmin ? "yes" : "no"}</td>
                  <td>{u.canCreateMarkets ? "yes" : "no"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--accent"
                      disabled={busy}
                      onClick={() => void toggleCreate(u)}
                    >
                      {u.canCreateMarkets ? "Revoke create" : "Grant create"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="muted">
                    {busy ? "Loading…" : "No users"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
