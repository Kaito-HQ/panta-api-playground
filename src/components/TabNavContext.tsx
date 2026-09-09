"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlaygroundTab =
  | "auth"
  | "keys"
  | "account"
  | "markets"
  | "create"
  | "buy"
  | "positions"
  | "claim"
  | "trades"
  | "admin";

export type ClaimPreset = {
  marketId: string;
};

export type BuyPreset = {
  marketId: string;
};

export type TradePreset = {
  signature?: string;
  wallet?: string;
  marketId?: string;
  quoteId?: string;
  clientOrderId?: string;
};

type Ctx = {
  tab: PlaygroundTab;
  setTab: (tab: PlaygroundTab) => void;
  claimPreset: ClaimPreset | null;
  buyPreset: BuyPreset | null;
  tradePreset: TradePreset | null;
  openClaim: (marketId: string) => void;
  openBuy: (marketId: string) => void;
  openTrades: (preset: TradePreset) => void;
  clearClaimPreset: () => void;
  clearBuyPreset: () => void;
  clearTradePreset: () => void;
};

const TabNavContext = createContext<Ctx | null>(null);

export function TabNavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<PlaygroundTab>("auth");
  const [claimPreset, setClaimPreset] = useState<ClaimPreset | null>(null);
  const [buyPreset, setBuyPreset] = useState<BuyPreset | null>(null);
  const [tradePreset, setTradePreset] = useState<TradePreset | null>(null);

  const openClaim = useCallback((marketId: string) => {
    setClaimPreset({ marketId });
    setTab("claim");
  }, []);

  const openBuy = useCallback((marketId: string) => {
    setBuyPreset({ marketId });
    setTab("buy");
  }, []);

  const openTrades = useCallback((preset: TradePreset) => {
    setTradePreset(preset);
    setTab("trades");
  }, []);

  const clearClaimPreset = useCallback(() => setClaimPreset(null), []);
  const clearBuyPreset = useCallback(() => setBuyPreset(null), []);
  const clearTradePreset = useCallback(() => setTradePreset(null), []);

  const value = useMemo(
    () => ({
      tab,
      setTab,
      claimPreset,
      buyPreset,
      tradePreset,
      openClaim,
      openBuy,
      openTrades,
      clearClaimPreset,
      clearBuyPreset,
      clearTradePreset,
    }),
    [
      tab,
      claimPreset,
      buyPreset,
      tradePreset,
      openClaim,
      openBuy,
      openTrades,
      clearClaimPreset,
      clearBuyPreset,
      clearTradePreset,
    ],
  );

  return (
    <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>
  );
}

export function useTabNav() {
  const ctx = useContext(TabNavContext);
  if (!ctx) throw new Error("useTabNav requires TabNavProvider");
  return ctx;
}
