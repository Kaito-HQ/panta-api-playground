export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Response from POST /auth/register/ and POST /auth/token/ */
export type AuthTokenResponse = {
  userId: string | null;
  email: string;
  name: string;
  access: string;
  refresh: string;
};

export type Account = {
  userId: string;
  email?: string;
  name: string;
  status: string;
  canCreateMarkets: boolean;
  createdAt?: string;
  apiKeyId?: string;
};

export type MetricsBucket = {
  total: number;
  byStatus?: Record<string, number>;
  volumeUsdcBase?: number;
  byKind?: Record<string, number>;
};

export type KeyCounts = {
  active: number;
  revoked: number;
  total: number;
};

export type AccountDashboard = {
  account: Account;
  keys: KeyCounts;
  metrics: {
    creates: MetricsBucket;
    trades: MetricsBucket;
  };
  permissions: { canCreateMarkets: boolean };
};

export type CreateMetricRow = {
  createId: string;
  userId?: string;
  apiKeyId?: string | null;
  wallet: string;
  eventPda: string;
  signature?: string | null;
  status: string;
  paymentUsdc: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TradeMetricRow = {
  signature: string;
  userId?: string;
  apiKeyId?: string | null;
  wallet: string;
  marketId: string;
  side: string;
  kind: string;
  amountUsdc: string;
  status: string;
  createdAt?: string | null;
};

export type AccountMetricsResponse = {
  summary: {
    creates: MetricsBucket;
    trades: MetricsBucket;
    keys: KeyCounts;
  };
  creates: CreateMetricRow[];
  trades: TradeMetricRow[];
};

export type PositionRow = {
  marketId: string;
  category?: string | null;
  side: string;
  shares: string;
  phase: string;
  claimable: boolean;
  claimed: boolean;
  outcome?: string | null;
};

export type PositionsResponse = {
  wallet: string;
  positions: PositionRow[];
};

export type ClaimBuildResponse = {
  wallet: string;
  marketId: string;
  outcome: string;
  winningShares: string;
  instructions: BuiltInstruction[];
  derived?: Record<string, string>;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
};

/** POST /claim/creator-fees/build/ — graduated market creator fees. */
export type CreatorFeesClaimBuildResponse = {
  wallet: string;
  marketId: string;
  claimableFeesUsdc: string;
  instructions: BuiltInstruction[];
  derived?: Record<string, string>;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
};

export type TradeReportResponse = {
  signature: string;
  status: string;
  marketId?: string;
  wallet?: string;
  side?: string;
  kind?: string;
};

export type TradeStatusResponse = {
  signature: string;
  status: string;
  marketId?: string;
  wallet?: string;
};

export type PlatformMetrics = {
  users: {
    total: number;
    active: number;
    suspended: number;
    admins: number;
  };
  keys: KeyCounts;
  creates: MetricsBucket;
  trades: MetricsBucket;
};

export type AdminUserDetail = {
  user: AdminUser & { email?: string };
  metrics: {
    creates: MetricsBucket;
    trades: MetricsBucket;
    keys: KeyCounts;
  };
  keys: ApiKeyRow[];
  creates: CreateMetricRow[];
  trades: TradeMetricRow[];
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
    creates?: MetricsBucket;
    trades?: MetricsBucket;
    keys?: KeyCounts;
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

/** Response from POST /markets/create/image-upload/ */
export type MarketImageUploadResponse = {
  uploadUrl: string;
  publicId: string;
  expiresAt: string;
  fields: Record<string, string | number | boolean>;
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

export type MarketCatalogItem = {
  marketId: string;
  category: string;
  title: string;
  description?: string;
  images?: string[];
  phase: string;
  marketType?: string;
  startTime?: number | null;
  endTime?: number | null;
  resolutionTime?: number | null;
  region?: string;
  resolved?: boolean;
  status?: string;
  volumeUsdc?: string;
  campaignId?: string | null;
  createdByPartner?: boolean;
  yesPrice?: string | null;
  noPrice?: string | null;
  primaryYesPrice?: string | null;
  primaryNoPrice?: string | null;
  secondaryYesPrice?: string | null;
  secondaryNoPrice?: string | null;
};

export type MarketsListResponse = {
  items: MarketCatalogItem[];
  nextCursor?: string | null;
};

export type CatalogTradeRow = {
  id?: string | number;
  marketId?: string;
  wallet?: string;
  isPrimary?: boolean;
  yesAmount?: string | number;
  noAmount?: string | number;
  feePaid?: string | number;
  blockTime?: number | null;
  signature?: string;
  quoteAsset?: string;
};

export type MarketTradesResponse = {
  marketId: string;
  items: CatalogTradeRow[];
};

export type WalletTradesResponse = {
  wallet: string;
  items: CatalogTradeRow[];
};

export type CategoriesResponse = {
  categories: string[];
};
