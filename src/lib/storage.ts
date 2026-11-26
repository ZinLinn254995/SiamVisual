import type {
  BackupPayload,
  KalodataCategoryItem,
  KalodataLimitSettings,
  Language,
  ProductAiAnalysis,
  ProductDeepInsights,
  ProductItem,
  ProductKalodataMetrics,
  ProductObservationSnapshot,
  ProductValidatedMetrics,
  RankBoardSnapshot,
  RecentSearchEntry,
  ResultGridCols,
  ResultListZoom,
  ResultViewMode,
  SavedDeepInsightRecord,
  SavedHistoryEntry,
  Theme,
} from '../types';
import {
  inferSpecificProductCategory,
  isLegacyDefaultHomeLabel,
  localizeCategories,
} from './categoryTranslations';
import {
  adaptProductItemToValidatedMetrics,
  computeSyntheticCommissionThb,
  refreshProductValidatedMetricsFreshness,
} from './metricFoundation';
import { evaluateProductCommercialV2 } from './scoringEngineV2';
import {
  loadProductSnapshotsFromStorage,
  sanitizeImportedProductSnapshotsMap,
} from './snapshotStore';
import { evaluateProductStrategiesV2 } from './strategyEngineV2';

const HISTORY_KEY = 'siamvisual_history_v1';
const RECENT_SEARCHES_KEY = 'siamvisual_recent_searches_v1';
const DEEP_INSIGHTS_KEY = 'siamvisual_deep_insights_v1';
const AI_EXPLANATIONS_KEY = 'siamvisual_ai_explanations_v1';
const PRODUCT_ANALYSIS_KEY = 'siamvisual_product_analysis_v1';
const THEME_KEY = 'siamvisual_theme_v1';
const LANG_KEY = 'siamvisual_lang_v1';
const KALO_LIMITS_KEY = 'siamvisual_kalo_limits_v1';
const KALO_CATEGORIES_KEY = 'siamvisual_kalo_categories_v1';
const RESULT_VIEW_KEY = 'siamvisual_result_view_v1';
const RESULT_GRID_COLS_KEY = 'siamvisual_result_grid_cols_v1';
const RESULT_LIST_ZOOM_KEY = 'siamvisual_result_list_zoom_v1';
const RANK_BOARD_SNAPSHOT_KEY = 'siamvisual_rank_board_snapshot_v1';
const PINCH_HINT_SEEN_KEY = 'siamvisual_pinch_hint_seen_v1';

const MAX_RECENT_SEARCHES = 30;

const CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_OFFICIAL_CATEGORIES: KalodataCategoryItem[] = [
  {
    id: '',
    label: { my: 'အားလုံး', en: 'All' },
    visualGroup: 'beauty',
    source: 'official',
  },
  {
    id: '601450',
    label: { my: 'အလှကုန်နှင့် အသားအရေ', en: 'Beauty & Personal Care' },
    visualGroup: 'beauty',
    source: 'official',
  },
  {
    id: '600001',
    label: { my: 'အိမ်သုံးပစ္စည်း', en: 'Home Supplies' },
    visualGroup: 'home',
    source: 'official',
  },
  {
    id: '600024',
    label: { my: 'မီးဖိုချောင်သုံး', en: 'Kitchenware' },
    visualGroup: 'home',
    source: 'official',
  },
  {
    id: '601739',
    label: { my: 'ဖုန်းနှင့် စမတ်ပစ္စည်း', en: 'Phones & Electronics' },
    visualGroup: 'gadget',
    source: 'official',
  },
  {
    id: '601152',
    label: { my: 'အမျိုးသမီးဖက်ရှင်', en: 'Womenswear & Fashion' },
    visualGroup: 'fashion',
    source: 'official',
  },
  {
    id: '700645',
    label: { my: 'ကျန်းမာရေး', en: 'Health' },
    visualGroup: 'wellness',
    source: 'official',
  },
  {
    id: '602118',
    label: { my: 'အိမ်မွေးတိရစ္ဆာန်သုံး', en: 'Pet Supplies' },
    visualGroup: 'pet',
    source: 'official',
  },
  {
    id: '605196',
    label: { my: 'ကားနှင့် ဆိုင်ကယ်သုံး', en: 'Automotive & Moto' },
    visualGroup: 'gadget',
    source: 'official',
  },
];

const DEFAULT_KALODATA_LIMITS: KalodataLimitSettings = {
  maxSpendCredits: null,
  minBalanceReserve: null,
  trackedSpentCredits: 0,
};

export function loadCachedCategories(): KalodataCategoryItem[] {
  try {
    const raw = localStorage.getItem(KALO_CATEGORIES_KEY);
    if (!raw) return DEFAULT_OFFICIAL_CATEGORIES;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      items?: KalodataCategoryItem[];
    };
    if (
      parsed &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt < CATEGORY_CACHE_TTL_MS &&
      Array.isArray(parsed.items) &&
      parsed.items.length > 1
    ) {
      return localizeCategories(parsed.items);
    }
  } catch {
    // fallback to official defaults
  }
  return DEFAULT_OFFICIAL_CATEGORIES;
}

export function saveCachedCategories(items: KalodataCategoryItem[]): void {
  try {
    const localized = localizeCategories(items);
    localStorage.setItem(
      KALO_CATEGORIES_KEY,
      JSON.stringify({ savedAt: Date.now(), items: localized })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function loadKalodataLimits(): KalodataLimitSettings {
  try {
    const raw = localStorage.getItem(KALO_LIMITS_KEY);
    if (!raw) return { ...DEFAULT_KALODATA_LIMITS };
    const parsed = JSON.parse(raw) as Partial<KalodataLimitSettings>;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_KALODATA_LIMITS };
    }
    const maxSpendCredits =
      typeof parsed.maxSpendCredits === 'number' &&
      Number.isFinite(parsed.maxSpendCredits) &&
      parsed.maxSpendCredits > 0
        ? Math.round(parsed.maxSpendCredits * 100) / 100
        : null;
    const minBalanceReserve =
      typeof parsed.minBalanceReserve === 'number' &&
      Number.isFinite(parsed.minBalanceReserve) &&
      parsed.minBalanceReserve >= 0
        ? Math.round(parsed.minBalanceReserve * 100) / 100
        : null;
    const trackedSpentCredits =
      typeof parsed.trackedSpentCredits === 'number' &&
      Number.isFinite(parsed.trackedSpentCredits) &&
      parsed.trackedSpentCredits >= 0
        ? Math.round(parsed.trackedSpentCredits * 100) / 100
        : 0;
    return {
      maxSpendCredits,
      minBalanceReserve,
      trackedSpentCredits,
    };
  } catch {
    return { ...DEFAULT_KALODATA_LIMITS };
  }
}

export function saveKalodataLimits(settings: KalodataLimitSettings): void {
  try {
    localStorage.setItem(KALO_LIMITS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function loadSavedHistory(): SavedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHistoryEntry);
  } catch {
    return [];
  }
}

export function persistSavedHistory(entries: SavedHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function upsertHistoryEntry(
  current: SavedHistoryEntry[],
  newEntry: SavedHistoryEntry
): SavedHistoryEntry[] {
  const filtered = current.filter((item) => {
    if (item.product.id !== newEntry.product.id) return true;
    if (newEntry.plan) {
      // Replace same-style plan OR upgrade any plan-less bookmark for this product
      if (!item.plan) return false;
      return item.plan.style !== newEntry.plan.style;
    }
    // Plan-less bookmark replaces existing plan-less bookmark for the same product
    return Boolean(item.plan);
  });
  const next = [newEntry, ...filtered].slice(0, 120);
  persistSavedHistory(next);
  return next;
}

export function toggleSavedProduct(
  current: SavedHistoryEntry[],
  product: ProductItem
): { next: SavedHistoryEntry[]; saved: boolean } {
  const alreadySaved = current.some((item) => item.product.id === product.id);
  if (alreadySaved) {
    const next = current.filter((item) => item.product.id !== product.id);
    persistSavedHistory(next);
    return { next, saved: false };
  }
  const bookmarkEntry: SavedHistoryEntry = {
    id: `prod_${product.id}`,
    savedAt: new Date().toISOString(),
    product,
  };
  const next = [bookmarkEntry, ...current].slice(0, 120);
  persistSavedHistory(next);
  return { next, saved: true };
}

export function syncProductInSavedHistory(
  current: SavedHistoryEntry[],
  updatedProduct: ProductItem
): SavedHistoryEntry[] {
  if (!current.some((item) => item.product.id === updatedProduct.id)) {
    return current;
  }
  const next = current.map((item) =>
    item.product.id === updatedProduct.id ? { ...item, product: updatedProduct } : item
  );
  persistSavedHistory(next);
  return next;
}

export function removeHistoryEntry(
  current: SavedHistoryEntry[],
  entryId: string
): SavedHistoryEntry[] {
  const next = current.filter((item) => item.id !== entryId);
  persistSavedHistory(next);
  return next;
}

function isValidRecentSearchEntry(value: unknown): value is RecentSearchEntry {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.searchedAt === 'string' &&
    typeof obj.query === 'string' &&
    Array.isArray(obj.cateIds) &&
    Array.isArray(obj.products)
  );
}

export function loadRecentSearches(): RecentSearchEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecentSearchEntry).slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function persistRecentSearches(entries: RecentSearchEntry[]): void {
  const trimmed = entries.slice(0, MAX_RECENT_SEARCHES);
  // Quota-safe persistence: if storage is tight, prune oldest entries automatically
  for (let count = trimmed.length; count >= 1; count -= 1) {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed.slice(0, count)));
      return;
    } catch {
      // Retry with fewer entries
    }
  }
  if (trimmed.length === 0) {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export function upsertRecentSearch(
  current: RecentSearchEntry[],
  nextEntry: RecentSearchEntry
): RecentSearchEntry[] {
  const filtered = current.filter((item) => item.id !== nextEntry.id);
  const next = [nextEntry, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  persistRecentSearches(next);
  return next;
}

export function removeRecentSearch(
  current: RecentSearchEntry[],
  searchId: string
): RecentSearchEntry[] {
  const next = current.filter((item) => item.id !== searchId);
  persistRecentSearches(next);
  return next;
}

export function clearAllRecentSearches(): RecentSearchEntry[] {
  persistRecentSearches([]);
  return [];
}

// Permanent Browser Storage for Kalodata Deep Data (keyed by product.id)
export function loadDeepInsightsCache(): Record<string, SavedDeepInsightRecord> {
  try {
    const raw = localStorage.getItem(DEEP_INSIGHTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, SavedDeepInsightRecord>;
  } catch {
    return {};
  }
}

export function persistDeepInsightsCache(
  cache: Record<string, SavedDeepInsightRecord>
): void {
  try {
    localStorage.setItem(DEEP_INSIGHTS_KEY, JSON.stringify(cache));
  } catch {
    // Prune oldest records if storage quota is tight
    const sorted = Object.entries(cache)
      .sort((a, b) => new Date(b[1].savedAt).getTime() - new Date(a[1].savedAt).getTime())
      .slice(0, 60);
    try {
      localStorage.setItem(DEEP_INSIGHTS_KEY, JSON.stringify(Object.fromEntries(sorted)));
    } catch {
      // Ignore gracefully
    }
  }
}

function parseTimestampMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

const COHERENT_SNAPSHOT_MERGE_WINDOW_MS = 6 * 3_600_000;

function isMetricAbsentForComplementaryMerge(
  metric: ProductValidatedMetrics['revenueGrowthRate'] | undefined
): boolean {
  if (!metric) return true;
  if (metric.state === 'MISSING') return true;
  if (
    metric.state === 'UNAVAILABLE' &&
    (metric.rawInput === null || metric.rawInput === undefined || metric.rawInput === '')
  ) {
    return true;
  }
  return false;
}

function canComplementAcrossSnapshots(
  aFetchedAt: string | null | undefined,
  bFetchedAt: string | null | undefined,
  aDateRange: string | null | undefined,
  bDateRange: string | null | undefined
): boolean {
  const aMs = parseTimestampMs(aFetchedAt);
  const bMs = parseTimestampMs(bFetchedAt);
  if (aMs === null || bMs === null) return false;
  if (Math.abs(aMs - bMs) > COHERENT_SNAPSHOT_MERGE_WINDOW_MS) return false;
  const normA = (aDateRange || 'last7Day').trim();
  const normB = (bDateRange || 'last7Day').trim();
  return normA === normB;
}

type NumericKalodataMetricKey =
  | 'salesVolume7d'
  | 'revenueThb7d'
  | 'videoRevenueThb7d'
  | 'liveRevenueThb7d'
  | 'shoppingMallRevenueThb7d'
  | 'revenueGrowthRate'
  | 'creatorCount'
  | 'rating'
  | 'reviewCount';

function pickKalodataFieldWithTimestamp(
  fieldKey: NumericKalodataMetricKey,
  newer: ProductKalodataMetrics,
  older: ProductKalodataMetrics
): { value: number | null; fetchedAt: string | null } {
  const newerVal = newer[fieldKey];
  if (newerVal !== undefined && newerVal !== null) {
    const ts =
      newer.metricTimestamps?.[fieldKey] !== undefined
        ? newer.metricTimestamps[fieldKey] ?? null
        : newer.fetchedAt ?? null;
    return { value: newerVal, fetchedAt: ts };
  }
  const olderVal = older[fieldKey];
  if (olderVal !== undefined && olderVal !== null) {
    const ts =
      older.metricTimestamps?.[fieldKey] !== undefined
        ? older.metricTimestamps[fieldKey] ?? null
        : older.fetchedAt ?? null;
    return { value: olderVal, fetchedAt: ts };
  }
  return { value: null, fetchedAt: null };
}

function buildMergedKalodataObject(
  newer: ProductKalodataMetrics,
  older: ProductKalodataMetrics
): ProductKalodataMetrics {
  const salesVolume7d = pickKalodataFieldWithTimestamp('salesVolume7d', newer, older);
  const revenueThb7d = pickKalodataFieldWithTimestamp('revenueThb7d', newer, older);
  const videoRevenueThb7d = pickKalodataFieldWithTimestamp('videoRevenueThb7d', newer, older);
  const liveRevenueThb7d = pickKalodataFieldWithTimestamp('liveRevenueThb7d', newer, older);
  const shoppingMallRevenueThb7d = pickKalodataFieldWithTimestamp(
    'shoppingMallRevenueThb7d',
    newer,
    older
  );
  const revenueGrowthRate = pickKalodataFieldWithTimestamp('revenueGrowthRate', newer, older);
  const creatorCount = pickKalodataFieldWithTimestamp('creatorCount', newer, older);
  const rating = pickKalodataFieldWithTimestamp('rating', newer, older);
  const reviewCount = pickKalodataFieldWithTimestamp('reviewCount', newer, older);

  const metricTimestamps: Partial<Record<string, string | null>> = {
    ...(salesVolume7d.value !== null ? { salesVolume7d: salesVolume7d.fetchedAt } : {}),
    ...(revenueThb7d.value !== null ? { revenueThb7d: revenueThb7d.fetchedAt } : {}),
    ...(videoRevenueThb7d.value !== null ? { videoRevenueThb7d: videoRevenueThb7d.fetchedAt } : {}),
    ...(liveRevenueThb7d.value !== null ? { liveRevenueThb7d: liveRevenueThb7d.fetchedAt } : {}),
    ...(shoppingMallRevenueThb7d.value !== null
      ? { shoppingMallRevenueThb7d: shoppingMallRevenueThb7d.fetchedAt }
      : {}),
    ...(revenueGrowthRate.value !== null ? { revenueGrowthRate: revenueGrowthRate.fetchedAt } : {}),
    ...(creatorCount.value !== null ? { creatorCount: creatorCount.fetchedAt } : {}),
    ...(rating.value !== null ? { rating: rating.fetchedAt } : {}),
    ...(reviewCount.value !== null ? { reviewCount: reviewCount.fetchedAt } : {}),
  };

  const revenueTrendThb =
    Array.isArray(newer.revenueTrendThb) && newer.revenueTrendThb.length > 0
      ? newer.revenueTrendThb
      : Array.isArray(older.revenueTrendThb) && older.revenueTrendThb.length > 0
        ? older.revenueTrendThb
        : undefined;
  const videoCount =
    typeof newer.videoCount === 'number'
      ? newer.videoCount
      : typeof older.videoCount === 'number'
        ? older.videoCount
        : undefined;
  const liveCount =
    typeof newer.liveCount === 'number'
      ? newer.liveCount
      : typeof older.liveCount === 'number'
        ? older.liveCount
        : undefined;
  const launchDate = newer.launchDate || older.launchDate || undefined;
  const deliveryType = newer.deliveryType || older.deliveryType || undefined;

  return {
    salesVolume7d: salesVolume7d.value,
    revenueThb7d: revenueThb7d.value,
    videoRevenueThb7d: videoRevenueThb7d.value,
    liveRevenueThb7d: liveRevenueThb7d.value,
    shoppingMallRevenueThb7d: shoppingMallRevenueThb7d.value,
    revenueGrowthRate: revenueGrowthRate.value,
    creatorCount: creatorCount.value,
    rating: rating.value,
    reviewCount: reviewCount.value,
    ...(revenueTrendThb ? { revenueTrendThb } : {}),
    ...(videoCount !== undefined ? { videoCount } : {}),
    ...(liveCount !== undefined ? { liveCount } : {}),
    ...(launchDate ? { launchDate } : {}),
    ...(deliveryType ? { deliveryType } : {}),
    dateRange: newer.dateRange || older.dateRange || 'last7Day',
    fetchedAt: newer.fetchedAt || older.fetchedAt,
    ...(Object.keys(metricTimestamps).length > 0 ? { metricTimestamps } : {}),
  };
}

export function mergeKalodataMetrics(
  primary?: ProductKalodataMetrics,
  fallback?: ProductKalodataMetrics
): ProductKalodataMetrics | undefined {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  // Prefer a coherent snapshot when timestamps differ beyond the 6h coherent window or across periods
  const primaryMs = parseTimestampMs(primary.fetchedAt);
  const fallbackMs = parseTimestampMs(fallback.fetchedAt);
  if (primaryMs !== null && fallbackMs !== null && primaryMs !== fallbackMs) {
    const newer = primaryMs >= fallbackMs ? primary : fallback;
    const older = primaryMs >= fallbackMs ? fallback : primary;
    if (
      !canComplementAcrossSnapshots(
        newer.fetchedAt,
        older.fetchedAt,
        newer.dateRange,
        older.dateRange
      )
    ) {
      return newer;
    }
    return buildMergedKalodataObject(newer, older);
  }
  if (primaryMs !== null && fallbackMs === null) {
    return primary;
  }
  if (fallbackMs !== null && primaryMs === null) {
    return fallback;
  }

  return buildMergedKalodataObject(primary, fallback);
}

export function mergeValidatedMetricsSnapshots(
  primary?: ProductValidatedMetrics,
  fallback?: ProductValidatedMetrics
): ProductValidatedMetrics | undefined {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const primaryMs = parseTimestampMs(primary.fetchedAt);
  const fallbackMs = parseTimestampMs(fallback.fetchedAt);
  let newer = primary;
  let older = fallback;
  if (primaryMs !== null && fallbackMs !== null) {
    if (fallbackMs > primaryMs) {
      newer = fallback;
      older = primary;
    }
  } else if (fallbackMs !== null && primaryMs === null) {
    return fallback;
  } else if (primaryMs !== null && fallbackMs === null) {
    return primary;
  }

  // Only fill endpoint-exclusive absent fields (e.g. /rank growth + /detail creator/review)
  // when both snapshots share the same dateRange and are within the 6h coherent window.
  // Each complemented ValidatedMetric retains its OWN fetchedAt, dateRange, and sourceEndpoint.
  if (
    !canComplementAcrossSnapshots(
      newer.fetchedAt,
      older.fetchedAt,
      newer.dateRange,
      older.dateRange
    )
  ) {
    return newer;
  }

  const pickComplementary = <T extends ProductValidatedMetrics['revenueGrowthRate']>(
    a: T,
    b: T
  ): T => (isMetricAbsentForComplementaryMerge(a) && !isMetricAbsentForComplementaryMerge(b) ? b : a);

  const priceThb = pickComplementary(newer.priceThb, older.priceThb);
  const commissionRate = pickComplementary(newer.commissionRate, older.commissionRate);
  const commissionThb =
    priceThb !== newer.priceThb || commissionRate !== newer.commissionRate
      ? computeSyntheticCommissionThb(priceThb, commissionRate)
      : newer.commissionThb;

  const mergedShoppingMall =
    newer.shoppingMallRevenueThb7d &&
    !isMetricAbsentForComplementaryMerge(newer.shoppingMallRevenueThb7d)
      ? newer.shoppingMallRevenueThb7d
      : older.shoppingMallRevenueThb7d ?? newer.shoppingMallRevenueThb7d;

  const merged: ProductValidatedMetrics = {
    ...newer,
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d: pickComplementary(newer.salesVolume7d, older.salesVolume7d),
    revenueThb7d: pickComplementary(newer.revenueThb7d, older.revenueThb7d),
    videoRevenueThb7d: pickComplementary(newer.videoRevenueThb7d, older.videoRevenueThb7d),
    liveRevenueThb7d: pickComplementary(newer.liveRevenueThb7d, older.liveRevenueThb7d),
    revenueGrowthRate: pickComplementary(newer.revenueGrowthRate, older.revenueGrowthRate),
    creatorCount: pickComplementary(newer.creatorCount, older.creatorCount),
    reviewCount: pickComplementary(newer.reviewCount, older.reviewCount),
    rating: pickComplementary(newer.rating, older.rating),
    ...(mergedShoppingMall ? { shoppingMallRevenueThb7d: mergedShoppingMall } : {}),
  };

  const unresolvedSet = new Set<string>();
  const fields: Array<[string, ProductValidatedMetrics['revenueGrowthRate'] | undefined]> = [
    ['priceThb', merged.priceThb],
    ['commissionRate', merged.commissionRate],
    ['commissionThb', merged.commissionThb],
    ['salesVolume7d', merged.salesVolume7d],
    ['revenueThb7d', merged.revenueThb7d],
    ['videoRevenueThb7d', merged.videoRevenueThb7d],
    ['liveRevenueThb7d', merged.liveRevenueThb7d],
    ['shoppingMallRevenueThb7d', merged.shoppingMallRevenueThb7d],
    ['revenueGrowthRate', merged.revenueGrowthRate],
    ['creatorCount', merged.creatorCount],
    ['rating', merged.rating],
    ['reviewCount', merged.reviewCount],
  ];
  for (const [name, m] of fields) {
    if (!m) continue;
    if (
      m.unit === 'UNVERIFIED' ||
      m.state === 'UNAVAILABLE' ||
      Boolean(m.note && /UNVERIFIED_COMPARISON_PERIOD/i.test(m.note))
    ) {
      unresolvedSet.add(name);
    }
  }
  merged.unresolvedFields = Array.from(unresolvedSet);

  return merged;
}

export function saveDeepInsightForProduct(
  productId: string,
  incoming: {
    deepInsights: ProductDeepInsights;
    kalodataMetrics?: ProductKalodataMetrics;
    validatedMetrics?: ProductValidatedMetrics;
    shopName?: string;
    imageUrl?: string;
  }
): SavedDeepInsightRecord {
  const cache = loadDeepInsightsCache();
  const prev = cache[productId];
  const mergedDeep: ProductDeepInsights = {
    description: incoming.deepInsights.description ?? prev?.deepInsights.description,
    highlights: incoming.deepInsights.highlights ?? prev?.deepInsights.highlights,
    painPoints: incoming.deepInsights.painPoints ?? prev?.deepInsights.painPoints,
    usageScenarios: incoming.deepInsights.usageScenarios ?? prev?.deepInsights.usageScenarios,
    fetchedDetails: Boolean(
      incoming.deepInsights.fetchedDetails ||
        prev?.deepInsights.fetchedDetails ||
        incoming.deepInsights.description ||
        prev?.deepInsights.description
    ),
    fetchedSpecs: Boolean(
      incoming.deepInsights.fetchedSpecs ||
        prev?.deepInsights.fetchedSpecs ||
        (incoming.deepInsights.highlights && incoming.deepInsights.highlights.length > 0) ||
        (prev?.deepInsights.highlights && prev.deepInsights.highlights.length > 0)
    ),
    fetchedComments: Boolean(
      incoming.deepInsights.fetchedComments ||
        prev?.deepInsights.fetchedComments ||
        (incoming.deepInsights.painPoints && incoming.deepInsights.painPoints.length > 0) ||
        (incoming.deepInsights.usageScenarios && incoming.deepInsights.usageScenarios.length > 0) ||
        (prev?.deepInsights.painPoints && prev.deepInsights.painPoints.length > 0) ||
        (prev?.deepInsights.usageScenarios && prev.deepInsights.usageScenarios.length > 0)
    ),
    fetchedAt: incoming.deepInsights.fetchedAt || new Date().toISOString(),
  };
  const record: SavedDeepInsightRecord = {
    deepInsights: mergedDeep,
    kalodataMetrics: mergeKalodataMetrics(incoming.kalodataMetrics, prev?.kalodataMetrics),
    validatedMetrics: mergeValidatedMetricsSnapshots(
      incoming.validatedMetrics,
      prev?.validatedMetrics
    ),
    shopName: incoming.shopName || prev?.shopName,
    imageUrl: incoming.imageUrl || prev?.imageUrl,
    savedAt: new Date().toISOString(),
  };
  cache[productId] = record;
  persistDeepInsightsCache(cache);
  return record;
}

// Permanent Browser Storage for AI Product Deep Analyses (keyed by product.id)
export function loadProductAnalysisCache(): Record<string, ProductAiAnalysis> {
  try {
    const raw = localStorage.getItem(PRODUCT_ANALYSIS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, ProductAiAnalysis>;
  } catch {
    return {};
  }
}

export function persistProductAnalysisCache(
  cache: Record<string, ProductAiAnalysis>
): void {
  try {
    localStorage.setItem(PRODUCT_ANALYSIS_KEY, JSON.stringify(cache));
  } catch {
    const sorted = Object.entries(cache)
      .sort((a, b) => new Date(b[1].analyzedAt).getTime() - new Date(a[1].analyzedAt).getTime())
      .slice(0, 60);
    try {
      localStorage.setItem(PRODUCT_ANALYSIS_KEY, JSON.stringify(Object.fromEntries(sorted)));
    } catch {
      // Ignore gracefully
    }
  }
}

export function saveProductAnalysisForProduct(
  productId: string,
  analysis: ProductAiAnalysis
): void {
  const cache = loadProductAnalysisCache();
  cache[productId] = analysis;
  persistProductAnalysisCache(cache);
}

// Permanent Browser Storage for Manual AI Explanations (keyed by product.id)
interface SavedAiExplanationRecord {
  clearTitle: ProductItem['clearTitle'];
  whatItIs: ProductItem['whatItIs'];
  whySilentWorks: ProductItem['whySilentWorks'];
  category: ProductItem['category'];
  categoryLabel: ProductItem['categoryLabel'];
  visualTags: string[];
  scoreBreakdown?: ProductItem['scoreBreakdown'];
  savedAt: string;
}

export function loadAiExplanationsCache(): Record<string, SavedAiExplanationRecord> {
  try {
    const raw = localStorage.getItem(AI_EXPLANATIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, SavedAiExplanationRecord>;
  } catch {
    return {};
  }
}

export function saveAiExplanationsForProducts(products: ProductItem[]): void {
  const cache = loadAiExplanationsCache();
  let changed = false;
  for (const p of products) {
    if (!p.aiEnriched) continue;
    cache[p.id] = {
      clearTitle: p.clearTitle,
      whatItIs: p.whatItIs,
      whySilentWorks: p.whySilentWorks,
      category: p.category,
      categoryLabel: p.categoryLabel,
      visualTags: p.visualTags,
      scoreBreakdown: p.scoreBreakdown,
      savedAt: new Date().toISOString(),
    };
    changed = true;
  }
  if (!changed) return;
  try {
    localStorage.setItem(AI_EXPLANATIONS_KEY, JSON.stringify(cache));
  } catch {
    const trimmed = Object.entries(cache)
      .sort((a, b) => new Date(b[1].savedAt).getTime() - new Date(a[1].savedAt).getTime())
      .slice(0, 120);
    try {
      localStorage.setItem(AI_EXPLANATIONS_KEY, JSON.stringify(Object.fromEntries(trimmed)));
    } catch {
      // Ignore gracefully
    }
  }
}

export function hydrateProductFromStorage(
  product: ProductItem,
  options?: { nowMs?: number }
): ProductItem {
  const deepCache = loadDeepInsightsCache();
  const aiCache = loadAiExplanationsCache();
  const analysisCache = loadProductAnalysisCache();
  const nowMs = options?.nowMs;
  const scoringOpts = nowMs !== undefined ? { nowMs } : undefined;
  const strategyOpts =
    nowMs !== undefined ? { scoringConfig: { nowMs } } : undefined;

  let hydrated = product;

  const savedDeep = deepCache[product.id];
  if (savedDeep) {
    const mergedDeep: ProductDeepInsights = {
      description: product.deepInsights?.description ?? savedDeep.deepInsights.description,
      highlights: product.deepInsights?.highlights ?? savedDeep.deepInsights.highlights,
      painPoints: product.deepInsights?.painPoints ?? savedDeep.deepInsights.painPoints,
      usageScenarios: product.deepInsights?.usageScenarios ?? savedDeep.deepInsights.usageScenarios,
      fetchedDetails: Boolean(
        product.deepInsights?.fetchedDetails ||
          savedDeep.deepInsights.fetchedDetails ||
          product.deepInsights?.description ||
          savedDeep.deepInsights.description
      ),
      fetchedSpecs: Boolean(
        product.deepInsights?.fetchedSpecs ||
          savedDeep.deepInsights.fetchedSpecs ||
          (product.deepInsights?.highlights && product.deepInsights.highlights.length > 0) ||
          (savedDeep.deepInsights.highlights && savedDeep.deepInsights.highlights.length > 0)
      ),
      fetchedComments: Boolean(
        product.deepInsights?.fetchedComments ||
          savedDeep.deepInsights.fetchedComments ||
          (product.deepInsights?.painPoints && product.deepInsights.painPoints.length > 0) ||
          (product.deepInsights?.usageScenarios && product.deepInsights.usageScenarios.length > 0) ||
          (savedDeep.deepInsights.painPoints && savedDeep.deepInsights.painPoints.length > 0) ||
          (savedDeep.deepInsights.usageScenarios && savedDeep.deepInsights.usageScenarios.length > 0)
      ),
      fetchedAt: product.deepInsights?.fetchedAt || savedDeep.deepInsights.fetchedAt,
    };
    const selectedValidated = mergeValidatedMetricsSnapshots(
      hydrated.validatedMetrics,
      savedDeep.validatedMetrics
    );
    const nextValidated =
      selectedValidated && nowMs !== undefined
        ? refreshProductValidatedMetricsFreshness(selectedValidated, { nowMs })
        : selectedValidated;
    const nextCommercialV2 = nextValidated
      ? evaluateProductCommercialV2(nextValidated, scoringOpts)
      : hydrated.commercialScoreV2;
    hydrated = {
      ...hydrated,
      shopName: savedDeep.shopName || hydrated.shopName,
      imageUrl: savedDeep.imageUrl || hydrated.imageUrl,
      kalodataMetrics: mergeKalodataMetrics(hydrated.kalodataMetrics, savedDeep.kalodataMetrics),
      validatedMetrics: nextValidated,
      commercialScoreV2: nextCommercialV2,
      strategyIntelligenceV2: nextValidated
        ? evaluateProductStrategiesV2(nextValidated, nextCommercialV2, strategyOpts)
        : hydrated.strategyIntelligenceV2,
      deepInsights: mergedDeep,
    };
  }

  const savedAi = aiCache[product.id];
  if (savedAi && !hydrated.aiEnriched) {
    hydrated = {
      ...hydrated,
      clearTitle: savedAi.clearTitle,
      whatItIs: savedAi.whatItIs,
      whySilentWorks: savedAi.whySilentWorks,
      category: savedAi.category,
      categoryLabel: savedAi.categoryLabel,
      visualTags: savedAi.visualTags,
      scoreBreakdown: hydrated.scoreBreakdown ?? savedAi.scoreBreakdown,
      aiEnriched: true,
    };
  }

  const savedAnalysis = analysisCache[product.id];
  if (savedAnalysis) {
    hydrated = {
      ...hydrated,
      aiAnalysis: savedAnalysis,
    };
  }

  // Auto-repair stale legacy "Home & Kitchen" labels on older locally saved search results (0 cr)
  if (!hydrated.kalodataCategoryId && isLegacyDefaultHomeLabel(hydrated.categoryLabel)) {
    const inferred = inferSpecificProductCategory({
      thaiTitle: hydrated.thaiTitle,
      englishTitle: hydrated.aiAnalysis?.cleanName?.en || hydrated.clearTitle?.en,
      shopName: hydrated.shopName,
    });
    hydrated = {
      ...hydrated,
      category: inferred.visualGroup,
      categoryLabel: inferred.label,
    };
  }

  // Ensure legacy products saved before V2 seamlessly upgrade with validated metrics, V2 scores, and strategy evaluations
  const baseValidated =
    hydrated.validatedMetrics ?? adaptProductItemToValidatedMetrics(hydrated, scoringOpts);
  const refreshedValidated =
    nowMs !== undefined
      ? refreshProductValidatedMetricsFreshness(baseValidated, { nowMs })
      : baseValidated;
  const freshnessChanged = refreshedValidated !== hydrated.validatedMetrics;

  if (
    freshnessChanged ||
    !hydrated.validatedMetrics ||
    !hydrated.commercialScoreV2 ||
    !hydrated.strategyIntelligenceV2
  ) {
    const nextCommercialV2 =
      !freshnessChanged && hydrated.commercialScoreV2
        ? hydrated.commercialScoreV2
        : evaluateProductCommercialV2(refreshedValidated, scoringOpts);
    const nextStrategyV2 =
      !freshnessChanged && hydrated.strategyIntelligenceV2
        ? hydrated.strategyIntelligenceV2
        : evaluateProductStrategiesV2(refreshedValidated, nextCommercialV2, strategyOpts);
    hydrated = {
      ...hydrated,
      validatedMetrics: refreshedValidated,
      commercialScoreV2: nextCommercialV2,
      strategyIntelligenceV2: nextStrategyV2,
    };
  }

  return hydrated;
}

export function hydrateProductsFromStorage(
  products: ProductItem[],
  options?: { nowMs?: number }
): ProductItem[] {
  return products.map((product) => hydrateProductFromStorage(product, options));
}

export function buildBackupPayload(params: {
  entries: SavedHistoryEntry[];
  limits?: KalodataLimitSettings;
  recentSearches?: RecentSearchEntry[];
  deepInsightsCache?: Record<string, SavedDeepInsightRecord>;
  productAnalysisCache?: Record<string, ProductAiAnalysis>;
  productSnapshots?: Record<string, ProductObservationSnapshot[]>;
  exportedAt?: string;
}): BackupPayload {
  const deepInsightsCache = params.deepInsightsCache ?? loadDeepInsightsCache();
  const productAnalysisCache = params.productAnalysisCache ?? loadProductAnalysisCache();
  const productSnapshots = params.productSnapshots ?? loadProductSnapshotsFromStorage();

  return {
    app: 'SiamVisual',
    version: 5,
    exportedAt: params.exportedAt ?? new Date().toISOString(),
    entries: params.entries,
    limits: params.limits,
    recentSearches: params.recentSearches,
    deepInsightsCache,
    productAnalysisCache,
    productSnapshots,
  };
}

export function exportHistoryBackup(
  entries: SavedHistoryEntry[],
  limits?: KalodataLimitSettings,
  recentSearches?: RecentSearchEntry[]
): void {
  const payload = buildBackupPayload({
    entries,
    limits,
    recentSearches,
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `siamvisual-backup-${dateStamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedBackupResult {
  entries: SavedHistoryEntry[];
  limits?: KalodataLimitSettings;
  recentSearches?: RecentSearchEntry[];
  deepInsightsCache?: Record<string, SavedDeepInsightRecord>;
  productAnalysisCache?: Record<string, ProductAiAnalysis>;
  productSnapshots?: Record<string, ProductObservationSnapshot[]>;
}

export function parseBackupFile(
  text: string,
  options?: { nowMs?: number; importedAt?: string }
): ParsedBackupResult | null {
  try {
    if (text.length > 8_000_000) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;

    let rawEntries: unknown[] = [];
    let limits: KalodataLimitSettings | undefined;
    let recentSearches: RecentSearchEntry[] | undefined;
    let deepInsightsCache: Record<string, SavedDeepInsightRecord> | undefined;
    let productAnalysisCache: Record<string, ProductAiAnalysis> | undefined;
    let productSnapshots: Record<string, ProductObservationSnapshot[]> | undefined;

    if ('entries' in parsed && Array.isArray((parsed as BackupPayload).entries)) {
      const payload = parsed as BackupPayload;
      rawEntries = payload.entries;
      if (payload.limits && typeof payload.limits === 'object') {
        const l = payload.limits;
        limits = {
          maxSpendCredits:
            typeof l.maxSpendCredits === 'number' && Number.isFinite(l.maxSpendCredits) && l.maxSpendCredits > 0
              ? Math.round(l.maxSpendCredits * 100) / 100
              : null,
          minBalanceReserve:
            typeof l.minBalanceReserve === 'number' && Number.isFinite(l.minBalanceReserve) && l.minBalanceReserve >= 0
              ? Math.round(l.minBalanceReserve * 100) / 100
              : null,
          trackedSpentCredits:
            typeof l.trackedSpentCredits === 'number' && Number.isFinite(l.trackedSpentCredits) && l.trackedSpentCredits >= 0
              ? Math.round(l.trackedSpentCredits * 100) / 100
              : 0,
        };
      }
      if (Array.isArray(payload.recentSearches)) {
        recentSearches = payload.recentSearches
          .filter(isValidRecentSearchEntry)
          .slice(0, MAX_RECENT_SEARCHES);
      }
      if (
        payload.deepInsightsCache &&
        typeof payload.deepInsightsCache === 'object' &&
        !Array.isArray(payload.deepInsightsCache)
      ) {
        deepInsightsCache = payload.deepInsightsCache;
      }
      if (
        payload.productAnalysisCache &&
        typeof payload.productAnalysisCache === 'object' &&
        !Array.isArray(payload.productAnalysisCache)
      ) {
        productAnalysisCache = payload.productAnalysisCache;
      }
      if (
        payload.productSnapshots &&
        typeof payload.productSnapshots === 'object' &&
        !Array.isArray(payload.productSnapshots)
      ) {
        // Untrusted import boundary: ALWAYS sanitize imported snapshots as IMPORTED_UNVERIFIED
        const sanitized = sanitizeImportedProductSnapshotsMap(payload.productSnapshots, {
          nowMs: options?.nowMs,
          importedAt: options?.importedAt,
        });
        if (Object.keys(sanitized).length > 0) {
          productSnapshots = sanitized;
        }
      }
    } else if (Array.isArray(parsed)) {
      rawEntries = parsed;
    } else {
      return null;
    }

    return {
      entries: rawEntries.filter(isValidHistoryEntry),
      limits,
      recentSearches,
      deepInsightsCache,
      productAnalysisCache,
      productSnapshots,
    };
  } catch {
    return null;
  }
}

export function mergeRestoredHistory(
  current: SavedHistoryEntry[],
  imported: SavedHistoryEntry[]
): { merged: SavedHistoryEntry[]; addedCount: number } {
  const existingIds = new Set(current.map((item) => item.id));
  let addedCount = 0;
  const map = new Map<string, SavedHistoryEntry>();
  for (const item of imported) {
    if (!existingIds.has(item.id)) addedCount += 1;
    map.set(item.id, item);
  }
  for (const item of current) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  persistSavedHistory(merged);
  return { merged, addedCount };
}

export function mergeRestoredRecentSearches(
  current: RecentSearchEntry[],
  imported: RecentSearchEntry[]
): { merged: RecentSearchEntry[]; addedCount: number } {
  const existingIds = new Set(current.map((item) => item.id));
  let addedCount = 0;
  const map = new Map<string, RecentSearchEntry>();
  for (const item of imported) {
    if (!existingIds.has(item.id)) addedCount += 1;
    map.set(item.id, item);
  }
  for (const item of current) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  const merged = Array.from(map.values())
    .sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime())
    .slice(0, MAX_RECENT_SEARCHES);
  persistRecentSearches(merged);
  return { merged, addedCount };
}

function isValidHistoryEntry(value: unknown): value is SavedHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.savedAt !== 'string') return false;
  if (!obj.product || typeof obj.product !== 'object') return false;
  const product = obj.product as Record<string, unknown>;
  if (typeof product.id !== 'string' || typeof product.thaiTitle !== 'string') return false;
  if (obj.plan === undefined || obj.plan === null) {
    return true;
  }
  if (typeof obj.plan !== 'object') return false;
  const plan = obj.plan as Record<string, unknown>;
  return (
    typeof plan.id === 'string' &&
    Array.isArray(plan.hooks) &&
    Array.isArray(plan.storyboard)
  );
}

export function loadThemePreference(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // fallback
  }
  return 'light';
}

export function saveThemePreference(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadLanguagePreference(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'my' || stored === 'en') return stored;
  } catch {
    // fallback
  }
  return 'my';
}

export function saveLanguagePreference(lang: Language): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export function loadResultViewMode(): ResultViewMode {
  try {
    const stored = localStorage.getItem(RESULT_VIEW_KEY);
    if (stored === 'list' || stored === 'grid') return stored;
  } catch {
    // fallback
  }
  return 'grid';
}

export function saveResultViewMode(mode: ResultViewMode): void {
  try {
    localStorage.setItem(RESULT_VIEW_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadResultGridCols(): ResultGridCols | null {
  try {
    const raw = localStorage.getItem(RESULT_GRID_COLS_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return null;
}

export function saveResultGridCols(cols: ResultGridCols): void {
  try {
    localStorage.setItem(RESULT_GRID_COLS_KEY, String(cols));
  } catch {
    // ignore
  }
}

export function loadResultListZoom(): ResultListZoom {
  try {
    const raw = localStorage.getItem(RESULT_LIST_ZOOM_KEY);
    if (raw === '0') return 0;
    if (raw === '1') return 1;
    if (raw === '2') return 2;
  } catch {
    // fallback
  }
  return 2;
}

export function saveResultListZoom(level: ResultListZoom): void {
  try {
    localStorage.setItem(RESULT_LIST_ZOOM_KEY, String(level));
  } catch {
    // ignore
  }
}

export function loadRankBoardSnapshot(): RankBoardSnapshot | null {
  try {
    const raw = localStorage.getItem(RANK_BOARD_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.syncedAt !== 'string' ||
      !Array.isArray(obj.products) ||
      !Array.isArray(obj.categoryMarket) ||
      !obj.marketSummary ||
      typeof obj.marketSummary !== 'object'
    ) {
      return null;
    }
    return parsed as RankBoardSnapshot;
  } catch {
    return null;
  }
}

export function saveRankBoardSnapshot(snapshot: RankBoardSnapshot): void {
  try {
    localStorage.setItem(RANK_BOARD_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function clearRankBoardSnapshot(): void {
  try {
    localStorage.removeItem(RANK_BOARD_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

export function loadPinchHintSeen(): boolean {
  try {
    return localStorage.getItem(PINCH_HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function savePinchHintSeen(): void {
  try {
    localStorage.setItem(PINCH_HINT_SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

