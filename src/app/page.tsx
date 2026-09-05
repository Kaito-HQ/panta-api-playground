"use client";

import { useState } from "react";
import { ConnectionBar } from "@/components/ConnectionBar";
import { CreateMarketFlow } from "@/components/CreateMarketFlow";
import { PrimaryBuyFlow } from "@/components/PrimaryBuyFlow";
import { KeysPanel } from "@/components/KeysPanel";
import { AdminPanel } from "@/components/AdminPanel";

type Tab = "keys" | "create" | "buy" | "admin";

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("keys");

  return (
    <main className="shell">
      <ConnectionBar />

      <div className="tabs" role="tablist">
        <button
          type="button"
          className={`tab ${tab === "keys" ? "tab--on" : ""}`}
          onClick={() => setTab("keys")}
        >
          API keys
        </button>
        <button
          type="button"
          className={`tab ${tab === "create" ? "tab--on" : ""}`}
          onClick={() => setTab("create")}
        >
          Create market
        </button>
        <button
          type="button"
          className={`tab ${tab === "buy" ? "tab--on" : ""}`}
          onClick={() => setTab("buy")}
        >
          Primary buy
        </button>
        <button
          type="button"
          className={`tab ${tab === "admin" ? "tab--on" : ""}`}
          onClick={() => setTab("admin")}
        >
          Admin
        </button>
      </div>

      {tab === "keys" && <KeysPanel />}
      {tab === "create" && <CreateMarketFlow />}
      {tab === "buy" && <PrimaryBuyFlow />}
      {tab === "admin" && <AdminPanel />}
    </main>
  );
}
