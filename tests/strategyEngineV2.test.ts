import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSyntheticCommissionThb,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import {
  ALL_STRATEGY_IDS,
  evaluateProductStrategiesV2,
  rankProductIntelligenceV2,
} from '../src/lib/strategyEngineV2.ts';
import { parseRawProductRow } from '../server/kalodata.ts';
import type { ProductValidatedMetrics } from '../src/types/metrics.ts';
import type { HistoricalMetricSnapshot } from '../src/types/strategyV2.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

interface Seed {
  priceThb?: number | null;
  commissionRate?: number | null;
  commissionUnit?: 'PERCENT' | 'RATIO' | 'UNVERIFIED';
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  videoRevenueThb7d?: number | null;
  liveRevenueThb7d?: number | null;
  revenueGrowthRate?: number | null;
  growthUnit?: 'PERCENT' | 'RATIO' | 'UNVERIFIED';
  growthDateRange?: string | null;
  creatorCount?: number | null;
  creatorUnit?: 'COUNT' | 'UNVERIFIED';
  rating?: number | null;
  ratingUnit?: 'RATING_5' | 'UNVERIFIED';
  reviewCount?: number | null;
  reviewUnit?: 'COUNT' | 'UNVERIFIED';
  fetchedAt?: string;
}

function makeMetrics(seed: Seed): ProductValidatedMetrics {
  const fetchedAt = seed.fetchedAt ?? NOW_ISO;
  const dateRange = 'last7Day';

  const priceThb = validatePriceThbMetric(seed.priceThb === undefined ? 299 : seed.priceThb, {
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
  });

  const commissionUnit = seed.commissionUnit ?? 'PERCENT';
  const rawComm = seed.commissionRate === undefined ? 15 : seed.commissionRate;
  const commissionRate =
    commissionUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawComm, {
          unverifiedNote: 'Unverified commission unit.',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawComm,
          unit: commissionUnit,
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
        });

  const commissionThb = computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesVolume7d = validateNumericMetric({
    rawInput: seed.salesVolume7d === undefined ? 1800 : seed.salesVolume7d,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueThb7d = validateNumericMetric({
    rawInput: seed.revenueThb7d === undefined ? 538_200 : seed.revenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const videoRevenueThb7d = validateNumericMetric({
    rawInput: seed.videoRevenueThb7d === undefined ? 360_000 : seed.videoRevenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const liveRevenueThb7d = validateNumericMetric({
    rawInput: seed.liveRevenueThb7d === undefined ? 40_000 : seed.liveRevenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const growthUnit = seed.growthUnit ?? 'PERCENT';
  const rawGrowth = seed.revenueGrowthRate === undefined ? 45 : seed.revenueGrowthRate;
  const gDateRange =
    seed.growthDateRange === undefined ? 'last7Day_vs_prev7Day' : seed.growthDateRange;
  const revenueGrowthRate =
    growthUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawGrowth, {
          allowNegative: true,
          unverifiedNote: 'Unverified growth unit.',
          context: { fetchedAt, dateRange: gDateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawGrowth,
          unit: growthUnit,
          provenance: 'SOURCE',
          fetchedAt,
          dateRange: gDateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: true,
        });

  const creatorUnit = seed.creatorUnit ?? 'COUNT';
  const rawCreator = seed.creatorCount === undefined ? 7 : seed.creatorCount;
  const creatorCount =
    creatorUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawCreator, {
          allowNegative: false,
          unverifiedNote: 'Unverified creator definition.',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawCreator,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

  const ratingUnit = seed.ratingUnit ?? 'RATING_5';
  const rawRating = seed.rating === undefined ? 4.8 : seed.rating;
  const rating =
    ratingUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawRating, {
          allowNegative: false,
          minValue: 0,
          maxValue: 5,
          unverifiedNote: 'Unverified rating scale.',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawRating,
          unit: 'RATING_5',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
          minValue: 0,
          maxValue: 5,
        });

  const reviewUnit = seed.reviewUnit ?? 'COUNT';
  const rawReviews = seed.reviewCount === undefined ? 260 : seed.reviewCount;
  const reviewCount =
    reviewUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawReviews, {
          allowNegative: false,
          unverifiedNote: 'Unverified review meaning.',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawReviews,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

  return {
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    liveRevenueThb7d,
    revenueGrowthRate,
    creatorCount,
    rating,
    reviewCount,
    fetchedAt,
    dateRange,
    sourceEndpoint: 'detail',
    unresolvedFields: [],
  };
}

function makeProduct(id: string, seed: Seed, extra?: Partial<ProductItem>): ProductItem {
  const vm = makeMetrics(seed);
  return {
    id,
    thaiTitle: `สินค้า_${id}`,
    clearTitle: { my: id, en: id },
    whatItIs: { my: id, en: id },
    whySilentWorks: { my: id, en: id },
    category: 'home',
    categoryLabel: { my: 'Home', en: 'Home' },
    shopName: 'Shop TH',
    priceThb: vm.priceThb.value,
    commissionRate: vm.commissionRate.value,
    commissionThb: vm.commissionThb.value,
    visualTags: [],
    validatedMetrics: vm,
    ...extra,
  };
}

describe('Phase 3 — Strategy Classification & Intelligent Ranking Engine', () => {
  it('1 & 21. One product can qualify for multiple strategies with distinct strategy scores', () => {
    const allRounder = makeProduct('multi_winner', {
      priceThb: 450,
      commissionRate: 18,
      revenueThb7d: 720_000,
      salesVolume7d: 1600,
      videoRevenueThb7d: 580_000,
      liveRevenueThb7d: 60_000,
      revenueGrowthRate: 52,
      creatorCount: 7,
      rating: 4.85,
      reviewCount: 420,
    });

    const report = evaluateProductStrategiesV2(allRounder, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(report.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.ok(report.qualifiedStrategyIds.length >= 6);
    assert.equal(report.strategies.early_market_opportunity.eligibilityStatus, 'QUALIFIED');
    assert.equal(report.strategies.underserved_demand.eligibilityStatus, 'QUALIFIED');
    assert.equal(report.strategies.creator_yield_opportunity.eligibilityStatus, 'QUALIFIED');
    assert.equal(report.strategies.profit_maximizer.eligibilityStatus, 'QUALIFIED');
    assert.equal(report.strategies.video_proven_winners.eligibilityStatus, 'QUALIFIED');
    assert.equal(report.strategies.trust_based_winners.eligibilityStatus, 'QUALIFIED');
    // Historical strategies remain DATA_UNAVAILABLE without snapshots
    assert.equal(report.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(report.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    const distinctScores = new Set(
      report.qualifiedStrategyIds.map((id) => report.strategies[id].strategyScore)
    );
    assert.ok(distinctScores.size >= 3, 'Expected distinct strategy-specific scores across qualified strategies');
  });

  it('2. Different products win different strategies instead of sharing one generic ranking', () => {
    const earlyWinner = makeProduct('p_early', {
      priceThb: 280,
      commissionRate: 15,
      revenueThb7d: 520_000,
      salesVolume7d: 1857,
      videoRevenueThb7d: 140_000,
      revenueGrowthRate: 85,
      creatorCount: 5,
      rating: 4.4,
      reviewCount: 45,
    });

    const underservedNoGrowth = makeProduct('p_underserved', {
      priceThb: 320,
      commissionRate: 16,
      revenueThb7d: 1_100_000,
      salesVolume7d: 3437,
      videoRevenueThb7d: 250_000,
      revenueGrowthRate: null,
      creatorCount: 9,
      rating: 4.5,
      reviewCount: 120,
    });

    const profitWinner = makeProduct('p_profit', {
      priceThb: 1490,
      commissionRate: 20, // ฿298 payout/sale!
      revenueThb7d: 340_000,
      salesVolume7d: 228,
      videoRevenueThb7d: 90_000,
      revenueGrowthRate: 12,
      creatorCount: 22,
      rating: 4.5,
      reviewCount: 70,
    });

    const videoWinner = makeProduct('p_video', {
      priceThb: 199,
      commissionRate: 12,
      revenueThb7d: 900_000,
      salesVolume7d: 4522,
      videoRevenueThb7d: 850_000, // 94.4% video share!
      liveRevenueThb7d: 20_000,
      revenueGrowthRate: 15,
      creatorCount: 18,
      rating: 4.4,
      reviewCount: 60,
    });

    const trustWinner = makeProduct('p_trust', {
      priceThb: 350,
      commissionRate: 15,
      revenueThb7d: 380_000,
      salesVolume7d: 1085,
      videoRevenueThb7d: 120_000,
      revenueGrowthRate: 12,
      creatorCount: 16,
      rating: 4.95,
      reviewCount: 800,
    });

    const ranked = rankProductIntelligenceV2(
      [earlyWinner, underservedNoGrowth, profitWinner, videoWinner, trustWinner],
      { scoringConfig: { nowMs: NOW_MS } }
    );

    assert.equal(ranked.strategyRankings.early_market_opportunity.qualifiedRankings[0].productId, 'p_early');
    assert.equal(ranked.strategyRankings.underserved_demand.qualifiedRankings[0].productId, 'p_underserved');
    assert.equal(ranked.strategyRankings.profit_maximizer.qualifiedRankings[0].productId, 'p_profit');
    assert.equal(ranked.strategyRankings.video_proven_winners.qualifiedRankings[0].productId, 'p_video');
    assert.equal(ranked.strategyRankings.trust_based_winners.qualifiedRankings[0].productId, 'p_trust');
    // p_underserved failed Early Market due to missing growth while winning Underserved Demand!
    assert.equal(
      ranked.overallRanking
        .find((e) => e.productId === 'p_underserved')
        ?.strategyReport.strategies.early_market_opportunity.eligibilityStatus,
      'INSUFFICIENT_DATA'
    );
  });

  it('3. Strong demand but high competition fails Early Market & Underserved Demand', () => {
    const crowded = makeProduct('crowded_1', {
      revenueThb7d: 900_000,
      salesVolume7d: 3000,
      creatorCount: 450,
      revenueGrowthRate: 30,
      commissionRate: 15,
    });

    const report = evaluateProductStrategiesV2(crowded, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(report.strategies.early_market_opportunity.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(report.strategies.underserved_demand.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(report.strategies.creator_yield_opportunity.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(report.cautionInsights.some((c) => /competition/i.test(c)));
  });

  it('4 & 5. High RPC with weak demand and High commission with weak demand are NOT_ELIGIBLE', () => {
    const highRpcWeak = makeProduct('tiny_1_creator', {
      priceThb: 199,
      commissionRate: 15,
      revenueThb7d: 3_500,
      salesVolume7d: 18,
      creatorCount: 1,
      revenueGrowthRate: 20,
    });
    const highCommWeak = makeProduct('high_comm_weak', {
      priceThb: 250,
      commissionRate: 40,
      revenueThb7d: 2_500,
      salesVolume7d: 10,
      creatorCount: 2,
      revenueGrowthRate: 20,
    });

    const ranked = rankProductIntelligenceV2([highRpcWeak, highCommWeak], {
      scoringConfig: { nowMs: NOW_MS },
    });

    for (const id of ALL_STRATEGY_IDS) {
      assert.equal(ranked.strategyRankings[id].qualifiedCount, 0);
    }
    assert.equal(
      ranked.overallRanking[0].strategyReport.strategies.creator_yield_opportunity.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
    assert.equal(
      ranked.overallRanking[1].strategyReport.strategies.profit_maximizer.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
  });

  it('6. Verified 0% commission excludes product from all monetizable strategies', () => {
    const zeroComm = makeProduct('zero_comm', {
      priceThb: 499,
      commissionRate: 0,
      revenueThb7d: 1_400_000,
      salesVolume7d: 2800,
      videoRevenueThb7d: 1_100_000,
      revenueGrowthRate: 70,
      creatorCount: 5,
      rating: 4.9,
      reviewCount: 500,
    });

    const ranked = rankProductIntelligenceV2([zeroComm], {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(ranked.overallRanking[0].opportunityClassification, 'NOT_MONETIZABLE');
    assert.equal(ranked.overallRanking[0].qualifiedStrategyIds.length, 0);
    for (const id of ALL_STRATEGY_IDS) {
      assert.equal(ranked.strategyRankings[id].qualifiedCount, 0);
    }
  });

  it('7 & 8. Missing commission and Unverified creator count never qualify for any strategy', () => {
    const missingComm = makeProduct('no_comm', { commissionRate: null });
    const unverifiedCreators = makeProduct('unver_creators', {
      creatorCount: 6,
      creatorUnit: 'UNVERIFIED',
    });

    const ranked = rankProductIntelligenceV2([missingComm, unverifiedCreators], {
      scoringConfig: { nowMs: NOW_MS },
    });

    for (const id of ALL_STRATEGY_IDS) {
      assert.equal(ranked.strategyRankings[id].qualifiedCount, 0);
    }
    const creatorEntry = ranked.overallRanking.find((e) => e.productId === 'unver_creators')!;
    assert.ok(creatorEntry.cautionInsights.some((c) => /creator competition data is unverified/i.test(c)));
  });

  it('9 & 10. Missing growth works ONLY where non-mandatory; unverified growth blocks Early Market', () => {
    const missingGrowth = makeProduct('miss_growth', {
      revenueGrowthRate: null,
      creatorCount: 6,
      revenueThb7d: 700_000,
    });
    const unverifiedGrowth = makeProduct('unver_growth', {
      revenueGrowthRate: 0.75,
      growthUnit: 'UNVERIFIED',
      creatorCount: 6,
      revenueThb7d: 700_000,
    });

    const rMiss = evaluateProductStrategiesV2(missingGrowth, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });
    const rUnver = evaluateProductStrategiesV2(unverifiedGrowth, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(rMiss.strategies.early_market_opportunity.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(rUnver.strategies.early_market_opportunity.eligibilityStatus, 'INSUFFICIENT_DATA');
    // Strategy 2 (Underserved Demand) still works without historical growth
    assert.equal(rMiss.strategies.underserved_demand.eligibilityStatus, 'QUALIFIED');
    assert.equal(rUnver.strategies.underserved_demand.eligibilityStatus, 'QUALIFIED');
    assert.ok(rMiss.cautionInsights.some((c) => /growth evidence is unavailable/i.test(c)));
    assert.ok(rUnver.cautionInsights.some((c) => /growth unit or comparison period is unverified/i.test(c)));
  });

  it('11. Historical strategies return DATA_UNAVAILABLE without snapshots, and qualify when valid snapshots exist', () => {
    const prod = makeProduct('rising_star', {
      revenueThb7d: 500_000,
      salesVolume7d: 1800,
      creatorCount: 8,
      commissionRate: 15,
    });

    const withoutSnapshots = evaluateProductStrategiesV2(prod, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(withoutSnapshots.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(withoutSnapshots.strategies.fast_rising_products.strategyScore, null);
    assert.equal(withoutSnapshots.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(withoutSnapshots.strategies.trend_timing_opportunity.strategyScore, null);

    // Now supply verified 3-point longitudinal snapshots showing accelerating demand & slower creator growth
    const snap = (hoursAgo: number, rev: number, creators: number): HistoricalMetricSnapshot => {
      const iso = new Date(NOW_MS - hoursAgo * 3_600_000).toISOString();
      const snapMs = Date.parse(iso);
      return {
        fetchedAt: iso,
        dateRange: 'last7Day',
        revenueThb7d: validateNumericMetric({
          rawInput: rev,
          unit: 'THB',
          provenance: 'SOURCE',
          fetchedAt: iso,
          nowMs: snapMs,
        }),
        creatorCount: validateNumericMetric({
          rawInput: creators,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt: iso,
          nowMs: snapMs,
        }),
      };
    };

    const withSnapshots = evaluateProductStrategiesV2(prod, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: [
        snap(72, 200_000, 6),
        snap(36, 300_000, 7), // +50% first half
        snap(0, 500_000, 8),  // +66.7% second half -> accelerating! creators only +33%
      ],
    });
    assert.equal(withSnapshots.strategies.fast_rising_products.eligibilityStatus, 'QUALIFIED');
    assert.ok((withSnapshots.strategies.fast_rising_products.strategyScore ?? 0) >= 65);
    assert.equal(withSnapshots.strategies.trend_timing_opportunity.eligibilityStatus, 'QUALIFIED');
    assert.ok((withSnapshots.strategies.trend_timing_opportunity.strategyScore ?? 0) >= 65);
  });

  it('12. Strong video revenue evidence qualifies Video Proven Winners without equating visual tags to sales proof', () => {
    const visualOnlyNoVideoSales = makeProduct(
      'visual_only',
      {
        revenueThb7d: 400_000,
        videoRevenueThb7d: 0,
        liveRevenueThb7d: 350_000,
        creatorCount: 10,
      },
      { visualTags: ['Macro Texture', 'ASMR Sound', 'Instant Before-After'] }
    );
    const provenVideo = makeProduct('video_proven', {
      revenueThb7d: 400_000,
      videoRevenueThb7d: 340_000,
      liveRevenueThb7d: 20_000,
      creatorCount: 10,
    });

    const rVisualOnly = evaluateProductStrategiesV2(visualOnlyNoVideoSales, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });
    const rVideoProven = evaluateProductStrategiesV2(provenVideo, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(rVisualOnly.strategies.video_proven_winners.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(rVideoProven.strategies.video_proven_winners.eligibilityStatus, 'QUALIFIED');
    assert.ok(
      rVideoProven.strategies.video_proven_winners.rankingReasons[0]
        .toLowerCase()
        .includes('does not guarantee')
    );
  });

  it('13 & 14. Trust-Based Winners rewards sufficient review sample and rejects small review sample', () => {
    const highSample = makeProduct('trusted', {
      rating: 4.85,
      reviewCount: 350,
    });
    const tinySample = makeProduct('tiny_reviews', {
      rating: 5.0,
      reviewCount: 4,
    });

    const rHigh = evaluateProductStrategiesV2(highSample, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });
    const rTiny = evaluateProductStrategiesV2(tinySample, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(rHigh.strategies.trust_based_winners.eligibilityStatus, 'QUALIFIED');
    assert.equal(rTiny.strategies.trust_based_winners.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(rTiny.cautionInsights.some((c) => /small review sample/i.test(c)));
  });

  it('15 & 16. Low data confidence and insufficient data cannot enter TOP_OPPORTUNITY or qualified rankings', () => {
    const lowConfidencePartial = makeProduct('low_conf', {
      revenueThb7d: 600_000,
      salesVolume7d: null, // missing
      commissionRate: 18,
      priceThb: 300,
      creatorCount: 6,
      revenueGrowthRate: null,
      rating: null,
      reviewCount: null,
    });

    // Simulate synthetic/stale penalty dropping confidence below top threshold
    const lowConfMetrics = lowConfidencePartial.validatedMetrics!;
    const commercial = evaluateProductCommercialV2(lowConfMetrics, { nowMs: NOW_MS });
    assert.ok(commercial.dataConfidence.score < 70);

    const report = evaluateProductStrategiesV2(lowConfMetrics, commercial, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.notEqual(report.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(report.strategies.early_market_opportunity.eligibilityStatus, 'INSUFFICIENT_DATA');

    const incomplete = makeProduct('insufficient_prod', {
      commissionRate: null,
      creatorCount: null,
      revenueGrowthRate: null,
    });
    const ranked = rankProductIntelligenceV2([incomplete], {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(ranked.overallRanking[0].opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    for (const id of ALL_STRATEGY_IDS) {
      assert.equal(ranked.strategyRankings[id].qualifiedCount, 0);
    }
  });

  it('17 & 18. Ranking is 100% deterministic with stable tie-breaking and independent of input array order', () => {
    const tieA = makeProduct('alpha_id', {
      priceThb: 300,
      commissionRate: 15,
      revenueThb7d: 500_000,
      salesVolume7d: 1667,
      creatorCount: 8,
    });
    const tieB = makeProduct('beta_id', {
      priceThb: 300,
      commissionRate: 15,
      revenueThb7d: 500_000,
      salesVolume7d: 1667,
      creatorCount: 8,
    });
    const higher = makeProduct('gamma_id', {
      priceThb: 400,
      commissionRate: 20,
      revenueThb7d: 900_000,
      salesVolume7d: 2250,
      creatorCount: 5,
    });

    const run1 = rankProductIntelligenceV2([tieB, tieA, higher], {
      scoringConfig: { nowMs: NOW_MS },
    });
    const run2 = rankProductIntelligenceV2([higher, tieA, tieB], {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.deepEqual(
      run1.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore]),
      run2.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore])
    );
    assert.equal(run1.overallRanking[0].productId, 'gamma_id');
    // Identical ties break deterministically by canonical productId ascending ('alpha_id' before 'beta_id')
    assert.equal(run1.overallRanking[1].productId, 'alpha_id');
    assert.equal(run1.overallRanking[2].productId, 'beta_id');

    for (const id of ALL_STRATEGY_IDS) {
      assert.deepEqual(
        run1.strategyRankings[id].qualifiedRankings.map((r) => [r.productId, r.strategyScore]),
        run2.strategyRankings[id].qualifiedRankings.map((r) => [r.productId, r.strategyScore])
      );
    }
  });

  it('19 & 20. Empty product list and very small product pool behave cleanly without percentile distortion', () => {
    const emptyResult = rankProductIntelligenceV2([], { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(emptyResult.poolSize, 0);
    assert.equal(emptyResult.overallRanking.length, 0);
    for (const id of ALL_STRATEGY_IDS) {
      assert.equal(emptyResult.strategyRankings[id].qualifiedCount, 0);
    }

    const loneWeak = makeProduct('lone_weak', {
      priceThb: 99,
      commissionRate: 10,
      revenueThb7d: 1_500,
      salesVolume7d: 15,
      creatorCount: 2,
    });
    const smallPool = rankProductIntelligenceV2([loneWeak], { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(smallPool.smallPoolWarning, true);
    assert.equal(smallPool.overallRanking[0].opportunityClassification, 'WATCHLIST');
    assert.equal(smallPool.overallRanking[0].qualifiedStrategyIds.length, 0);
  });

  it('Works safely with unverified Kalodata raw rows without producing false qualified opportunities', () => {
    const raw = parseRawProductRow(
      {
        product_id: '173755248421',
        product_name: 'เซรั่มบำรุงผิว',
        unit_price: 129,
        commission_rate: 0.1,
        sales_volumn: 13853,
        revenue: 1780423,
        video_revenue: 1743604,
        live_revenue: 36819,
      },
      'fallback_p3',
      'rank',
      NOW_ISO
    );
    assert.ok(raw);
    const report = evaluateProductStrategiesV2(raw.validatedMetrics, undefined, {
      scoringConfig: { nowMs: NOW_MS },
    });
    // Because Phase 0 live unit verification is still pending for non-zero commission, growth, creators, and rating:
    // NO strategy should falsely report QUALIFIED!
    assert.equal(report.qualifiedStrategyIds.length, 0);
    assert.equal(report.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(report.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(report.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');
  });
});
