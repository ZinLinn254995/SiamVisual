import crypto from 'crypto';
import type {
  CategoryKey,
  KalodataCategoryItem,
  KalodataCreditBalance,
  KalodataStatus,
  ProductDeepInsights,
  ProductEnrichOptions,
  ProductKalodataMetrics,
  ProductMetricSourceEndpoint,
  ProductValidatedMetrics,
} from '../src/types.ts';
import { translateCategoryNameToMyanmar } from '../src/lib/categoryTranslations.ts';
import {
  adaptRawKalodataRowToValidatedMetrics,
  parseStrictFiniteNumber,
} from '../src/lib/metricFoundation.ts';
import { sanitizeRevenueTrendArray } from '../src/lib/revenueTrendAnalyzer.ts';
import { sanitizeExternalUrl } from './gemini.ts';

export interface KalodataRawProduct {
  id: string;
  thaiTitle: string;
  shopName: string;
  priceThb: number | null;
  commissionRate: number | null;
  salesVolume7d: number;
  revenueThb7d: number;
  videoRevenueThb7d: number;
  revenueGrowthRate: number;
  kalodataMetrics: ProductKalodataMetrics;
  validatedMetrics: ProductValidatedMetrics;
  categoryHint: string;
  rawCategoryId?: string;
  imageUrl?: string;
  productUrl?: string;
  description?: string;
}

export interface KalodataSearchResponse {
  products: KalodataRawProduct[];
  creditsUsed: number | null;
  fromCache: boolean;
  mode: 'rank' | 'single_link';
  balance: KalodataCreditBalance | null;
  pageNumber?: number;
  hasMore?: boolean;
}

export interface KalodataSingleEnrichResponse {
  deepInsights: ProductDeepInsights;
  kalodataMetrics?: ProductKalodataMetrics;
  validatedMetrics?: ProductValidatedMetrics;
  shopName?: string;
  imageUrl?: string;
  failedLayers?: Array<'details' | 'specs' | 'comments'>;
  creditsUsed: number | null;
  balance: KalodataCreditBalance | null;
}

export interface KalodataLiveCategoriesResponse {
  categories: KalodataCategoryItem[];
  creditsUsed: number | null;
  balance: KalodataCreditBalance | null;
}

export interface CreditGuardrails {
  minBalanceReserve?: number | null;
  maxSpendRemaining?: number | null;
  estimatedCost?: number;
}

export class KalodataApiError extends Error {
  code:
    | 'KALODATA_NOT_CONNECTED'
    | 'KALODATA_INVALID_KEY'
    | 'KALODATA_INSUFFICIENT_CREDITS'
    | 'KALODATA_RATE_LIMITED'
    | 'KALODATA_LIMIT_EXCEEDED'
    | 'KALODATA_INVALID_LINK'
    | 'KALODATA_TIMEOUT'
    | 'KALODATA_UPSTREAM_ERROR';
  httpStatus: number;

  constructor(
    code: KalodataApiError['code'],
    message: string,
    httpStatus = 400
  ) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Strips any occurrence of an active API key or credential-like header/token
 * from upstream error text so secrets can never leak into logs or browser responses.
 */
export function sanitizeKalodataErrorText(
  rawMsg: string,
  activeKey?: string | null
): string {
  let clean = String(rawMsg || '').trim();
  if (!clean) return '';
  if (activeKey && activeKey.trim().length >= 4) {
    const escaped = activeKey.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
  }
  clean = clean
    .replace(/secret[-_]?key\s*[:=]\s*\S+/gi, 'secret-key=[REDACTED]')
    .replace(/(the\s+key\s+)[^\s,;:]+/gi, '$1[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[REDACTED]')
    .slice(0, 240);
  return clean;
}

// Official Kalodata Open Center v1 API base URL (strictly allowlisted)
const KALODATA_BASE_URL = 'https://www.kalodata.com/openapi/v1';

// Official verified TikTok Shop SEA/TH Level-1 Category IDs
export const OFFICIAL_TH_CATEGORIES: KalodataCategoryItem[] = [
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

// In-memory session store for UI-pasted Kalodata API key (never written to disk or localStorage)
let sessionKalodataApiKey: string | null = null;
let lastKnownBalance: KalodataCreditBalance | null = null;

// 10-minute smart search cache & in-flight deduplication to prevent duplicate credit charges
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
// 30-minute per-layer enrichment cache (detail / specs / comments) shared across single-link & studio enrich
const ENRICH_LAYER_CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedSearchEntry {
  expiresAt: number;
  products: KalodataRawProduct[];
  mode: 'rank' | 'single_link';
}
interface CachedLayerEntry<T> {
  expiresAt: number;
  fetchedAt: string;
  data: T;
}

const searchCache = new Map<string, CachedSearchEntry>();
const inFlightSearches = new Map<string, Promise<KalodataSearchResponse>>();

const detailLayerCache = new Map<string, CachedLayerEntry<Record<string, unknown>>>();
const specsLayerCache = new Map<string, CachedLayerEntry<Record<string, unknown>>>();
const commentsLayerCache = new Map<string, CachedLayerEntry<Record<string, unknown>>>();
const inFlightDetailLayers = new Map<string, Promise<{ data: Record<string, unknown> | null; fetchedAt: string }>>();
const inFlightSpecsLayers = new Map<string, Promise<{ data: Record<string, unknown> | null; fetchedAt: string }>>();
const inFlightCommentsLayers = new Map<string, Promise<{ data: Record<string, unknown> | null; fetchedAt: string }>>();

export function clearKalodataCachesForTests(): void {
  searchCache.clear();
  detailLayerCache.clear();
  specsLayerCache.clear();
  commentsLayerCache.clear();
  inFlightSearches.clear();
  inFlightDetailLayers.clear();
  inFlightSpecsLayers.clear();
  inFlightCommentsLayers.clear();
}

function hashKeyPrefix(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
}

/**
 * Safely parses a pasted TikTok Shop / Kalodata product URL, TikTok app share text,
 * or raw numeric Product ID without making any external redirect fetches.
 */
export function parseProductLinkInput(rawInput: string): {
  isLinkOrId: boolean;
  productId: string | null;
  isShortLink: boolean;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  // Raw numeric TikTok Shop Product ID (e.g. 1729384729182736451)
  if (/^\d{12,24}$/.test(trimmed)) {
    return { isLinkOrId: true, productId: trimmed, isShortLink: false };
  }

  const explicitUrlMatch = trimmed.match(/https?:\/\/[^\s<>"'`]+/i);
  const bareUrlMatch = !explicitUrlMatch
    ? trimmed.match(
        /(?:^|[\s(])((?:[a-z0-9-]+\.)?(?:tiktok\.com|tiktokv\.com|kalodata\.com)\/[^\s<>"'`]+)/i
      )
    : null;
  const extractedUrl = explicitUrlMatch?.[0]
    ? explicitUrlMatch[0].replace(/[.,!?;:)\]}]+$/, '')
    : bareUrlMatch?.[1]
      ? `https://${bareUrlMatch[1].replace(/[.,!?;:)\]}]+$/, '')}`
      : null;

  const looksLikeUrl =
    Boolean(extractedUrl) ||
    /^https?:\/\//i.test(trimmed) ||
    /(?:tiktok\.com|tiktokv\.com|kalodata\.com)/i.test(trimmed);

  if (!looksLikeUrl) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  // Try structured URL parsing first
  try {
    const normalized =
      extractedUrl ?? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;

    for (const paramKey of ['product_id', 'productId', 'item_id']) {
      const val = url.searchParams.get(paramKey)?.trim();
      if (val && /^\d{12,24}$/.test(val)) {
        return { isLinkOrId: true, productId: val, isShortLink: false };
      }
    }

    const genericId = url.searchParams.get('id')?.trim();
    if (
      genericId &&
      /^\d{12,24}$/.test(genericId) &&
      (host.includes('kalodata.com') || /\/(?:product|pdp|shop)\b/i.test(pathname))
    ) {
      return { isLinkOrId: true, productId: genericId, isShortLink: false };
    }

    const productPathPatterns = [
      /\/view\/product\/(\d{12,24})(?:\/|$)/i,
      /\/product\/(\d{12,24})(?:\/|$)/i,
      /\/shop\/(?:[a-z]{2}\/)?pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
      /\/pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
    ];
    for (const pattern of productPathPatterns) {
      const pathMatch = pathname.match(pattern);
      if (pathMatch?.[1]) {
        return { isLinkOrId: true, productId: pathMatch[1], isShortLink: false };
      }
    }

    for (const jsonKey of ['ec_search_share_params', 'og_info', 'share_params']) {
      const rawParam = url.searchParams.get(jsonKey);
      if (!rawParam) continue;
      const jsonId = rawParam.match(/"(?:product_id|productId)"\s*:\s*"?(\d{12,24})"?/);
      if (jsonId?.[1]) {
        return { isLinkOrId: true, productId: jsonId[1], isShortLink: false };
      }
    }

    if (
      host === 'vt.tiktok.com' ||
      host === 'vm.tiktok.com' ||
      ((host === 'tiktok.com' || host.endsWith('.tiktok.com')) &&
        /^\/t\/[A-Za-z0-9_-]+/i.test(pathname))
    ) {
      return { isLinkOrId: true, productId: null, isShortLink: true };
    }

    if (/\/@[^/]+\/video\/\d+/i.test(pathname)) {
      return { isLinkOrId: true, productId: null, isShortLink: false };
    }

    const fallbackPathMatch = pathname.match(/(\d{12,24})/);
    if (fallbackPathMatch?.[1]) {
      return { isLinkOrId: true, productId: fallbackPathMatch[1], isShortLink: false };
    }
  } catch {
    // Fallback regex extraction if URL has extra pasted text around it
  }

  if (/(?:v[tm]\.tiktok\.com\/|tiktok\.com\/t\/)/i.test(trimmed)) {
    return { isLinkOrId: true, productId: null, isShortLink: true };
  }

  const anyIdMatch = trimmed.match(/\b(\d{12,24})\b/);
  if (anyIdMatch?.[1] && !/\/@[^/]+\/video\/\d+/i.test(trimmed)) {
    return { isLinkOrId: true, productId: anyIdMatch[1], isShortLink: false };
  }

  return {
    isLinkOrId: true,
    productId: null,
    isShortLink: false,
  };
}

export function getActiveKalodataKey(): {
  key: string | null;
  source: 'env' | 'ui' | 'none';
} {
  // Backend Secret (process.env.KALODATA_API_KEY) always takes strict precedence
  // and is never mixed with or overridden by a UI-entered session value.
  const envKey = process.env.KALODATA_API_KEY?.trim();
  if (envKey) {
    return { key: envKey, source: 'env' };
  }
  if (sessionKalodataApiKey && sessionKalodataApiKey.trim()) {
    return { key: sessionKalodataApiKey.trim(), source: 'ui' };
  }
  return { key: null, source: 'none' };
}

export function setSessionKalodataKey(key: string): void {
  sessionKalodataApiKey = key.trim();
  lastKnownBalance = null;
  clearKalodataCachesForTests();
}

export function clearSessionKalodataKey(): void {
  sessionKalodataApiKey = null;
  lastKnownBalance = null;
  clearKalodataCachesForTests();
}

export function maskApiKey(_key: string | null): string | null {
  // Never expose raw or partial API key characters in browser responses.
  return null;
}

export function getCachedKalodataStatus(): KalodataStatus {
  const { key, source } = getActiveKalodataKey();
  return {
    connected: Boolean(key),
    keySource: source,
    maskedKey: null,
    balance: key ? lastKnownBalance : null,
  };
}

function parseFiniteNumber(val: unknown): number | null {
  return parseStrictFiniteNumber(val);
}

function parsePositiveOrNull(val: unknown): number | null {
  const num = parseFiniteNumber(val);
  return num !== null && num > 0 ? num : null;
}

function parseNonNegativeOrNull(val: unknown): number | null {
  const num = parseFiniteNumber(val);
  return num !== null && num >= 0 ? num : null;
}

function flattenRichText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const chunks: string[] = [];
  function walk(node: unknown) {
    if (typeof node === 'string') {
      chunks.push(node);
    } else if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const text = obj.text ?? obj.t;
      if (typeof text === 'string') {
        chunks.push(text);
      } else if (obj.sub) {
        walk(obj.sub);
      }
    }
  }
  walk(value);
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function inferVisualGroup(name: string): Exclude<CategoryKey, 'all'> {
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

export function extractMetricsFromRawRow(
  row: Record<string, unknown>,
  sourceEndpoint: ProductMetricSourceEndpoint = 'unknown',
  fetchedAt: string | null = null,
  options?: { dateRange?: string; nowMs?: number }
): {
  priceThb: number | null;
  commissionRate: number | null;
  salesVolume7d: number;
  revenueThb7d: number;
  videoRevenueThb7d: number;
  revenueGrowthRate: number;
  kalodataMetrics: ProductKalodataMetrics;
  validatedMetrics: ProductValidatedMetrics;
  hasAnyRawMetricField: boolean;
} {
  const effectiveDateRange = options?.dateRange?.trim() || 'last7Day';
  const rawPrice =
    parsePositiveOrNull(row.unit_price) ??
    parsePositiveOrNull(row.avg_price) ??
    parsePositiveOrNull(row.min_price) ??
    parsePositiveOrNull(row.price);
  const priceThb = rawPrice !== null ? Math.round(rawPrice) : null;

  const rawCommission = parseNonNegativeOrNull(row.commission_rate);
  let commissionRate: number | null = null;
  if (rawCommission !== null) {
    if (rawCommission === 0) {
      commissionRate = 0;
    } else if (rawCommission >= 1 && rawCommission <= 100) {
      commissionRate = Math.round(rawCommission * 100) / 100;
    }
    // 0 < rawCommission < 1 stays null here (never multiplied by 100) because
    // Phase 0 verified percentage-point encoding (10 = 10%) and sub-1% encoding is UNVERIFIED.
  }

  const rawSalesVol = parseFiniteNumber(
    row.sales_volumn ?? row.sales_volume ?? row.sale_count ?? row.item_sold
  );
  const rawRevenue = parseFiniteNumber(row.revenue);
  const rawVideoRevenue = parseFiniteNumber(row.video_revenue);
  const rawLiveRevenue = parseFiniteNumber(row.live_revenue);
  const rawShoppingMallRevenue = parseFiniteNumber(
    row.shopping_mall_revenue ?? row.showcase_revenue
  );
  const rawGrowthRate = parseFiniteNumber(row.revenue_growth_rate);
  const rawCreatorCount = parseFiniteNumber(
    row.creator_number ?? row.creator_count ?? row.affiliate_count ?? row.influencer_count
  );
  const rawRating = parseFiniteNumber(row.product_rating ?? row.rating);
  const rawReviewCount = parseFiniteNumber(
    row.product_review_count ?? row.review_count ?? row.comment_count
  );
  const rawRevenueTrend = sanitizeRevenueTrendArray(row.revenue_trend);
  const rawVideoCount = parseNonNegativeOrNull(row.video_number ?? row.video_count);
  const rawLiveCount = parseNonNegativeOrNull(row.live_number ?? row.live_count);
  const rawLaunchDate =
    typeof row.launch_date === 'string' && row.launch_date.trim()
      ? row.launch_date.trim().slice(0, 32)
      : null;
  const rawDeliveryType =
    typeof row.delivery_type === 'string' && row.delivery_type.trim()
      ? row.delivery_type.trim().slice(0, 32)
      : null;

  const hasAnyRawMetricField =
    rawSalesVol !== null ||
    rawRevenue !== null ||
    rawVideoRevenue !== null ||
    rawLiveRevenue !== null ||
    rawShoppingMallRevenue !== null ||
    rawGrowthRate !== null ||
    rawCreatorCount !== null ||
    rawRating !== null ||
    rawReviewCount !== null ||
    rawRevenueTrend !== null;

  // Legacy V1 fields kept intact for computeDirectKalodataScore backward compatibility.
  // Phase 1 validatedMetrics preserves exact ZERO / MISSING / INVALID / UNAVAILABLE states separately.
  const salesVolume7d = rawSalesVol !== null && rawSalesVol >= 0 ? Math.round(rawSalesVol) : 0;
  const revenueThb7d =
    rawRevenue !== null && rawRevenue >= 0
      ? Math.round(rawRevenue)
      : priceThb !== null && rawSalesVol !== null && rawSalesVol >= 0
        ? Math.round(rawSalesVol * priceThb)
        : 0;
  const videoRevenueThb7d =
    rawVideoRevenue !== null && rawVideoRevenue >= 0 ? Math.round(rawVideoRevenue) : 0;
  const revenueGrowthRate = rawGrowthRate ?? 0;

  const normalizedFetchedAt =
    typeof fetchedAt === 'string' && fetchedAt.trim() ? fetchedAt.trim() : null;

  const kalodataMetrics: ProductKalodataMetrics = {
    salesVolume7d: rawSalesVol !== null && rawSalesVol >= 0 ? Math.round(rawSalesVol) : null,
    revenueThb7d:
      rawRevenue !== null && rawRevenue >= 0 ? Math.round(rawRevenue * 100) / 100 : null,
    videoRevenueThb7d:
      rawVideoRevenue !== null && rawVideoRevenue >= 0
        ? Math.round(rawVideoRevenue * 100) / 100
        : null,
    liveRevenueThb7d:
      rawLiveRevenue !== null && rawLiveRevenue >= 0
        ? Math.round(rawLiveRevenue * 100) / 100
        : null,
    shoppingMallRevenueThb7d:
      rawShoppingMallRevenue !== null && rawShoppingMallRevenue >= 0
        ? Math.round(rawShoppingMallRevenue * 100) / 100
        : null,
    revenueGrowthRate: rawGrowthRate !== null ? Math.round(rawGrowthRate * 100) / 100 : null,
    creatorCount:
      rawCreatorCount !== null && rawCreatorCount >= 0 ? Math.round(rawCreatorCount) : null,
    rating:
      rawRating !== null && rawRating >= 0 && rawRating <= 5
        ? Math.round(rawRating * 10) / 10
        : null,
    reviewCount:
      rawReviewCount !== null && rawReviewCount >= 0 ? Math.round(rawReviewCount) : null,
    ...(rawRevenueTrend ? { revenueTrendThb: rawRevenueTrend } : {}),
    ...(rawVideoCount !== null ? { videoCount: Math.round(rawVideoCount) } : {}),
    ...(rawLiveCount !== null ? { liveCount: Math.round(rawLiveCount) } : {}),
    ...(rawLaunchDate ? { launchDate: rawLaunchDate } : {}),
    ...(rawDeliveryType ? { deliveryType: rawDeliveryType } : {}),
    dateRange: effectiveDateRange,
    ...(normalizedFetchedAt ? { fetchedAt: normalizedFetchedAt } : {}),
  };

  const validatedMetrics = adaptRawKalodataRowToValidatedMetrics(row, {
    fetchedAt: normalizedFetchedAt,
    dateRange: effectiveDateRange,
    sourceEndpoint,
    nowMs: options?.nowMs,
  });

  return {
    priceThb,
    commissionRate,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    revenueGrowthRate,
    kalodataMetrics,
    validatedMetrics,
    hasAnyRawMetricField,
  };
}

export function parseRawProductRow(
  row: Record<string, unknown>,
  fallbackId: string,
  sourceEndpoint: ProductMetricSourceEndpoint = 'unknown',
  fetchedAt: string | null = null,
  options?: { dateRange?: string; nowMs?: number }
): KalodataRawProduct | null {
  const title = String(
    row.product_name ?? row.product_title ?? row.title ?? ''
  ).trim();
  if (!title) return null;

  const productId = String(row.product_id ?? row.id ?? fallbackId).trim();

  const {
    priceThb,
    commissionRate,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    revenueGrowthRate,
    kalodataMetrics,
    validatedMetrics,
  } = extractMetricsFromRawRow(row, sourceEndpoint, fetchedAt, options);

  const imageUrl = sanitizeExternalUrl(
    row.master_image_url ?? row.image_url ?? row.cover_url ?? row.main_image
  );

  const productUrl = sanitizeExternalUrl(
    row.product_url ??
      row.tiktok_url ??
      row.share_url ??
      row.pdp_url ??
      row.shop_product_url ??
      row.url
  );

  const description = row.product_description
    ? flattenRichText(row.product_description).slice(0, 600)
    : undefined;

  const priCategoryObj =
    row.pri_category && typeof row.pri_category === 'object' && !Array.isArray(row.pri_category)
      ? (row.pri_category as Record<string, unknown>)
      : null;

  const firstCateArrayId =
    Array.isArray(row.category_ids) && row.category_ids.length > 0
      ? String(row.category_ids[0] ?? '')
      : Array.isArray(row.cate_ids) && row.cate_ids.length > 0
        ? String(row.cate_ids[0] ?? '')
        : '';
  const nestedCategories = Array.isArray(row.categories)
    ? row.categories
    : Array.isArray(row.category_list)
      ? row.category_list
      : [];
  const firstNestedCate =
    nestedCategories.length > 0 &&
    nestedCategories[0] &&
    typeof nestedCategories[0] === 'object'
      ? (nestedCategories[0] as Record<string, unknown>)
      : null;

  const rawCateIdCandidate = String(
    priCategoryObj?.category_id ??
      priCategoryObj?.cate_id ??
      priCategoryObj?.id ??
      row.pri_cate_id ??
      row.first_cate_id ??
      row.first_category_id ??
      row.cate1_id ??
      row.l1_cate_id ??
      row.category_level1_id ??
      row.category_id ??
      row.cate_id ??
      firstNestedCate?.category_id ??
      firstNestedCate?.cate_id ??
      firstNestedCate?.id ??
      firstCateArrayId
  ).trim();
  const rawCategoryId = /^\d{3,15}$/.test(rawCateIdCandidate) ? rawCateIdCandidate : undefined;

  const categoryPathStr =
    typeof row.category_path === 'string'
      ? row.category_path.split(/[>/>]/)[0]?.trim() || ''
      : typeof row.cate_path === 'string'
        ? row.cate_path.split(/[>/>]/)[0]?.trim() || ''
        : '';

  const categoryHint = String(
    priCategoryObj?.category_name ??
      priCategoryObj?.cate_name ??
      priCategoryObj?.name ??
      row.pri_cate_name ??
      row.first_cate_name ??
      row.first_category_name ??
      row.cate1_name ??
      row.l1_cate_name ??
      row.category_level1_name ??
      row.category_name ??
      row.cate_name ??
      firstNestedCate?.category_name ??
      firstNestedCate?.cate_name ??
      firstNestedCate?.name ??
      categoryPathStr
  ).trim();

  return {
    id: productId,
    thaiTitle: title,
    shopName: String(row.shop_name ?? row.seller_name ?? 'TikTok Shop TH').trim(),
    priceThb,
    commissionRate,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    revenueGrowthRate,
    kalodataMetrics,
    validatedMetrics,
    categoryHint,
    rawCategoryId,
    imageUrl,
    productUrl,
    description: description || undefined,
  };
}

/**
 * Core Kalodata Open Center v1 HTTP client matching the official spec:
 * - Headers: Content-Type, secret-key, source-type: SKILL
 * - Envelope: { success: true, data: ... } or { success: false, code, message }
 */
async function kalodataRequest<T>(
  apiKey: string,
  endpointPath: string,
  body: Record<string, unknown> | null,
  method: 'GET' | 'POST' = 'POST',
  timeoutMs = 18000
): Promise<T> {
  const url = `${KALODATA_BASE_URL}${endpointPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'secret-key': apiKey,
        'source-type': 'SKILL',
      },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });

    let envelope: Record<string, unknown> | null = null;
    try {
      const rawText = await response.text();
      // Preserve 16-24 digit numeric IDs (such as 19-digit TikTok Shop product_id) as strings
      // before JSON.parse so IEEE-754 double rounding never corrupts the last 3 digits.
      const safeJsonText = rawText.replace(
        /("(?:product_id|id|item_id|shop_id|seller_id|video_id|creator_id)"\s*:\s*)(\d{16,24})(?=\s*[,}\]])/g,
        '$1"$2"'
      );
      const parsed: unknown = JSON.parse(safeJsonText);
      if (parsed && typeof parsed === 'object') {
        envelope = parsed as Record<string, unknown>;
      }
    } catch {
      envelope = null;
    }

    if (!envelope) {
      if (response.status === 401 || response.status === 403) {
        throw new KalodataApiError(
          'KALODATA_INVALID_KEY',
          'Kalodata rejected the API key. Please check your KALODATA_API_KEY configuration.',
          401
        );
      }
      if (response.status === 402) {
        throw new KalodataApiError(
          'KALODATA_INSUFFICIENT_CREDITS',
          'Insufficient Kalodata credit balance. Please top up credits in Kalodata Open Center.',
          402
        );
      }
      if (response.status === 429) {
        throw new KalodataApiError(
          'KALODATA_RATE_LIMITED',
          'Kalodata API rate limit reached. Please wait a few seconds and try again.',
          429
        );
      }
      throw new KalodataApiError(
        'KALODATA_UPSTREAM_ERROR',
        `Kalodata API returned an unexpected response (HTTP ${response.status}).`,
        502
      );
    }

    if (envelope.success === true) {
      return envelope.data as T;
    }

    const codeStr = String(envelope.code ?? response.status);
    const rawMsg = String(envelope.message ?? envelope.msg ?? '').trim();
    const low = rawMsg.toLowerCase();

    if (
      response.status === 401 ||
      response.status === 403 ||
      (codeStr === '501' && low.startsWith('the key')) ||
      low.includes('key is not allowed') ||
      low.includes('invalid key') ||
      low.includes('invalid secret') ||
      low.includes('unauthorized') ||
      (low.includes('secret-key') &&
        (low.includes('invalid') ||
          low.includes('missing') ||
          low.includes('required') ||
          low.includes('expired') ||
          low.includes('denied')))
    ) {
      // Never echo raw upstream message here because Kalodata may include key text in error strings.
      throw new KalodataApiError(
        'KALODATA_INVALID_KEY',
        'Kalodata rejected the API key. Please verify KALODATA_API_KEY in Backend Secrets or Kalodata Open Center.',
        401
      );
    }

    if (
      response.status === 402 ||
      (low.includes('credit') && (low.includes('not enough') || low.includes('insufficient') || low.includes('balance'))) ||
      low.includes('余额不足')
    ) {
      throw new KalodataApiError(
        'KALODATA_INSUFFICIENT_CREDITS',
        'Insufficient Kalodata credit balance. Please top up credits in Kalodata Open Center.',
        402
      );
    }

    if (
      response.status === 429 ||
      low.includes('too many') ||
      low.includes('rate limit') ||
      low.includes('qps') ||
      low.includes('frequency') ||
      low.includes('throttle')
    ) {
      throw new KalodataApiError(
        'KALODATA_RATE_LIMITED',
        'Kalodata API rate limit reached. Please wait a few seconds and try again.',
        429
      );
    }

    const safeUpstreamMsg = sanitizeKalodataErrorText(rawMsg, apiKey);
    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      safeUpstreamMsg
        ? `Kalodata API error (code ${codeStr}): ${safeUpstreamMsg}`
        : `Kalodata API error (code ${codeStr}).`,
      502
    );
  } catch (err) {
    if (err instanceof KalodataApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new KalodataApiError(
        'KALODATA_TIMEOUT',
        'Kalodata API request timed out. Please try again shortly.',
        504
      );
    }
    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      'Unable to reach Kalodata Open Center API right now. Please try again shortly.',
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchKalodataCreditBalance(
  explicitKey?: string
): Promise<KalodataCreditBalance> {
  const apiKey = explicitKey?.trim() || getActiveKalodataKey().key;
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const data = await kalodataRequest<Record<string, unknown> | null>(
    apiKey,
    '/credit/balance',
    null,
    'GET',
    10000
  );

  const obj = data && typeof data === 'object' ? data : {};
  const totalRemain = parseFiniteNumber(obj.totalRemain);
  const mainRemain = parseFiniteNumber(obj.mainRemain);
  const subRemain =
    obj.subRemain === null || obj.subRemain === undefined
      ? null
      : parseFiniteNumber(obj.subRemain);

  const available = totalRemain ?? mainRemain ?? subRemain;

  const balance: KalodataCreditBalance = {
    available: available !== null ? Math.round(available * 100) / 100 : null,
    mainRemain: mainRemain !== null ? Math.round(mainRemain * 100) / 100 : null,
    subRemain: subRemain !== null ? Math.round(subRemain * 100) / 100 : null,
    accountType: subRemain !== null ? 'sub' : 'main',
    unit: 'credits',
    checkedAt: new Date().toISOString(),
  };

  if (!explicitKey) {
    lastKnownBalance = balance;
  }
  return balance;
}

export async function verifyAndConnectKalodataKey(
  rawKey: string
): Promise<KalodataStatus> {
  // Never mix or override a server Backend Secret with a UI-entered key.
  if (process.env.KALODATA_API_KEY?.trim()) {
    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      'Kalodata API key is already managed via server Backend Secrets and cannot be overridden from the browser.',
      409
    );
  }

  const apiKey = rawKey.trim();
  if (apiKey.length < 8 || apiKey.length > 512) {
    throw new KalodataApiError(
      'KALODATA_INVALID_KEY',
      'API key format looks invalid. Please check your key from Kalodata Open Center.',
      400
    );
  }

  const balance = await fetchKalodataCreditBalance(apiKey);
  setSessionKalodataKey(apiKey);
  lastKnownBalance = balance;

  return {
    connected: true,
    keySource: 'ui',
    maskedKey: null,
    balance,
  };
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object')
    );
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'list', 'items', 'records']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object')
        );
      }
    }
  }
  return [];
}

async function checkGuardrailsBeforeSpend(
  apiKey: string,
  guardrails?: CreditGuardrails
): Promise<KalodataCreditBalance | null> {
  const estCost = guardrails?.estimatedCost ?? 0.2;

  if (
    guardrails?.maxSpendRemaining !== null &&
    guardrails?.maxSpendRemaining !== undefined &&
    Number.isFinite(guardrails.maxSpendRemaining) &&
    estCost > guardrails.maxSpendRemaining + 0.0001
  ) {
    throw new KalodataApiError(
      'KALODATA_LIMIT_EXCEEDED',
      `Stopped by your Max Spend Limit: estimated cost (~${estCost} cr) exceeds remaining allowed spend (${Math.max(0, Math.round(guardrails.maxSpendRemaining * 100) / 100)} cr).`,
      403
    );
  }

  let balanceBefore: KalodataCreditBalance | null = null;
  try {
    balanceBefore = await fetchKalodataCreditBalance(apiKey);
    lastKnownBalance = balanceBefore;
  } catch (err) {
    if (err instanceof KalodataApiError && err.code === 'KALODATA_INVALID_KEY') {
      throw err;
    }
  }

  const reserve = guardrails?.minBalanceReserve;
  if (
    reserve !== null &&
    reserve !== undefined &&
    Number.isFinite(reserve) &&
    balanceBefore &&
    balanceBefore.available !== null &&
    balanceBefore.available - estCost < reserve - 0.0001
  ) {
    throw new KalodataApiError(
      'KALODATA_LIMIT_EXCEEDED',
      `Stopped by your Minimum Balance Reserve: balance (${balanceBefore.available} cr) minus est. cost (~${estCost} cr) would drop below your ${reserve} cr reserve.`,
      403
    );
  }

  return balanceBefore;
}

async function computePostSpendDiff(
  apiKey: string,
  balanceBefore: KalodataCreditBalance | null
): Promise<{ balance: KalodataCreditBalance | null; creditsUsed: number | null }> {
  let balanceAfter: KalodataCreditBalance | null = balanceBefore;
  try {
    balanceAfter = await fetchKalodataCreditBalance(apiKey);
    lastKnownBalance = balanceAfter;
  } catch {
    // Keep prior known balance gracefully
  }

  let actualCreditsUsed: number | null = null;
  if (
    balanceBefore?.available !== null &&
    balanceBefore?.available !== undefined &&
    balanceAfter?.available !== null &&
    balanceAfter?.available !== undefined
  ) {
    const diff = balanceBefore.available - balanceAfter.available;
    if (diff >= 0) {
      actualCreditsUsed = Math.round(diff * 100) / 100;
    }
  }

  return { balance: balanceAfter, creditsUsed: actualCreditsUsed };
}

export async function fetchKalodataLiveCategories(
  guardrails?: CreditGuardrails
): Promise<KalodataLiveCategoriesResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const balanceBefore = await checkGuardrailsBeforeSpend(apiKey, {
    ...guardrails,
    estimatedCost: 0.2,
  });

  const data = await kalodataRequest<unknown>(
    apiKey,
    '/tiktok/category/rank',
    {
      region: 'TH',
      language: 'en-US',
      currency: 'THB',
      date_range: 'last7Day',
      category_level: 1,
      page_number: 1,
      page_size: 20,
      sort_field: { field: 'revenue', type: 'DESC' },
    },
    'POST',
    20000
  );

  const rows = asList(data);
  const officialLookup = new Map<string, KalodataCategoryItem>(
    OFFICIAL_TH_CATEGORIES.filter((c) => c.id).map((c) => [c.id, c])
  );

  const liveItems: KalodataCategoryItem[] = [OFFICIAL_TH_CATEGORIES[0]];
  const seenIds = new Set<string>(['']);

  for (const row of rows) {
    const rawId = String(row.category_id ?? row.cate_id ?? row.id ?? '').trim();
    const rawName = String(row.category_name ?? row.cate_name ?? row.name ?? '').trim();
    if (!rawId || !/^\d{3,15}$/.test(rawId) || !rawName || seenIds.has(rawId)) {
      continue;
    }
    seenIds.add(rawId);
    const known = officialLookup.get(rawId);
    liveItems.push({
      id: rawId,
      label: {
        my: translateCategoryNameToMyanmar(rawName, rawId),
        en: rawName,
      },
      visualGroup: known ? known.visualGroup : inferVisualGroup(rawName),
      source: 'kalodata_live',
    });
  }

  const post = await computePostSpendDiff(apiKey, balanceBefore);

  return {
    categories: liveItems.length > 1 ? liveItems : OFFICIAL_TH_CATEGORIES,
    creditsUsed: post.creditsUsed,
    balance: post.balance,
  };
}

export interface KalodataCategoryMarketRow {
  id: string;
  nameEn: string;
  nameMy: string;
  visualGroup: Exclude<CategoryKey, 'all'>;
  revenueThb: number | null;
  salesVolume: number | null;
  revenueSharePct: number | null;
}

export interface KalodataCategoryMarketRankResponse {
  categories: KalodataCategoryMarketRow[];
  creditsUsed: number | null;
  balance: KalodataCreditBalance | null;
}

/**
 * Fetches live Thailand L1 TikTok Shop Category Market Rank (~0.2 cr)
 * for the Executive Product Rank Board.
 */
export async function fetchKalodataCategoryMarketRank(params: {
  dateRange?: 'last7Day' | 'last30Day';
  guardrails?: CreditGuardrails;
  skipGuardrails?: boolean;
}): Promise<KalodataCategoryMarketRankResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const dateRange = normalizeKalodataDateRange(params.dateRange);
  const balanceBefore = params.skipGuardrails
    ? lastKnownBalance
    : await checkGuardrailsBeforeSpend(apiKey, {
        ...params.guardrails,
        estimatedCost: 0.2,
      });

  const data = await kalodataRequest<unknown>(
    apiKey,
    '/tiktok/category/rank',
    {
      region: 'TH',
      language: 'en-US',
      currency: 'THB',
      date_range: dateRange,
      category_level: 1,
      page_number: 1,
      page_size: 20,
      sort_field: { field: 'revenue', type: 'DESC' },
    },
    'POST',
    20000
  );

  const rows = asList(data);
  const officialLookup = new Map<string, KalodataCategoryItem>(
    OFFICIAL_TH_CATEGORIES.filter((c) => c.id).map((c) => [c.id, c])
  );
  const seenIds = new Set<string>();
  const categories: KalodataCategoryMarketRow[] = [];

  for (const row of rows) {
    const rawId = String(row.category_id ?? row.cate_id ?? row.id ?? '').trim();
    const rawName = String(row.category_name ?? row.cate_name ?? row.name ?? '').trim();
    if (!rawId || !/^\d{3,15}$/.test(rawId) || !rawName || seenIds.has(rawId)) {
      continue;
    }
    seenIds.add(rawId);
    const known = officialLookup.get(rawId);
    const revenueThb = parseNonNegativeOrNull(
      row.revenue ?? row.sale_amount ?? row.gmv ?? row.total_revenue ?? row.amount
    );
    const salesVolume = parseNonNegativeOrNull(
      row.sales ?? row.sale_count ?? row.volume ?? row.unit_sales ?? row.sold_count
    );
    const rawShare = parseNonNegativeOrNull(
      row.revenue_share ?? row.market_share ?? row.share ?? row.ratio ?? row.revenue_ratio
    );
    const revenueSharePct =
      rawShare !== null ? (rawShare > 0 && rawShare <= 1 ? rawShare * 100 : rawShare) : null;

    categories.push({
      id: rawId,
      nameEn: rawName,
      nameMy: translateCategoryNameToMyanmar(rawName, rawId),
      visualGroup: known ? known.visualGroup : inferVisualGroup(rawName),
      revenueThb,
      salesVolume,
      revenueSharePct,
    });
  }

  const post = await computePostSpendDiff(apiKey, balanceBefore);

  return {
    categories,
    creditsUsed: post.creditsUsed,
    balance: post.balance,
  };
}

/**
 * Validates combined credit guardrails up front before executing a multi-call Rank Board sync (~0.4 cr).
 */
export async function precheckKalodataCombinedGuardrails(
  guardrails?: CreditGuardrails
): Promise<KalodataCreditBalance | null> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }
  return checkGuardrailsBeforeSpend(apiKey, {
    ...guardrails,
    estimatedCost: guardrails?.estimatedCost ?? 0.4,
  });
}

/**
 * Fetches a SINGLE Thailand TikTok Shop product by pasted Product Link / Product ID
 * using POST /openapi/v1/tiktok/product/detail (~0.2 cr only for that 1 product).
 */
export async function fetchSingleKalodataProductById(params: {
  productId: string;
  dateRange?: 'last7Day' | 'last30Day';
  forceRefresh?: boolean;
  guardrails?: CreditGuardrails;
}): Promise<KalodataSearchResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const cleanId = params.productId.trim();
  const effectiveDateRange = normalizeKalodataDateRange(params.dateRange);
  const cacheKey = `${hashKeyPrefix(apiKey)}|single|${effectiveDateRange}|${cleanId}`;

  if (!params.forceRefresh) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        products: cached.products,
        creditsUsed: 0,
        fromCache: true,
        mode: 'single_link',
        balance: lastKnownBalance,
      };
    }

    const existing = inFlightSearches.get(cacheKey);
    if (existing) return existing;
  }

  const promise = (async (): Promise<KalodataSearchResponse> => {
    const balanceBefore = await checkGuardrailsBeforeSpend(apiKey, {
      ...params.guardrails,
      estimatedCost: 0.2,
    });

    const detail = await kalodataRequest<Record<string, unknown> | null>(
      apiKey,
      '/tiktok/product/detail',
      {
        region: 'TH',
        language: 'en-US',
        currency: 'THB',
        date_range: effectiveDateRange,
        product_id: cleanId,
        need_extra: true,
        need_image: 1,
      },
      'POST',
      20000
    );

    const fetchedAt = new Date().toISOString();
    if (detail && typeof detail === 'object') {
      const layerKey = `${hashKeyPrefix(apiKey)}|detail|${effectiveDateRange}|${cleanId}`;
      detailLayerCache.set(layerKey, {
        expiresAt: Date.now() + ENRICH_LAYER_CACHE_TTL_MS,
        fetchedAt,
        data: detail,
      });
    }

    const parsed =
      detail && typeof detail === 'object'
        ? parseRawProductRow(detail, cleanId, 'detail', fetchedAt, { dateRange: effectiveDateRange })
        : null;
    const products = parsed ? [parsed] : [];

    if (products.length > 0) {
      searchCache.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        products,
        mode: 'single_link',
      });
    }

    const post = await computePostSpendDiff(apiKey, balanceBefore);

    return {
      products,
      creditsUsed: post.creditsUsed,
      fromCache: false,
      mode: 'single_link',
      balance: post.balance,
    };
  })();

  inFlightSearches.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
}

/**
 * Ultra-lean (~0.2 cr) Thailand TikTok Shop Product Ranking search.
 * Supports:
 *  - Default Best Matches (empty keyword & no categories)
 *  - Keyword search
 *  - Multiple selected official Thailand TikTok Shop categories (cate_ids: string[])
 *  - Keyword + Multiple Categories combined
 */
export function normalizeKalodataPageNumber(rawPage: unknown): number {
  const n = typeof rawPage === 'number' ? rawPage : Number(rawPage);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.floor(n)));
}

export function normalizeKalodataPageSize(rawPageSize: unknown): number {
  const n = typeof rawPageSize === 'number' ? rawPageSize : Number(rawPageSize);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

export function normalizeKalodataDateRange(rawDateRange: unknown): 'last7Day' | 'last30Day' {
  return rawDateRange === 'last30Day' ? 'last30Day' : 'last7Day';
}

export function buildKalodataRankCacheKey(params: {
  keyPrefix: string;
  cateIds: string[];
  query: string;
  pageNumber: number;
  pageSize?: number;
  dateRange: 'last7Day' | 'last30Day';
}): string {
  const sortedCates = Array.from(
    new Set(params.cateIds.map((id) => id.trim()).filter((id) => /^\d{3,15}$/.test(id)))
  ).sort();
  const sizeSegment =
    params.pageSize && params.pageSize !== 20 ? `|s${params.pageSize}` : '';
  return `${params.keyPrefix}|rank|${params.dateRange}|p${params.pageNumber}${sizeSegment}|${sortedCates.join(',')}|${params.query.trim().toLowerCase()}`;
}

export async function fetchKalodataThailandProducts(params: {
  query: string;
  cateIds: string[];
  pageNumber?: number;
  pageSize?: number;
  dateRange?: 'last7Day' | 'last30Day';
  forceRefresh?: boolean;
  guardrails?: CreditGuardrails;
}): Promise<KalodataSearchResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const cleanQuery = params.query.trim();
  const cleanCateIds = Array.from(
    new Set(
      params.cateIds
        .map((id) => id.trim())
        .filter((id) => /^\d{3,15}$/.test(id))
    )
  ).sort();
  const pageNumber = normalizeKalodataPageNumber(params.pageNumber);
  const pageSize = normalizeKalodataPageSize(params.pageSize);
  const dateRange = normalizeKalodataDateRange(params.dateRange);

  const cacheKey = buildKalodataRankCacheKey({
    keyPrefix: hashKeyPrefix(apiKey),
    cateIds: cleanCateIds,
    query: cleanQuery,
    pageNumber,
    pageSize,
    dateRange,
  });

  if (!params.forceRefresh) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        products: cached.products,
        creditsUsed: 0,
        fromCache: true,
        mode: 'rank',
        balance: lastKnownBalance,
        pageNumber,
        hasMore: cached.products.length >= pageSize && pageNumber < 10,
      };
    }

    const existing = inFlightSearches.get(cacheKey);
    if (existing) return existing;
  }

  const searchPromise = (async (): Promise<KalodataSearchResponse> => {
    const balanceBefore = await checkGuardrailsBeforeSpend(apiKey, {
      ...params.guardrails,
      estimatedCost: 0.2,
    });

    const rankBody: Record<string, unknown> = {
      region: 'TH',
      language: 'en-US',
      currency: 'THB',
      date_range: dateRange,
      page_number: pageNumber,
      page_size: pageSize,
      sort_field: { field: 'revenue', type: 'DESC' },
      need_image: 1,
      is_affiliate: 1,
    };

    if (cleanCateIds.length > 0) {
      rankBody.category_ids = cleanCateIds;
      rankBody.cate_ids = cleanCateIds;
      if (cleanCateIds.length === 1) {
        rankBody.category_id = cleanCateIds[0];
      }
    }
    if (cleanQuery) {
      rankBody.keyword = cleanQuery;
    }

    const rankData = await kalodataRequest<unknown>(
      apiKey,
      '/tiktok/product/rank',
      rankBody,
      'POST',
      25000
    );

    const rows = asList(rankData);
    const rankFetchedAt = new Date().toISOString();
    const seenIds = new Set<string>();
    const products: KalodataRawProduct[] = [];
    for (let idx = 0; idx < rows.length; idx += 1) {
      const parsed = parseRawProductRow(rows[idx], `kalo_${idx + 1}`, 'rank', rankFetchedAt, {
        dateRange,
      });
      if (!parsed || seenIds.has(parsed.id)) continue;
      seenIds.add(parsed.id);
      products.push(parsed);
    }

    if (products.length > 0) {
      if (searchCache.size > 40) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey) searchCache.delete(oldestKey);
      }
      searchCache.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        products,
        mode: 'rank',
      });
    }

    const post = await computePostSpendDiff(apiKey, balanceBefore);

    return {
      products,
      creditsUsed: post.creditsUsed,
      fromCache: false,
      mode: 'rank',
      balance: post.balance,
      pageNumber,
      hasMore: products.length >= pageSize && pageNumber < 10,
    };
  })();

  inFlightSearches.set(cacheKey, searchPromise);
  try {
    return await searchPromise;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
}

export async function enrichSingleKalodataProduct(
  productId: string,
  options: ProductEnrichOptions,
  guardrails?: CreditGuardrails
): Promise<KalodataSingleEnrichResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Kalodata API key is not configured on the server.',
      503
    );
  }

  const cleanProductId = productId.trim();
  if (!cleanProductId) {
    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      'Invalid product ID for Kalodata enrichment.',
      400
    );
  }

  const keyPrefix = hashKeyPrefix(apiKey);
  const now = Date.now();
  const effectiveDateRange = normalizeKalodataDateRange(options.dateRange);
  const detailKey = `${keyPrefix}|detail|${effectiveDateRange}|${cleanProductId}`;
  const specsKey = `${keyPrefix}|specs|${cleanProductId}`;
  const commentsKey = `${keyPrefix}|comments|${cleanProductId}`;

  const cachedDetail = options.includeDetails ? detailLayerCache.get(detailKey) : undefined;
  const hasFreshDetail = Boolean(cachedDetail && cachedDetail.expiresAt > now);
  const cachedSpecs = options.includeSpecs ? specsLayerCache.get(specsKey) : undefined;
  const hasFreshSpecs = Boolean(cachedSpecs && cachedSpecs.expiresAt > now);
  const cachedComments = options.includeComments ? commentsLayerCache.get(commentsKey) : undefined;
  const hasFreshComments = Boolean(cachedComments && cachedComments.expiresAt > now);

  const estimatedCost =
    (options.includeDetails && !hasFreshDetail ? 0.2 : 0) +
    (options.includeSpecs && !hasFreshSpecs ? 0.5 : 0) +
    (options.includeComments && !hasFreshComments ? 1.0 : 0);

  if (!options.includeDetails && !options.includeSpecs && !options.includeComments) {
    return {
      deepInsights: { fetchedAt: new Date().toISOString() },
      creditsUsed: 0,
      balance: lastKnownBalance,
    };
  }

  const balanceBefore =
    estimatedCost > 0
      ? await checkGuardrailsBeforeSpend(apiKey, {
          ...guardrails,
          estimatedCost,
        })
      : lastKnownBalance;

  const enrichFetchedAt = new Date().toISOString();
  const deepInsights: ProductDeepInsights = {
    fetchedAt: enrichFetchedAt,
  };
  let kalodataMetrics: ProductKalodataMetrics | undefined;
  let validatedMetrics: ProductValidatedMetrics | undefined;
  let shopName: string | undefined;
  let imageUrl: string | undefined;

  const attemptedLayers: Array<'details' | 'specs' | 'comments'> = [];
  const failedLayers: Array<'details' | 'specs' | 'comments'> = [];
  let firstError: unknown = null;
  const tasks: Promise<void>[] = [];

  if (options.includeDetails) {
    attemptedLayers.push('details');
    tasks.push(
      (async () => {
        try {
          let detail: Record<string, unknown> | null = null;
          let detailFetchedAt = enrichFetchedAt;

          if (hasFreshDetail && cachedDetail) {
            detail = cachedDetail.data;
            detailFetchedAt = cachedDetail.fetchedAt;
          } else {
            let pending = inFlightDetailLayers.get(detailKey);
            if (!pending) {
              pending = (async () => {
                const payload = await kalodataRequest<Record<string, unknown>>(
                  apiKey,
                  '/tiktok/product/detail',
                  {
                    region: 'TH',
                    language: 'en-US',
                    currency: 'THB',
                    date_range: effectiveDateRange,
                    product_id: cleanProductId,
                    need_extra: true,
                    need_image: 1,
                  },
                  'POST',
                  14000
                );
                const ts = new Date().toISOString();
                if (payload && typeof payload === 'object') {
                  detailLayerCache.set(detailKey, {
                    expiresAt: Date.now() + ENRICH_LAYER_CACHE_TTL_MS,
                    fetchedAt: ts,
                    data: payload,
                  });
                }
                return { data: payload && typeof payload === 'object' ? payload : null, fetchedAt: ts };
              })();
              inFlightDetailLayers.set(detailKey, pending);
            }
            try {
              const resolved = await pending;
              detail = resolved.data;
              detailFetchedAt = resolved.fetchedAt;
            } finally {
              inFlightDetailLayers.delete(detailKey);
            }
          }

          deepInsights.fetchedDetails = true;
          deepInsights.fetchedAt = detailFetchedAt;
          if (detail && typeof detail === 'object') {
            if (typeof detail.shop_name === 'string' && detail.shop_name.trim()) {
              shopName = detail.shop_name.trim();
            }
            const rawDesc = detail.product_description ?? detail.description ?? detail.desc;
            if (rawDesc) {
              const desc = flattenRichText(rawDesc).slice(0, 1400);
              if (desc) deepInsights.description = desc;
            }
            const img = sanitizeExternalUrl(detail.master_image_url);
            if (img) imageUrl = img;

            const extracted = extractMetricsFromRawRow(detail, 'detail', detailFetchedAt, {
              dateRange: effectiveDateRange,
            });
            if (extracted.hasAnyRawMetricField || extracted.priceThb !== null || extracted.commissionRate !== null) {
              kalodataMetrics = extracted.kalodataMetrics;
              validatedMetrics = extracted.validatedMetrics;
            }
          }
        } catch (err) {
          failedLayers.push('details');
          if (!firstError) firstError = err;
        }
      })()
    );
  }

  if (options.includeSpecs) {
    attemptedLayers.push('specs');
    tasks.push(
      (async () => {
        try {
          let specs: Record<string, unknown> | null = null;
          if (hasFreshSpecs && cachedSpecs) {
            specs = cachedSpecs.data;
          } else {
            let pending = inFlightSpecsLayers.get(specsKey);
            if (!pending) {
              pending = (async () => {
                const payload = await kalodataRequest<Record<string, unknown>>(
                  apiKey,
                  '/tiktok/product/analysis',
                  {
                    product_id: cleanProductId,
                    region: 'TH',
                    language: 'en-US',
                  },
                  'POST',
                  18000
                );
                const ts = new Date().toISOString();
                if (payload && typeof payload === 'object') {
                  specsLayerCache.set(specsKey, {
                    expiresAt: Date.now() + ENRICH_LAYER_CACHE_TTL_MS,
                    fetchedAt: ts,
                    data: payload,
                  });
                }
                return { data: payload && typeof payload === 'object' ? payload : null, fetchedAt: ts };
              })();
              inFlightSpecsLayers.set(specsKey, pending);
            }
            try {
              const resolved = await pending;
              specs = resolved.data;
            } finally {
              inFlightSpecsLayers.delete(specsKey);
            }
          }

          deepInsights.fetchedSpecs = true;
          const rawHighlights = Array.isArray(specs?.highlights)
            ? specs.highlights
            : Array.isArray(specs?.selling_points)
              ? specs.selling_points
              : [];
          if (rawHighlights.length > 0) {
            const list = rawHighlights
              .map((h) => {
                if (typeof h === 'string') return h.trim();
                if (h && typeof h === 'object') {
                  const obj = h as Record<string, unknown>;
                  const primary = String(
                    obj.key_word ?? obj.keyword ?? obj.title ?? obj.name ?? obj.text ?? ''
                  ).trim();
                  const extra = String(
                    obj.description ?? obj.content ?? obj.value ?? ''
                  ).trim();
                  if (primary && extra && extra.toLowerCase() !== primary.toLowerCase()) {
                    return `${primary}: ${extra}`;
                  }
                  return primary || extra;
                }
                return '';
              })
              .filter(Boolean)
              .slice(0, 10);
            if (list.length > 0) deepInsights.highlights = list;
          }
        } catch (err) {
          failedLayers.push('specs');
          if (!firstError) firstError = err;
        }
      })()
    );
  }

  if (options.includeComments) {
    attemptedLayers.push('comments');
    tasks.push(
      (async () => {
        try {
          let insight: Record<string, unknown> | null = null;
          if (hasFreshComments && cachedComments) {
            insight = cachedComments.data;
          } else {
            let pending = inFlightCommentsLayers.get(commentsKey);
            if (!pending) {
              pending = (async () => {
                const payload = await kalodataRequest<Record<string, unknown>>(
                  apiKey,
                  '/tiktok/product/comment/insight',
                  {
                    product_id: cleanProductId,
                    country_code: 'th',
                  },
                  'POST',
                  22000
                );
                const ts = new Date().toISOString();
                if (payload && typeof payload === 'object') {
                  commentsLayerCache.set(commentsKey, {
                    expiresAt: Date.now() + ENRICH_LAYER_CACHE_TTL_MS,
                    fetchedAt: ts,
                    data: payload,
                  });
                }
                return { data: payload && typeof payload === 'object' ? payload : null, fetchedAt: ts };
              })();
              inFlightCommentsLayers.set(commentsKey, pending);
            }
            try {
              const resolved = await pending;
              insight = resolved.data;
            } finally {
              inFlightCommentsLayers.delete(commentsKey);
            }
          }

          deepInsights.fetchedComments = true;
          if (insight && typeof insight === 'object') {
            if (Array.isArray(insight.pain_points)) {
              const list = insight.pain_points
                .map((p) => {
                  if (typeof p === 'string') return p.trim();
                  if (p && typeof p === 'object') {
                    const obj = p as Record<string, unknown>;
                    return String(
                      obj.view_point ?? obj.viewpoint ?? obj.content ?? obj.summary ?? obj.text ?? ''
                    ).trim();
                  }
                  return '';
                })
                .filter(Boolean)
                .slice(0, 6);
              if (list.length > 0) deepInsights.painPoints = list;
            }
            if (Array.isArray(insight.usage_scenarios)) {
              const list = insight.usage_scenarios
                .map((u) => {
                  if (typeof u === 'string') return u.trim();
                  if (u && typeof u === 'object') {
                    const obj = u as Record<string, unknown>;
                    return String(
                      obj.view_point ?? obj.viewpoint ?? obj.content ?? obj.summary ?? obj.text ?? ''
                    ).trim();
                  }
                  return '';
                })
                .filter(Boolean)
                .slice(0, 6);
              if (list.length > 0) deepInsights.usageScenarios = list;
            }
          }
        } catch (err) {
          failedLayers.push('comments');
          if (!firstError) firstError = err;
        }
      })()
    );
  }

  await Promise.all(tasks);

  if (attemptedLayers.length > 0 && failedLayers.length === attemptedLayers.length) {
    if (firstError instanceof KalodataApiError) {
      throw firstError;
    }
    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      firstError instanceof Error
        ? firstError.message
        : 'All requested Kalodata deep-data layers failed to load.',
      502
    );
  }

  const post =
    estimatedCost > 0
      ? await computePostSpendDiff(apiKey, balanceBefore)
      : { balance: lastKnownBalance, creditsUsed: 0 };

  return {
    deepInsights,
    kalodataMetrics,
    validatedMetrics,
    shopName,
    imageUrl,
    ...(failedLayers.length > 0 ? { failedLayers } : {}),
    creditsUsed: post.creditsUsed,
    balance: post.balance,
  };
}
