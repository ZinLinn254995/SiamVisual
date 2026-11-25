import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptProductItemToValidatedMetrics,
  adaptRawKalodataRowToValidatedMetrics,
  computeSyntheticCommissionThb,
  computeSyntheticRevenueEstimate,
  DEFAULT_METRIC_STALE_MS,
  validateCommissionRateMetric,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import {
  DEFAULT_COMMERCIAL_SCORING_V2_CONFIG,
  evaluateProductCommercialV2,
  rankCommercialOpportunitiesV2,
} from '../src/lib/scoringEngineV2.ts';
import {
  ALL_STRATEGY_IDS,
  evaluateProductStrategiesV2,
  rankProductIntelligenceV2,
  type StrategyCandidateInput,
} from '../src/lib/strategyEngineV2.ts';
import { parseRawProductRow } from '../server/kalodata.ts';
import { computeDirectKalodataScore } from '../server/scoreEngine.ts';
import {
  hydrateProductFromStorage,
  saveDeepInsightForProduct,
} from '../src/lib/storage.ts';
import type { ProductValidatedMetrics, ValidatedMetric } from '../src/types/metrics.ts';
import type { HistoricalMetricSnapshot } from '../src/types/strategyV2.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

interface VerifiedSeed {
  priceThb?: number | null;
  commissionRate?: number | null;
  commissionUnit?: 'PERCENT' | 'RATIO' | 'UNVERIFIED';
  commissionThbOverride?: ValidatedMetric<number>;
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  revenueOverride?: ValidatedMetric<number>;
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
  dateRange?: string;
}

function buildMetrics(seed: VerifiedSeed): ProductValidatedMetrics {
  const fetchedAt = seed.fetchedAt ?? NOW_ISO;
  const dateRange = seed.dateRange ?? 'last7Day';

  const priceThb = validatePriceThbMetric(
    seed.priceThb === undefined ? 299 : seed.priceThb,
    { fetchedAt, dateRange, nowMs: NOW_MS }
  );

  const commUnit = seed.commissionUnit ?? 'PERCENT';
  const rawComm = seed.commissionRate === undefined ? 15 : seed.commissionRate;
  const commissionRate =
    commUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawComm, {
          unverifiedNote: 'Unverified commission unit.',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawComm,
          unit: commUnit,
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
        });

  const commissionThb =
    seed.commissionThbOverride ?? computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesVolume7d = validateNumericMetric({
    rawInput: seed.salesVolume7d === undefined ? 1600 : seed.salesVolume7d,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueThb7d =
    seed.revenueOverride ??
    validateNumericMetric({
      rawInput: seed.revenueThb7d === undefined ? 480_000 : seed.revenueThb7d,
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
    rawInput: seed.videoRevenueThb7d === undefined ? 260_000 : seed.videoRevenueThb7d,
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
  const rawGrowth = seed.revenueGrowthRate === undefined ? 35 : seed.revenueGrowthRate;
  const growthDateRange =
    seed.growthDateRange === undefined ? 'last7Day_vs_prev7Day' : seed.growthDateRange;
  const revenueGrowthRate =
    growthUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawGrowth, {
          allowNegative: true,
          unverifiedNote: 'Unverified growth unit.',
          context: { fetchedAt, dateRange: growthDateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawGrowth,
          unit: growthUnit,
          provenance: 'SOURCE',
          fetchedAt,
          dateRange: growthDateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: true,
        });

  const creatorUnit = seed.creatorUnit ?? 'COUNT';
  const rawCreator = seed.creatorCount === undefined ? 8 : seed.creatorCount;
  const creatorCount =
    creatorUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawCreator, {
          allowNegative: false,
          unverifiedNote: 'Unverified creator scope.',
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
  const rawRating = seed.rating === undefined ? 4.75 : seed.rating;
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
  const rawReviews = seed.reviewCount === undefined ? 240 : seed.reviewCount;
  const reviewCount =
    reviewUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawReviews, {
          allowNegative: false,
          unverifiedNote: 'Unverified review semantics.',
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

function makeProduct(
  id: string,
  seed: VerifiedSeed,
  extra?: Partial<ProductItem>,
  snapshots?: HistoricalMetricSnapshot[]
): StrategyCandidateInput<ProductItem> {
  const vm = buildMetrics(seed);
  const item: ProductItem = {
    id,
    thaiTitle: `สินค้าทดสอบ_${id}`,
    clearTitle: { my: id, en: id },
    whatItIs: { my: id, en: id },
    whySilentWorks: { my: id, en: id },
    category: 'home',
    categoryLabel: { my: 'Home', en: 'Home' },
    shopName: 'TH Shop',
    priceThb: vm.priceThb.value,
    commissionRate: vm.commissionRate.value,
    commissionThb: vm.commissionThb.value,
    visualTags: [],
    validatedMetrics: vm,
    ...extra,
  };
  return {
    item,
    productId: id,
    validatedMetrics: vm,
    historicalSnapshots: snapshots,
  };
}

function makeSnapshot(hoursAgo: number, rev: number, creators: number): HistoricalMetricSnapshot {
  const iso = new Date(NOW_MS - hoursAgo * 3_600_000).toISOString();
  const ms = Date.parse(iso);
  return {
    fetchedAt: iso,
    dateRange: 'last7Day',
    revenueThb7d: validateNumericMetric({
      rawInput: rev,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: iso,
      dateRange: 'last7Day',
      nowMs: ms,
    }),
    creatorCount: validateNumericMetric({
      rawInput: creators,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: iso,
      dateRange: 'last7Day',
      nowMs: ms,
    }),
  };
}

function seededShuffle<T>(arr: T[], seedNum: number): T[] {
  const copy = [...arr];
  let s = seedNum >>> 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

describe('Phase 4 — Full System Testing & Validation', () => {
  it('Section 1: Full end-to-end pipeline preserves stage invariants across unverified and verified flows', () => {
    // Flow A: Raw Kalodata payload (unverified upstream units preserved -> zero false qualifications)
    const rawRow = {
      product_id: 'raw_e2e_1',
      product_name: 'เซรั่มวิตามินซี',
      unit_price: '฿249.00',
      commission_rate: 0.15, // UNVERIFIED upstream unit per Phase 0
      sales_volumn: 2200,
      revenue: 547_800,
      video_revenue: 420_000,
      live_revenue: 55_000,
      revenue_growth_rate: 0.45, // UNVERIFIED growth unit
      creator_count: 7, // UNVERIFIED creator scope
      product_rating: 4.85,
      review_count: 340,
    };

    const vmRaw = adaptRawKalodataRowToValidatedMetrics(rawRow, {
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: NOW_MS,
    });
    const parsedItem = parseRawProductRow(rawRow, 'fallback_raw', 'detail', NOW_ISO);
    assert.ok(parsedItem);
    assert.equal(parsedItem.validatedMetrics.commissionRate.unit, 'UNVERIFIED');
    assert.equal(parsedItem.validatedMetrics.commissionRate.rawInput, 0.15);

    const commercialRaw = evaluateProductCommercialV2(vmRaw, { nowMs: NOW_MS });
    const strategyRaw = evaluateProductStrategiesV2(vmRaw, commercialRaw, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(commercialRaw.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(commercialRaw.commercialOpportunityScore, null);
    assert.equal(strategyRaw.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(strategyRaw.qualifiedStrategyIds.length, 0);
    assert.equal(strategyRaw.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(strategyRaw.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Flow B: Verified-unit pipeline end-to-end through rankProductIntelligenceV2
    const verifiedCandidate = makeProduct(
      'verified_e2e_1',
      {
        priceThb: 299,
        commissionRate: 18,
        salesVolume7d: 2100,
        revenueThb7d: 627_900,
        videoRevenueThb7d: 480_000,
        liveRevenueThb7d: 60_000,
        revenueGrowthRate: 52,
        creatorCount: 6,
        rating: 4.85,
        reviewCount: 410,
      },
      undefined,
      [
        makeSnapshot(72, 220_000, 4),
        makeSnapshot(36, 360_000, 5),
        makeSnapshot(0, 627_900, 6),
      ]
    );

    const ranked = rankProductIntelligenceV2([verifiedCandidate], {
      scoringConfig: { nowMs: NOW_MS },
    });
    const overall = ranked.overallRanking[0];
    assert.equal(overall.eligibilityStatus, 'ELIGIBLE');
    assert.equal(overall.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(overall.dataConfidence.level, 'HIGH');
    assert.equal(overall.commercialScore.conversionEvidence.dominantChannel, 'VIDEO');
    assert.equal(overall.qualifiedStrategyIds.length, 8);
    assert.equal(ranked.strategyRankings.early_market_opportunity.qualifiedCount, 1);
    assert.equal(ranked.strategyRankings.fast_rising_products.qualifiedCount, 1);
    assert.equal(ranked.strategyRankings.trend_timing_opportunity.qualifiedCount, 1);
  });

  it('Section 2: 32-product synthetic benchmark catalog validates strategy separation, exclusions, and overall classifications', () => {
    const synthRev = computeSyntheticRevenueEstimate(
      validateNumericMetric({ rawInput: 1800, unit: 'COUNT', fetchedAt: NOW_ISO, nowMs: NOW_MS }),
      validatePriceThbMetric(299, { fetchedAt: NOW_ISO, nowMs: NOW_MS })
    );
    const staleIso = new Date(NOW_MS - DEFAULT_METRIC_STALE_MS - 3_600_000).toISOString();

    const catalog: Array<StrategyCandidateInput<ProductItem>> = [
      // 1. Early Market Winner
      makeProduct('sim_01_early_winner', {
        priceThb: 300,
        commissionRate: 16,
        revenueThb7d: 540_000,
        salesVolume7d: 1800,
        videoRevenueThb7d: 140_000,
        revenueGrowthRate: 75,
        creatorCount: 6,
        rating: 4.75,
        reviewCount: 220,
      }),
      // 2. Underserved Demand Winner (missing growth!)
      makeProduct('sim_02_underserved_winner', {
        priceThb: 306,
        commissionRate: 16,
        revenueThb7d: 950_000,
        salesVolume7d: 3100,
        videoRevenueThb7d: 210_000,
        revenueGrowthRate: null,
        creatorCount: 8,
        rating: 4.6,
        reviewCount: 140,
      }),
      // 3. Creator Yield Winner (very high RPC, non-zero creators)
      makeProduct('sim_03_creator_yield_winner', {
        priceThb: 485,
        commissionRate: 16,
        revenueThb7d: 820_000,
        salesVolume7d: 1690,
        videoRevenueThb7d: 180_000,
        revenueGrowthRate: 22,
        creatorCount: 3,
        rating: 4.65,
        reviewCount: 95,
      }),
      // 4. Fast Rising Winner
      makeProduct(
        'sim_04_fast_rising_winner',
        {
          priceThb: 280,
          commissionRate: 15,
          revenueThb7d: 480_000,
          salesVolume7d: 1714,
          revenueGrowthRate: 65,
          creatorCount: 7,
          rating: 4.6,
          reviewCount: 110,
        },
        undefined,
        [makeSnapshot(72, 160_000, 5), makeSnapshot(36, 260_000, 6), makeSnapshot(0, 480_000, 7)]
      ),
      // 5. Profit Maximizer Winner (high THB payout)
      makeProduct('sim_05_profit_maximizer_winner', {
        priceThb: 1650,
        commissionRate: 22, // ฿363/sale
        revenueThb7d: 420_000,
        salesVolume7d: 255,
        videoRevenueThb7d: 90_000,
        revenueGrowthRate: 12,
        creatorCount: 22,
        rating: 4.55,
        reviewCount: 75,
      }),
      // 6. Video Proven Winner
      makeProduct('sim_06_video_proven_winner', {
        priceThb: 220,
        commissionRate: 14,
        revenueThb7d: 820_000,
        salesVolume7d: 3727,
        videoRevenueThb7d: 760_000, // 92.7% video share
        liveRevenueThb7d: 25_000,
        revenueGrowthRate: 15,
        creatorCount: 16,
        rating: 4.45,
        reviewCount: 85,
      }),
      // 7. Trust-Based Winner
      makeProduct('sim_07_trust_based_winner', {
        priceThb: 350,
        commissionRate: 15,
        revenueThb7d: 380_000,
        salesVolume7d: 1085,
        videoRevenueThb7d: 90_000,
        revenueGrowthRate: 11,
        creatorCount: 18,
        rating: 4.94,
        reviewCount: 950,
      }),
      // 8. Trend Timing Winner
      makeProduct(
        'sim_08_trend_timing_winner',
        {
          priceThb: 290,
          commissionRate: 14,
          revenueThb7d: 440_000,
          salesVolume7d: 1517,
          revenueGrowthRate: 55,
          creatorCount: 10,
          rating: 4.6,
          reviewCount: 130,
        },
        undefined,
        [makeSnapshot(96, 150_000, 8), makeSnapshot(48, 250_000, 9), makeSnapshot(0, 440_000, 10)]
      ),
      // 9. Saturated Giant
      makeProduct('sim_09_saturated_giant', {
        priceThb: 249,
        commissionRate: 14,
        revenueThb7d: 2_100_000,
        salesVolume7d: 8433,
        videoRevenueThb7d: 900_000,
        revenueGrowthRate: 25,
        creatorCount: 620,
        rating: 4.7,
        reviewCount: 1500,
      }),
      // 10. High Commission No Demand
      makeProduct('sim_10_high_comm_no_demand', {
        priceThb: 350,
        commissionRate: 38,
        revenueThb7d: 1_750,
        salesVolume7d: 5,
        videoRevenueThb7d: 700,
        revenueGrowthRate: 10,
        creatorCount: 2,
        rating: 4.6,
        reviewCount: 40,
      }),
      // 11. Zero Commission Popular
      makeProduct('sim_11_zero_comm_popular', {
        priceThb: 499,
        commissionRate: 0,
        revenueThb7d: 1_500_000,
        salesVolume7d: 3006,
        videoRevenueThb7d: 1_100_000,
        revenueGrowthRate: 60,
        creatorCount: 4,
        rating: 4.9,
        reviewCount: 600,
      }),
      // 12. Missing Commission
      makeProduct('sim_12_missing_comm', {
        priceThb: 299,
        commissionRate: null,
        revenueThb7d: 600_000,
        salesVolume7d: 2006,
        creatorCount: 6,
      }),
      // 13. Unverified Creators
      makeProduct('sim_13_unverified_creators', {
        priceThb: 299,
        commissionRate: 15,
        revenueThb7d: 650_000,
        salesVolume7d: 2173,
        creatorCount: 6,
        creatorUnit: 'UNVERIFIED',
      }),
      // 14. Zero Creators High Revenue
      makeProduct('sim_14_zero_creators_high_rev', {
        priceThb: 320,
        commissionRate: 15,
        revenueThb7d: 480_000,
        salesVolume7d: 1500,
        creatorCount: 0,
      }),
      // 15. Missing Growth Strong Demand
      makeProduct('sim_15_missing_growth_strong', {
        priceThb: 290,
        commissionRate: 15,
        revenueThb7d: 680_000,
        salesVolume7d: 2344,
        revenueGrowthRate: null,
        creatorCount: 9,
      }),
      // 16. Unverified Growth Unit
      makeProduct('sim_16_unverified_growth', {
        priceThb: 290,
        commissionRate: 15,
        revenueThb7d: 620_000,
        salesVolume7d: 2138,
        revenueGrowthRate: 0.55,
        growthUnit: 'UNVERIFIED',
        creatorCount: 8,
      }),
      // 17. 5-star with 3 reviews
      makeProduct('sim_17_low_sample_5star', {
        priceThb: 299,
        commissionRate: 15,
        revenueThb7d: 400_000,
        salesVolume7d: 1337,
        creatorCount: 8,
        rating: 5.0,
        reviewCount: 3,
      }),
      // 18. Poor rating many reviews
      makeProduct('sim_18_poor_rating_many_reviews', {
        priceThb: 299,
        commissionRate: 18,
        revenueThb7d: 720_000,
        salesVolume7d: 2408,
        creatorCount: 6,
        rating: 2.9,
        reviewCount: 520,
      }),
      // 19. Stale snapshot
      makeProduct('sim_19_stale_snapshot', {
        fetchedAt: staleIso,
        revenueThb7d: 700_000,
        salesVolume7d: 2340,
        creatorCount: 5,
      }),
      // 20. Synthetic revenue only (no verified SOURCE rev/sales)
      makeProduct('sim_20_synthetic_rev_only', {
        salesVolume7d: null,
        revenueOverride: synthRev,
        videoRevenueThb7d: null,
        liveRevenueThb7d: null,
      }),
      // 21. Large demand but sharply negative growth
      makeProduct('sim_21_negative_growth_large', {
        priceThb: 280,
        commissionRate: 15,
        revenueThb7d: 520_000,
        salesVolume7d: 1857,
        revenueGrowthRate: -45,
        creatorCount: 12,
      }),
      // 22. Live dominant channel
      makeProduct('sim_22_live_dominant_channel', {
        priceThb: 320,
        commissionRate: 14,
        revenueThb7d: 700_000,
        salesVolume7d: 2187,
        videoRevenueThb7d: 25_000,
        liveRevenueThb7d: 620_000,
        creatorCount: 14,
      }),
      // 23. Micro price tiny payout
      makeProduct('sim_23_tiny_payout_high_vol', {
        priceThb: 29,
        commissionRate: 2, // 0.58 THB
        revenueThb7d: 174_000,
        salesVolume7d: 6000,
        creatorCount: 7,
      }),
      // 24. Balanced mid-tier
      makeProduct('sim_24_balanced_mid_tier', {
        priceThb: 240,
        commissionRate: 12,
        revenueThb7d: 120_000,
        salesVolume7d: 500,
        videoRevenueThb7d: 35_000,
        revenueGrowthRate: 5,
        creatorCount: 24,
        rating: 4.3,
        reviewCount: 45,
      }),
      // 25. Missing rating with high sales
      makeProduct('sim_25_missing_rating_high_sales', {
        priceThb: 299,
        commissionRate: 16,
        revenueThb7d: 650_000,
        salesVolume7d: 2173,
        creatorCount: 7,
        rating: null,
        reviewCount: null,
      }),
      // 26. Flat verified 0% growth
      makeProduct('sim_26_flat_zero_growth', {
        priceThb: 300,
        commissionRate: 15,
        revenueThb7d: 480_000,
        salesVolume7d: 1600,
        revenueGrowthRate: 0,
        creatorCount: 7,
      }),
      // 27. Decelerating snapshots
      makeProduct(
        'sim_27_decelerating_snapshots',
        {
          priceThb: 290,
          commissionRate: 15,
          revenueThb7d: 310_000,
          salesVolume7d: 1068,
          revenueGrowthRate: 15,
          creatorCount: 12,
        },
        undefined,
        [makeSnapshot(72, 100_000, 6), makeSnapshot(36, 300_000, 9), makeSnapshot(0, 310_000, 12)]
      ),
      // 28. Borderline missing multiple non-core metrics -> low confidence
      makeProduct('sim_28_borderline_low_confidence', {
        priceThb: 220,
        commissionRate: 12,
        revenueThb7d: 90_000,
        salesVolume7d: null,
        videoRevenueThb7d: null,
        liveRevenueThb7d: null,
        revenueGrowthRate: null,
        creatorCount: 15,
        rating: null,
        reviewCount: null,
      }),
      // 29. Zero verified sales & revenue
      makeProduct('sim_29_zero_sales_and_rev', {
        priceThb: 299,
        commissionRate: 15,
        revenueThb7d: 0,
        salesVolume7d: 0,
        videoRevenueThb7d: 0,
        liveRevenueThb7d: 0,
        creatorCount: 3,
      }),
      // 30. Ratio-unit commission & growth parity
      makeProduct('sim_30_ratio_unit_winner', {
        priceThb: 300,
        commissionRate: 0.16,
        commissionUnit: 'RATIO',
        revenueThb7d: 540_000,
        salesVolume7d: 1800,
        videoRevenueThb7d: 140_000,
        revenueGrowthRate: 0.75,
        growthUnit: 'RATIO',
        creatorCount: 6,
        rating: 4.75,
        reviewCount: 220,
      }),
      // 31. All-rounder champion
      makeProduct(
        'sim_31_all_rounder_champion',
        {
          priceThb: 490,
          commissionRate: 20, // ฿98 payout
          revenueThb7d: 1_100_000,
          salesVolume7d: 2245,
          videoRevenueThb7d: 880_000,
          liveRevenueThb7d: 90_000,
          revenueGrowthRate: 80,
          creatorCount: 5,
          rating: 4.9,
          reviewCount: 620,
        },
        undefined,
        [makeSnapshot(72, 320_000, 3), makeSnapshot(36, 560_000, 4), makeSnapshot(0, 1_100_000, 5)]
      ),
      // 32. Visually hyped dud (V1 high visual score, V2 commercial weak)
      makeProduct(
        'sim_32_visual_hyped_dud',
        {
          priceThb: 120,
          commissionRate: 3,
          revenueThb7d: 1_200,
          salesVolume7d: 10,
          videoRevenueThb7d: 1_000,
          creatorCount: 4,
          rating: 4.8,
          reviewCount: 80,
        },
        {
          visualTags: ['Macro Texture', 'ASMR Sound', 'Instant Before-After'],
          scoreBreakdown: {
            total: 97,
            grade: 'top',
            visualDemo: 98,
            aiSuitability: 96,
            salesDemand: 90,
            commissionValue: 85,
            speechPenalty: 0,
          },
        }
      ),
    ];

    assert.equal(catalog.length, 32);

    const ranked = rankProductIntelligenceV2(catalog, {
      scoringConfig: { nowMs: NOW_MS },
    });

    assert.equal(ranked.poolSize, 32);
    assert.equal(ranked.smallPoolWarning, false);

    const byId = new Map(ranked.overallRanking.map((e) => [e.productId, e]));

    // Strategy & classification assertions across key profiles
    assert.equal(byId.get('sim_31_all_rounder_champion')?.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(byId.get('sim_31_all_rounder_champion')?.qualifiedStrategyIds.length, 8);

    assert.equal(
      byId.get('sim_01_early_winner')?.strategyReport.strategies.early_market_opportunity.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_02_underserved_winner')?.strategyReport.strategies.early_market_opportunity.eligibilityStatus,
      'INSUFFICIENT_DATA'
    );
    assert.equal(
      byId.get('sim_02_underserved_winner')?.strategyReport.strategies.underserved_demand.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_03_creator_yield_winner')?.strategyReport.strategies.creator_yield_opportunity.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_04_fast_rising_winner')?.strategyReport.strategies.fast_rising_products.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_05_profit_maximizer_winner')?.strategyReport.strategies.profit_maximizer.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_06_video_proven_winner')?.strategyReport.strategies.video_proven_winners.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_07_trust_based_winner')?.strategyReport.strategies.trust_based_winners.eligibilityStatus,
      'QUALIFIED'
    );
    assert.equal(
      byId.get('sim_08_trend_timing_winner')?.strategyReport.strategies.trend_timing_opportunity.eligibilityStatus,
      'QUALIFIED'
    );

    // Saturated giant excluded from Early Market, Underserved, Creator Yield
    assert.equal(
      byId.get('sim_09_saturated_giant')?.strategyReport.strategies.early_market_opportunity.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
    assert.equal(
      byId.get('sim_09_saturated_giant')?.strategyReport.strategies.underserved_demand.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
    assert.ok(byId.get('sim_09_saturated_giant')?.riskTags.includes('EXTREME_COMPETITION'));

    // Weak demand / 0% / missing / unverified / poor quality / stale / synthetic never qualify
    for (const badId of [
      'sim_10_high_comm_no_demand',
      'sim_11_zero_comm_popular',
      'sim_12_missing_comm',
      'sim_13_unverified_creators',
      'sim_18_poor_rating_many_reviews',
      'sim_19_stale_snapshot',
      'sim_20_synthetic_rev_only',
      'sim_29_zero_sales_and_rev',
      'sim_32_visual_hyped_dud',
    ]) {
      const entry = byId.get(badId)!;
      assert.equal(
        entry.qualifiedStrategyIds.length,
        0,
        `Expected ${badId} to qualify for 0 strategies, got ${entry.qualifiedStrategyIds.join(', ')}`
      );
      assert.notEqual(entry.opportunityClassification, 'TOP_OPPORTUNITY');
    }

    // Specific expected exclusions & edge checks
    assert.equal(byId.get('sim_11_zero_comm_popular')?.opportunityClassification, 'NOT_MONETIZABLE');
    assert.equal(byId.get('sim_12_missing_comm')?.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(byId.get('sim_18_poor_rating_many_reviews')?.eligibilityStatus, 'RESTRICTED_POOR_QUALITY');
    assert.equal(byId.get('sim_19_stale_snapshot')?.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(byId.get('sim_20_synthetic_rev_only')?.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(byId.get('sim_23_tiny_payout_high_vol')?.commercialScore.earningScore.payoutPerSaleThb, 0.58);
    assert.equal(
      byId.get('sim_22_live_dominant_channel')?.strategyReport.strategies.video_proven_winners.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
    assert.equal(
      byId.get('sim_27_decelerating_snapshots')?.strategyReport.strategies.fast_rising_products.eligibilityStatus,
      'NOT_ELIGIBLE'
    );
    assert.equal(byId.get('sim_32_visual_hyped_dud')?.eligibilityStatus, 'RESTRICTED_WEAK_DEMAND');

    // RATIO vs PERCENT parity check
    assert.equal(
      byId.get('sim_30_ratio_unit_winner')?.commercialOpportunityScore,
      byId.get('sim_01_early_winner')?.commercialOpportunityScore
    );
    assert.deepEqual(
      byId.get('sim_30_ratio_unit_winner')?.qualifiedStrategyIds,
      byId.get('sim_01_early_winner')?.qualifiedStrategyIds
    );
  });

  it('Section 3: Adversarial testing across all 16 hostile input scenarios', () => {
    // 1. High commission + near-zero demand
    const adv1 = evaluateProductCommercialV2(
      buildMetrics({ commissionRate: 45, priceThb: 300, revenueThb7d: 300, salesVolume7d: 1, creatorCount: 1 }),
      { nowMs: NOW_MS }
    );
    assert.equal(adv1.eligibilityStatus, 'RESTRICTED_WEAK_DEMAND');
    assert.ok((adv1.commercialOpportunityScore ?? 100) <= 35);

    // 2. Huge revenue + extreme creator competition
    const adv2 = evaluateProductCommercialV2(
      buildMetrics({ revenueThb7d: 3_000_000, salesVolume7d: 10_000, creatorCount: 1200 }),
      { nowMs: NOW_MS }
    );
    assert.ok(adv2.riskTags.includes('EXTREME_COMPETITION'));
    assert.equal(adv2.isTopTierEligible, false);

    // 3. 1 creator + extremely high RPC (anti-tiny-product guard vs real demand)
    const adv3Tiny = evaluateProductStrategiesV2(
      buildMetrics({ revenueThb7d: 1_500, salesVolume7d: 5, creatorCount: 1 }),
      undefined,
      { scoringConfig: { nowMs: NOW_MS } }
    );
    assert.equal(adv3Tiny.strategies.creator_yield_opportunity.eligibilityStatus, 'NOT_ELIGIBLE');

    // 4. 0 creators + huge revenue
    const adv4 = evaluateProductStrategiesV2(
      buildMetrics({ revenueThb7d: 1_200_000, salesVolume7d: 4000, creatorCount: 0 }),
      undefined,
      { scoringConfig: { nowMs: NOW_MS } }
    );
    assert.equal(adv4.strategies.early_market_opportunity.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(adv4.strategies.creator_yield_opportunity.eligibilityStatus, 'NOT_ELIGIBLE');

    // 5. Rating 5.0 + 1 review
    const adv5 = evaluateProductStrategiesV2(
      buildMetrics({ rating: 5.0, reviewCount: 1 }),
      undefined,
      { scoringConfig: { nowMs: NOW_MS } }
    );
    assert.equal(adv5.strategies.trust_based_winners.eligibilityStatus, 'NOT_ELIGIBLE');

    // 6. Missing rating + huge sales
    const adv6 = evaluateProductCommercialV2(
      buildMetrics({ revenueThb7d: 1_500_000, salesVolume7d: 5000, rating: null, reviewCount: null }),
      { nowMs: NOW_MS }
    );
    assert.equal(adv6.customerQualityScore.score, null);
    assert.ok(adv6.riskTags.includes('UNVERIFIED_CUSTOMER_QUALITY'));

    // 7. Negative revenue (direct bypass of validateNumericMetric!)
    const baseForNeg = buildMetrics({});
    const adv7Metrics: ProductValidatedMetrics = {
      ...baseForNeg,
      revenueThb7d: {
        value: -250_000,
        state: 'OK',
        provenance: 'SOURCE',
        rawInput: -250_000,
        unit: 'THB',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        note: null,
      },
    };
    const adv7 = evaluateProductCommercialV2(adv7Metrics, { nowMs: NOW_MS });
    const adv7Strat = evaluateProductStrategiesV2(adv7Metrics, adv7, { scoringConfig: { nowMs: NOW_MS } });
    assert.ok(adv7.riskTags.includes('INVALID_METRICS_EXCLUDED'));
    assert.equal(adv7.competitionScore.status, 'INSUFFICIENT');
    assert.equal(adv7.isTopTierEligible, false);
    assert.notEqual(adv7Strat.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(adv7Strat.qualifiedStrategyIds.length, 0);

    // 8. Negative creator count (-5 = -smoothingPriorCreators -> formerly Infinity!)
    const adv8Metrics: ProductValidatedMetrics = {
      ...baseForNeg,
      creatorCount: {
        value: -5,
        state: 'OK',
        provenance: 'SOURCE',
        rawInput: -5,
        unit: 'COUNT',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        note: null,
      },
    };
    const adv8 = evaluateProductCommercialV2(adv8Metrics, { nowMs: NOW_MS });
    const adv8Strat = evaluateProductStrategiesV2(adv8Metrics, adv8, { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(adv8.competitionScore.status, 'INSUFFICIENT');
    assert.equal(adv8.rawRpcThb, null);
    assert.equal(adv8.adjustedRpcThb, null);
    assert.equal(adv8.isTopTierEligible, false);
    assert.ok(adv8.riskTags.includes('INVALID_METRICS_EXCLUDED'));
    assert.notEqual(adv8Strat.opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(adv8Strat.qualifiedStrategyIds.length, 0);

    // 9. NaN and Infinity numeric payloads
    const adv9Metrics: ProductValidatedMetrics = {
      ...baseForNeg,
      salesVolume7d: {
        value: Number.NaN,
        state: 'OK',
        provenance: 'SOURCE',
        rawInput: Number.NaN,
        unit: 'COUNT',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        note: null,
      },
      priceThb: {
        value: Number.POSITIVE_INFINITY,
        state: 'OK',
        provenance: 'SOURCE',
        rawInput: Number.POSITIVE_INFINITY,
        unit: 'THB',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        note: null,
      },
    };
    const adv9 = evaluateProductCommercialV2(adv9Metrics, { nowMs: NOW_MS });
    const adv9Strat = evaluateProductStrategiesV2(adv9Metrics, adv9, { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(adv9.earningScore.status, 'INSUFFICIENT');
    assert.equal(adv9.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(adv9.commercialOpportunityScore, null);
    assert.equal(adv9Strat.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(adv9Strat.qualifiedStrategyIds.length, 0);
    assert.ok(adv9.riskTags.includes('INVALID_METRICS_EXCLUDED'));

    // 10. Invalid numeric strings through full commercial & strategy pipeline
    const badPrice = validatePriceThbMetric('฿199 - ฿399', { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const badSales = validateNumericMetric({ rawInput: '1,23abc', unit: 'COUNT', fetchedAt: NOW_ISO, nowMs: NOW_MS });
    assert.equal(badPrice.state, 'INVALID');
    assert.equal(badPrice.value, null);
    assert.equal(badSales.state, 'INVALID');
    assert.equal(badSales.value, null);
    const badStringProd: ProductValidatedMetrics = {
      ...baseForNeg,
      priceThb: badPrice,
      salesVolume7d: badSales,
      revenueThb7d: validateNumericMetric({ rawInput: 'NaN', unit: 'THB', fetchedAt: NOW_ISO, nowMs: NOW_MS }),
    };
    const adv10Comm = evaluateProductCommercialV2(badStringProd, { nowMs: NOW_MS });
    const adv10Strat = evaluateProductStrategiesV2(badStringProd, adv10Comm, { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(adv10Comm.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(adv10Comm.commercialOpportunityScore, null);
    assert.equal(adv10Strat.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(adv10Strat.qualifiedStrategyIds.length, 0);

    // 11. Conflicting timestamps across metrics (> 6h spread within same product)
    const olderTs = new Date(NOW_MS - 14 * 3_600_000).toISOString();
    const conflictingTsMetrics: ProductValidatedMetrics = {
      ...baseForNeg,
      creatorCount: validateNumericMetric({
        rawInput: 5,
        unit: 'COUNT',
        fetchedAt: olderTs,
        dateRange: 'last7Day',
        nowMs: NOW_MS,
      }),
    };
    const adv11 = evaluateProductCommercialV2(conflictingTsMetrics, { nowMs: NOW_MS });
    const adv11Baseline = evaluateProductCommercialV2(
      buildMetrics({ creatorCount: 5 }),
      { nowMs: NOW_MS }
    );
    assert.ok(adv11.riskTags.includes('CONFLICTING_TIMESTAMPS'));
    assert.ok(adv11.dataConfidence.score < adv11Baseline.dataConfidence.score);

    // 12. Future timestamps (e.g., +2 hours ahead)
    const futureTs = new Date(NOW_MS + 2 * 3_600_000).toISOString();
    const adv12Direct = validateNumericMetric({
      rawInput: 500_000,
      unit: 'THB',
      fetchedAt: futureTs,
      nowMs: NOW_MS,
    });
    assert.equal(adv12Direct.state, 'INVALID');
    assert.equal(adv12Direct.value, null);
    const adv12Metrics: ProductValidatedMetrics = {
      ...baseForNeg,
      revenueThb7d: {
        ...baseForNeg.revenueThb7d,
        fetchedAt: futureTs,
      },
      salesVolume7d: {
        ...baseForNeg.salesVolume7d,
        fetchedAt: futureTs,
      },
    };
    const adv12Engine = evaluateProductCommercialV2(adv12Metrics, { nowMs: NOW_MS });
    const adv12Strat = evaluateProductStrategiesV2(adv12Metrics, adv12Engine, { scoringConfig: { nowMs: NOW_MS } });
    assert.equal(adv12Engine.demandScore.status, 'INSUFFICIENT');
    assert.equal(adv12Engine.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(adv12Engine.commercialOpportunityScore, null);
    assert.equal(adv12Strat.opportunityClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(adv12Strat.qualifiedStrategyIds.length, 0);
    assert.ok(adv12Engine.riskTags.includes('INVALID_METRICS_EXCLUDED'));

    // 13. Extremely stale data (30 days old)
    const veryStaleTs = new Date(NOW_MS - 30 * 24 * 3_600_000).toISOString();
    const adv13 = evaluateProductCommercialV2(buildMetrics({ fetchedAt: veryStaleTs }), { nowMs: NOW_MS });
    assert.equal(adv13.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.ok(adv13.riskTags.includes('STALE_DATA'));
    assert.ok(adv13.dataConfidence.score < 30);

    // 14. Duplicate product IDs (stale weak copy vs fresher strong copy)
    const staleDup = makeProduct('dup_item', { fetchedAt: new Date(NOW_MS - 48 * 3_600_000).toISOString() });
    const freshDup = makeProduct('dup_item', {
      fetchedAt: NOW_ISO,
      revenueThb7d: 720_000,
      salesVolume7d: 2400,
      creatorCount: 6,
    });
    const dedupRanked = rankProductIntelligenceV2([staleDup, freshDup], {
      scoringConfig: { nowMs: NOW_MS },
    });
    const dedupReversed = rankProductIntelligenceV2([freshDup, staleDup], {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(dedupRanked.poolSize, 1);
    assert.equal(dedupReversed.poolSize, 1);
    assert.deepEqual(dedupRanked.duplicateProductIdsRemoved, ['dup_item']);
    assert.equal(dedupRanked.overallRanking[0].opportunityClassification, 'TOP_OPPORTUNITY');
    assert.equal(
      dedupRanked.overallRanking[0].commercialOpportunityScore,
      dedupReversed.overallRanking[0].commercialOpportunityScore
    );

    // 15. Identical scores across distinct IDs -> canonical alphabetical ID tie-breaking
    const tieZ = makeProduct('prod_z', { revenueThb7d: 500_000, creatorCount: 7 });
    const tieA = makeProduct('prod_a', { revenueThb7d: 500_000, creatorCount: 7 });
    const tieM = makeProduct('prod_m', { revenueThb7d: 500_000, creatorCount: 7 });
    const tieRun = rankProductIntelligenceV2([tieZ, tieA, tieM], {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.deepEqual(
      tieRun.overallRanking.map((r) => r.productId),
      ['prod_a', 'prod_m', 'prod_z']
    );

    // 16. Conflicting source & synthetic values + videoRevenue > totalRevenue bug check
    const tamperedCommissionThb: ValidatedMetric<number> = {
      value: 999, // wildly disagrees with 300 * 15% = 45 THB
      state: 'OK',
      provenance: 'SYNTHETIC',
      rawInput: 999,
      unit: 'THB',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      note: null,
    };
    const conflictProduct = buildMetrics({
      priceThb: 300,
      commissionRate: 15,
      commissionThbOverride: tamperedCommissionThb,
      revenueThb7d: 100_000,
      videoRevenueThb7d: 500_000, // > totalRevenue!
      salesVolume7d: 333,
    });
    const adv16Comm = evaluateProductCommercialV2(conflictProduct, { nowMs: NOW_MS });
    const adv16Strat = evaluateProductStrategiesV2(conflictProduct, adv16Comm, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(adv16Comm.earningScore.payoutPerSaleThb, 45);
    assert.ok(adv16Comm.riskTags.includes('CONFLICTING_PAYOUT_METRIC'));
    assert.ok(adv16Comm.riskTags.includes('CONFLICTING_REVENUE_CHANNELS'));
    // Must NEVER silently produce QUALIFIED with null strategyScore
    assert.equal(adv16Strat.strategies.video_proven_winners.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(adv16Strat.strategies.video_proven_winners.strategyScore, null);
  });

  it('Section 4 & 5: Order independence, zero invalid/excluded pollution, and calibration sanity checks', () => {
    const baseSet: Array<StrategyCandidateInput<ProductItem>> = [
      makeProduct('c_top', {
        priceThb: 450,
        commissionRate: 20,
        revenueThb7d: 920_000,
        salesVolume7d: 2044,
        videoRevenueThb7d: 680_000,
        revenueGrowthRate: 65,
        creatorCount: 5,
        rating: 4.88,
        reviewCount: 410,
      }),
      makeProduct('c_profit', {
        priceThb: 1890,
        commissionRate: 20,
        revenueThb7d: 380_000,
        salesVolume7d: 201,
        videoRevenueThb7d: 70_000,
        revenueGrowthRate: 12,
        creatorCount: 20,
        rating: 4.6,
        reviewCount: 95,
      }),
      makeProduct('c_video', {
        priceThb: 199,
        commissionRate: 13,
        revenueThb7d: 890_000,
        salesVolume7d: 4472,
        videoRevenueThb7d: 840_000,
        liveRevenueThb7d: 10_000,
        revenueGrowthRate: 14,
        creatorCount: 15,
        rating: 4.45,
        reviewCount: 65,
      }),
      makeProduct('c_zero_comm', {
        commissionRate: 0,
        revenueThb7d: 1_500_000,
        creatorCount: 3,
      }),
      makeProduct('c_missing', {
        commissionRate: null,
        creatorCount: null,
      }),
      makeProduct('c_weak', {
        priceThb: 150,
        commissionRate: 25,
        revenueThb7d: 2_400,
        salesVolume7d: 16,
        creatorCount: 2,
      }),
    ];

    const refRun = rankProductIntelligenceV2(baseSet, { scoringConfig: { nowMs: NOW_MS } });
    for (const seed of [101, 202, 303, 404]) {
      const shuffled = seededShuffle(baseSet, seed);
      const run = rankProductIntelligenceV2(shuffled, { scoringConfig: { nowMs: NOW_MS } });

      assert.deepEqual(
        run.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore, r.opportunityClassification]),
        refRun.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore, r.opportunityClassification])
      );

      for (const id of ALL_STRATEGY_IDS) {
        const q = run.strategyRankings[id].qualifiedRankings;
        const refQ = refRun.strategyRankings[id].qualifiedRankings;
        assert.deepEqual(
          q.map((r) => [r.rank, r.productId, r.strategyScore]),
          refQ.map((r) => [r.rank, r.productId, r.strategyScore])
        );
        // Hard invariant: every qualified entry has QUALIFIED + finite non-null score
        for (const entry of q) {
          assert.equal(entry.eligibilityStatus, 'QUALIFIED');
          assert.equal(typeof entry.strategyScore, 'number');
          assert.ok(Number.isFinite(entry.strategyScore));
          assert.notEqual(entry.productId, 'c_zero_comm');
          assert.notEqual(entry.productId, 'c_missing');
          assert.notEqual(entry.productId, 'c_weak');
        }
        for (const ex of run.strategyRankings[id].excludedCandidates) {
          assert.notEqual(ex.eligibilityStatus, 'QUALIFIED');
          assert.equal(ex.strategyScore, null);
        }
      }
    }

    // Strategy separation check: c_video tops video_proven_winners or competes distinctly, while c_profit beats low-payout on profit_maximizer
    const profitOrder = refRun.strategyRankings.profit_maximizer.qualifiedRankings.map((e) => e.productId);
    assert.ok(profitOrder.includes('c_profit'));
    assert.equal(profitOrder[0], 'c_profit');

    // Commercial pool dedup invariant check
    const dupPool = rankCommercialOpportunitiesV2(
      [baseSet[0].item, baseSet[3].item, baseSet[0].item],
      { nowMs: NOW_MS }
    );
    assert.equal(dupPool.poolSize, 2);
  });

  it('Section 6: Performance & deterministic scaling benchmark (1, 20, 100, 500, 1,000 products)', () => {
    function makeScaleDataset(count: number): Array<StrategyCandidateInput<ProductItem>> {
      const list: Array<StrategyCandidateInput<ProductItem>> = [];
      for (let i = 0; i < count; i += 1) {
        const mod = i % 5;
        list.push(
          makeProduct(
            `scale_${String(i).padStart(4, '0')}`,
            {
              priceThb: 149 + (i % 8) * 120,
              commissionRate: mod === 4 ? 0 : 8 + (i % 15),
              revenueThb7d: 18_000 + (i % 25) * 42_000,
              salesVolume7d: 120 + (i % 25) * 140,
              videoRevenueThb7d: (10_000 + (i % 20) * 28_000),
              liveRevenueThb7d: 5_000 + (i % 10) * 4_000,
              revenueGrowthRate: mod === 3 ? null : -10 + (i % 18) * 6,
              creatorCount: 2 + (i % 45),
              rating: 3.9 + (i % 11) * 0.1,
              reviewCount: 15 + (i % 30) * 25,
            },
            undefined,
            mod === 0
              ? [makeSnapshot(72, 120_000, 4), makeSnapshot(36, 220_000, 5), makeSnapshot(0, 420_000, 6)]
              : undefined
          )
        );
      }
      return list;
    }

    const timings: Record<number, number> = {};
    for (const size of [1, 20, 100, 500, 1000]) {
      const dataset = makeScaleDataset(size);
      const t0 = performance.now();
      const res = rankProductIntelligenceV2(dataset, { scoringConfig: { nowMs: NOW_MS } });
      const elapsedMs = performance.now() - t0;
      timings[size] = Math.round(elapsedMs * 100) / 100;

      assert.equal(res.poolSize, size);
      assert.equal(res.overallRanking.length, size);
      assert.equal(res.smallPoolWarning, size < DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation.smallPoolWarningThreshold);
      assert.ok(elapsedMs < 1500, `Expected <= 1500ms for ${size} products, got ${elapsedMs}ms`);
    }

    // Determinism check across repeated 100-product runs
    const d100 = makeScaleDataset(100);
    const runA = rankProductIntelligenceV2(d100, { scoringConfig: { nowMs: NOW_MS } });
    const runB = rankProductIntelligenceV2(seededShuffle(d100, 777), { scoringConfig: { nowMs: NOW_MS } });
    assert.deepEqual(
      runA.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore]),
      runB.overallRanking.map((r) => [r.rank, r.productId, r.commercialOpportunityScore])
    );

    // Emit structured performance metrics in test diagnostic output
    console.info(`PHASE4_PERF_BENCHMARK_MS=${JSON.stringify(timings)}`);
  });

  it('Section 7: V1 regression & storage hydration compatibility remain intact alongside V2', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };

    const raw = parseRawProductRow(
      {
        product_id: 'reg_v1_v2_99',
        product_name: 'แปรงทำความสะอาด 360',
        unit_price: 199,
        commission_rate: 0.15,
        sales_volumn: 1400,
        revenue: 278_600,
        video_revenue: 220_000,
        live_revenue: 15_000,
      },
      'fallback_reg',
      'rank',
      NOW_ISO
    );
    assert.ok(raw);

    const derivedCommThb = raw.priceThb !== null && raw.commissionRate !== null
      ? Math.round(raw.priceThb * raw.commissionRate * 100) / 100
      : null;

    const v1Score = computeDirectKalodataScore({
      thaiTitle: raw.thaiTitle,
      category: 'home',
      priceThb: raw.priceThb,
      commissionRate: raw.commissionRate,
      commissionThb: derivedCommThb,
      salesVolume7d: raw.salesVolume7d,
      revenueThb7d: raw.revenueThb7d,
      videoRevenueThb7d: raw.videoRevenueThb7d,
      revenueGrowthRate: raw.revenueGrowthRate,
      hasImage: true,
    });
    assert.ok(v1Score.total >= 70 && v1Score.total <= 100);

    const baseProduct: ProductItem = {
      id: raw.id,
      thaiTitle: raw.thaiTitle,
      clearTitle: { my: 'Brush', en: 'Brush' },
      whatItIs: { my: 'Brush', en: 'Brush' },
      whySilentWorks: { my: 'Brush', en: 'Brush' },
      category: 'home',
      categoryLabel: { my: 'Home', en: 'Home' },
      shopName: 'Shop TH',
      priceThb: raw.priceThb,
      commissionRate: raw.commissionRate,
      commissionThb: derivedCommThb,
      visualTags: ['360', 'Demo'],
      scoreBreakdown: v1Score,
      kalodataMetrics: raw.kalodataMetrics,
      validatedMetrics: raw.validatedMetrics,
      commercialScoreV2: evaluateProductCommercialV2(raw.validatedMetrics, { nowMs: NOW_MS }),
      strategyIntelligenceV2: evaluateProductStrategiesV2(raw.validatedMetrics, undefined, {
        scoringConfig: { nowMs: NOW_MS },
      }),
    };

    const verifiedUpdatedMetrics = buildMetrics({
      priceThb: 199,
      commissionRate: 15,
      revenueThb7d: 320_000,
      salesVolume7d: 1608,
      creatorCount: 6,
      revenueGrowthRate: 40,
      fetchedAt: NOW_ISO,
    });

    saveDeepInsightForProduct(baseProduct.id, {
      deepInsights: { description: 'Hydrated deep details', fetchedAt: NOW_ISO },
      validatedMetrics: verifiedUpdatedMetrics,
    });

    const hydrated = hydrateProductFromStorage({
      ...baseProduct,
      validatedMetrics: {
        ...raw.validatedMetrics,
        fetchedAt: new Date(NOW_MS - 3_600_000).toISOString(),
      },
    });
    assert.equal(hydrated.scoreBreakdown?.total, v1Score.total);
    assert.equal(hydrated.commercialScoreV2?.eligibilityStatus, 'ELIGIBLE');
    assert.ok((hydrated.strategyIntelligenceV2?.qualifiedStrategyIds.length ?? 0) >= 1);

    // Also ensure legacy ProductItem adaptation produces valid V2 structures
    const adapted = adaptProductItemToValidatedMetrics({
      ...baseProduct,
      validatedMetrics: undefined,
    });
    assert.equal(adapted.sourceEndpoint, 'legacy_product');
  });
});
