import crypto from 'crypto';
import type {
  CategoryKey,
  KalodataCategoryItem,
  KalodataCreditBalance,
  KalodataStatus,
  ProductDeepInsights,
  ProductEnrichOptions,
} from '../src/types.ts';
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
  categoryHint: string;
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
}

export interface KalodataSingleEnrichResponse {
  deepInsights: ProductDeepInsights;
  shopName?: string;
  imageUrl?: string;
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
interface CachedSearchEntry {
  expiresAt: number;
  products: KalodataRawProduct[];
  mode: 'rank' | 'single_link';
}
const searchCache = new Map<string, CachedSearchEntry>();
const inFlightSearches = new Map<string, Promise<KalodataSearchResponse>>();

function hashKeyPrefix(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
}

/**
 * Safely parses a pasted TikTok Shop / Kalodata product URL or raw numeric Product ID
 * without making any external redirect fetches.
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

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /(?:tiktok\.com|kalodata\.com)/i.test(trimmed);

  if (!looksLikeUrl) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  // Try structured URL parsing first
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    for (const paramKey of ['id', 'product_id', 'productId', 'item_id']) {
      const val = url.searchParams.get(paramKey)?.trim();
      if (val && /^\d{12,24}$/.test(val)) {
        return { isLinkOrId: true, productId: val, isShortLink: false };
      }
    }

    const pathMatch = url.pathname.match(/(\d{12,24})/);
    if (pathMatch?.[1]) {
      return { isLinkOrId: true, productId: pathMatch[1], isShortLink: false };
    }

    if (host.startsWith('vt.tiktok.com') || host.startsWith('vm.tiktok.com')) {
      return { isLinkOrId: true, productId: null, isShortLink: true };
    }
  } catch {
    // Fallback regex extraction if URL has extra pasted text around it
  }

  const anyIdMatch = trimmed.match(/\b(\d{12,24})\b/);
  if (anyIdMatch?.[1]) {
    return { isLinkOrId: true, productId: anyIdMatch[1], isShortLink: false };
  }

  return {
    isLinkOrId: true,
    productId: null,
    isShortLink: /v[tm]\.tiktok\.com/i.test(trimmed),
  };
}

export function getActiveKalodataKey(): {
  key: string | null;
  source: 'env' | 'ui' | 'none';
} {
  if (sessionKalodataApiKey && sessionKalodataApiKey.trim()) {
    return { key: sessionKalodataApiKey.trim(), source: 'ui' };
  }
  const envKey = process.env.KALODATA_API_KEY?.trim();
  if (envKey) {
    return { key: envKey, source: 'env' };
  }
  return { key: null, source: 'none' };
}

export function setSessionKalodataKey(key: string): void {
  sessionKalodataApiKey = key.trim();
  lastKnownBalance = null;
  searchCache.clear();
}

export function clearSessionKalodataKey(): void {
  sessionKalodataApiKey = null;
  lastKnownBalance = null;
  searchCache.clear();
}

export function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••' + trimmed.slice(-2);
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function getCachedKalodataStatus(): KalodataStatus {
  const { key, source } = getActiveKalodataKey();
  return {
    connected: Boolean(key),
    keySource: source,
    maskedKey: maskApiKey(key),
    balance: key ? lastKnownBalance : null,
  };
}

function parseFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parsePositiveOrNull(val: unknown): number | null {
  const num = parseFiniteNumber(val);
  return num !== null && num > 0 ? num : null;
}

function parsePositiveNumber(val: unknown, fallback = 0): number {
  const num = parseFiniteNumber(val);
  return num !== null && num >= 0 ? num : fallback;
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

function parseRawProductRow(
  row: Record<string, unknown>,
  fallbackId: string
): KalodataRawProduct | null {
  const title = String(
    row.product_name ?? row.product_title ?? row.title ?? ''
  ).trim();
  if (!title) return null;

  const productId = String(row.product_id ?? row.id ?? fallbackId).trim();

  const rawPrice =
    parsePositiveOrNull(row.unit_price) ??
    parsePositiveOrNull(row.avg_price) ??
    parsePositiveOrNull(row.min_price) ??
    parsePositiveOrNull(row.price);
  const priceThb = rawPrice !== null ? Math.round(rawPrice) : null;

  const rawCommission = parsePositiveOrNull(row.commission_rate);
  let commissionRate: number | null = null;
  if (rawCommission !== null) {
    commissionRate =
      rawCommission > 0 && rawCommission < 1
        ? Math.round(rawCommission * 1000) / 10
        : Math.min(60, Math.round(rawCommission * 10) / 10);
  }

  const salesVolume7d = parsePositiveNumber(
    row.sales_volumn ?? row.sales_volume ?? row.sale_count ?? row.item_sold,
    0
  );
  const revenueThb7d = parsePositiveNumber(
    row.revenue,
    priceThb !== null ? salesVolume7d * priceThb : 0
  );
  const videoRevenueThb7d = parsePositiveNumber(row.video_revenue, 0);
  const revenueGrowthRate = parseFiniteNumber(row.revenue_growth_rate) ?? 0;

  const imageUrl = sanitizeExternalUrl(
    row.master_image_url ?? row.image_url ?? row.cover_url ?? row.main_image
  );

  const productUrl = sanitizeExternalUrl(
    row.product_url ?? row.url ?? row.tiktok_url
  );

  const description = row.product_description
    ? flattenRichText(row.product_description).slice(0, 600)
    : undefined;

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
    categoryHint: String(
      row.category_name ?? row.first_cate_name ?? row.cate_name ?? ''
    ).trim(),
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
      const parsed: unknown = await response.json();
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
          'Kalodata rejected this API key. Please check your secret-key from Open Center.',
          401
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
    const msg = String(envelope.message ?? envelope.msg ?? '').trim();
    const low = msg.toLowerCase();

    if (
      response.status === 401 ||
      response.status === 403 ||
      (codeStr === '501' && low.startsWith('the key')) ||
      low.includes('key is not allowed') ||
      low.includes('invalid key') ||
      low.includes('unauthorized')
    ) {
      throw new KalodataApiError(
        'KALODATA_INVALID_KEY',
        msg || 'Kalodata rejected this API key. Please copy your key again from Kalodata Open Center.',
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
        msg || 'Insufficient Kalodata credit balance. Please top up credits in Kalodata Open Center.',
        402
      );
    }

    if (response.status === 429 || low.includes('too many') || low.includes('rate limit')) {
      throw new KalodataApiError(
        'KALODATA_RATE_LIMITED',
        msg || 'Kalodata API rate limit reached. Please wait a few seconds and try again.',
        429
      );
    }

    throw new KalodataApiError(
      'KALODATA_UPSTREAM_ERROR',
      msg || `Kalodata API error (code ${codeStr}).`,
      502
    );
  } catch (err) {
    if (err instanceof KalodataApiError) throw err;
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
      'Please paste and connect your Kalodata API key first.',
      401
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
  const apiKey = rawKey.trim();
  if (apiKey.length < 8 || apiKey.length > 512) {
    throw new KalodataApiError(
      'KALODATA_INVALID_KEY',
      'API key format looks too short. Please copy the full secret-key from Kalodata Open Center.',
      400
    );
  }

  const balance = await fetchKalodataCreditBalance(apiKey);
  setSessionKalodataKey(apiKey);
  lastKnownBalance = balance;

  return {
    connected: true,
    keySource: 'ui',
    maskedKey: maskApiKey(apiKey),
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
      'Please connect your Kalodata API key first.',
      401
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
        my: known ? known.label.my : rawName,
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

/**
 * Fetches a SINGLE Thailand TikTok Shop product by pasted Product Link / Product ID
 * using POST /openapi/v1/tiktok/product/detail (~0.2 cr only for that 1 product).
 */
export async function fetchSingleKalodataProductById(params: {
  productId: string;
  forceRefresh?: boolean;
  guardrails?: CreditGuardrails;
}): Promise<KalodataSearchResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Please connect your Kalodata API key first.',
      401
    );
  }

  const cleanId = params.productId.trim();
  const cacheKey = `${hashKeyPrefix(apiKey)}|single|${cleanId}`;

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
        date_range: 'last7Day',
        product_id: cleanId,
        need_extra: true,
        need_image: 1,
      },
      'POST',
      20000
    );

    const parsed =
      detail && typeof detail === 'object'
        ? parseRawProductRow(detail, cleanId)
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
export async function fetchKalodataThailandProducts(params: {
  query: string;
  cateIds: string[];
  forceRefresh?: boolean;
  guardrails?: CreditGuardrails;
}): Promise<KalodataSearchResponse> {
  const { key: apiKey } = getActiveKalodataKey();
  if (!apiKey) {
    throw new KalodataApiError(
      'KALODATA_NOT_CONNECTED',
      'Please connect your Kalodata API key first.',
      401
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

  const cacheKey = `${hashKeyPrefix(apiKey)}|rank|${cleanCateIds.join(',')}|${cleanQuery.toLowerCase()}`;

  if (!params.forceRefresh) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        products: cached.products,
        creditsUsed: 0,
        fromCache: true,
        mode: 'rank',
        balance: lastKnownBalance,
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
      date_range: 'last7Day',
      page_number: 1,
      page_size: 20,
      sort_field: { field: 'revenue', type: 'DESC' },
      need_image: 1,
      is_affiliate: 1,
    };

    if (cleanCateIds.length > 0) {
      rankBody.cate_ids = cleanCateIds;
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
    const products: KalodataRawProduct[] = rows
      .map((row, idx) => parseRawProductRow(row, `kalo_${idx + 1}`))
      .filter((item): item is KalodataRawProduct => item !== null);

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
      'Please connect your Kalodata API key first.',
      401
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

  const estimatedCost =
    (options.includeDetails ? 0.2 : 0) +
    (options.includeSpecs ? 0.5 : 0) +
    (options.includeComments ? 1.0 : 0);

  if (estimatedCost <= 0) {
    return {
      deepInsights: { fetchedAt: new Date().toISOString() },
      creditsUsed: 0,
      balance: lastKnownBalance,
    };
  }

  const balanceBefore = await checkGuardrailsBeforeSpend(apiKey, {
    ...guardrails,
    estimatedCost,
  });

  const deepInsights: ProductDeepInsights = {
    fetchedAt: new Date().toISOString(),
  };
  let shopName: string | undefined;
  let imageUrl: string | undefined;

  const tasks: Promise<void>[] = [];

  if (options.includeDetails) {
    tasks.push(
      (async () => {
        try {
          const detail = await kalodataRequest<Record<string, unknown>>(
            apiKey,
            '/tiktok/product/detail',
            {
              region: 'TH',
              language: 'en-US',
              currency: 'THB',
              date_range: 'last7Day',
              product_id: cleanProductId,
              need_extra: true,
              need_image: 1,
            },
            'POST',
            14000
          );
          if (detail && typeof detail === 'object') {
            if (typeof detail.shop_name === 'string' && detail.shop_name.trim()) {
              shopName = detail.shop_name.trim();
            }
            if (detail.product_description) {
              const desc = flattenRichText(detail.product_description).slice(0, 600);
              if (desc) deepInsights.description = desc;
            }
            const img = sanitizeExternalUrl(detail.master_image_url);
            if (img) imageUrl = img;
          }
        } catch {
          // Graceful partial enrichment
        }
      })()
    );
  }

  if (options.includeSpecs) {
    tasks.push(
      (async () => {
        try {
          const specs = await kalodataRequest<Record<string, unknown>>(
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
          if (specs && Array.isArray(specs.highlights)) {
            const list = specs.highlights
              .map((h) =>
                h && typeof h === 'object'
                  ? String((h as Record<string, unknown>).key_word ?? '').trim()
                  : ''
              )
              .filter(Boolean)
              .slice(0, 6);
            if (list.length > 0) deepInsights.highlights = list;
          }
        } catch {
          // Graceful partial enrichment
        }
      })()
    );
  }

  if (options.includeComments) {
    tasks.push(
      (async () => {
        try {
          const insight = await kalodataRequest<Record<string, unknown>>(
            apiKey,
            '/tiktok/product/comment/insight',
            {
              product_id: cleanProductId,
              country_code: 'th',
            },
            'POST',
            22000
          );
          if (insight && typeof insight === 'object') {
            if (Array.isArray(insight.pain_points)) {
              const list = insight.pain_points
                .map((p) =>
                  p && typeof p === 'object'
                    ? String((p as Record<string, unknown>).view_point ?? '').trim()
                    : ''
                )
                .filter(Boolean)
                .slice(0, 4);
              if (list.length > 0) deepInsights.painPoints = list;
            }
            if (Array.isArray(insight.usage_scenarios)) {
              const list = insight.usage_scenarios
                .map((u) =>
                  u && typeof u === 'object'
                    ? String((u as Record<string, unknown>).view_point ?? '').trim()
                    : ''
                )
                .filter(Boolean)
                .slice(0, 4);
              if (list.length > 0) deepInsights.usageScenarios = list;
            }
          }
        } catch {
          // Graceful partial enrichment
        }
      })()
    );
  }

  await Promise.all(tasks);
  const post = await computePostSpendDiff(apiKey, balanceBefore);

  return {
    deepInsights,
    shopName,
    imageUrl,
    creditsUsed: post.creditsUsed,
    balance: post.balance,
  };
}
