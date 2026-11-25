import type {
  BackupPayload,
  KalodataCategoryItem,
  KalodataLimitSettings,
  Language,
  ProductAiAnalysis,
  ProductDeepInsights,
  ProductItem,
  ProductKalodataMetrics,
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

function mergeKalodataMetrics(
  primary?: ProductKalodataMetrics,
  fallback?: ProductKalodataMetrics
): ProductKalodataMetrics | undefined {
  if (!primary && !fallback) return undefined;
  return {
    salesVolume7d: primary?.salesVolume7d ?? fallback?.salesVolume7d ?? null,
    revenueThb7d: primary?.revenueThb7d ?? fallback?.revenueThb7d ?? null,
    videoRevenueThb7d: primary?.videoRevenueThb7d ?? fallback?.videoRevenueThb7d ?? null,
    liveRevenueThb7d: primary?.liveRevenueThb7d ?? fallback?.liveRevenueThb7d ?? null,
    revenueGrowthRate: primary?.revenueGrowthRate ?? fallback?.revenueGrowthRate ?? null,
    creatorCount: primary?.creatorCount ?? fallback?.creatorCount ?? null,
    rating: primary?.rating ?? fallback?.rating ?? null,
    reviewCount: primary?.reviewCount ?? fallback?.reviewCount ?? null,
    dateRange: primary?.dateRange || fallback?.dateRange || 'last7Day',
  };
}

export function saveDeepInsightForProduct(
  productId: string,
  incoming: {
    deepInsights: ProductDeepInsights;
    kalodataMetrics?: ProductKalodataMetrics;
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

export function hydrateProductFromStorage(product: ProductItem): ProductItem {
  const deepCache = loadDeepInsightsCache();
  const aiCache = loadAiExplanationsCache();
  const analysisCache = loadProductAnalysisCache();

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
    hydrated = {
      ...hydrated,
      shopName: savedDeep.shopName || hydrated.shopName,
      imageUrl: savedDeep.imageUrl || hydrated.imageUrl,
      kalodataMetrics: mergeKalodataMetrics(hydrated.kalodataMetrics, savedDeep.kalodataMetrics),
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
      scoreBreakdown: savedAi.scoreBreakdown ?? hydrated.scoreBreakdown,
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

  return hydrated;
}

export function hydrateProductsFromStorage(products: ProductItem[]): ProductItem[] {
  return products.map(hydrateProductFromStorage);
}

export function exportHistoryBackup(
  entries: SavedHistoryEntry[],
  limits?: KalodataLimitSettings,
  recentSearches?: RecentSearchEntry[]
): void {
  const deepInsightsCache = loadDeepInsightsCache();
  const productAnalysisCache = loadProductAnalysisCache();
  const payload: BackupPayload = {
    app: 'SiamVisual',
    version: 4,
    exportedAt: new Date().toISOString(),
    entries,
    limits,
    recentSearches,
    deepInsightsCache,
    productAnalysisCache,
  };
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
}

export function parseBackupFile(text: string): ParsedBackupResult | null {
  try {
    if (text.length > 8_000_000) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;

    let rawEntries: unknown[] = [];
    let limits: KalodataLimitSettings | undefined;
    let recentSearches: RecentSearchEntry[] | undefined;
    let deepInsightsCache: Record<string, SavedDeepInsightRecord> | undefined;
    let productAnalysisCache: Record<string, ProductAiAnalysis> | undefined;

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
