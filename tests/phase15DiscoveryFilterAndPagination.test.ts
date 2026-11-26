import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKalodataRankCacheKey,
  normalizeKalodataDateRange,
  normalizeKalodataPageNumber,
  parseRawProductRow,
} from '../server/kalodata.ts';
import {
  applyDiscoveryFiltersAndSort,
  DEFAULT_DISCOVERY_FILTER_STATE,
  isDefaultDiscoveryFilterState,
} from '../src/lib/discoveryFilterEngine.ts';
import { buildProductIntelligenceView } from '../src/lib/productIntelligenceView.ts';
import type {
  ProductItem,
  ProductObservationSnapshot,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-04-20T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function makeMetric(
  value: number | null,
  unit: ValidatedMetric<number>['unit'],
  state: ValidatedMetric<number>['state'] = value === 0 ? 'ZERO' : value === null ? 'MISSING' : 'OK',
  fetchedAt: string | null = NOW_ISO
): ValidatedMetric<number> {
  return {
    value,
    state,
    provenance: 'SOURCE',
    rawInput: value,
    unit,
    fetchedAt,
    dateRange: 'last7Day',
    note: null,
    sourceEndpoint: 'rank',
  };
}

function makeProduct(opts: {
  id: string;
  priceThb: number | null;
  commissionRate: number | null;
  commissionState?: ValidatedMetric<number>['state'];
  commissionUnit?: ValidatedMetric<number>['unit'];
  revenueThb7d: number | null;
  salesVolume7d: number | null;
  videoRevenueThb7d: number | null;
  liveRevenueThb7d?: number | null;
}): ProductItem {
  const commissionRateState =
    opts.commissionState ??
    (opts.commissionRate === 0 ? 'ZERO' : opts.commissionRate === null ? 'MISSING' : 'OK');
  const commissionUnit = opts.commissionUnit ?? 'PERCENT';
  const payout =
    opts.priceThb !== null &&
    opts.commissionRate !== null &&
    commissionRateState !== 'STALE' &&
    commissionUnit === 'PERCENT'
      ? Math.round(opts.priceThb * (opts.commissionRate / 100) * 100) / 100
      : null;

  const validated: ProductValidatedMetrics = {
    priceThb: makeMetric(opts.priceThb, 'THB'),
    commissionRate: makeMetric(opts.commissionRate, commissionUnit, commissionRateState),
    commissionThb: {
      value: payout,
      state: payout === 0 ? 'ZERO' : payout === null ? 'MISSING' : 'OK',
      provenance: 'SYNTHETIC',
      rawInput: payout,
      unit: 'THB',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      note: 'Derived payout',
      sourceEndpoint: 'rank',
    },
    salesVolume7d: makeMetric(opts.salesVolume7d, 'COUNT'),
    revenueThb7d: makeMetric(opts.revenueThb7d, 'THB'),
    videoRevenueThb7d: makeMetric(opts.videoRevenueThb7d, 'THB'),
    liveRevenueThb7d: makeMetric(opts.liveRevenueThb7d ?? 0, 'THB'),
    shoppingMallRevenueThb7d: makeMetric(0, 'THB'),
    revenueGrowthRate: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    creatorCount: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    rating: makeMetric(null, 'RATING_5', 'UNAVAILABLE'),
    reviewCount: makeMetric(null, 'COUNT', 'UNAVAILABLE'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    unresolvedFields: [],
  };

  return {
    id: opts.id,
    thaiTitle: `Product ${opts.id}`,
    clearTitle: { en: `Product ${opts.id}`, my: `ပစ္စည်း ${opts.id}` },
    whatItIs: { en: 'Sample item', my: 'နမူနာပစ္စည်း' },
    whySilentWorks: { en: 'Clear visual demo', my: 'မြင်သာသည်' },
    category: 'beauty',
    categoryLabel: { en: 'Beauty', my: 'အလှကုန်' },
    shopName: 'TH Shop',
    priceThb: opts.priceThb,
    commissionRate: opts.commissionRate,
    commissionThb: payout,
    visualTags: ['Before/After'],
    kalodataMetrics: {
      salesVolume7d: opts.salesVolume7d,
      revenueThb7d: opts.revenueThb7d,
      videoRevenueThb7d: opts.videoRevenueThb7d,
      liveRevenueThb7d: opts.liveRevenueThb7d ?? 0,
      dateRange: 'last7Day',
      fetchedAt: NOW_ISO,
    },
    validatedMetrics: validated,
  };
}

function makeSnapshot(
  productId: string,
  observedAt: string,
  revenueThb: number,
  salesVolume: number
): ProductObservationSnapshot {
  return {
    snapshotVersion: 1,
    productId,
    observedAt,
    observationDay: observedAt.slice(0, 10),
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    trustStatus: 'LOCAL_OBSERVED',
    dataConfidenceScore: 60,
    dataConfidenceLevel: 'MEDIUM',
    observations: {
      revenueThb,
      salesVolume,
      videoRevenueThb: Math.round(revenueThb * 0.6),
      liveRevenueThb: Math.round(revenueThb * 0.4),
      shoppingMallRevenueThb: 0,
      unitPriceThb: 250,
      commissionRate: 15,
      revenueGrowthRate: null,
      revenueGrowthVerified: false,
      creatorCountVerified: null,
      creatorCountUnverifiedRaw: null,
    },
  };
}

test('Phase 15: shortlist presets accurately isolate monetizable, video-proven, high-earnings, and rising-trend products', () => {
  const products = [
    // P1: Video proven + High earnings + Rising multi-day local trend (price 250, 18% comm -> 45 THB payout, 80% video)
    makeProduct({
      id: 'p_video_rising',
      priceThb: 250,
      commissionRate: 18,
      revenueThb7d: 500_000,
      salesVolume7d: 2000,
      videoRevenueThb7d: 400_000,
      liveRevenueThb7d: 100_000,
    }),
    // P2: High ticket high earnings (price 1500, 10% comm -> 150 THB payout), Live-driven (5% video)
    makeProduct({
      id: 'p_live_high_payout',
      priceThb: 1500,
      commissionRate: 10,
      revenueThb7d: 600_000,
      salesVolume7d: 400,
      videoRevenueThb7d: 30_000,
      liveRevenueThb7d: 570_000,
    }),
    // P3: 0% commission non-monetizable (even with massive video revenue!)
    makeProduct({
      id: 'p_zero_comm',
      priceThb: 900,
      commissionRate: 0,
      revenueThb7d: 2_000_000,
      salesVolume7d: 2222,
      videoRevenueThb7d: 1_800_000,
      liveRevenueThb7d: 200_000,
    }),
    // P4: Low commission (4%), mid price (450)
    makeProduct({
      id: 'p_low_comm',
      priceThb: 450,
      commissionRate: 4,
      revenueThb7d: 90_000,
      salesVolume7d: 200,
      videoRevenueThb7d: 30_000,
      liveRevenueThb7d: 60_000,
    }),
  ];

  const snapshots: Record<string, ProductObservationSnapshot[]> = {
    p_video_rising: [
      makeSnapshot('p_video_rising', '2026-04-16T10:00:00.000Z', 300_000, 1200),
      makeSnapshot('p_video_rising', '2026-04-19T10:00:00.000Z', 500_000, 2000),
    ],
  };

  const view = buildProductIntelligenceView(products, 'overall', {
    nowMs: NOW_MS,
    observationSnapshotsByProductId: snapshots,
  });

  // Default state returns all 4 with accurate live counts
  const allRes = applyDiscoveryFiltersAndSort(view.rankedEntries, DEFAULT_DISCOVERY_FILTER_STATE);
  assert.equal(isDefaultDiscoveryFilterState(DEFAULT_DISCOVERY_FILTER_STATE), true);
  assert.equal(allRes.entries.length, 4);
  assert.equal(allRes.counts.monetizableCount, 3);
  assert.equal(allRes.counts.notMonetizableCount, 1);
  assert.equal(allRes.counts.risingTrendCount, 1);

  // monetizable_only hides p_zero_comm
  const monRes = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    preset: 'monetizable_only',
  });
  assert.equal(monRes.entries.length, 3);
  assert.ok(!monRes.entries.some((e) => e.product.id === 'p_zero_comm'));

  // video_proven excludes 0% commission even though p_zero_comm has 1.8M video revenue!
  const videoRes = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    preset: 'video_proven',
  });
  assert.ok(videoRes.entries.some((e) => e.product.id === 'p_video_rising'));
  assert.ok(!videoRes.entries.some((e) => e.product.id === 'p_zero_comm'));
  assert.ok(!videoRes.entries.some((e) => e.product.id === 'p_live_high_payout'));

  // strong_earnings captures p_video_rising and p_live_high_payout, never p_zero_comm or p_low_comm
  const earnRes = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    preset: 'strong_earnings',
  });
  assert.deepEqual(
    earnRes.entries.map((e) => e.product.id).sort(),
    ['p_live_high_payout', 'p_video_rising']
  );

  // rising_trend returns strictly locally observed Phase 14 RISING product
  const risingRes = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    preset: 'rising_trend',
  });
  assert.deepEqual(
    risingRes.entries.map((e) => e.product.id),
    ['p_video_rising']
  );
});

test('Phase 15: local numeric filters reject missing, unverified, and stale metrics and never alter commercialScore', () => {
  const products = [
    makeProduct({
      id: 'p_verified_12',
      priceThb: 280,
      commissionRate: 12,
      revenueThb7d: 200_000,
      salesVolume7d: 714,
      videoRevenueThb7d: 120_000, // 60% video share
      liveRevenueThb7d: 80_000,
    }),
    makeProduct({
      id: 'p_unverified_comm',
      priceThb: 280,
      commissionRate: 20,
      commissionUnit: 'UNVERIFIED',
      revenueThb7d: 200_000,
      salesVolume7d: 714,
      videoRevenueThb7d: 120_000,
    }),
    makeProduct({
      id: 'p_stale_comm',
      priceThb: 280,
      commissionRate: 25,
      commissionState: 'STALE',
      revenueThb7d: 200_000,
      salesVolume7d: 714,
      videoRevenueThb7d: 120_000,
    }),
    makeProduct({
      id: 'p_expensive',
      priceThb: 1400,
      commissionRate: 15,
      revenueThb7d: 280_000,
      salesVolume7d: 200,
      videoRevenueThb7d: 150_000, // 53.6% video share
    }),
  ];

  const view = buildProductIntelligenceView(products, 'overall', { nowMs: NOW_MS });
  const beforeScores = view.rankedEntries.map((e) => e.commercialScore);

  // minCommissionPct >= 10 + priceBand under_300 + minVideoSharePct >= 50 -> ONLY p_verified_12
  const filtered = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    preset: 'all',
    minCommissionPct: 10,
    minVideoSharePct: 50,
    priceBand: 'under_300',
    sortMode: 'intelligence',
  });
  assert.deepEqual(
    filtered.entries.map((e) => e.product.id),
    ['p_verified_12']
  );

  // over_1000 price band isolates p_expensive
  const over1k = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    priceBand: 'over_1000',
  });
  assert.deepEqual(
    over1k.entries.map((e) => e.product.id),
    ['p_expensive']
  );

  // Original rankedEntries and commercialScore objects are 100% untouched
  assert.deepEqual(
    view.rankedEntries.map((e) => e.commercialScore),
    beforeScores
  );
});

test('Phase 15: all 6 verified-metric sort modes order deterministically with missing/0%-comm safely sunk', () => {
  const products = [
    makeProduct({
      id: 'a_high_rev',
      priceThb: 100,
      commissionRate: 5, // payout 5 THB
      revenueThb7d: 900_000,
      salesVolume7d: 9000,
      videoRevenueThb7d: 100_000,
    }),
    makeProduct({
      id: 'b_high_video',
      priceThb: 200,
      commissionRate: 20, // payout 40 THB
      revenueThb7d: 500_000,
      salesVolume7d: 2500,
      videoRevenueThb7d: 450_000,
    }),
    makeProduct({
      id: 'c_high_payout',
      priceThb: 1200,
      commissionRate: 12, // payout 144 THB
      revenueThb7d: 360_000,
      salesVolume7d: 300,
      videoRevenueThb7d: 50_000,
    }),
    makeProduct({
      id: 'd_zero_comm',
      priceThb: 2000,
      commissionRate: 0, // NOT_MONETIZABLE -> payout excluded from top
      revenueThb7d: 100_000,
      salesVolume7d: 50,
      videoRevenueThb7d: null, // missing video rev sinks to bottom
    }),
  ];

  const view = buildProductIntelligenceView(products, 'overall', { nowMs: NOW_MS });

  const byVideoRev = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'video_revenue_desc',
  });
  assert.deepEqual(
    byVideoRev.entries.map((e) => e.product.id),
    ['b_high_video', 'a_high_rev', 'c_high_payout', 'd_zero_comm']
  );

  const byPayout = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'payout_desc',
  });
  assert.deepEqual(
    byPayout.entries.map((e) => e.product.id),
    ['c_high_payout', 'b_high_video', 'a_high_rev', 'd_zero_comm']
  );

  const byCommission = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'commission_desc',
  });
  assert.deepEqual(
    byCommission.entries.map((e) => e.product.id),
    ['b_high_video', 'c_high_payout', 'a_high_rev', 'd_zero_comm']
  );

  const byRevenue = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'revenue_desc',
  });
  assert.deepEqual(
    byRevenue.entries.map((e) => e.product.id),
    ['a_high_rev', 'b_high_video', 'c_high_payout', 'd_zero_comm']
  );

  const bySales = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'sales_desc',
  });
  assert.deepEqual(
    bySales.entries.map((e) => e.product.id),
    ['a_high_rev', 'b_high_video', 'c_high_payout', 'd_zero_comm']
  );
});

test('Phase 15: pagination normalization, cache-key isolation, and dateRange propagation work with 0 live API calls', () => {
  assert.equal(normalizeKalodataPageNumber(undefined), 1);
  assert.equal(normalizeKalodataPageNumber(0), 1);
  assert.equal(normalizeKalodataPageNumber(-5), 1);
  assert.equal(normalizeKalodataPageNumber(2.9), 2);
  assert.equal(normalizeKalodataPageNumber(99), 10);

  assert.equal(normalizeKalodataDateRange(undefined), 'last7Day');
  assert.equal(normalizeKalodataDateRange('last7Day'), 'last7Day');
  assert.equal(normalizeKalodataDateRange('last30Day'), 'last30Day');
  assert.equal(normalizeKalodataDateRange('invalid'), 'last7Day');

  const keyP1 = buildKalodataRankCacheKey({
    keyPrefix: 'abc123',
    cateIds: ['601450', '600001'],
    query: 'Lip Tint',
    pageNumber: 1,
    dateRange: 'last7Day',
  });
  const keyP2 = buildKalodataRankCacheKey({
    keyPrefix: 'abc123',
    cateIds: ['600001', '601450'],
    query: 'lip tint',
    pageNumber: 2,
    dateRange: 'last7Day',
  });
  const key30d = buildKalodataRankCacheKey({
    keyPrefix: 'abc123',
    cateIds: ['601450', '600001'],
    query: 'lip tint',
    pageNumber: 1,
    dateRange: 'last30Day',
  });
  assert.notEqual(keyP1, keyP2);
  assert.notEqual(keyP1, key30d);

  // dateRange propagates cleanly into kalodataMetrics and validatedMetrics
  const parsed30d = parseRawProductRow(
    {
      product_id: '173999000111',
      product_name: '30d Test Serum',
      unit_price: 299,
      commission_rate: 15,
      revenue: 180_000,
      sales_volumn: 600,
    },
    'fallback_30d',
    'rank',
    NOW_ISO,
    { dateRange: 'last30Day', nowMs: NOW_MS }
  );
  assert.ok(parsed30d);
  assert.equal(parsed30d.kalodataMetrics.dateRange, 'last30Day');
  assert.equal(parsed30d.validatedMetrics.dateRange, 'last30Day');
  assert.equal(parsed30d.validatedMetrics.revenueThb7d.dateRange, 'last30Day');
});
