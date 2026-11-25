import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProductDiscoveryShortlist } from '../src/lib/discoveryShortlist.ts';
import {
  adaptRawKalodataRowToValidatedMetrics,
  computeSyntheticRevenueEstimate,
} from '../src/lib/metricFoundation.ts';
import { buildProductIntelligenceView } from '../src/lib/productIntelligenceView.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import {
  appendObservationSnapshot,
  buildStrategySnapshotsMap,
  createObservationSnapshotFromProduct,
  deriveSnapshotTrend,
  loadProductSnapshotsFromStorage,
  mergeRestoredProductSnapshots,
  recordProductSnapshotsInStorage,
  type StorageLike,
  toStrategyHistoricalSnapshots,
} from '../src/lib/snapshotStore.ts';
import { parseBackupFile } from '../src/lib/storage.ts';
import type {
  ProductItem,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-11-25T10:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

function makeVerifiedMetric(
  value: number,
  unit: ValidatedMetric<number>['unit'],
  fetchedAt = NOW_ISO,
  dateRange = 'last7Day'
): ValidatedMetric<number> {
  return {
    value,
    state: value === 0 ? 'ZERO' : 'OK',
    provenance: 'SOURCE',
    rawInput: value,
    unit,
    fetchedAt,
    dateRange,
    note: null,
  };
}

function makeMissingMetric(
  unit: ValidatedMetric<number>['unit'],
  state: 'MISSING' | 'UNAVAILABLE' = 'MISSING',
  fetchedAt = NOW_ISO
): ValidatedMetric<number> {
  return {
    value: null,
    state,
    provenance: 'SOURCE',
    rawInput: null,
    unit,
    fetchedAt,
    dateRange: 'last7Day',
    note: null,
  };
}

function makeProductItem(
  id: string,
  title: string,
  validatedMetrics: ProductValidatedMetrics
): ProductItem {
  const commercialScoreV2 = evaluateProductCommercialV2(validatedMetrics, { nowMs: NOW_MS });
  return {
    id,
    thaiTitle: title,
    clearTitle: { my: title, en: title },
    whatItIs: { my: title, en: title },
    whySilentWorks: { my: 'Visual demo', en: 'Visual demo' },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်', en: 'Beauty' },
    shopName: 'Test Shop TH',
    priceThb: validatedMetrics.priceThb.value,
    commissionRate: validatedMetrics.commissionRate.value,
    commissionThb: validatedMetrics.commissionThb.value,
    visualTags: [],
    validatedMetrics,
    commercialScoreV2,
    kalodataMetrics: {
      salesVolume7d: validatedMetrics.salesVolume7d.value,
      revenueThb7d: validatedMetrics.revenueThb7d.value,
      videoRevenueThb7d: validatedMetrics.videoRevenueThb7d.value,
      liveRevenueThb7d: validatedMetrics.liveRevenueThb7d.value,
      shoppingMallRevenueThb7d: validatedMetrics.shoppingMallRevenueThb7d?.value ?? null,
      revenueGrowthRate: validatedMetrics.revenueGrowthRate.value,
      creatorCount: validatedMetrics.creatorCount.value,
      rating: validatedMetrics.rating.value,
      reviewCount: validatedMetrics.reviewCount.value,
      dateRange: validatedMetrics.dateRange ?? 'last7Day',
      fetchedAt: validatedMetrics.fetchedAt ?? NOW_ISO,
    },
  };
}

// =========================================================================
// 1. PRODUCT DISCOVERY SHORTLIST — REAL PHASE 9 SANITIZED LIVE SHAPES
// =========================================================================

test('Phase 10 Shortlist: Real Phase 9 live video-led product (INZENT) classifies as Strong Demand + Strong Video Sales (Preliminary) and NEVER low/high competition', () => {
  // Mirrors real live Kalodata TH /detail payload from Phase 9 (product_id 1732462917435950190)
  const validated = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 142,
      commission_rate: 20,
      sales_volumn: 29_360,
      revenue: 4_168_900,
      video_revenue: 3_981_400, // 95.5% video share
      live_revenue: 60_400,
      shopping_mall_revenue: 127_100,
      revenue_growth_rate: 48.2,
      creator_number: 1028, // UNVERIFIED scope from /detail
      product_review_count: 19_236, // UNVERIFIED scope
    },
    {
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: NOW_MS,
    }
  );

  const commercial = evaluateProductCommercialV2(validated, { nowMs: NOW_MS });
  const shortlist = classifyProductDiscoveryShortlist(validated, commercial);

  assert.equal(shortlist.primaryClassification, 'STRONG_DEMAND_STRONG_VIDEO_SALES');
  assert.ok(shortlist.secondarySignals.includes('STRONG_AFFILIATE_EARNINGS'));
  assert.equal(shortlist.isPreliminaryCandidate, true);
  assert.equal(shortlist.competitionEvidenceStatus, 'UNVERIFIED');
  assert.equal(shortlist.videoSalesEvidenceStatus, 'STRONG');
  assert.ok((shortlist.videoRevenueSharePct ?? 0) >= 95);
  assert.notEqual(shortlist.primaryClassification, 'STRONG_DEMAND_LOW_COMPETITION');
  assert.notEqual(shortlist.primaryClassification, 'HIGH_DEMAND_HIGH_COMPETITION');
  assert.match(shortlist.cautionNote, /unverified|preliminary/i);
});

test('Phase 10 Shortlist: Real Phase 9 live/mall-dominant products (Teashell Serum, Whitelab) NEVER classify as Strong Video Sales', () => {
  // Teashell Serum: ฿12.1M rev, only ฿26K video rev (0.2% video share), 84% shopping mall
  const teashellValidated = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 149,
      commission_rate: 15,
      sales_volumn: 81_200,
      revenue: 12_100_000,
      video_revenue: 26_000,
      live_revenue: 1_900_000,
      shopping_mall_revenue: 10_174_000,
      revenue_growth_rate: 12.5,
    },
    { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
  );
  const teashellCommercial = evaluateProductCommercialV2(teashellValidated, { nowMs: NOW_MS });
  const teashellShortlist = classifyProductDiscoveryShortlist(
    teashellValidated,
    teashellCommercial
  );

  assert.notEqual(teashellShortlist.primaryClassification, 'STRONG_DEMAND_STRONG_VIDEO_SALES');
  assert.ok(!teashellShortlist.secondarySignals.includes('STRONG_DEMAND_STRONG_VIDEO_SALES'));
  assert.equal(teashellShortlist.videoSalesEvidenceStatus, 'WEAK');
  assert.equal(teashellShortlist.primaryClassification, 'STRONG_AFFILIATE_EARNINGS');
  assert.equal(teashellShortlist.isPreliminaryCandidate, true);

  // Whitelab Astaxanthin: ฿5.5M rev, ฿253K video rev (4.6% video share), 95% live
  const whitelabValidated = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 390,
      commission_rate: 15,
      sales_volumn: 14_100,
      revenue: 5_500_000,
      video_revenue: 253_000,
      live_revenue: 5_225_000,
      shopping_mall_revenue: 22_000,
      revenue_growth_rate: 18,
    },
    { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
  );
  const whitelabCommercial = evaluateProductCommercialV2(whitelabValidated, { nowMs: NOW_MS });
  const whitelabShortlist = classifyProductDiscoveryShortlist(
    whitelabValidated,
    whitelabCommercial
  );

  assert.notEqual(whitelabShortlist.primaryClassification, 'STRONG_DEMAND_STRONG_VIDEO_SALES');
  assert.equal(whitelabShortlist.videoSalesEvidenceStatus, 'WEAK');
});

test('Phase 10 Shortlist: 0% commission products always return INSUFFICIENT_EVIDENCE with isNotMonetizable=true', () => {
  const ipadValidated = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 11_900,
      commission_rate: 0,
      sales_volumn: 900,
      revenue: 10_710_000,
      video_revenue: 8_000_000,
      live_revenue: 1_000_000,
      shopping_mall_revenue: 1_710_000,
      revenue_growth_rate: 25,
    },
    { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
  );
  const commercial = evaluateProductCommercialV2(ipadValidated, { nowMs: NOW_MS });
  const shortlist = classifyProductDiscoveryShortlist(ipadValidated, commercial);

  assert.equal(shortlist.primaryClassification, 'INSUFFICIENT_EVIDENCE');
  assert.equal(shortlist.isNotMonetizable, true);
  assert.deepEqual(shortlist.secondarySignals, []);
});

test('Phase 10 Shortlist: Verified competition fixtures classify Low Competition, High Competition, and Emerging Opportunity accurately', () => {
  // A) Strong Demand + Verified Low Creator Competition (fully qualified)
  const lowCompValidated: ProductValidatedMetrics = {
    priceThb: makeVerifiedMetric(299, 'THB'),
    commissionRate: makeVerifiedMetric(15, 'PERCENT'),
    commissionThb: makeVerifiedMetric(44.85, 'THB'),
    salesVolume7d: makeVerifiedMetric(2500, 'COUNT'),
    revenueThb7d: makeVerifiedMetric(747_500, 'THB'),
    videoRevenueThb7d: makeVerifiedMetric(550_000, 'THB'),
    liveRevenueThb7d: makeVerifiedMetric(100_000, 'THB'),
    shoppingMallRevenueThb7d: makeVerifiedMetric(97_500, 'THB'),
    revenueGrowthRate: makeVerifiedMetric(42, 'PERCENT'),
    creatorCount: makeVerifiedMetric(14, 'COUNT'),
    rating: makeVerifiedMetric(4.8, 'RATING_5'),
    reviewCount: makeVerifiedMetric(420, 'COUNT'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'detail',
    unresolvedFields: [],
  };
  const lowCompCommercial = evaluateProductCommercialV2(lowCompValidated, { nowMs: NOW_MS });
  const lowCompShortlist = classifyProductDiscoveryShortlist(lowCompValidated, lowCompCommercial);

  assert.equal(lowCompShortlist.primaryClassification, 'STRONG_DEMAND_LOW_COMPETITION');
  assert.equal(lowCompShortlist.isPreliminaryCandidate, false);
  assert.equal(lowCompShortlist.competitionEvidenceStatus, 'VERIFIED_LOW');
  assert.ok(lowCompShortlist.secondarySignals.includes('STRONG_DEMAND_STRONG_VIDEO_SALES'));

  // B) High Demand + Verified Extreme Competition (warns first even if video sales are high!)
  const highCompValidated: ProductValidatedMetrics = {
    ...lowCompValidated,
    creatorCount: makeVerifiedMetric(1800, 'COUNT'),
  };
  const highCompCommercial = evaluateProductCommercialV2(highCompValidated, { nowMs: NOW_MS });
  const highCompShortlist = classifyProductDiscoveryShortlist(
    highCompValidated,
    highCompCommercial
  );

  assert.equal(highCompShortlist.primaryClassification, 'HIGH_DEMAND_HIGH_COMPETITION');
  assert.equal(highCompShortlist.competitionEvidenceStatus, 'VERIFIED_HIGH');
  assert.ok(highCompShortlist.secondarySignals.includes('STRONG_DEMAND_STRONG_VIDEO_SALES'));

  // C) Emerging Opportunity (solid demand 50-64, verified +65% growth, verified low/moderate competition >= 55)
  const emergingValidated: ProductValidatedMetrics = {
    ...lowCompValidated,
    salesVolume7d: makeVerifiedMetric(250, 'COUNT'),
    revenueThb7d: makeVerifiedMetric(74_750, 'THB'),
    videoRevenueThb7d: makeVerifiedMetric(32_000, 'THB'),
    liveRevenueThb7d: makeVerifiedMetric(10_000, 'THB'),
    revenueGrowthRate: makeVerifiedMetric(65, 'PERCENT'),
    creatorCount: makeVerifiedMetric(6, 'COUNT'),
  };
  const emergingCommercial = evaluateProductCommercialV2(emergingValidated, { nowMs: NOW_MS });
  const emergingShortlist = classifyProductDiscoveryShortlist(
    emergingValidated,
    emergingCommercial
  );

  assert.equal(emergingShortlist.primaryClassification, 'EMERGING_OPPORTUNITY');
  assert.equal(emergingShortlist.isPreliminaryCandidate, false);
});

test('Phase 10 Shortlist Guardrail: Unverified creatorCount and missing videoRevenue are NEVER promoted to competition or video-sales categories', () => {
  const unverifiedCompAndNoVideo: ProductValidatedMetrics = {
    priceThb: makeVerifiedMetric(250, 'THB'),
    commissionRate: makeVerifiedMetric(5, 'PERCENT'),
    commissionThb: makeVerifiedMetric(12.5, 'THB'),
    salesVolume7d: makeVerifiedMetric(3000, 'COUNT'),
    revenueThb7d: makeVerifiedMetric(750_000, 'THB'),
    videoRevenueThb7d: makeMissingMetric('THB', 'MISSING'),
    liveRevenueThb7d: makeMissingMetric('THB', 'MISSING'),
    revenueGrowthRate: {
      value: 80,
      state: 'OK',
      provenance: 'SOURCE',
      rawInput: 80,
      unit: 'UNVERIFIED',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      note: 'UNVERIFIED_COMPARISON_PERIOD',
    },
    creatorCount: {
      value: 5,
      state: 'OK',
      provenance: 'SOURCE',
      rawInput: 5,
      unit: 'UNVERIFIED',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      note: 'UNVERIFIED_CREATOR_SCOPE',
    },
    rating: makeMissingMetric('RATING_5', 'UNAVAILABLE'),
    reviewCount: makeMissingMetric('COUNT', 'MISSING'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    unresolvedFields: ['creatorCount', 'rating'],
  };

  const commercial = evaluateProductCommercialV2(unverifiedCompAndNoVideo, { nowMs: NOW_MS });
  const shortlist = classifyProductDiscoveryShortlist(unverifiedCompAndNoVideo, commercial);

  assert.equal(shortlist.primaryClassification, 'INSUFFICIENT_EVIDENCE');
  assert.equal(shortlist.competitionEvidenceStatus, 'UNVERIFIED');
  assert.equal(shortlist.videoSalesEvidenceStatus, 'INSUFFICIENT');
  assert.equal(shortlist.isPreliminaryCandidate, true);
});

// =========================================================================
// 2. HISTORICAL SNAPSHOT FOUNDATION — DEDUP, APPEND-ONLY, QUARANTINE, TRENDS
// =========================================================================

test('Phase 10 Snapshots: Deduplicates identical same-day observations, merges same-day /detail enrichment, and never overwrites prior days', () => {
  const storage = createMemoryStorage();
  const day1Rank = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 142,
      commission_rate: 20,
      sales_volumn: 20_000,
      revenue: 2_840_000,
      video_revenue: 2_600_000,
      live_revenue: 100_000,
      shopping_mall_revenue: 140_000,
      revenue_growth_rate: 25,
    },
    {
      fetchedAt: '2026-11-21T08:00:00.000Z',
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      nowMs: Date.parse('2026-11-21T08:00:00.000Z'),
    }
  );
  const pDay1Rank = makeProductItem('1732462917435950190', 'INZENT Vit C', day1Rank);

  // First record on Day 1
  const r1 = recordProductSnapshotsInStorage([pDay1Rank], { storage });
  assert.equal(r1.addedCount, 1);
  assert.equal(r1.snapshotsByProductId['1732462917435950190'].length, 1);

  // Identical re-record on Day 1 -> deduplicated (no overwrite, no duplicate)
  const r2 = recordProductSnapshotsInStorage([pDay1Rank], { storage });
  assert.equal(r2.addedCount, 0);
  assert.equal(r2.updatedCount, 0);
  assert.equal(r2.deduplicatedCount, 1);
  assert.equal(r2.snapshotsByProductId['1732462917435950190'].length, 1);

  // Same-day /detail enrichment merges into Day 1 without duplicating day and keeps unverified creatorCount quarantined
  const day1Detail = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 142,
      commission_rate: 20,
      sales_volumn: 20_000,
      revenue: 2_840_000,
      video_revenue: 2_600_000,
      live_revenue: 100_000,
      shopping_mall_revenue: 140_000,
      revenue_growth_rate: 25,
      creator_number: 1028, // UNVERIFIED scope
    },
    {
      fetchedAt: '2026-11-21T12:00:00.000Z',
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: Date.parse('2026-11-21T12:00:00.000Z'),
    }
  );
  const pDay1Detail = makeProductItem('1732462917435950190', 'INZENT Vit C', day1Detail);
  const r3 = recordProductSnapshotsInStorage([pDay1Detail], { storage });
  assert.equal(r3.addedCount, 0);
  assert.equal(r3.updatedCount, 1);
  const day1Record = r3.snapshotsByProductId['1732462917435950190'][0];
  assert.equal(day1Record.sourceEndpoint, 'detail');
  assert.equal(day1Record.observations.creatorCountVerified, null);
  assert.equal(day1Record.observations.creatorCountUnverifiedRaw, 1028);

  // Day 3 observation appends cleanly without overwriting Day 1
  const day3Rank = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 142,
      commission_rate: 20,
      sales_volumn: 29_360,
      revenue: 4_168_900,
      video_revenue: 3_981_400,
      live_revenue: 60_400,
      shopping_mall_revenue: 127_100,
      revenue_growth_rate: 48.2,
    },
    {
      fetchedAt: '2026-11-23T09:00:00.000Z',
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      nowMs: Date.parse('2026-11-23T09:00:00.000Z'),
    }
  );
  const pDay3 = makeProductItem('1732462917435950190', 'INZENT Vit C', day3Rank);
  const r4 = recordProductSnapshotsInStorage([pDay3], { storage });
  assert.equal(r4.addedCount, 1);

  const loaded = loadProductSnapshotsFromStorage(storage)['1732462917435950190'];
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].observationDay, '2026-11-21');
  assert.equal(loaded[0].observations.revenueThb, 2_840_000);
  assert.equal(loaded[1].observationDay, '2026-11-23');
  assert.equal(loaded[1].observations.revenueThb, 4_168_900);

  // Verify strategy snapshot adapter NEVER leaks unverified creator_number or unverified growth
  const strategySnaps = toStrategyHistoricalSnapshots(loaded);
  assert.equal(strategySnaps.length, 2);
  assert.equal(strategySnaps[0].creatorCount, undefined);
  assert.equal(strategySnaps[0].revenueGrowthRate, undefined);
  assert.equal(strategySnaps[0].revenueThb7d?.value, 2_840_000);

  // Verify derived trend is explicitly marked DERIVED and leaves verifiedCreatorDeltaPct null
  const trend = deriveSnapshotTrend(loaded);
  assert.ok(trend);
  assert.equal(trend.provenance, 'DERIVED');
  assert.equal(trend.observationCount, 2);
  assert.ok((trend.revenueDeltaPct ?? 0) > 45);
  assert.equal(trend.verifiedCreatorDeltaPct, null);
});

test('Phase 10 Snapshots: Rejects SYNTHETIC revenue from SOURCE observations and unlocks longitudinal strategies ONLY with real verified multi-day history', () => {
  const baseValidated = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 200,
      commission_rate: 12,
      sales_volumn: 500,
    },
    { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
  );
  const syntheticValidated: ProductValidatedMetrics = {
    ...baseValidated,
    revenueThb7d: computeSyntheticRevenueEstimate(
      baseValidated.priceThb,
      baseValidated.salesVolume7d
    ),
  };
  assert.equal(syntheticValidated.revenueThb7d.provenance, 'SYNTHETIC');
  const syntheticProduct = makeProductItem('syn_1', 'Synthetic Rev Item', syntheticValidated);
  const synSnap = createObservationSnapshotFromProduct(syntheticProduct);
  assert.ok(synSnap);
  assert.equal(synSnap.observations.revenueThb, null);
  assert.equal(synSnap.observations.salesVolume, 500);

  // Multi-day verified snapshots unlock fast_rising_products and trend_timing_opportunity cleanly
  const makeVerifiedDayProduct = (
    iso: string,
    revenue: number,
    sales: number,
    creators: number
  ): ProductItem => {
    const vm: ProductValidatedMetrics = {
      priceThb: makeVerifiedMetric(250, 'THB', iso),
      commissionRate: makeVerifiedMetric(15, 'PERCENT', iso),
      commissionThb: makeVerifiedMetric(37.5, 'THB', iso),
      salesVolume7d: makeVerifiedMetric(sales, 'COUNT', iso),
      revenueThb7d: makeVerifiedMetric(revenue, 'THB', iso),
      videoRevenueThb7d: makeVerifiedMetric(Math.round(revenue * 0.7), 'THB', iso),
      liveRevenueThb7d: makeVerifiedMetric(Math.round(revenue * 0.15), 'THB', iso),
      shoppingMallRevenueThb7d: makeVerifiedMetric(Math.round(revenue * 0.15), 'THB', iso),
      revenueGrowthRate: makeVerifiedMetric(55, 'PERCENT', iso),
      creatorCount: makeVerifiedMetric(creators, 'COUNT', iso),
      rating: makeVerifiedMetric(4.7, 'RATING_5', iso),
      reviewCount: makeVerifiedMetric(210, 'COUNT', iso),
      fetchedAt: iso,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      unresolvedFields: [],
    };
    return makeProductItem('rising_1', 'Verified Rising Item', vm);
  };

  const p1 = makeVerifiedDayProduct('2026-11-21T10:00:00.000Z', 120_000, 480, 12);
  const p2 = makeVerifiedDayProduct('2026-11-23T10:00:00.000Z', 180_000, 720, 13);
  const p3 = makeVerifiedDayProduct('2026-11-25T10:00:00.000Z', 360_000, 1440, 14);

  let historyList = appendObservationSnapshot(
    [],
    createObservationSnapshotFromProduct(p1)!
  ).snapshots;

  // With only 1 snapshot, fast_rising_products remains DATA_UNAVAILABLE
  const view1 = buildProductIntelligenceView([p3], 'fast_rising_products', {
    nowMs: NOW_MS,
    historicalSnapshotsByProductId: buildStrategySnapshotsMap({ rising_1: historyList }),
  });
  assert.equal(view1.rankedEntries.length, 0);
  assert.equal(view1.isHistoricalDataUnavailable, true);

  // Add Day 3 and Day 5 genuine observations -> unlocks both fast_rising_products and trend_timing_opportunity
  historyList = appendObservationSnapshot(
    historyList,
    createObservationSnapshotFromProduct(p2)!
  ).snapshots;
  historyList = appendObservationSnapshot(
    historyList,
    createObservationSnapshotFromProduct(p3)!
  ).snapshots;

  const snapMap = buildStrategySnapshotsMap({ rising_1: historyList });
  const viewFastRising = buildProductIntelligenceView([p3], 'fast_rising_products', {
    nowMs: NOW_MS,
    historicalSnapshotsByProductId: snapMap,
  });
  assert.equal(viewFastRising.rankedEntries.length, 1);
  assert.equal(viewFastRising.rankedEntries[0].snapshotCount, 3);

  const viewTrendTiming = buildProductIntelligenceView([p3], 'trend_timing_opportunity', {
    nowMs: NOW_MS,
    historicalSnapshotsByProductId: snapMap,
  });
  assert.equal(viewTrendTiming.rankedEntries.length, 1);
  assert.equal(viewTrendTiming.rankedEntries[0].product.id, 'rising_1');
});

test('Phase 10 Backup Round-Trip: parseBackupFile v5 restores productSnapshots cleanly and preserves backward compatibility with v4', () => {
  const storage = createMemoryStorage();
  const vm = adaptRawKalodataRowToValidatedMetrics(
    {
      price: 199,
      commission_rate: 15,
      sales_volumn: 1000,
      revenue: 199_000,
      video_revenue: 150_000,
    },
    {
      fetchedAt: '2026-11-22T10:00:00.000Z',
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      nowMs: Date.parse('2026-11-22T10:00:00.000Z'),
    }
  );
  const snap = createObservationSnapshotFromProduct(makeProductItem('bk_1', 'Backup Item', vm))!;

  const v5Json = JSON.stringify({
    app: 'SiamVisual',
    version: 5,
    exportedAt: NOW_ISO,
    entries: [],
    productSnapshots: {
      bk_1: [snap],
    },
  });

  const parsedV5 = parseBackupFile(v5Json);
  assert.ok(parsedV5);
  assert.equal(parsedV5.productSnapshots?.bk_1?.length, 1);

  const merged = mergeRestoredProductSnapshots({}, parsedV5.productSnapshots!, storage);
  assert.equal(merged.addedSnapshots, 1);
  assert.equal(loadProductSnapshotsFromStorage(storage).bk_1?.length, 1);

  // Backward compatibility: v4 backup without productSnapshots still parses cleanly
  const v4Json = JSON.stringify({
    app: 'SiamVisual',
    version: 4,
    exportedAt: NOW_ISO,
    entries: [],
  });
  const parsedV4 = parseBackupFile(v4Json);
  assert.ok(parsedV4);
  assert.equal(parsedV4.productSnapshots, undefined);
});
