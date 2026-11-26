import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeProductHistoricalTrends,
  buildHistoricalTrendsMap,
  HISTORICAL_TREND_METRIC_KEYS,
} from '../src/lib/historicalTrendIntelligence.ts';
import { buildProductEvidenceSummary } from '../src/lib/productEvidenceSummary.ts';
import { buildProductIntelligenceView } from '../src/lib/productIntelligenceView.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import {
  appendObservationSnapshot,
  createObservationSnapshotFromProduct,
  sanitizeImportedProductSnapshotsMap,
} from '../src/lib/snapshotStore.ts';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2.ts';
import type {
  ProductItem,
  ProductObservationSnapshot,
  ProductSourceObservationValues,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-04-20T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function makeSnapshot(overrides: {
  productId?: string;
  observedAt: string;
  dateRange?: string;
  sourceEndpoint?: ProductObservationSnapshot['sourceEndpoint'];
  trustStatus?: ProductObservationSnapshot['trustStatus'];
  observations?: Partial<ProductSourceObservationValues>;
  metricMeta?: ProductObservationSnapshot['metricMeta'];
}): ProductObservationSnapshot {
  const observedAt = overrides.observedAt;
  return {
    snapshotVersion: 1,
    productId: overrides.productId ?? 'prod_14_01',
    observedAt,
    observationDay: observedAt.slice(0, 10),
    dateRange: overrides.dateRange ?? 'last7Day',
    sourceEndpoint: overrides.sourceEndpoint ?? 'rank',
    trustStatus: overrides.trustStatus ?? 'LOCAL_OBSERVED',
    dataConfidenceScore: 68,
    dataConfidenceLevel: 'MEDIUM',
    observations: {
      revenueThb: 100_000,
      salesVolume: 500,
      videoRevenueThb: 40_000,
      liveRevenueThb: 30_000,
      shoppingMallRevenueThb: 30_000,
      unitPriceThb: 200,
      commissionRate: 12,
      revenueGrowthRate: null,
      revenueGrowthVerified: false,
      creatorCountVerified: null,
      creatorCountUnverifiedRaw: null,
      ...(overrides.observations ?? {}),
    },
    ...(overrides.metricMeta ? { metricMeta: overrides.metricMeta } : {}),
  };
}

function makeMetric(
  value: number | null,
  unit: ValidatedMetric<number>['unit'],
  state: ValidatedMetric<number>['state'] = value === 0 ? 'ZERO' : value === null ? 'MISSING' : 'OK',
  sourceEndpoint: ValidatedMetric<number>['sourceEndpoint'] = 'rank',
  fetchedAt: string | null = NOW_ISO,
  dateRange: string | null = 'last7Day'
): ValidatedMetric<number> {
  return {
    value,
    state,
    provenance: 'SOURCE',
    rawInput: value,
    unit,
    fetchedAt,
    dateRange,
    note: null,
    sourceEndpoint,
  };
}

function makeValidatedProduct(overrides?: Partial<ProductValidatedMetrics>): ProductValidatedMetrics {
  return {
    priceThb: makeMetric(250, 'THB'),
    commissionRate: makeMetric(15, 'PERCENT'),
    commissionThb: makeMetric(37.5, 'THB'),
    salesVolume7d: makeMetric(600, 'COUNT'),
    revenueThb7d: makeMetric(150_000, 'THB'),
    videoRevenueThb7d: makeMetric(90_000, 'THB'),
    liveRevenueThb7d: makeMetric(35_000, 'THB'),
    shoppingMallRevenueThb7d: makeMetric(25_000, 'THB'),
    revenueGrowthRate: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    creatorCount: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    rating: makeMetric(null, 'RATING_5', 'UNAVAILABLE'),
    reviewCount: makeMetric(null, 'COUNT', 'UNAVAILABLE'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    unresolvedFields: [],
    ...(overrides ?? {}),
  };
}

function makeProductItem(validated: ProductValidatedMetrics): ProductItem {
  return {
    id: 'prod_14_01',
    thaiTitle: 'ลิปทินท์เนื้อแมตต์ 10ml',
    clearTitle: { en: 'Thai Matte Lip Tint 10ml', my: 'မတ်လစ်တင့် ၁၀ မီလီ' },
    whatItIs: { en: 'Matte lip tint', my: 'နှုတ်ခမ်းနီတင့်' },
    whySilentWorks: { en: 'Clear swatch reveal', my: 'အရောင်ပြသမှု ရှင်းလင်းသည်' },
    category: 'beauty',
    categoryLabel: { en: 'Beauty & Personal Care', my: 'အလှကုန်' },
    shopName: 'Siam Beauty Official',
    priceThb: validated.priceThb.value ?? null,
    commissionRate: validated.commissionRate.value ?? null,
    commissionThb: validated.commissionThb.value ?? null,
    imageUrl: 'https://example.com/lip-tint.jpg',
    visualTags: ['Before/After', 'Swatches'],
    kalodataMetrics: {
      salesVolume7d: validated.salesVolume7d.value,
      revenueThb7d: validated.revenueThb7d.value,
      videoRevenueThb7d: validated.videoRevenueThb7d.value,
      liveRevenueThb7d: validated.liveRevenueThb7d.value,
      shoppingMallRevenueThb7d: validated.shoppingMallRevenueThb7d?.value ?? null,
      dateRange: validated.dateRange ?? 'last7Day',
      fetchedAt: validated.fetchedAt ?? NOW_ISO,
    },
    validatedMetrics: validated,
  };
}

test('Phase 14: snapshot capture stores unitPriceThb, rejects UNVERIFIED unit, and preserves backward compatibility', () => {
  const validated = makeValidatedProduct({
    fetchedAt: '2026-04-18T10:00:00.000Z',
    priceThb: makeMetric(250, 'THB', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    commissionRate: makeMetric(15, 'PERCENT', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    salesVolume7d: makeMetric(600, 'COUNT', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    revenueThb7d: makeMetric(150_000, 'THB', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    videoRevenueThb7d: makeMetric(90_000, 'THB', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    liveRevenueThb7d: makeMetric(35_000, 'THB', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
    shoppingMallRevenueThb7d: makeMetric(25_000, 'THB', 'OK', 'rank', '2026-04-18T10:00:00.000Z'),
  });
  const product = makeProductItem(validated);
  const snap = createObservationSnapshotFromProduct(product, { nowMs: NOW_MS });
  assert.ok(snap);
  assert.equal(snap.observations.unitPriceThb, 250);
  assert.equal(snap.metricMeta?.unitPriceThb?.unit, 'THB');
  assert.equal(snap.metricMeta?.revenueThb?.unit, 'THB');
  assert.equal(snap.metricMeta?.salesVolume?.unit, 'COUNT');
  assert.equal(snap.metricMeta?.commissionRate?.unit, 'PERCENT');

  // Unverified unit price must NOT be persisted as a verified numeric observation
  const sameDayLater = '2026-04-18T11:00:00.000Z';
  const unverifiedPriceValidated = makeValidatedProduct({
    fetchedAt: sameDayLater,
    priceThb: makeMetric(250, 'UNVERIFIED', 'OK', 'rank', sameDayLater),
    commissionRate: makeMetric(15, 'PERCENT', 'OK', 'rank', sameDayLater),
    commissionThb: makeMetric(37.5, 'THB', 'OK', 'rank', sameDayLater),
    salesVolume7d: makeMetric(610, 'COUNT', 'OK', 'rank', sameDayLater),
    revenueThb7d: makeMetric(152_000, 'THB', 'OK', 'rank', sameDayLater),
    videoRevenueThb7d: makeMetric(91_000, 'THB', 'OK', 'rank', sameDayLater),
    liveRevenueThb7d: makeMetric(36_000, 'THB', 'OK', 'rank', sameDayLater),
    shoppingMallRevenueThb7d: makeMetric(25_000, 'THB', 'OK', 'rank', sameDayLater),
  });
  const snapUnverified = createObservationSnapshotFromProduct(
    makeProductItem(unverifiedPriceValidated),
    { nowMs: NOW_MS }
  );
  assert.ok(snapUnverified);
  assert.equal(snapUnverified.observations.unitPriceThb, null);

  // Same-day merge preserves unitPriceThb from earlier observation if later snapshot lacks it
  const firstAppend = appendObservationSnapshot([], snap, 30, { nowMs: NOW_MS });
  assert.equal(firstAppend.added, true);
  const secondAppend = appendObservationSnapshot(firstAppend.snapshots, snapUnverified, 30, { nowMs: NOW_MS });
  assert.equal(secondAppend.snapshots.length, 1);
  assert.equal(secondAppend.snapshots[0].observations.unitPriceThb, 250);

  // Reject empty productId or dateRange cleanly
  const badIdRes = appendObservationSnapshot([], { ...snap, productId: '   ' }, 30, { nowMs: NOW_MS });
  assert.equal(badIdRes.snapshots.length, 0);
  assert.match(badIdRes.rejectedReason ?? '', /productId/i);
  const badDateRangeRes = appendObservationSnapshot([], { ...snap, dateRange: '' }, 30, { nowMs: NOW_MS });
  assert.equal(badDateRangeRes.snapshots.length, 0);
  assert.match(badDateRangeRes.rejectedReason ?? '', /dateRange/i);

  // Backward compatibility: pre-Phase 14 snapshots without unitPriceThb still analyze other 6 metrics cleanly
  const legacySnap1 = makeSnapshot({ observedAt: '2026-04-15T10:00:00.000Z' });
  delete legacySnap1.observations.unitPriceThb;
  const legacySnap2 = makeSnapshot({
    observedAt: '2026-04-18T10:00:00.000Z',
    observations: { revenueThb: 140_000, salesVolume: 700 },
  });
  delete legacySnap2.observations.unitPriceThb;

  const report = analyzeProductHistoricalTrends([legacySnap1, legacySnap2], {
    productId: 'prod_14_01',
    nowMs: NOW_MS,
  });
  assert.equal(report.metrics.revenue.classification, 'RISING');
  assert.equal(report.metrics.salesVolume.classification, 'RISING');
  assert.equal(report.metrics.unitPrice.classification, 'INSUFFICIENT_HISTORY');
  assert.equal(report.metrics.unitPrice.pointCount, 0);
});

test('Phase 14: classifies all 7 metrics across RISING, STABLE, DECLINING, and VOLATILE deterministically', () => {
  const s1 = makeSnapshot({
    observedAt: '2026-04-14T10:00:00.000Z',
    observations: {
      revenueThb: 100_000,
      salesVolume: 500,
      videoRevenueThb: 40_000,
      liveRevenueThb: 40_000,
      shoppingMallRevenueThb: 20_000,
      unitPriceThb: 200,
      commissionRate: 10,
    },
  });
  const s2 = makeSnapshot({
    observedAt: '2026-04-16T10:00:00.000Z',
    observations: {
      revenueThb: 120_000,
      salesVolume: 590,
      videoRevenueThb: 75_000, // sharp jump
      liveRevenueThb: 30_000,
      shoppingMallRevenueThb: 20_400, // stable
      unitPriceThb: 202,
      commissionRate: 12,
    },
  });
  const s3 = makeSnapshot({
    observedAt: '2026-04-18T10:00:00.000Z',
    observations: {
      revenueThb: 145_000, // +45% -> RISING
      salesVolume: 700, // +40% -> RISING
      videoRevenueThb: 41_000, // 40k -> 75k -> 41k roundtrip reversal -> VOLATILE (not STABLE!)
      liveRevenueThb: 22_000, // -45% -> DECLINING
      shoppingMallRevenueThb: 20_500, // +2.5% -> STABLE
      unitPriceThb: 207, // +3.5%, +7 THB -> RISING
      commissionRate: 14, // +4pp -> RISING
    },
  });

  const report = analyzeProductHistoricalTrends([s1, s2, s3], {
    productId: 'prod_14_01',
    dateRange: 'last7Day',
    nowMs: NOW_MS,
  });

  assert.equal(report.provenance, 'DERIVED');
  assert.equal(report.trustScope, 'LOCAL_OBSERVED_ONLY');
  assert.equal(report.comparableSnapshotCount, 3);
  assert.equal(report.spanDays, 4);
  assert.equal(report.overallTrend, 'RISING');
  assert.equal(HISTORICAL_TREND_METRIC_KEYS.length, 7);

  assert.equal(report.metrics.revenue.classification, 'RISING');
  assert.equal(report.metrics.revenue.deltaPct, 45);
  assert.equal(report.metrics.salesVolume.classification, 'RISING');
  assert.equal(report.metrics.salesVolume.deltaPct, 40);
  assert.equal(report.metrics.videoRevenue.classification, 'VOLATILE');
  assert.equal(report.metrics.videoRevenue.directionReversals, 1);
  assert.equal(report.metrics.liveRevenue.classification, 'DECLINING');
  assert.equal(report.metrics.liveRevenue.deltaPct, -45);
  assert.equal(report.metrics.shoppingMallRevenue.classification, 'STABLE');
  assert.equal(report.metrics.unitPrice.classification, 'RISING');
  assert.equal(report.metrics.commissionRate.classification, 'RISING');
  assert.equal(report.metrics.commissionRate.absoluteDelta, 4);
});

test('Phase 14: never classifies RISING from 0/1 snapshots, same-day duplicates, or <12h span', () => {
  const empty = analyzeProductHistoricalTrends([], { productId: 'prod_14_01', nowMs: NOW_MS });
  assert.equal(empty.overallTrend, 'INSUFFICIENT_HISTORY');
  assert.equal(empty.comparableSnapshotCount, 0);

  const single = analyzeProductHistoricalTrends(
    [makeSnapshot({ observedAt: '2026-04-18T10:00:00.000Z' })],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(single.overallTrend, 'INSUFFICIENT_HISTORY');
  assert.equal(single.metrics.revenue.classification, 'INSUFFICIENT_HISTORY');

  // Same UTC day deduplication -> only 1 distinct day remains
  const sameDay = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-18T02:00:00.000Z', observations: { revenueThb: 100_000 } }),
      makeSnapshot({ observedAt: '2026-04-18T22:00:00.000Z', observations: { revenueThb: 250_000 } }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(sameDay.comparableSnapshotCount, 1);
  assert.equal(sameDay.excludedSnapshots.sameDayDeduplicated, 1);
  assert.equal(sameDay.overallTrend, 'INSUFFICIENT_HISTORY');

  // Two distinct UTC days separated by only 4 hours (< 12h minSpanHours)
  const shortSpan = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-18T22:00:00.000Z', observations: { revenueThb: 100_000 } }),
      makeSnapshot({ observedAt: '2026-04-19T02:00:00.000Z', observations: { revenueThb: 200_000 } }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(shortSpan.comparableSnapshotCount, 2);
  assert.equal(shortSpan.metrics.revenue.classification, 'INSUFFICIENT_HISTORY');
  assert.equal(shortSpan.overallTrend, 'INSUFFICIENT_HISTORY');
});

test('Phase 14: explicit ZERO_BASELINE and ALL_ZERO handling never produces Infinity or NaN', () => {
  // 0 -> 50,000 => RISING with ZERO_BASELINE and deltaPct === null
  const risingFromZero = analyzeProductHistoricalTrends(
    [
      makeSnapshot({
        observedAt: '2026-04-16T10:00:00.000Z',
        observations: { videoRevenueThb: 0, liveRevenueThb: 0 },
      }),
      makeSnapshot({
        observedAt: '2026-04-18T10:00:00.000Z',
        observations: { videoRevenueThb: 50_000, liveRevenueThb: 0 },
      }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(risingFromZero.metrics.videoRevenue.classification, 'RISING');
  assert.equal(risingFromZero.metrics.videoRevenue.baselineStatus, 'ZERO_BASELINE');
  assert.equal(risingFromZero.metrics.videoRevenue.deltaPct, null);
  assert.equal(risingFromZero.metrics.videoRevenue.absoluteDelta, 50_000);

  // 0 -> 0 => STABLE with ALL_ZERO and deltaPct === null
  assert.equal(risingFromZero.metrics.liveRevenue.classification, 'STABLE');
  assert.equal(risingFromZero.metrics.liveRevenue.baselineStatus, 'ALL_ZERO');
  assert.equal(risingFromZero.metrics.liveRevenue.deltaPct, null);
  assert.equal(risingFromZero.metrics.liveRevenue.absoluteDelta, 0);

  // 0 -> 50,000 -> 0 => VOLATILE with ZERO_BASELINE and deltaPct === null
  const volatileZero = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-15T10:00:00.000Z', observations: { videoRevenueThb: 0 } }),
      makeSnapshot({ observedAt: '2026-04-17T10:00:00.000Z', observations: { videoRevenueThb: 50_000 } }),
      makeSnapshot({ observedAt: '2026-04-19T10:00:00.000Z', observations: { videoRevenueThb: 0 } }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(volatileZero.metrics.videoRevenue.classification, 'VOLATILE');
  assert.equal(volatileZero.metrics.videoRevenue.baselineStatus, 'ZERO_BASELINE');
  assert.equal(volatileZero.metrics.videoRevenue.deltaPct, null);
  assert.equal(volatileZero.metrics.videoRevenue.directionReversals, 1);
});

test('Phase 14: strict comparability guards reject mismatched identity, dateRange, provenance, unit, imported, future, and duplicate metric timestamps', () => {
  // 1. Mismatched product identities without target productId
  const mixedProducts = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ productId: 'prod_A', observedAt: '2026-04-16T10:00:00.000Z' }),
      makeSnapshot({ productId: 'prod_B', observedAt: '2026-04-18T10:00:00.000Z' }),
    ],
    { nowMs: NOW_MS }
  );
  assert.equal(mixedProducts.overallTrend, 'INCOMPARABLE_DATA');
  assert.ok(mixedProducts.incomparabilityReasons.includes('PRODUCT_IDENTITY_MISMATCH'));

  // 2. Mixed dateRange (last7Day vs last30Day)
  const mixedDateRange = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-16T10:00:00.000Z', dateRange: 'last7Day' }),
      makeSnapshot({ observedAt: '2026-04-18T10:00:00.000Z', dateRange: 'last30Day' }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(mixedDateRange.overallTrend, 'INCOMPARABLE_DATA');
  assert.ok(mixedDateRange.incomparabilityReasons.includes('DATE_RANGE_MISMATCH'));

  // 3. Imported backup snapshots are ALWAYS downgraded and excluded from trend classification
  const rawImported = sanitizeImportedProductSnapshotsMap({
    prod_14_01: [
      makeSnapshot({ observedAt: '2026-04-15T10:00:00.000Z', observations: { revenueThb: 50_000 } }),
      makeSnapshot({ observedAt: '2026-04-18T10:00:00.000Z', observations: { revenueThb: 300_000 } }),
    ],
  });
  const importedReport = analyzeProductHistoricalTrends(rawImported.prod_14_01, {
    productId: 'prod_14_01',
    nowMs: NOW_MS,
  });
  assert.equal(importedReport.overallTrend, 'INCOMPARABLE_DATA');
  assert.equal(importedReport.comparableSnapshotCount, 0);
  assert.equal(importedReport.importedUnverifiedSnapshotCount, 2);
  assert.ok(importedReport.incomparabilityReasons.includes('IMPORTED_UNVERIFIED_ONLY'));

  // 4. Incompatible provenance (legacy_product + rank => INCOMPARABLE_DATA; rank + detail => compatible!)
  const incompatibleProv = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-16T10:00:00.000Z', sourceEndpoint: 'legacy_product' }),
      makeSnapshot({ observedAt: '2026-04-18T10:00:00.000Z', sourceEndpoint: 'rank' }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(incompatibleProv.overallTrend, 'INCOMPARABLE_DATA');
  assert.ok(incompatibleProv.incomparabilityReasons.includes('PROVENANCE_INCOMPATIBLE'));

  const compatibleProv = analyzeProductHistoricalTrends(
    [
      makeSnapshot({
        observedAt: '2026-04-16T10:00:00.000Z',
        sourceEndpoint: 'rank',
        observations: { revenueThb: 100_000, salesVolume: 500 },
      }),
      makeSnapshot({
        observedAt: '2026-04-18T10:00:00.000Z',
        sourceEndpoint: 'detail',
        observations: { revenueThb: 130_000, salesVolume: 650 },
      }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(compatibleProv.overallTrend, 'RISING');
  assert.equal(compatibleProv.comparableSnapshotCount, 2);

  // 5. Explicit unit mismatch in metricMeta
  const unitMismatch = analyzeProductHistoricalTrends(
    [
      makeSnapshot({
        observedAt: '2026-04-16T10:00:00.000Z',
        metricMeta: {
          unitPriceThb: {
            fetchedAt: '2026-04-16T10:00:00.000Z',
            timestampPrecision: 'EXACT_METRIC',
            sourceEndpoint: 'rank',
            dateRange: 'last7Day',
            unit: 'THB',
          },
        },
      }),
      makeSnapshot({
        observedAt: '2026-04-18T10:00:00.000Z',
        metricMeta: {
          unitPriceThb: {
            fetchedAt: '2026-04-18T10:00:00.000Z',
            timestampPrecision: 'EXACT_METRIC',
            sourceEndpoint: 'rank',
            dateRange: 'last7Day',
            unit: 'UNVERIFIED',
          },
        },
      }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(unitMismatch.metrics.unitPrice.classification, 'INCOMPARABLE_DATA');
  assert.ok(unitMismatch.metrics.unitPrice.incomparabilityReasons.includes('UNIT_MISMATCH'));

  // 6. Future / invalid timestamps rejected
  const futureSnaps = analyzeProductHistoricalTrends(
    [
      makeSnapshot({ observedAt: '2026-04-18T10:00:00.000Z' }),
      makeSnapshot({ observedAt: '2026-04-25T10:00:00.000Z' }), // 5 days in the future relative to NOW_MS
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(futureSnaps.overallTrend, 'INCOMPARABLE_DATA');
  assert.equal(futureSnaps.excludedSnapshots.invalidOrFutureTimestamp, 1);
  assert.ok(futureSnaps.incomparabilityReasons.includes('INVALID_OR_FUTURE_TIMESTAMPS'));

  // 7. Duplicate exact per-metric fetchedAt carried across distinct UTC days
  const duplicateMetricTs = analyzeProductHistoricalTrends(
    [
      makeSnapshot({
        observedAt: '2026-04-16T10:00:00.000Z',
        observations: { revenueThb: 100_000 },
        metricMeta: {
          revenueThb: {
            fetchedAt: '2026-04-16T09:30:00.000Z',
            timestampPrecision: 'EXACT_METRIC',
            sourceEndpoint: 'detail',
            dateRange: 'last7Day',
            unit: 'THB',
          },
        },
      }),
      makeSnapshot({
        observedAt: '2026-04-18T10:00:00.000Z',
        observations: { revenueThb: 150_000 },
        metricMeta: {
          revenueThb: {
            fetchedAt: '2026-04-16T09:30:00.000Z', // exact same stale fetch timestamp
            timestampPrecision: 'EXACT_METRIC',
            sourceEndpoint: 'detail',
            dateRange: 'last7Day',
            unit: 'THB',
          },
        },
      }),
    ],
    { productId: 'prod_14_01', nowMs: NOW_MS }
  );
  assert.equal(duplicateMetricTs.metrics.revenue.classification, 'INCOMPARABLE_DATA');
  assert.ok(duplicateMetricTs.metrics.revenue.incomparabilityReasons.includes('DUPLICATE_METRIC_TIMESTAMP'));
});

test('Phase 14: overall trend synthesizes diverging Revenue RISING vs Sales Volume DECLINING as VOLATILE and buildHistoricalTrendsMap works', () => {
  const snaps = [
    makeSnapshot({
      observedAt: '2026-04-15T10:00:00.000Z',
      observations: { revenueThb: 100_000, salesVolume: 600, unitPriceThb: 166.7 },
    }),
    makeSnapshot({
      observedAt: '2026-04-18T10:00:00.000Z',
      observations: { revenueThb: 135_000, salesVolume: 450, unitPriceThb: 300 },
    }),
  ];
  const map = buildHistoricalTrendsMap({ prod_14_01: snaps }, { nowMs: NOW_MS });
  const report = map.prod_14_01;
  assert.equal(report.metrics.revenue.classification, 'RISING');
  assert.equal(report.metrics.salesVolume.classification, 'DECLINING');
  assert.equal(report.overallTrend, 'VOLATILE');
});

test('Phase 14: integration into evidence summary & intelligence view leaves Commercial Score and Strategy gates 100% unchanged', () => {
  const validated = makeValidatedProduct();
  const product = makeProductItem(validated);
  const scoreWithoutHistory = evaluateProductCommercialV2(validated, { nowMs: NOW_MS });
  const strategyWithoutHistory = evaluateProductStrategiesV2(validated, scoreWithoutHistory, {
    scoringConfig: { nowMs: NOW_MS },
  });

  const risingSnapshots = [
    makeSnapshot({
      observedAt: '2026-04-15T10:00:00.000Z',
      observations: { revenueThb: 100_000, salesVolume: 400, videoRevenueThb: 50_000, unitPriceThb: 250, commissionRate: 15 },
    }),
    makeSnapshot({
      observedAt: '2026-04-17T10:00:00.000Z',
      observations: { revenueThb: 125_000, salesVolume: 500, videoRevenueThb: 70_000, unitPriceThb: 250, commissionRate: 15 },
    }),
    makeSnapshot({
      observedAt: '2026-04-19T10:00:00.000Z',
      observations: { revenueThb: 150_000, salesVolume: 600, videoRevenueThb: 90_000, unitPriceThb: 250, commissionRate: 15 },
    }),
  ];

  // Commercial score and strategy evaluation remain 100% identical
  const scoreAfter = evaluateProductCommercialV2(validated, { nowMs: NOW_MS });
  const strategyAfter = evaluateProductStrategiesV2(validated, scoreAfter, {
    scoringConfig: { nowMs: NOW_MS },
  });
  assert.deepEqual(scoreAfter, scoreWithoutHistory);
  assert.deepEqual(strategyAfter, strategyWithoutHistory);

  const evidence = buildProductEvidenceSummary({
    product,
    validated,
    commercialScore: scoreWithoutHistory,
    snapshots: risingSnapshots,
    nowMs: NOW_MS,
  });
  assert.equal(evidence.historicalSummary.trendReport.overallTrend, 'RISING');
  assert.equal(evidence.historicalSummary.trendReport.comparableSnapshotCount, 3);
  assert.ok(evidence.derivedCalculations.some((c) => c.id === 'derived_local_trend'));

  const viewNoHistory = buildProductIntelligenceView([product], 'overall', {
    nowMs: NOW_MS,
  });
  const viewWithHistory = buildProductIntelligenceView([product], 'overall', {
    nowMs: NOW_MS,
    observationSnapshotsByProductId: { [product.id]: risingSnapshots },
  });

  // Ranking order, bucket, commercialScore, and strategyReport remain 100% identical
  assert.equal(viewWithHistory.rankedEntries.length, viewNoHistory.rankedEntries.length);
  assert.equal(viewWithHistory.excludedEntries.length, viewNoHistory.excludedEntries.length);
  const itemNoHist = viewNoHistory.rankedEntries[0] ?? viewNoHistory.excludedEntries[0];
  const itemWithHist = viewWithHistory.rankedEntries[0] ?? viewWithHistory.excludedEntries[0];
  assert.ok(itemNoHist && itemWithHist);
  assert.deepEqual(itemWithHist.commercialScore, itemNoHist.commercialScore);
  assert.deepEqual(itemWithHist.strategyReport, itemNoHist.strategyReport);
  assert.equal(itemWithHist.historicalTrend?.overallTrend, 'RISING');
  assert.equal(itemNoHist.historicalTrend, undefined);
});
