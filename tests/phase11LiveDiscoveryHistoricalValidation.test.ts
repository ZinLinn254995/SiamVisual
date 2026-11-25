import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISCOVERY_SHORTLIST_THRESHOLDS,
  classifyProductDiscoveryShortlist,
} from '../src/lib/discoveryShortlist.ts';
import {
  adaptRawKalodataRowToValidatedMetrics,
  validateNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { buildProductEvidenceSummary } from '../src/lib/productEvidenceSummary.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import {
  appendObservationSnapshot,
  buildStrategySnapshotsMap,
  createObservationSnapshotFromProduct,
  loadProductSnapshotsFromStorage,
  mergeRestoredProductSnapshots,
  recordProductSnapshotsInStorage,
  toStrategyHistoricalSnapshots,
  type StorageLike,
} from '../src/lib/snapshotStore.ts';
import {
  buildBackupPayload,
  mergeKalodataMetrics,
  mergeValidatedMetricsSnapshots,
  parseBackupFile,
} from '../src/lib/storage.ts';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2.ts';
import type {
  HistoricalMetricSnapshot,
  ProductItem,
  ProductValidatedMetrics,
} from '../src/types.ts';

const NOW_ISO = '2026-11-25T16:50:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function makeValidatedMetrics(overrides?: {
  fetchedAt?: string | null;
  dateRange?: string;
  sourceEndpoint?: 'rank' | 'detail' | 'legacy_product' | 'unknown';
  priceThb?: number | null;
  commissionRate?: number | null;
  revenueThb7d?: number | null;
  salesVolume7d?: number | null;
  videoRevenueThb7d?: number | null;
  liveRevenueThb7d?: number | null;
  shoppingMallRevenueThb7d?: number | null;
  revenueGrowthRate?: number | null;
  growthVerified?: boolean;
  creatorCount?: number | null;
  creatorVerified?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
  stale?: boolean;
}): ProductValidatedMetrics {
  const stale = overrides?.stale === true;
  const ts =
    overrides?.fetchedAt !== undefined
      ? overrides.fetchedAt
      : stale
        ? '2026-11-01T00:00:00.000Z'
        : NOW_ISO;
  const dateRange = overrides?.dateRange ?? 'last7Day';
  const sourceEndpoint = overrides?.sourceEndpoint ?? 'detail';
  const evalNow = NOW_MS;

  const priceVal = overrides?.priceThb !== undefined ? overrides.priceThb : 420;
  const commVal = overrides?.commissionRate !== undefined ? overrides.commissionRate : 15;
  const revVal = overrides?.revenueThb7d !== undefined ? overrides.revenueThb7d : 800_000;
  const salesVal = overrides?.salesVolume7d !== undefined ? overrides.salesVolume7d : 1900;
  const videoVal = overrides?.videoRevenueThb7d !== undefined ? overrides.videoRevenueThb7d : 600_000;
  const liveVal = overrides?.liveRevenueThb7d !== undefined ? overrides.liveRevenueThb7d : 150_000;
  const mallVal =
    overrides?.shoppingMallRevenueThb7d !== undefined ? overrides.shoppingMallRevenueThb7d : 50_000;
  const growthVal = overrides?.revenueGrowthRate !== undefined ? overrides.revenueGrowthRate : 32;
  const creatorVal = overrides?.creatorCount !== undefined ? overrides.creatorCount : 12;
  const ratingVal = overrides?.rating !== undefined ? overrides.rating : 4.7;
  const reviewVal = overrides?.reviewCount !== undefined ? overrides.reviewCount : 120;

  const growthVerified = overrides?.growthVerified ?? true;
  const creatorVerified = overrides?.creatorVerified ?? true;

  return {
    dateRange,
    fetchedAt: ts,
    sourceEndpoint,
    priceThb: validateNumericMetric({
      rawInput: priceVal,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      minValue: 0,
    }),
    commissionRate: validateNumericMetric({
      rawInput: commVal,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowZero: true,
      minValue: 0,
      maxValue: 100,
    }),
    commissionThb: validateNumericMetric({
      rawInput:
        priceVal !== null && commVal !== null
          ? Math.round(priceVal * (commVal / 100) * 100) / 100
          : null,
      unit: 'THB',
      provenance: 'SYNTHETIC',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowZero: true,
      minValue: 0,
    }),
    salesVolume7d: validateNumericMetric({
      rawInput: salesVal,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      minValue: 0,
    }),
    revenueThb7d: validateNumericMetric({
      rawInput: revVal,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      minValue: 0,
    }),
    videoRevenueThb7d: validateNumericMetric({
      rawInput: videoVal,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowZero: true,
      minValue: 0,
    }),
    liveRevenueThb7d: validateNumericMetric({
      rawInput: liveVal,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowZero: true,
      minValue: 0,
    }),
    shoppingMallRevenueThb7d: validateNumericMetric({
      rawInput: mallVal,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowZero: true,
      minValue: 0,
    }),
    revenueGrowthRate: validateNumericMetric({
      rawInput: growthVal,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      allowNegative: true,
      note: growthVerified
        ? null
        : 'UNVERIFIED_COMPARISON_PERIOD: baseline window unverified.',
    }),
    creatorCount: creatorVerified
      ? validateNumericMetric({
          rawInput: creatorVal,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt: ts,
          dateRange,
          sourceEndpoint,
          nowMs: evalNow,
          allowZero: true,
          minValue: 0,
        })
      : {
          value: null,
          state: 'UNAVAILABLE',
          provenance: 'SOURCE',
          rawInput: creatorVal,
          unit: 'UNVERIFIED',
          fetchedAt: ts,
          dateRange,
          sourceEndpoint,
          note: 'UNVERIFIED_CREATOR_DEFINITION: scope unverified.',
        },
    rating: validateNumericMetric({
      rawInput: ratingVal,
      unit: 'RATING_5',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      minValue: 0,
      maxValue: 5,
    }),
    reviewCount: validateNumericMetric({
      rawInput: reviewVal,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: evalNow,
      minValue: 0,
    }),
    unresolvedFields: [],
  };
}

function makeProduct(id: string, validatedMetrics: ProductValidatedMetrics): ProductItem {
  const commercialScoreV2 = evaluateProductCommercialV2(validatedMetrics, { nowMs: NOW_MS });
  return {
    id,
    thaiTitle: `สินค้าทดสอบ ${id}`,
    clearTitle: { my: `ပစ္စည်း ${id}`, en: `Product ${id}` },
    whatItIs: { my: 'စမ်းသပ်ပစ္စည်း', en: 'Test product' },
    whySilentWorks: { my: 'ပြသရလွယ်ကူ', en: 'Clear visual demonstration' },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်', en: 'Beauty & Personal Care' },
    shopName: 'TikTok Shop TH',
    priceThb: validatedMetrics.priceThb.value,
    commissionRate: validatedMetrics.commissionRate.value,
    commissionThb: validatedMetrics.commissionThb.value,
    visualTags: ['Before-After', 'Texture'],
    scoreBreakdown: {
      total: 82,
      grade: 'strong',
      visualDemo: 85,
      aiSuitability: 80,
      salesDemand: 80,
      commissionValue: 75,
      speechPenalty: 0,
    },
    validatedMetrics,
    commercialScoreV2,
  };
}

function makeHistSnap(params: {
  fetchedAt: string;
  revenue: number;
  creators: number;
  dateRange?: string;
  trustStatus?: 'LOCAL_OBSERVED' | 'IMPORTED_UNVERIFIED';
}): HistoricalMetricSnapshot {
  const ms = Date.parse(params.fetchedAt);
  const dateRange = params.dateRange ?? 'last7Day';
  return {
    fetchedAt: params.fetchedAt,
    dateRange,
    trustStatus: params.trustStatus ?? 'LOCAL_OBSERVED',
    revenueThb7d: validateNumericMetric({
      rawInput: params.revenue,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: params.fetchedAt,
      dateRange,
      nowMs: ms,
      minValue: 0,
    }),
    creatorCount: validateNumericMetric({
      rawInput: params.creators,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: params.fetchedAt,
      dateRange,
      nowMs: ms,
      minValue: 0,
    }),
  };
}

describe('Phase 11 — Live Product Discovery Validation & Historical Intelligence', () => {
  it('1. Validates all 6 discovery shortlist categories and strict metric-state guards (missing, unavailable, stale, invalid, unverified, 0% comm)', () => {
    // 1A: Strong Demand + Low Creator Competition (verified low competition + verified demand + earnings)
    const lowCompVm = makeValidatedMetrics({
      revenueThb7d: 1_500_000,
      salesVolume7d: 3500,
      videoRevenueThb7d: 1_100_000,
      commissionRate: 15,
      creatorCount: 8,
      creatorVerified: true,
      revenueGrowthRate: 30,
      growthVerified: true,
    });
    const lowCompScore = evaluateProductCommercialV2(lowCompVm, { nowMs: NOW_MS });
    const lowCompRes = classifyProductDiscoveryShortlist(lowCompVm, lowCompScore);
    assert.equal(lowCompRes.primaryClassification, 'STRONG_DEMAND_LOW_COMPETITION');
    assert.equal(lowCompRes.competitionEvidenceStatus, 'VERIFIED_LOW');
    assert.equal(lowCompRes.isPreliminaryCandidate, false);
    assert.ok(lowCompRes.secondarySignals.includes('EMERGING_OPPORTUNITY'));
    assert.ok(lowCompRes.secondarySignals.includes('STRONG_DEMAND_STRONG_VIDEO_SALES'));
    assert.ok(lowCompRes.secondarySignals.includes('STRONG_AFFILIATE_EARNINGS'));

    // 1B: High Demand but High Competition (verified crowded creators)
    const highCompVm = makeValidatedMetrics({
      revenueThb7d: 1_800_000,
      salesVolume7d: 4200,
      videoRevenueThb7d: 1_400_000,
      commissionRate: 12,
      creatorCount: 950,
      creatorVerified: true,
    });
    const highCompScore = evaluateProductCommercialV2(highCompVm, { nowMs: NOW_MS });
    const highCompRes = classifyProductDiscoveryShortlist(highCompVm, highCompScore);
    assert.equal(highCompRes.primaryClassification, 'HIGH_DEMAND_HIGH_COMPETITION');
    assert.equal(highCompRes.competitionEvidenceStatus, 'VERIFIED_HIGH');

    // 1C: Emerging Opportunity (solid demand + verified moderate/low competition + verified >=20% growth, without low-comp primary)
    const emergingVm = makeValidatedMetrics({
      revenueThb7d: 260_000,
      salesVolume7d: 620,
      videoRevenueThb7d: 100_000,
      commissionRate: 12,
      creatorCount: 14,
      creatorVerified: true,
      revenueGrowthRate: 45,
      growthVerified: true,
    });
    const emergingScore = evaluateProductCommercialV2(emergingVm, { nowMs: NOW_MS });
    const emergingRes = classifyProductDiscoveryShortlist(emergingVm, emergingScore);
    assert.ok(
      emergingRes.primaryClassification === 'EMERGING_OPPORTUNITY' ||
        emergingRes.secondarySignals.includes('EMERGING_OPPORTUNITY')
    );

    // 1D: Strong Demand + Strong Video Sales (preliminary when competition is UNVERIFIED)
    const strongVideoPreliminaryVm = makeValidatedMetrics({
      revenueThb7d: 4_163_665,
      salesVolume7d: 29_324,
      videoRevenueThb7d: 3_978_070,
      liveRevenueThb7d: 185_595,
      shoppingMallRevenueThb7d: 0,
      priceThb: 141.99,
      commissionRate: 20,
      creatorCount: 343,
      creatorVerified: false,
      growthVerified: false,
      rating: null,
      reviewCount: null,
    });
    const strongVideoScore = evaluateProductCommercialV2(strongVideoPreliminaryVm, {
      nowMs: NOW_MS,
    });
    const strongVideoRes = classifyProductDiscoveryShortlist(
      strongVideoPreliminaryVm,
      strongVideoScore
    );
    assert.equal(strongVideoScore.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(strongVideoRes.primaryClassification, 'STRONG_DEMAND_STRONG_VIDEO_SALES');
    assert.ok(strongVideoRes.secondarySignals.includes('STRONG_AFFILIATE_EARNINGS'));
    assert.equal(strongVideoRes.isPreliminaryCandidate, true);
    assert.equal(strongVideoRes.competitionEvidenceStatus, 'UNVERIFIED');
    // Must NEVER be classified as low competition or emerging without verified competition
    assert.ok(!strongVideoRes.secondarySignals.includes('STRONG_DEMAND_LOW_COMPETITION'));
    assert.ok(!strongVideoRes.secondarySignals.includes('EMERGING_OPPORTUNITY'));
    assert.ok(!strongVideoRes.secondarySignals.includes('HIGH_DEMAND_HIGH_COMPETITION'));

    // 1E: Strong Affiliate Earnings (solid demand + attractive commission, live-driven so weak video share)
    const strongEarnVm = makeValidatedMetrics({
      revenueThb7d: 3_485_400,
      salesVolume7d: 9_733,
      videoRevenueThb7d: 160_735,
      liveRevenueThb7d: 3_321_756,
      shoppingMallRevenueThb7d: 2_909,
      priceThb: 358.1,
      commissionRate: 10,
      creatorCount: null,
      creatorVerified: false,
      growthVerified: false,
      rating: null,
      reviewCount: null,
    });
    const strongEarnScore = evaluateProductCommercialV2(strongEarnVm, { nowMs: NOW_MS });
    const strongEarnRes = classifyProductDiscoveryShortlist(strongEarnVm, strongEarnScore);
    assert.equal(strongEarnRes.primaryClassification, 'STRONG_AFFILIATE_EARNINGS');
    assert.equal(strongEarnRes.videoSalesEvidenceStatus, 'WEAK');
    assert.equal(strongEarnRes.isPreliminaryCandidate, true);

    // 1F: Insufficient Evidence — Non-monetizable 0% commission even with ฿4M+ revenue & 50%+ video share
    const zeroCommVm = makeValidatedMetrics({
      revenueThb7d: 4_127_594,
      salesVolume7d: 978,
      videoRevenueThb7d: 2_098_795,
      priceThb: 4220.44,
      commissionRate: 0,
      creatorVerified: false,
    });
    const zeroCommScore = evaluateProductCommercialV2(zeroCommVm, { nowMs: NOW_MS });
    const zeroCommRes = classifyProductDiscoveryShortlist(zeroCommVm, zeroCommScore);
    assert.equal(zeroCommScore.eligibilityStatus, 'NOT_MONETIZABLE');
    assert.equal(zeroCommRes.primaryClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(zeroCommRes.isNotMonetizable, true);
    assert.equal(zeroCommRes.isPreliminaryCandidate, true);

    // 1G: Stale data cannot qualify any positive shortlist category
    const staleVm = makeValidatedMetrics({
      revenueThb7d: 3_000_000,
      salesVolume7d: 8_000,
      videoRevenueThb7d: 2_600_000,
      commissionRate: 20,
      creatorCount: 6,
      creatorVerified: true,
      stale: true,
    });
    const staleScore = evaluateProductCommercialV2(staleVm, { nowMs: NOW_MS });
    const staleRes = classifyProductDiscoveryShortlist(staleVm, staleScore);
    assert.equal(staleRes.primaryClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(staleRes.secondarySignals.length, 0);

    // 1H: Invalid/negative metrics cannot qualify any positive shortlist category
    const invalidVm = makeValidatedMetrics({
      revenueThb7d: -500,
      salesVolume7d: -10,
      videoRevenueThb7d: -200,
      commissionRate: 150, // >100% invalid
      creatorCount: -5,
      creatorVerified: true,
    });
    const invalidScore = evaluateProductCommercialV2(invalidVm, { nowMs: NOW_MS });
    const invalidRes = classifyProductDiscoveryShortlist(invalidVm, invalidScore);
    assert.equal(invalidRes.primaryClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(DISCOVERY_SHORTLIST_THRESHOLDS.strongVideoShareMinRatio, 0.5);
  });

  it('2. Validates historical snapshot accumulation, UTC-day deduplication, /rank + /detail timestamp preservation, reload persistence, and backup trust boundary', () => {
    const storage = createMemoryStorage();
    const T_DAY1_RANK = '2026-11-24T08:00:00.000Z';
    const T_DAY2_RANK = '2026-11-25T16:50:12.320Z';
    const T_DAY2_DETAIL = '2026-11-25T16:50:49.298Z';

    const DAY1_MS = Date.parse(T_DAY1_RANK);

    // Day 1 genuine /rank capture (captured on Day 1 at T_DAY1_RANK)
    const day1RankVm = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731299385569545105',
        unit_price: 2127.62,
        commission_rate: 7,
        revenue: 6_200_000,
        sales_volumn: 2914,
        video_revenue: 4_700_000,
        live_revenue: 1_490_000,
        showcase_revenue: 10_000,
        revenue_growth_rate: -5.2,
      },
      { fetchedAt: T_DAY1_RANK, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: DAY1_MS }
    );
    const day1Rec = recordProductSnapshotsInStorage(
      [makeProduct('1731299385569545105', day1RankVm)],
      { storage, nowMs: DAY1_MS }
    );
    assert.equal(day1Rec.addedCount, 1);

    // Day 2 genuine /rank capture
    const day2RankVm = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731299385569545105',
        unit_price: 2127.62,
        commission_rate: 7,
        revenue: 6_929_653.68,
        sales_volumn: 3257,
        video_revenue: 5_276_828.25,
        live_revenue: 1_640_069.62,
        showcase_revenue: 12_755.81,
        revenue_growth_rate: -11.76,
      },
      { fetchedAt: T_DAY2_RANK, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
    );
    const day2Prod = makeProduct('1731299385569545105', day2RankVm);
    const day2Rec = recordProductSnapshotsInStorage([day2Prod], { storage, nowMs: NOW_MS });
    assert.equal(day2Rec.addedCount, 1);
    assert.equal(day2Rec.snapshotsByProductId['1731299385569545105'].length, 2);

    // Repeated search on Day 2 MUST deduplicate (0 added, 0 artificial growth)
    const repeatRec = recordProductSnapshotsInStorage([day2Prod], { storage, nowMs: NOW_MS });
    assert.equal(repeatRec.addedCount, 0);
    assert.equal(repeatRec.updatedCount, 0);
    assert.equal(repeatRec.deduplicatedCount, 1);
    assert.equal(repeatRec.snapshotsByProductId['1731299385569545105'].length, 2);

    // Day 2 /detail enrichment merges cleanly on same UTC day without erasing Day 1 OR overwriting /rank growth timestamp
    const day2DetailVm = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731299385569545105',
        unit_price: 2127.62,
        commission_rate: 7,
        revenue: 6_929_653.68,
        sales_volumn: 3257,
        video_revenue: 5_276_828.25,
        live_revenue: 1_640_069.62,
        shopping_mall_revenue: 12_755.81,
        creator_number: 343,
        product_review_count: 59540,
      },
      { fetchedAt: T_DAY2_DETAIL, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS }
    );
    const mergedVm = mergeValidatedMetricsSnapshots(day2DetailVm, day2RankVm)!;
    const mergedKalo = mergeKalodataMetrics(
      {
        revenueThb7d: 6_929_653.68,
        salesVolume7d: 3257,
        creatorCount: 343,
        reviewCount: 59540,
        dateRange: 'last7Day',
        fetchedAt: T_DAY2_DETAIL,
      },
      {
        revenueThb7d: 6_929_653.68,
        salesVolume7d: 3257,
        revenueGrowthRate: -11.76,
        dateRange: 'last7Day',
        fetchedAt: T_DAY2_RANK,
      }
    );
    assert.equal(mergedKalo?.metricTimestamps?.revenueGrowthRate, T_DAY2_RANK);
    assert.equal(mergedKalo?.metricTimestamps?.creatorCount, T_DAY2_DETAIL);

    const enrichedRec = recordProductSnapshotsInStorage(
      [makeProduct('1731299385569545105', mergedVm)],
      { storage, nowMs: NOW_MS }
    );
    assert.equal(enrichedRec.addedCount, 0);
    assert.equal(enrichedRec.updatedCount, 1);

    // Reload from storage: Day 1 and Day 2 survive intact with distinct per-metric timestamps
    const reloaded = loadProductSnapshotsFromStorage(storage, { nowMs: NOW_MS });
    const list = reloaded['1731299385569545105'];
    assert.equal(list.length, 2);
    assert.equal(list[0].observationDay, '2026-11-24');
    assert.equal(list[0].observations.revenueThb, 6_200_000);
    assert.equal(list[1].observationDay, '2026-11-25');
    assert.equal(list[1].observations.creatorCountVerified, null);
    assert.equal(list[1].observations.creatorCountUnverifiedRaw, 343);
    assert.equal(list[1].metricMeta?.revenueGrowthRate?.fetchedAt, T_DAY2_RANK);
    assert.equal(list[1].metricMeta?.revenueGrowthRate?.sourceEndpoint, 'rank');
    assert.equal(list[1].metricMeta?.creatorCountUnverifiedRaw?.fetchedAt, T_DAY2_DETAIL);
    assert.equal(list[1].metricMeta?.creatorCountUnverifiedRaw?.sourceEndpoint, 'detail');

    // Backup export preserves LOCAL_OBSERVED; restoring onto a fresh device marks IMPORTED_UNVERIFIED
    const exported = buildBackupPayload({
      entries: [],
      productSnapshots: reloaded,
      deepInsightsCache: {},
      productAnalysisCache: {},
      exportedAt: NOW_ISO,
    });
    assert.equal(
      exported.productSnapshots?.['1731299385569545105']?.[1].trustStatus,
      'LOCAL_OBSERVED'
    );

    const parsed = parseBackupFile(JSON.stringify(exported), {
      nowMs: NOW_MS,
      importedAt: NOW_ISO,
    });
    assert.ok(parsed?.productSnapshots?.['1731299385569545105']);
    assert.ok(
      parsed.productSnapshots['1731299385569545105'].every(
        (s) => s.trustStatus === 'IMPORTED_UNVERIFIED'
      )
    );
    const freshStorage = createMemoryStorage();
    const restored = mergeRestoredProductSnapshots(
      {},
      parsed.productSnapshots,
      freshStorage,
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );
    assert.equal(restored.addedSnapshots, 2);
    // Imported backup snapshots are excluded from strategy qualification
    assert.equal(
      toStrategyHistoricalSnapshots(restored.merged['1731299385569545105'], {
        nowMs: NOW_MS,
      }).length,
      0
    );
  });

  it('3. Validates Fast Rising Products & Trend Timing Opportunity across all 8 required longitudinal test scenarios', () => {
    const product = makeProduct(
      'hist_candidate',
      makeValidatedMetrics({
        fetchedAt: NOW_ISO,
        revenueThb7d: 540_000,
        salesVolume7d: 1350,
        videoRevenueThb7d: 400_000,
        priceThb: 400,
        commissionRate: 15,
        creatorCount: 8,
        creatorVerified: true,
        revenueGrowthRate: 35,
        growthVerified: true,
      })
    );

    const evalWith = (snaps: HistoricalMetricSnapshot[]) =>
      evaluateProductStrategiesV2(product, undefined, {
        scoringConfig: { nowMs: NOW_MS },
        historicalSnapshots: snaps,
      });

    // Case 1: One genuine observation -> both DATA_UNAVAILABLE
    const r1 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-25T10:00:00.000Z', revenue: 540_000, creators: 8 }),
    ]);
    assert.equal(r1.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(r1.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 2: Two observations with insufficient time span (8h < 12h min) -> both DATA_UNAVAILABLE
    const r2 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-25T06:00:00.000Z', revenue: 300_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-25T14:00:00.000Z', revenue: 540_000, creators: 7 }),
    ]);
    assert.equal(r2.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(r2.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 3: Two observations with sufficient time span (18h >= 12h) -> Fast Rising QUALIFIED, Trend Timing still DATA_UNAVAILABLE (needs >=3 over >=24h)
    const r3 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-24T20:00:00.000Z', revenue: 300_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-25T14:00:00.000Z', revenue: 540_000, creators: 7 }),
    ]);
    assert.equal(r3.strategies.fast_rising_products.eligibilityStatus, 'QUALIFIED');
    assert.equal(r3.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 4: Three observations across multiple days (>= 24h span, accelerating demand > creator growth) -> BOTH QUALIFIED
    const r4 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-22T12:00:00.000Z', revenue: 200_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-24T00:00:00.000Z', revenue: 300_000, creators: 7 }),
      makeHistSnap({ fetchedAt: '2026-11-25T12:00:00.000Z', revenue: 540_000, creators: 8 }),
    ]);
    assert.equal(r4.strategies.fast_rising_products.eligibilityStatus, 'QUALIFIED');
    assert.equal(r4.strategies.trend_timing_opportunity.eligibilityStatus, 'QUALIFIED');

    // Case 5: Duplicate / near-duplicate observations -> rejected from inflating snapshot count
    const r5 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-23T10:00:00.000Z', revenue: 200_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-23T10:00:00.000Z', revenue: 300_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-23T10:30:00.000Z', revenue: 350_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-25T12:00:00.000Z', revenue: 540_000, creators: 7 }),
    ]);
    // Only 2 distinct time-separated snapshots remain -> Trend Timing (minSnapshots: 3) stays DATA_UNAVAILABLE
    assert.equal(r5.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 6: Imported-unverified observations -> strictly DATA_UNAVAILABLE
    const r6 = evalWith([
      makeHistSnap({
        fetchedAt: '2026-11-22T12:00:00.000Z',
        revenue: 200_000,
        creators: 6,
        trustStatus: 'IMPORTED_UNVERIFIED',
      }),
      makeHistSnap({
        fetchedAt: '2026-11-24T00:00:00.000Z',
        revenue: 300_000,
        creators: 7,
        trustStatus: 'IMPORTED_UNVERIFIED',
      }),
      makeHistSnap({
        fetchedAt: '2026-11-25T12:00:00.000Z',
        revenue: 540_000,
        creators: 8,
        trustStatus: 'IMPORTED_UNVERIFIED',
      }),
    ]);
    assert.equal(r6.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(r6.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 7: Future-dated observations -> strictly rejected
    const r7 = evalWith([
      makeHistSnap({ fetchedAt: '2026-11-24T12:00:00.000Z', revenue: 200_000, creators: 6 }),
      makeHistSnap({ fetchedAt: '2026-11-29T12:00:00.000Z', revenue: 600_000, creators: 7 }),
      makeHistSnap({ fetchedAt: '2026-12-01T12:00:00.000Z', revenue: 900_000, creators: 8 }),
    ]);
    assert.equal(r7.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(r7.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Case 8: Incompatible date ranges (last30Day snapshots vs last7Day product) -> strictly rejected
    const r8 = evalWith([
      makeHistSnap({
        fetchedAt: '2026-11-22T12:00:00.000Z',
        revenue: 200_000,
        creators: 6,
        dateRange: 'last30Day',
      }),
      makeHistSnap({
        fetchedAt: '2026-11-24T00:00:00.000Z',
        revenue: 300_000,
        creators: 7,
        dateRange: 'last30Day',
      }),
      makeHistSnap({
        fetchedAt: '2026-11-25T12:00:00.000Z',
        revenue: 540_000,
        creators: 8,
        dateRange: 'last30Day',
      }),
    ]);
    assert.equal(r8.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(r8.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');
  });

  it('4. Product-level evidence summary cleanly separates facts, derived calculations, unavailable evidence, and creative heuristics (EN + MY)', () => {
    // Preliminary live-like candidate (verified demand + earnings + video sales; unverified competition + unavailable rating)
    const prelimVm = makeValidatedMetrics({
      revenueThb7d: 6_929_653.68,
      salesVolume7d: 3257,
      videoRevenueThb7d: 5_276_828.25,
      liveRevenueThb7d: 1_640_069.62,
      shoppingMallRevenueThb7d: 12_755.81,
      priceThb: 2127.62,
      commissionRate: 7,
      creatorCount: 343,
      creatorVerified: false,
      growthVerified: false,
      rating: null,
      reviewCount: null,
    });
    const prelimProduct = makeProduct('1731299385569545105', prelimVm);
    const localSnap = createObservationSnapshotFromProduct(prelimProduct, { nowMs: NOW_MS })!;
    const importedSnap = {
      ...localSnap,
      observedAt: '2026-11-23T10:00:00.000Z',
      observationDay: '2026-11-23',
      trustStatus: 'IMPORTED_UNVERIFIED' as const,
    };

    const summary = buildProductEvidenceSummary({
      product: prelimProduct,
      validated: prelimVm,
      commercialScore: prelimProduct.commercialScoreV2!,
      snapshots: [importedSnap, localSnap],
      nowMs: NOW_MS,
    });

    assert.equal(summary.qualificationStatus, 'PRELIMINARY');
    assert.equal(summary.competitionKnown, false);
    assert.equal(summary.videoSalesDemonstrated, true);
    assert.equal(summary.historicalSummary.localObservedCount, 1);
    assert.equal(summary.historicalSummary.importedUnverifiedCount, 1);
    assert.equal(summary.historicalSummary.multiDayTrendAvailable, false);

    // Facts bucket contains demand, commission, video sales — NOT unverified competition or payout
    assert.ok(summary.verifiedFacts.some((f) => f.id === 'demand_fact'));
    assert.ok(summary.verifiedFacts.some((f) => f.id === 'commission_fact'));
    assert.ok(summary.verifiedFacts.some((f) => f.id === 'video_sales_fact'));
    assert.ok(!summary.verifiedFacts.some((f) => f.id === 'competition_fact'));

    // Derived bucket contains payout/sale and video share — NOT fake trend from imported snapshot
    assert.ok(summary.derivedCalculations.some((d) => d.id === 'derived_payout'));
    assert.ok(summary.derivedCalculations.some((d) => d.id === 'derived_video_share'));
    assert.ok(!summary.derivedCalculations.some((d) => d.id === 'derived_local_trend'));

    // Unavailable bucket explicitly surfaces competition, quality, growth, and historical snapshot gaps
    assert.ok(summary.unavailableEvidence.some((u) => u.id === 'competition_unavailable'));
    assert.ok(summary.unavailableEvidence.some((u) => u.id === 'quality_unavailable'));
    assert.ok(summary.unavailableEvidence.some((u) => u.id === 'growth_unverified'));
    assert.ok(summary.unavailableEvidence.some((u) => u.id === 'historical_trend_unavailable'));

    // Heuristics bucket is strictly separated and explicitly states not conversion proof
    assert.equal(summary.heuristicSignals.length, 1);
    assert.match(summary.heuristicSignals[0].detail.en, /never proof of conversion/i);
    assert.match(summary.nonGuaranteeNotice.en, /no product is guaranteed to sell/i);
    assert.ok(summary.whyDiscovered.my.length > 0 && summary.qualificationReason.my.length > 0);

    // Non-monetizable 0% commission case
    const zeroVm = makeValidatedMetrics({
      revenueThb7d: 5_011_280,
      salesVolume7d: 299,
      videoRevenueThb7d: 1_993_839,
      priceThb: 16_760.13,
      commissionRate: 0,
      creatorVerified: false,
    });
    const zeroProduct = makeProduct('1732077377460865234', zeroVm);
    const zeroSummary = buildProductEvidenceSummary({
      product: zeroProduct,
      validated: zeroVm,
      commercialScore: zeroProduct.commercialScoreV2!,
      nowMs: NOW_MS,
    });
    assert.equal(zeroSummary.qualificationStatus, 'NOT_MONETIZABLE');
    assert.ok(zeroSummary.verifiedFacts.some((f) => f.id === 'commission_zero'));
    assert.ok(!zeroSummary.derivedCalculations.some((d) => d.id === 'derived_payout'));

    // Ensure appendObservationSnapshot & buildStrategySnapshotsMap stay consistent with Phase 10.1
    const appendRes = appendObservationSnapshot([localSnap], importedSnap, 90, { nowMs: NOW_MS });
    assert.equal(appendRes.snapshots.length, 2);
    const stratMap = buildStrategySnapshotsMap(
      { '1731299385569545105': appendRes.snapshots },
      { nowMs: NOW_MS }
    );
    // Only the 1 local snapshot passes into strategy history (never the imported one)
    assert.equal(stratMap['1731299385569545105']?.length, 1);
  });
});
