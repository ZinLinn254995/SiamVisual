import type { RankedIntelligenceCardItem } from './productIntelligenceView.ts';
import { isUsableScoringMetric } from './metricFoundation.ts';

export type DiscoveryShortlistPreset =
  | 'all'
  | 'monetizable_only'
  | 'video_proven'
  | 'strong_earnings'
  | 'rising_trend';

export type DiscoveryPriceBand = 'all' | 'under_300' | '300_1000' | 'over_1000';

export type DiscoverySortMode =
  | 'search_score_desc'
  | 'intelligence'
  | 'video_revenue_desc'
  | 'payout_desc'
  | 'commission_desc'
  | 'revenue_desc'
  | 'sales_desc';

export interface DiscoveryFilterState {
  preset: DiscoveryShortlistPreset;
  minCommissionPct: number | null;
  minVideoSharePct: number | null;
  priceBand: DiscoveryPriceBand;
  sortMode: DiscoverySortMode;
}

export interface DiscoveryFilterPoolCounts {
  totalCount: number;
  filteredCount: number;
  monetizableCount: number;
  notMonetizableCount: number;
  videoProvenCount: number;
  strongEarningsCount: number;
  risingTrendCount: number;
  activeFilterCount: number;
}

export interface DiscoveryFilterResult {
  entries: RankedIntelligenceCardItem[];
  counts: DiscoveryFilterPoolCounts;
}

export type SearchPageSizeOption = 20 | 50 | 100;
export type SearchDateRangeOption = 'last7Day' | 'last30Day';

export const SEARCH_PAGE_SIZE_OPTIONS: readonly SearchPageSizeOption[] = [20, 50, 100];
export const SEARCH_DATE_RANGE_OPTIONS: readonly SearchDateRangeOption[] = [
  'last7Day',
  'last30Day',
];

/**
 * Recommended default Kalodata discovery scope:
 * - 100 items per search: live-verified exact same 0.20 cr flat fee as 20 items (Kalodata max).
 * - last7Day: standard 7-day Thailand TikTok Shop commercial baseline.
 */
export const DEFAULT_SEARCH_PAGE_SIZE: SearchPageSizeOption = 100;
export const DEFAULT_SEARCH_DATE_RANGE: SearchDateRangeOption = 'last7Day';

export interface SearchConfigDraft {
  query: string;
  cateIds: string[];
  pageSize: SearchPageSizeOption;
  dateRange: SearchDateRangeOption;
  filterState: DiscoveryFilterState;
}

export const DEFAULT_DISCOVERY_FILTER_STATE: DiscoveryFilterState = {
  preset: 'all',
  minCommissionPct: null,
  minVideoSharePct: null,
  priceBand: 'all',
  sortMode: 'intelligence',
};

/**
 * Recommended default affiliate discovery filter:
 * Automatically hides 0% commission non-monetizable listings and ranks monetizable
 * products by the 0.20 cr Search Opportunity Score (Demand + Affiliate Earning +
 * Video Sales Proof + Price Fit) at zero extra credit cost.
 */
export const RECOMMENDED_DISCOVERY_FILTER_STATE: DiscoveryFilterState = {
  preset: 'monetizable_only',
  minCommissionPct: null,
  minVideoSharePct: null,
  priceBand: 'all',
  sortMode: 'search_score_desc',
};

export function createRecommendedSearchConfigDraft(): SearchConfigDraft {
  return {
    query: '',
    cateIds: [],
    pageSize: DEFAULT_SEARCH_PAGE_SIZE,
    dateRange: DEFAULT_SEARCH_DATE_RANGE,
    filterState: { ...RECOMMENDED_DISCOVERY_FILTER_STATE },
  };
}

/**
 * Resolves the discovery filter to apply after a live search completes.
 * For single-link checks, always show the requested product (even if 0% commission)
 * so pasted link inspections never land on an empty filtered view.
 */
export function resolveAppliedDiscoveryFilterAfterSearch(
  mode: 'rank' | 'single_link',
  requestedFilter: DiscoveryFilterState
): DiscoveryFilterState {
  if (mode === 'single_link') {
    return { ...DEFAULT_DISCOVERY_FILTER_STATE };
  }
  return { ...requestedFilter };
}

export function countActiveDiscoveryFilters(state: DiscoveryFilterState): number {
  let count = 0;
  if (state.preset !== 'all') count += 1;
  if (state.minCommissionPct !== null) count += 1;
  if (state.minVideoSharePct !== null) count += 1;
  if (state.priceBand !== 'all') count += 1;
  if (state.sortMode !== 'intelligence') count += 1;
  return count;
}

export function isDefaultDiscoveryFilterState(state: DiscoveryFilterState): boolean {
  return countActiveDiscoveryFilters(state) === 0;
}

export function isRecommendedDiscoveryFilterState(state: DiscoveryFilterState): boolean {
  return (
    state.preset === RECOMMENDED_DISCOVERY_FILTER_STATE.preset &&
    state.minCommissionPct === RECOMMENDED_DISCOVERY_FILTER_STATE.minCommissionPct &&
    state.minVideoSharePct === RECOMMENDED_DISCOVERY_FILTER_STATE.minVideoSharePct &&
    state.priceBand === RECOMMENDED_DISCOVERY_FILTER_STATE.priceBand &&
    state.sortMode === RECOMMENDED_DISCOVERY_FILTER_STATE.sortMode
  );
}

function isMonetizableEntry(entry: RankedIntelligenceCardItem): boolean {
  return (
    !entry.discoveryShortlist.isNotMonetizable &&
    entry.commercialEligibilityStatus !== 'NOT_MONETIZABLE'
  );
}

function isVideoProvenEntry(entry: RankedIntelligenceCardItem): boolean {
  if (!isMonetizableEntry(entry)) return false;
  return (
    entry.discoveryShortlist.videoSalesEvidenceStatus === 'STRONG' ||
    entry.discoveryShortlist.videoSalesEvidenceStatus === 'MODERATE'
  );
}

function isStrongEarningsEntry(entry: RankedIntelligenceCardItem): boolean {
  if (!isMonetizableEntry(entry)) return false;
  return (
    entry.discoveryShortlist.primaryClassification === 'STRONG_AFFILIATE_EARNINGS' ||
    entry.discoveryShortlist.secondarySignals.includes('STRONG_AFFILIATE_EARNINGS')
  );
}

function isRisingTrendEntry(entry: RankedIntelligenceCardItem): boolean {
  return entry.historicalTrend?.overallTrend === 'RISING';
}

function getVerifiedCommissionRate(entry: RankedIntelligenceCardItem): number | null {
  const m = entry.product.validatedMetrics?.commissionRate;
  if (!m || !isUsableScoringMetric(m) || m.unit !== 'PERCENT' || m.value === null) {
    return null;
  }
  return m.value;
}

function getVerifiedPriceThb(entry: RankedIntelligenceCardItem): number | null {
  const m = entry.product.validatedMetrics?.priceThb;
  if (!m || !isUsableScoringMetric(m) || m.unit !== 'THB' || m.value === null || m.value <= 0) {
    return null;
  }
  return m.value;
}

function getVerifiedVideoRevenueThb(entry: RankedIntelligenceCardItem): number | null {
  const m = entry.product.validatedMetrics?.videoRevenueThb7d;
  if (!m || !isUsableScoringMetric(m) || m.unit !== 'THB' || m.value === null) {
    return null;
  }
  return m.value;
}

function getVerifiedRevenueThb(entry: RankedIntelligenceCardItem): number | null {
  const m = entry.product.validatedMetrics?.revenueThb7d;
  if (!m || !isUsableScoringMetric(m) || m.unit !== 'THB' || m.value === null) {
    return null;
  }
  return m.value;
}

function getVerifiedSalesVolume(entry: RankedIntelligenceCardItem): number | null {
  const m = entry.product.validatedMetrics?.salesVolume7d;
  if (!m || !isUsableScoringMetric(m) || m.unit !== 'COUNT' || m.value === null) {
    return null;
  }
  return m.value;
}

function getDerivedMonetizablePayoutThb(entry: RankedIntelligenceCardItem): number | null {
  if (!isMonetizableEntry(entry)) return null;
  const payout = entry.commercialScore.earningScore.payoutPerSaleThb;
  if (typeof payout !== 'number' || !Number.isFinite(payout) || payout <= 0) {
    return null;
  }
  return payout;
}

function matchesPreset(
  entry: RankedIntelligenceCardItem,
  preset: DiscoveryShortlistPreset
): boolean {
  switch (preset) {
    case 'all':
      return true;
    case 'monetizable_only':
      return isMonetizableEntry(entry);
    case 'video_proven':
      return isVideoProvenEntry(entry);
    case 'strong_earnings':
      return isStrongEarningsEntry(entry);
    case 'rising_trend':
      return isRisingTrendEntry(entry);
  }
}

function matchesPriceBand(price: number | null, band: DiscoveryPriceBand): boolean {
  if (band === 'all') return true;
  if (price === null) return false;
  switch (band) {
    case 'under_300':
      return price <= 300;
    case '300_1000':
      return price > 300 && price <= 1000;
    case 'over_1000':
      return price > 1000;
  }
}

function extractSortValue(
  entry: RankedIntelligenceCardItem,
  sortMode: Exclude<DiscoverySortMode, 'intelligence'>
): number | null {
  switch (sortMode) {
    case 'search_score_desc':
      if (entry.searchScore.status === 'SCORED' && entry.searchScore.score !== null) {
        return entry.searchScore.score;
      }
      if (entry.searchScore.status === 'NOT_MONETIZABLE') {
        return -1;
      }
      return null;
    case 'video_revenue_desc':
      return getVerifiedVideoRevenueThb(entry);
    case 'payout_desc':
      return getDerivedMonetizablePayoutThb(entry);
    case 'commission_desc':
      return getVerifiedCommissionRate(entry);
    case 'revenue_desc':
      return getVerifiedRevenueThb(entry);
    case 'sales_desc':
      return getVerifiedSalesVolume(entry);
  }
}

/**
 * Computes exact evidence-pool counts before applying user filter selections so
 * shortlist preset controls always display truthful live counts.
 */
export function computeDiscoveryFilterPoolCounts(
  entries: RankedIntelligenceCardItem[],
  filteredCount: number,
  state: DiscoveryFilterState
): DiscoveryFilterPoolCounts {
  let monetizableCount = 0;
  let notMonetizableCount = 0;
  let videoProvenCount = 0;
  let strongEarningsCount = 0;
  let risingTrendCount = 0;

  for (const entry of entries) {
    if (isMonetizableEntry(entry)) {
      monetizableCount += 1;
    } else {
      notMonetizableCount += 1;
    }
    if (isVideoProvenEntry(entry)) videoProvenCount += 1;
    if (isStrongEarningsEntry(entry)) strongEarningsCount += 1;
    if (isRisingTrendEntry(entry)) risingTrendCount += 1;
  }

  return {
    totalCount: entries.length,
    filteredCount,
    monetizableCount,
    notMonetizableCount,
    videoProvenCount,
    strongEarningsCount,
    risingTrendCount,
    activeFilterCount: countActiveDiscoveryFilters(state),
  };
}

/**
 * Pure, deterministic, zero-credit client-side discovery filtering and verified-metric sorting.
 *
 * STRICT GUARDRAILS:
 * - Never alters Commercial Opportunity V2 scores, weights, caps, or Strategy eligibility gates.
 * - Never treats MISSING, STALE, UNAVAILABLE, INVALID, or UNVERIFIED metrics as satisfying
 *   numeric filter thresholds.
 * - Keeps deterministic tie-breaking by original intelligence rank and productId.
 */
export function applyDiscoveryFiltersAndSort(
  entries: RankedIntelligenceCardItem[],
  state: DiscoveryFilterState
): DiscoveryFilterResult {
  const filtered = entries.filter((entry) => {
    if (!matchesPreset(entry, state.preset)) return false;

    if (state.minCommissionPct !== null) {
      const rate = getVerifiedCommissionRate(entry);
      if (rate === null || rate < state.minCommissionPct) return false;
    }

    if (state.minVideoSharePct !== null) {
      const share = entry.discoveryShortlist.videoRevenueSharePct;
      if (share === null || share < state.minVideoSharePct) return false;
    }

    if (state.priceBand !== 'all') {
      const price = getVerifiedPriceThb(entry);
      if (!matchesPriceBand(price, state.priceBand)) return false;
    }

    return true;
  });

  const sorted =
    state.sortMode === 'intelligence'
      ? filtered.slice()
      : filtered.slice().sort((a, b) => {
          const valA = extractSortValue(a, state.sortMode as Exclude<DiscoverySortMode, 'intelligence'>);
          const valB = extractSortValue(b, state.sortMode as Exclude<DiscoverySortMode, 'intelligence'>);

          if (valA !== null && valB === null) return -1;
          if (valA === null && valB !== null) return 1;
          if (valA !== null && valB !== null && valA !== valB) {
            return valB - valA;
          }

          if (a.rank !== b.rank) return a.rank - b.rank;
          return a.product.id.localeCompare(b.product.id);
        });

  return {
    entries: sorted,
    counts: computeDiscoveryFilterPoolCounts(entries, sorted.length, state),
  };
}
