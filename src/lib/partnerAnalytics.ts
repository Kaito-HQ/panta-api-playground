import { pantaFetch } from "@/lib/api";
import type {
  AdminUserDetail,
  CreateMetricRow,
  MarketCatalogItem,
  TradeMetricRow,
} from "@/lib/types";

/** Human USDC from either base units or already-decimal `amountUsdc`. */
export function tradeUsdcNumber(row: {
  amountUsdc?: string;
  amountUsdcBase?: string | number;
}): number {
  if (row.amountUsdcBase !== undefined && row.amountUsdcBase !== "") {
    const base = Number(row.amountUsdcBase);
    if (Number.isFinite(base)) return base / 1_000_000;
  }
  const human = Number(row.amountUsdc);
  return Number.isFinite(human) ? human : 0;
}

export function formatUsdcHuman(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} USDC`;
}

export type PartnerMarketRow = {
  marketId: string;
  title: string;
  createdByPartner: boolean;
  createStatus: string | null;
  createId: string | null;
  paymentUsdc: string | null;
  volumeUsdc: number;
  tradeCount: number;
  byKind: Record<string, number>;
};

export type PartnerAnalytics = {
  totalVolumeUsdc: number;
  totalTrades: number;
  totalCreates: number;
  registeredCreates: number;
  marketsCreated: number;
  marketsTraded: number;
  markets: PartnerMarketRow[];
  createsByStatus: Record<string, number>;
  tradesByKind: Record<string, number>;
  /** Detail endpoint caps recent rows (~50); totals from metrics may be higher. */
  rowCapHint: string | null;
};

export function buildPartnerAnalytics(detail: AdminUserDetail): PartnerAnalytics {
  const creates = detail.creates || [];
  const trades = detail.trades || [];
  const metrics = detail.metrics;

  const createsByStatus: Record<string, number> = {
    ...(metrics.creates.byStatus || {}),
  };
  if (!metrics.creates.byStatus) {
    for (const row of creates) {
      createsByStatus[row.status] = (createsByStatus[row.status] || 0) + 1;
    }
  }

  const tradesByKind: Record<string, number> = {
    ...(metrics.trades.byKind || {}),
  };
  if (!metrics.trades.byKind) {
    for (const row of trades) {
      tradesByKind[row.kind] = (tradesByKind[row.kind] || 0) + 1;
    }
  }

  const createByMarket = new Map<string, CreateMetricRow>();
  for (const row of creates) {
    if (!row.eventPda) continue;
    const prev = createByMarket.get(row.eventPda);
    if (!prev || (row.status === "registered" && prev.status !== "registered")) {
      createByMarket.set(row.eventPda, row);
    }
  }

  type Acc = {
    volumeUsdc: number;
    tradeCount: number;
    byKind: Record<string, number>;
  };
  const tradeByMarket = new Map<string, Acc>();
  for (const row of trades) {
    if (!row.marketId) continue;
    const acc = tradeByMarket.get(row.marketId) || {
      volumeUsdc: 0,
      tradeCount: 0,
      byKind: {},
    };
    acc.volumeUsdc += tradeUsdcNumber(row);
    acc.tradeCount += 1;
    acc.byKind[row.kind] = (acc.byKind[row.kind] || 0) + 1;
    tradeByMarket.set(row.marketId, acc);
  }

  const marketIds = new Set<string>([
    ...createByMarket.keys(),
    ...tradeByMarket.keys(),
  ]);

  const markets: PartnerMarketRow[] = [...marketIds].map((marketId) => {
    const create = createByMarket.get(marketId);
    const trade = tradeByMarket.get(marketId);
    return {
      marketId,
      title: "",
      createdByPartner: Boolean(create),
      createStatus: create?.status ?? null,
      createId: create?.createId ?? null,
      paymentUsdc: create?.paymentUsdc ?? null,
      volumeUsdc: trade?.volumeUsdc ?? 0,
      tradeCount: trade?.tradeCount ?? 0,
      byKind: trade?.byKind ?? {},
    };
  });

  markets.sort(
    (a, b) =>
      b.volumeUsdc - a.volumeUsdc ||
      Number(b.createdByPartner) - Number(a.createdByPartner) ||
      a.marketId.localeCompare(b.marketId),
  );

  const metricsVolumeBase = metrics.trades.volumeUsdcBase;
  const totalVolumeUsdc =
    metricsVolumeBase !== undefined && metricsVolumeBase !== null
      ? Number(metricsVolumeBase) / 1_000_000
      : trades.reduce((s, t) => s + tradeUsdcNumber(t), 0);

  const totalTrades = metrics.trades.total ?? trades.length;
  const totalCreates = metrics.creates.total ?? creates.length;
  const registeredCreates =
    createsByStatus.registered ??
    creates.filter((c) => c.status === "registered").length;

  const rowCapHint =
    (metrics.trades.total ?? 0) > trades.length ||
    (metrics.creates.total ?? 0) > creates.length
      ? `Showing ${creates.length} create rows and ${trades.length} trade rows from detail (API capped). Totals above use account metrics.`
      : null;

  return {
    totalVolumeUsdc,
    totalTrades,
    totalCreates,
    registeredCreates,
    marketsCreated: registeredCreates || createByMarket.size,
    marketsTraded: tradeByMarket.size,
    markets,
    createsByStatus,
    tradesByKind,
    rowCapHint,
  };
}

/** Resolve titles via existing GET /markets/{id}/ (playground-only enrichment). */
export async function resolveMarketTitles(
  apiKey: string,
  marketIds: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(marketIds.filter(Boolean))];
  const out: Record<string, string> = {};
  const chunk = 8;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    await Promise.all(
      slice.map(async (id) => {
        try {
          const { data } = await pantaFetch<MarketCatalogItem>(
            `/markets/${encodeURIComponent(id)}/`,
            { apiKey },
          );
          out[id] = (data.title || "").trim();
        } catch {
          out[id] = "";
        }
      }),
    );
  }
  return out;
}

export function shortId(id: string, n = 10): string {
  if (!id) return "—";
  return id.length <= n + 1 ? id : `${id.slice(0, n)}…`;
}

export type { TradeMetricRow, CreateMetricRow };
