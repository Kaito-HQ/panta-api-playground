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
  | "secondary"
  | "positions"
  | "claim"
  | "dispute"
  | "trades"
  | "admin";

export type ClaimPreset = {
  marketId: string;
};

export type BuyPreset = {
  marketId: string;
};

export type SecondaryPreset = {
  marketId: string;
  nonce: number;
};

export type DisputePreset = {
  marketId: string;
  nonce: number;
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
  secondaryPreset: SecondaryPreset | null;
  disputePreset: DisputePreset | null;
  tradePreset: TradePreset | null;
  openClaim: (marketId: string) => void;
  openBuy: (marketId: string) => void;
  openSecondary: (marketId: string) => void;
  openDispute: (marketId: string) => void;
  openTrades: (preset: TradePreset) => void;
  clearClaimPreset: () => void;
  clearBuyPreset: () => void;
  clearSecondaryPreset: () => void;
  clearDisputePreset: () => void;
  clearTradePreset: () => void;
};

const TabNavContext = createContext<Ctx | null>(null);

export function TabNavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<PlaygroundTab>("auth");
  const [claimPreset, setClaimPreset] = useState<ClaimPreset | null>(null);
  const [buyPreset, setBuyPreset] = useState<BuyPreset | null>(null);
  const [secondaryPreset, setSecondaryPreset] = useState<SecondaryPreset | null>(
    null,
  );
  const [disputePreset, setDisputePreset] = useState<DisputePreset | null>(null);
  const [tradePreset, setTradePreset] = useState<TradePreset | null>(null);

  const openClaim = useCallback((marketId: string) => {
    setClaimPreset({ marketId });
    setTab("claim");
  }, []);

  const openBuy = useCallback((marketId: string) => {
    setBuyPreset({ marketId });
    setTab("buy");
  }, []);

  const openSecondary = useCallback((marketId: string) => {
    setSecondaryPreset({ marketId, nonce: Date.now() });
    setTab("secondary");
  }, []);

  const openDispute = useCallback((marketId: string) => {
    setDisputePreset({ marketId, nonce: Date.now() });
    setTab("dispute");
  }, []);

  const openTrades = useCallback((preset: TradePreset) => {
    setTradePreset(preset);
    setTab("trades");
  }, []);

  const clearClaimPreset = useCallback(() => setClaimPreset(null), []);
  const clearBuyPreset = useCallback(() => setBuyPreset(null), []);
  const clearSecondaryPreset = useCallback(() => setSecondaryPreset(null), []);
  const clearDisputePreset = useCallback(() => setDisputePreset(null), []);
  const clearTradePreset = useCallback(() => setTradePreset(null), []);

  const value = useMemo(
    () => ({
      tab,
      setTab,
      claimPreset,
      buyPreset,
      secondaryPreset,
      disputePreset,
      tradePreset,
      openClaim,
      openBuy,
      openSecondary,
      openDispute,
      openTrades,
      clearClaimPreset,
      clearBuyPreset,
      clearSecondaryPreset,
      clearDisputePreset,
      clearTradePreset,
    }),
    [
      tab,
      claimPreset,
      buyPreset,
      secondaryPreset,
      disputePreset,
      tradePreset,
      openClaim,
      openBuy,
      openSecondary,
      openDispute,
      openTrades,
      clearClaimPreset,
      clearBuyPreset,
      clearSecondaryPreset,
      clearDisputePreset,
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
