import {
  inferSpecificProductCategory,
  isLegacyDefaultHomeLabel,
  translateCategoryNameToMyanmar,
} from './categoryTranslations.ts';
import { evaluateSearchOpportunityScore } from './searchScoreEngine.ts';
import type {
  CategoryKey,
  ProductItem,
  RankBoardCategoryMarketItem,
  RankBoardMarketSummary,
  RankBoardSnapshot,
  SearchDateRange,
} from '../types.ts';

export type RankBoardQuickFilter = 'all' | 'video_proven' | 'high_commission' | 'sweet_spot';
export type RankBoardChannelFilter = 'all' | 'video' | 'live' | 'shop';
export type RankBoardSortKey =
  | 'rank'
  | 'revenue'
  | 'sales'
  | 'commission'
  | 'payout'
  | 'videoShare'
  | 'score';

export interface LiveKalodataCategoryMarketRow {
  id: string;
  nameEn: string;
  nameMy: string;
  visualGroup: Exclude<CategoryKey, 'all'>;
  revenueThb: number | null;
  salesVolume: number | null;
  revenueSharePct: number | null;
}

export interface ComputedRankProductRow {
  rank: number;
  product: ProductItem;
  revenueThb: number;
  salesVolume: number;
  videoRevenueThb: number;
  liveRevenueThb: number;
  shopRevenueThb: number;
  videoSharePct: number;
  liveSharePct: number;
  shopSharePct: number;
  dominantChannel: 'video' | 'live' | 'shop' | 'unknown';
  priceThb: number | null;
  commissionRate: number | null;
  payoutThb: number | null;
  searchScore: number | null;
  categoryKey: string;
  categoryNameEn: string;
  categoryNameMy: string;
  isMonetizable: boolean;
  isVideoProven: boolean;
  isSweetSpot: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeNonNeg(val: number | null | undefined): number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0;
}

function inferVisualGroupFromName(name: string): Exclude<CategoryKey, 'all'> {
  const low = name.toLowerCase();
  if (low.includes('beaut') || low.includes('skin') || low.includes('cosmet') || low.includes('personal care')) {
    return 'beauty';
  }
  if (low.includes('phone') || low.includes('elec') || low.includes('computer') || low.includes('auto') || low.includes('appli')) {
    return 'gadget';
  }
  if (low.includes('wear') || low.includes('fash') || low.includes('shoe') || low.includes('bag') || low.includes('jewel')) {
    return 'fashion';
  }
  if (low.includes('pet')) {
    return 'pet';
  }
  if (low.includes('health') || low.includes('sport') || low.includes('food') || low.includes('mom') || low.includes('baby')) {
    return 'wellness';
  }
  return 'home';
}

export function computeRankProductRow(
  product: ProductItem,
  rankIndex: number
): ComputedRankProductRow {
  const km = product.kalodataMetrics;
  const vm = product.validatedMetrics;
  const revenueThb = safeNonNeg(
    km?.revenueThb7d ?? (vm?.revenueThb7d?.unit === 'THB' ? vm.revenueThb7d.value : null)
  );
  const salesVolume = safeNonNeg(
    km?.salesVolume7d ?? (vm?.salesVolume7d?.unit === 'COUNT' ? vm.salesVolume7d.value : null)
  );
  const videoRevenueThb = safeNonNeg(
    km?.videoRevenueThb7d ??
      (vm?.videoRevenueThb7d?.unit === 'THB' ? vm.videoRevenueThb7d.value : null)
  );
  const liveRevenueThb = safeNonNeg(
    km?.liveRevenueThb7d ??
      (vm?.liveRevenueThb7d?.unit === 'THB' ? vm.liveRevenueThb7d.value : null)
  );
  const shopRevenueThb = safeNonNeg(
    km?.shoppingMallRevenueThb7d ??
      (vm?.shoppingMallRevenueThb7d?.unit === 'THB'
        ? vm.shoppingMallRevenueThb7d.value
        : null)
  );

  const channelSum = videoRevenueThb + liveRevenueThb + shopRevenueThb;
  const denom = Math.max(revenueThb, channelSum);

  let videoSharePct = 0;
  let liveSharePct = 0;
  let shopSharePct = 0;

  if (denom > 0 && channelSum > 0) {
    videoSharePct = round1(Math.min(100, (videoRevenueThb / denom) * 100));
    liveSharePct = round1(Math.min(100, (liveRevenueThb / denom) * 100));
    if (shopRevenueThb > 0) {
      shopSharePct = round1(Math.min(100, (shopRevenueThb / denom) * 100));
    } else {
      const residual = Math.max(0, 100 - videoSharePct - liveSharePct);
      shopSharePct = residual >= 0.5 ? round1(residual) : 0;
    }
  } else if (revenueThb > 0 && videoRevenueThb > 0) {
    videoSharePct = round1(Math.min(100, (videoRevenueThb / revenueThb) * 100));
    shopSharePct = round1(Math.max(0, 100 - videoSharePct));
  }

  let dominantChannel: 'video' | 'live' | 'shop' | 'unknown' = 'unknown';
  if (videoSharePct > 0 || liveSharePct > 0 || shopSharePct > 0) {
    if (videoSharePct >= liveSharePct && videoSharePct >= shopSharePct) {
      dominantChannel = 'video';
    } else if (liveSharePct >= videoSharePct && liveSharePct >= shopSharePct) {
      dominantChannel = 'live';
    } else {
      dominantChannel = 'shop';
    }
  }

  const priceThb =
    typeof product.priceThb === 'number' && Number.isFinite(product.priceThb) && product.priceThb > 0
      ? round2(product.priceThb)
      : null;

  const rawComm = product.commissionRate;
  const commissionRate =
    typeof rawComm === 'number' && Number.isFinite(rawComm) && rawComm >= 0
      ? round2(rawComm)
      : null;

  const payoutThb =
    priceThb !== null && commissionRate !== null && commissionRate > 0
      ? round2((priceThb * commissionRate) / 100)
      : null;

  const searchEval = evaluateSearchOpportunityScore(product);
  const searchScore =
    searchEval.status === 'SCORED' && typeof searchEval.score === 'number'
      ? Math.round(searchEval.score)
      : null;

  const hasRealCategoryLabel = !isLegacyDefaultHomeLabel(product.categoryLabel);
  const specificCat = inferSpecificProductCategory({
    categoryId: product.kalodataCategoryId,
    categoryHint: hasRealCategoryLabel ? product.categoryLabel?.en : undefined,
    thaiTitle: product.thaiTitle,
    englishTitle: product.clearTitle?.en,
    shopName: product.shopName,
  });

  const categoryNameEn =
    (specificCat.matched ? specificCat.label.en : '') ||
    product.categoryLabel?.en ||
    specificCat.label.en ||
    product.category;
  const categoryNameMy =
    (specificCat.matched ? specificCat.label.my : '') ||
    product.categoryLabel?.my ||
    translateCategoryNameToMyanmar(categoryNameEn, product.kalodataCategoryId);
  const categoryKey =
    product.kalodataCategoryId?.trim() ||
    categoryNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const isMonetizable = commissionRate !== null && commissionRate > 0;
  const isVideoProven = videoSharePct >= 30 || videoRevenueThb >= 10000;
  const isSweetSpot =
    priceThb !== null &&
    priceThb >= 100 &&
    priceThb <= 600 &&
    commissionRate !== null &&
    commissionRate >= 10;

  return {
    rank: rankIndex + 1,
    product,
    revenueThb,
    salesVolume,
    videoRevenueThb,
    liveRevenueThb,
    shopRevenueThb,
    videoSharePct,
    liveSharePct,
    shopSharePct,
    dominantChannel,
    priceThb,
    commissionRate,
    payoutThb,
    searchScore,
    categoryKey,
    categoryNameEn,
    categoryNameMy,
    isMonetizable,
    isVideoProven,
    isSweetSpot,
  };
}

export function buildRankBoardMarketSummary(products: ProductItem[]): RankBoardMarketSummary {
  const rows = products.map((product, index) => computeRankProductRow(product, index));

  let totalRevenueThb = 0;
  let totalSalesVolume = 0;
  let videoRevenueThb = 0;
  let liveRevenueThb = 0;
  let shopRevenueThb = 0;

  let commSum = 0;
  let commCount = 0;
  let payoutSum = 0;
  let payoutCount = 0;

  let monetizableCount = 0;
  let videoProvenCount = 0;
  let sweetSpotCount = 0;

  for (const row of rows) {
    totalRevenueThb += row.revenueThb;
    totalSalesVolume += row.salesVolume;
    videoRevenueThb += row.videoRevenueThb;
    liveRevenueThb += row.liveRevenueThb;
    // If shop revenue wasn't explicitly populated on a row with positive total revenue, attribute remaining residual honestly
    const explicitChannelTotal = row.videoRevenueThb + row.liveRevenueThb + row.shopRevenueThb;
    if (row.shopRevenueThb > 0) {
      shopRevenueThb += row.shopRevenueThb;
    } else if (row.revenueThb > explicitChannelTotal && (row.videoRevenueThb > 0 || row.liveRevenueThb > 0)) {
      shopRevenueThb += row.revenueThb - explicitChannelTotal;
    }

    if (row.isMonetizable && row.commissionRate !== null) {
      monetizableCount += 1;
      commSum += row.commissionRate;
      commCount += 1;
    }
    if (row.payoutThb !== null && row.payoutThb > 0) {
      payoutSum += row.payoutThb;
      payoutCount += 1;
    }
    if (row.isVideoProven) videoProvenCount += 1;
    if (row.isSweetSpot) sweetSpotCount += 1;
  }

  const channelTotal = videoRevenueThb + liveRevenueThb + shopRevenueThb;
  const videoSharePct = channelTotal > 0 ? round1((videoRevenueThb / channelTotal) * 100) : 0;
  const liveSharePct = channelTotal > 0 ? round1((liveRevenueThb / channelTotal) * 100) : 0;
  const shopSharePct =
    channelTotal > 0 ? round1(Math.max(0, 100 - videoSharePct - liveSharePct)) : 0;

  return {
    totalRevenueThb: Math.round(totalRevenueThb),
    totalSalesVolume: Math.round(totalSalesVolume),
    videoRevenueThb: Math.round(videoRevenueThb),
    liveRevenueThb: Math.round(liveRevenueThb),
    shopRevenueThb: Math.round(shopRevenueThb),
    videoSharePct,
    liveSharePct,
    shopSharePct,
    avgCommissionRate: commCount > 0 ? round1(commSum / commCount) : null,
    avgPayoutThb: payoutCount > 0 ? Math.round(payoutSum / payoutCount) : null,
    monetizableCount,
    videoProvenCount,
    sweetSpotCount,
  };
}

export function buildRankBoardCategoryMarket(
  products: ProductItem[],
  liveCategoryRows: LiveKalodataCategoryMarketRow[]
): {
  items: RankBoardCategoryMarketItem[];
  source: 'kalodata_category_rank' | 'top100_aggregate';
} {
  const computedRows = products.map((product, index) => computeRankProductRow(product, index));

  // Count how many Top-100 products match each category ID or name
  const countByCatId = new Map<string, number>();
  const countByNameLower = new Map<string, number>();
  const revByNameLower = new Map<string, { rev: number; sales: number; nameEn: string; nameMy: string; visualGroup: Exclude<CategoryKey, 'all'>; id: string }>();

  for (const row of computedRows) {
    if (row.product.kalodataCategoryId) {
      const cid = row.product.kalodataCategoryId.trim();
      countByCatId.set(cid, (countByCatId.get(cid) ?? 0) + 1);
    }
    const keyLower = row.categoryNameEn.toLowerCase();
    countByNameLower.set(keyLower, (countByNameLower.get(keyLower) ?? 0) + 1);

    const existing = revByNameLower.get(keyLower);
    if (existing) {
      existing.rev += row.revenueThb;
      existing.sales += row.salesVolume;
    } else {
      revByNameLower.set(keyLower, {
        id: row.categoryKey,
        nameEn: row.categoryNameEn,
        nameMy: row.categoryNameMy,
        visualGroup: row.product.category,
        rev: row.revenueThb,
        sales: row.salesVolume,
      });
    }
  }

  // Prefer live Kalodata /tiktok/category/rank market data whenever it returned positive revenue or share
  const validLiveRows = liveCategoryRows.filter(
    (c) => (c.revenueThb !== null && c.revenueThb > 0) || (c.revenueSharePct !== null && c.revenueSharePct > 0)
  );

  if (validLiveRows.length > 0) {
    const liveTotalRev = validLiveRows.reduce((acc, item) => acc + safeNonNeg(item.revenueThb), 0);
    const liveTotalShare = validLiveRows.reduce((acc, item) => acc + safeNonNeg(item.revenueSharePct), 0);

    const items: RankBoardCategoryMarketItem[] = validLiveRows
      .map((cat) => {
        const sharePct =
          cat.revenueThb !== null && liveTotalRev > 0
            ? round1((cat.revenueThb / liveTotalRev) * 100)
            : cat.revenueSharePct !== null && liveTotalShare > 0
              ? round1((cat.revenueSharePct / liveTotalShare) * 100)
              : 0;
        const countMatch =
          countByCatId.get(cat.id) ??
          countByNameLower.get(cat.nameEn.toLowerCase()) ??
          0;
        return {
          id: cat.id,
          label: { my: cat.nameMy, en: cat.nameEn },
          visualGroup: cat.visualGroup,
          revenueThb: cat.revenueThb !== null ? Math.round(cat.revenueThb) : null,
          salesVolume: cat.salesVolume !== null ? Math.round(cat.salesVolume) : null,
          productCountInTop100: countMatch,
          marketSharePct: sharePct,
          source: 'kalodata_category_rank' as const,
        };
      })
      .sort((a, b) => (b.revenueThb ?? b.marketSharePct) - (a.revenueThb ?? a.marketSharePct))
      .slice(0, 14);

    return { items, source: 'kalodata_category_rank' };
  }

  // Honest fallback: aggregate Top 100 products by category when /category/rank revenue is unavailable
  const aggregated = Array.from(revByNameLower.values()).sort((a, b) => b.rev - a.rev);
  const aggTotalRev = aggregated.reduce((acc, item) => acc + item.rev, 0);

  const items: RankBoardCategoryMarketItem[] = aggregated.slice(0, 12).map((item) => ({
    id: item.id,
    label: { my: item.nameMy, en: item.nameEn },
    visualGroup: item.visualGroup || inferVisualGroupFromName(item.nameEn),
    revenueThb: Math.round(item.rev),
    salesVolume: Math.round(item.sales),
    productCountInTop100: countByNameLower.get(item.nameEn.toLowerCase()) ?? 0,
    marketSharePct: aggTotalRev > 0 ? round1((item.rev / aggTotalRev) * 100) : 0,
    source: 'top100_aggregate' as const,
  }));

  return { items, source: 'top100_aggregate' };
}

export function buildRankBoardSnapshot(params: {
  products: ProductItem[];
  liveCategories: LiveKalodataCategoryMarketRow[];
  dateRange: SearchDateRange;
  syncedAt: string;
  creditsUsed: number | null;
}): RankBoardSnapshot {
  const marketSummary = buildRankBoardMarketSummary(params.products);
  const { items: categoryMarket, source: categorySource } = buildRankBoardCategoryMarket(
    params.products,
    params.liveCategories
  );

  return {
    syncedAt: params.syncedAt,
    dateRange: params.dateRange,
    products: params.products,
    categoryMarket,
    marketSummary,
    creditsUsed: params.creditsUsed,
    categorySource,
  };
}

export function doesRankProductMatchCategory(
  row: ComputedRankProductRow,
  categoryItem: RankBoardCategoryMarketItem
): boolean {
  const prodCatId = row.product.kalodataCategoryId?.trim();
  if (prodCatId && categoryItem.id && prodCatId === categoryItem.id) {
    return true;
  }
  const targetEn = categoryItem.label.en.toLowerCase();
  const prodEn = row.categoryNameEn.toLowerCase();
  if (prodEn === targetEn || prodEn.includes(targetEn) || targetEn.includes(prodEn)) {
    return true;
  }
  if (row.categoryKey === categoryItem.id) {
    return true;
  }
  // Visual group fallback only when no direct ID/name match exists and visualGroup aligns
  if (
    categoryItem.source === 'kalodata_category_rank' &&
    !prodCatId &&
    row.product.category === categoryItem.visualGroup
  ) {
    return true;
  }
  return false;
}

export function filterAndSortRankBoardRows(
  rows: ComputedRankProductRow[],
  options: {
    selectedCategory: RankBoardCategoryMarketItem | null;
    quickFilter: RankBoardQuickFilter;
    channelFilter: RankBoardChannelFilter;
    searchQuery: string;
    sortBy: RankBoardSortKey;
  }
): ComputedRankProductRow[] {
  const q = options.searchQuery.trim().toLowerCase();

  const filtered = rows.filter((row) => {
    if (options.selectedCategory && !doesRankProductMatchCategory(row, options.selectedCategory)) {
      return false;
    }

    if (options.quickFilter === 'video_proven' && !row.isVideoProven) {
      return false;
    }
    if (
      options.quickFilter === 'high_commission' &&
      (row.commissionRate === null || row.commissionRate < 10)
    ) {
      return false;
    }
    if (options.quickFilter === 'sweet_spot' && !row.isSweetSpot) {
      return false;
    }

    if (options.channelFilter !== 'all' && row.dominantChannel !== options.channelFilter) {
      return false;
    }

    if (q) {
      const haystack = [
        row.product.thaiTitle,
        row.product.clearTitle?.en,
        row.product.clearTitle?.my,
        row.product.shopName,
        row.categoryNameEn,
        row.categoryNameMy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'rank':
        return a.rank - b.rank;
      case 'revenue':
        return b.revenueThb - a.revenueThb || a.rank - b.rank;
      case 'sales':
        return b.salesVolume - a.salesVolume || a.rank - b.rank;
      case 'commission':
        return (b.commissionRate ?? -1) - (a.commissionRate ?? -1) || b.revenueThb - a.revenueThb;
      case 'payout':
        return (b.payoutThb ?? -1) - (a.payoutThb ?? -1) || b.revenueThb - a.revenueThb;
      case 'videoShare':
        return b.videoSharePct - a.videoSharePct || b.videoRevenueThb - a.videoRevenueThb;
      case 'score':
        return (b.searchScore ?? -1) - (a.searchScore ?? -1) || b.revenueThb - a.revenueThb;
      default:
        return a.rank - b.rank;
    }
  });

  return sorted;
}
