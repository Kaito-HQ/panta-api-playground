"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import { createKey, listKeys, revokeKey } from "@/lib/accountApi";
import { ApiError } from "@/lib/api";
import type { ApiKeyRow } from "@/lib/types";

export function KeysPanel() {
  const { settings } = useSettings();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"test" | "live">("test");
  const [revokeOthers, setRevokeOthers] = useState(false);

  const load = useCallback(async () => {
    if (!settings.apiKey) {
      setKeys([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setKeys(await listKeys(settings.apiKey));
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
        <h2>API keys</h2>
        <p className="muted">
          Paste an existing <code>pk_test_…</code> in the bar above, then create
          more keys here via <code>POST /account/keys/</code>.
        </p>
      </div>
    );
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNewSecret(null);
    try {
      const row = await createKey(settings.apiKey, {
        env,
        name: name.trim() || undefined,
        revokeOthers,
      });
      if (row.secret) setNewSecret(row.secret);
      setName("");
      await load();
    } catch (err) {
      setError(describeErr(err));
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm(`Revoke key ${id}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await revokeKey(settings.apiKey, id);
      await load();
    } catch (err) {
      setError(describeErr(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Create API key</h2>
        <p className="muted">
          Calls <code>POST /account/keys/</code> with your current key. The new
          secret is shown once.
        </p>
        <form onSubmit={onCreate} className="stack-form">
          <div className="row">
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ci, local, demo…"
              />
            </label>
            <label className="field">
              <span>Env</span>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value as "test" | "live")}
              >
                <option value="test">test</option>
                <option value="live">live</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={revokeOthers}
              onChange={(e) => setRevokeOthers(e.target.checked)}
            />
            Revoke all other active keys for this account
          </label>
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy ? "Creating…" : "Create API key"}
          </button>
        </form>

        {newSecret && (
          <div className="callout callout--ok" style={{ marginTop: "1rem" }}>
            <strong>Copy this secret now — it will not be shown again</strong>
            <code style={{ display: "block", marginTop: "0.35rem" }}>
              {newSecret}
            </code>
            <button
              type="button"
              className="btn"
              style={{ marginTop: "0.5rem" }}
              onClick={() => void navigator.clipboard.writeText(newSecret)}
            >
              Copy
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__head-row">
          <h2>Keys on this account</h2>
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
                <th>Prefix</th>
                <th>Env</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name || "—"}</td>
                  <td>
                    <code>{k.prefix}</code>
                  </td>
                  <td>{k.env}</td>
                  <td>{k.status}</td>
                  <td>{k.createdAt?.slice(0, 19) || "—"}</td>
                  <td>
                    {k.status === "active" && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busy}
                        onClick={() => void onRevoke(k.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    {busy ? "Loading…" : "No keys returned"}
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
