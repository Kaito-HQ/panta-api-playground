"use client";

import { type FormEvent, useState } from "react";
import { useSettings } from "@/components/SettingsContext";
import { loginAccount, registerAccount } from "@/lib/authApi";
import { ApiError } from "@/lib/api";

type Mode = "login" | "register";

export function AuthPanel() {
  const { settings, setSettings } = useSettings();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(settings.email || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = Boolean(settings.accessToken);

  const applySession = (data: {
    access: string;
    refresh: string;
    email: string;
    name: string;
    userId: string | null;
  }) => {
    setSettings({
      ...settings,
      accessToken: data.access,
      refreshToken: data.refresh,
      email: data.email,
      authName: data.name || "",
      userId: data.userId || "",
    });
    setPassword("");
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data =
        mode === "register"
          ? await registerAccount({
              email: email.trim(),
              password,
              name: name.trim() || undefined,
            })
          : await loginAccount({
              email: email.trim(),
              password,
            });
      applySession({
        access: data.access,
        refresh: data.refresh,
        email: data.email,
        name: data.name,
        userId: data.userId,
      });
    } catch (err) {
      setError(describeErr(err));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    setSettings({
      ...settings,
      accessToken: "",
      refreshToken: "",
      email: "",
      authName: "",
      userId: "",
      account: null,
      isAdmin: false,
    });
    setPassword("");
    setError(null);
  };

  if (loggedIn) {
    return (
      <div className="panel">
        <h2>Signed in</h2>
        <p className="muted">
          JWT from signup/login. Use the <strong>API keys</strong> tab to mint a{" "}
          <code>pk_test_…</code>, then paste it in the bar for product routes.
        </p>
        <dl className="kv" style={{ marginTop: "1rem" }}>
          <div>
            <dt>Email</dt>
            <dd>{settings.email || "—"}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{settings.authName || "—"}</dd>
          </div>
          <div>
            <dt>User id</dt>
            <dd>
              <code>{settings.userId || "—"}</code>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: "1rem" }}
          onClick={logout}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flow">
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel login-card" style={{ maxWidth: 440 }}>
        <div className="tabs" role="tablist" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className={`tab ${mode === "login" ? "tab--on" : ""}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`tab ${mode === "register" ? "tab--on" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>

        <h2>{mode === "login" ? "Log in" : "Create account"}</h2>
        <p className="muted">
          {mode === "login"
            ? "POST /auth/token/ — returns access + refresh JWTs."
            : "POST /auth/register/ — open signup, then you can create API keys."}
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="login-form">
          {mode === "register" && (
            <label className="field">
              <span>Name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme"
                autoComplete="organization"
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 characters"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy
              ? mode === "login"
                ? "Signing in…"
                : "Creating…"
              : mode === "login"
                ? "Log in"
                : "Sign up"}
          </button>
        </form>
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
