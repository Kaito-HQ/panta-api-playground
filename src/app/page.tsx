"use client";

import { ConnectionBar } from "@/components/ConnectionBar";
import { AuthPanel } from "@/components/AuthPanel";
import { KeysPanel } from "@/components/KeysPanel";
import { AccountPanel } from "@/components/AccountPanel";
import { CreateMarketFlow } from "@/components/CreateMarketFlow";
import { MarketsPanel } from "@/components/MarketsPanel";
import { PrimaryBuyFlow } from "@/components/PrimaryBuyFlow";
import { PositionsPanel } from "@/components/PositionsPanel";
import { ClaimFlow } from "@/components/ClaimFlow";
import { TradesPanel } from "@/components/TradesPanel";
import { AdminPanel } from "@/components/AdminPanel";
import {
  useTabNav,
  type PlaygroundTab,
} from "@/components/TabNavContext";

const TABS: { id: PlaygroundTab; label: string }[] = [
  { id: "auth", label: "Sign in" },
  { id: "keys", label: "API keys" },
  { id: "account", label: "Account" },
  { id: "markets", label: "Markets" },
  { id: "create", label: "Create market" },
  { id: "buy", label: "Primary buy" },
  { id: "positions", label: "Positions" },
  { id: "claim", label: "Claim" },
  { id: "trades", label: "Trades" },
  { id: "admin", label: "Admin" },
];

export default function HomePage() {
  const { tab, setTab } = useTabNav();

  return (
    <main className="shell">
      <ConnectionBar />

      <div className="tabs" role="tablist" aria-label="Playground sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "tab--on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Keep all panels mounted so in-progress flow state survives tab switches. */}
      <div className="tab-panes">
        <div hidden={tab !== "auth"} className="tab-pane">
          <AuthPanel />
        </div>
        <div hidden={tab !== "keys"} className="tab-pane">
          <KeysPanel />
        </div>
        <div hidden={tab !== "account"} className="tab-pane">
          <AccountPanel />
        </div>
        <div hidden={tab !== "markets"} className="tab-pane">
          <MarketsPanel />
        </div>
        <div hidden={tab !== "create"} className="tab-pane">
          <CreateMarketFlow />
        </div>
        <div hidden={tab !== "buy"} className="tab-pane">
          <PrimaryBuyFlow />
        </div>
        <div hidden={tab !== "positions"} className="tab-pane">
          <PositionsPanel />
        </div>
        <div hidden={tab !== "claim"} className="tab-pane">
          <ClaimFlow />
        </div>
        <div hidden={tab !== "trades"} className="tab-pane">
          <TradesPanel />
        </div>
        <div hidden={tab !== "admin"} className="tab-pane">
          <AdminPanel />
        </div>
      </div>
    </main>
  );
}
