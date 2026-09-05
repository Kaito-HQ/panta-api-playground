export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type Account = {
  userId: string;
  name: string;
  status: string;
  canCreateMarkets: boolean;
  createdAt?: string;
  apiKeyId?: string;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  env: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
  secret?: string;
};

export type AdminUser = {
  userId: string;
  name: string;
  status: string;
  canCreateMarkets: boolean;
  isAdmin: boolean;
  createdAt?: string | null;
  metrics?: {
    creates?: { total: number };
    trades?: { total: number };
    keys?: { active: number; total: number };
  };
};

export type CreateQuoteResponse = {
  createId: string;
  expectedEventPda: string;
  paymentUsdc: string;
  liquidityInjectionUsdc?: string;
  platformRevenueUsdc?: string;
  marketType: string;
  expiresAt: string;
  blockhashExpiryHintSec?: number;
};

export type CreateBuildResponse = {
  createId: string;
  expectedEventPda: string;
  transaction: string;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
  buildFingerprint?: string;
  paymentUsdc: string;
  marketType: string;
  derived?: Record<string, string>;
  expiresAt?: string;
};

export type CreateRegisterResponse = {
  createId: string;
  marketId: string;
  status: string;
  signature: string;
  category?: string;
  title?: string;
  images?: string[];
};

export type PrimaryQuoteResponse = {
  quoteId: string;
  marketId: string;
  side: string;
  amountUsdc: string;
  shares: string;
  avgPrice: string;
  feeUsdc: string;
  expiresAt: string;
};

export type IxAccount = {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
};

export type BuiltInstruction = {
  programId: string;
  data: string;
  accounts: IxAccount[];
};

export type PrimaryBuildResponse = {
  orderId: string;
  quoteId: string;
  wallet: string;
  marketId: string;
  side: string;
  amountUsdc: string;
  expectedShares: string;
  feeUsdc: string;
  status: string;
  instructions: BuiltInstruction[];
  recentBlockhash: string;
  lastValidBlockHeight?: number;
  expiresAt?: string;
};
