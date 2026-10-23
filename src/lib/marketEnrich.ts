import { pantaFetch } from "@/lib/api";
import type { MarketCatalogItem } from "@/lib/types";

const ENRICH_CHUNK = 4;

export function displayMarketTitle(
  m: Pick<MarketCatalogItem, "title" | "question"> | undefined,
): string {
  if (!m) return "";
  return (m.title || m.question || "").trim();
}

export function mergeListWithDetail(
  listItem: MarketCatalogItem,
  detail: MarketCatalogItem,
): MarketCatalogItem {
  const title = displayMarketTitle(detail) || displayMarketTitle(listItem);
  return {
    ...listItem,
    title,
    question: detail.question ?? listItem.question,
    description: detail.description || listItem.description,
    resolutionRule: detail.resolutionRule ?? listItem.resolutionRule,
    volumeUsdc:
      detail.volumeUsdc != null && detail.volumeUsdc !== ""
        ? detail.volumeUsdc
        : listItem.volumeUsdc,
    totalVolumeUsdc:
      detail.totalVolumeUsdc != null && detail.totalVolumeUsdc !== ""
        ? detail.totalVolumeUsdc
        : listItem.totalVolumeUsdc,
    yesPrice: detail.yesPrice ?? listItem.yesPrice,
    noPrice: detail.noPrice ?? listItem.noPrice,
    primaryYesPrice: detail.primaryYesPrice ?? listItem.primaryYesPrice,
    primaryNoPrice: detail.primaryNoPrice ?? listItem.primaryNoPrice,
  };
}

/** Playground-only: fill names/volume from GET /markets/{id}/. */
export async function fetchMarketDetails(
  apiKey: string,
  marketIds: string[],
  onChunk?: (rows: MarketCatalogItem[]) => boolean | void,
): Promise<MarketCatalogItem[]> {
  const unique = [...new Set(marketIds.filter(Boolean))];
  const out: MarketCatalogItem[] = [];
  for (let i = 0; i < unique.length; i += ENRICH_CHUNK) {
    const slice = unique.slice(i, i + ENRICH_CHUNK);
    const rows = await Promise.all(
      slice.map(async (id) => {
        try {
          const { data } = await pantaFetch<MarketCatalogItem>(
            `/markets/${encodeURIComponent(id)}/`,
            { apiKey },
          );
          return data;
        } catch {
          return null;
        }
      }),
    );
    const ok = rows.filter((row): row is MarketCatalogItem => Boolean(row));
    out.push(...ok);
    if (onChunk && onChunk(ok) === false) break;
  }
  return out;
}
