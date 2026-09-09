"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import { createKey, listKeys, revokeKey } from "@/lib/accountApi";
import { withAccessToken } from "@/lib/authApi";
import { ApiError } from "@/lib/api";
import type { ApiKeyRow } from "@/lib/types";

export function KeysPanel() {
  const { settings, setSettings, patchSettings } = useSettings();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"test" | "live">("test");
  const [revokeOthers, setRevokeOthers] = useState(false);

  const persistTokens = useCallback(
    (next: { access: string; refresh: string }) => {
      patchSettings({
        accessToken: next.access,
        refreshToken: next.refresh,
      });
    },
    [patchSettings],
  );

  const load = useCallback(async () => {
    if (!settings.accessToken) {
      setKeys([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await withAccessToken(
        settings.accessToken,
        settings.refreshToken,
        (access) => listKeys(access),
        persistTokens,
      );
      setKeys(rows);
    } catch (e) {
      setError(describeErr(e));
    } finally {
      setBusy(false);
    }
  }, [
    persistTokens,
    settings.accessToken,
    settings.refreshToken,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!settings.accessToken) {
    return (
      <div className="panel">
        <h2>API keys</h2>
        <p className="muted">
          Key create/list/revoke requires a signup JWT. Open the{" "}
          <strong>Sign in</strong> tab first, then come back here.
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
      const row = await withAccessToken(
        settings.accessToken,
        settings.refreshToken,
        (access) =>
          createKey(access, {
            env,
            name: name.trim() || undefined,
            revokeOthers,
          }),
        persistTokens,
      );
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
      await withAccessToken(
        settings.accessToken,
        settings.refreshToken,
        (access) => revokeKey(access, id),
        persistTokens,
      );
      await load();
    } catch (err) {
      setError(describeErr(err));
    } finally {
      setBusy(false);
    }
  };

  const useSecret = (secret: string) => {
    setSettings({
      ...settings,
      apiKey: secret,
      account: null,
      isAdmin: false,
    });
  };

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Create API key</h2>
        <p className="muted">
          Calls <code>POST /account/keys/</code> with{" "}
          <code>Authorization: Bearer</code> (not <code>X-Api-Key</code>). The
          new secret is shown once — use it in the bar for create/buy flows.
        </p>
        <form onSubmit={(e) => void onCreate(e)} className="stack-form">
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
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn"
                onClick={() => void navigator.clipboard.writeText(newSecret)}
              >
                Copy
              </button>
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => useSecret(newSecret)}
              >
                Use in connection bar
              </button>
            </div>
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
