"use client";

import { useState } from "react";
import { ConnectionBar } from "@/components/ConnectionBar";
import { CreateMarketFlow } from "@/components/CreateMarketFlow";
import { PrimaryBuyFlow } from "@/components/PrimaryBuyFlow";

type Tab = "create" | "buy";

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("create");

  return (
    <main className="shell">
      <ConnectionBar />

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "create" ? "tab--on" : ""}`}
          onClick={() => setTab("create")}
        >
          Create market
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "buy" ? "tab--on" : ""}`}
          onClick={() => setTab("buy")}
        >
          Primary buy
        </button>
      </div>

      {tab === "create" ? <CreateMarketFlow /> : <PrimaryBuyFlow />}
    </main>
  );
}
