import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSyntheticCommissionThb,
  computeSyntheticRevenueEstimate,
  DEFAULT_METRIC_STALE_MS,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import {
  DEFAULT_COMMERCIAL_SCORING_V2_CONFIG,
  evaluateProductCommercialV2,
  evaluateProductPoolCommercialV2,
  rankCommercialOpportunitiesV2,
} from '../src/lib/scoringEngineV2.ts';
import { parseRawProductRow } from '../server/kalodata.ts';
import { computeDirectKalodataScore } from '../server/scoreEngine.ts';
import type { ProductValidatedMetrics } from '../src/types/metrics.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

interface VerifiedMetricsSeed {
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

function buildVerifiedMetrics(seed: VerifiedMetricsSeed): ProductValidatedMetrics {
  const fetchedAt = seed.fetchedAt ?? NOW_ISO;
  const dateRange = 'last7Day';

  const priceThb = validatePriceThbMetric(seed.priceThb === undefined ? 249 : seed.priceThb, {
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
    rawInput: seed.revenueThb7d === undefined ? 448200 : seed.revenueThb7d,
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
    rawInput: seed.videoRevenueThb7d === undefined ? 320000 : seed.videoRevenueThb7d,
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
    rawInput: seed.liveRevenueThb7d === undefined ? 45000 : seed.liveRevenueThb7d,
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
  const rawGrowth = seed.revenueGrowthRate === undefined ? 42 : seed.revenueGrowthRate;
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
  const rawCreator = seed.creatorCount === undefined ? 8 : seed.creatorCount;
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
  const rawReviews = seed.reviewCount === undefined ? 320 : seed.reviewCount;
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

describe('Phase 2 — Commercial Scoring Engine V2', () => {
  it('1. High demand, positive growth, low creator count, strong RPC scores top-tier ELIGIBLE', () => {
    const metrics = buildVerifiedMetrics({
      priceThb: 390,
      commissionRate: 18,
      revenueThb7d: 780_000,
      salesVolume7d: 2000,
      revenueGrowthRate: 55,
      creatorCount: 6,
      rating: 4.8,
      reviewCount: 420,
    });

    const result = evaluateProductCommercialV2(metrics, { nowMs: NOW_MS });

    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
    assert.equal(result.isTopTierEligible, true);
    assert.ok((result.demandScore.score ?? 0) >= 80);
    assert.ok((result.earningScore.score ?? 0) >= 70);
    assert.ok((result.competitionScore.score ?? 0) >= 85);
    assert.ok((result.customerQualityScore.score ?? 0) >= 85);
    assert.ok((result.commercialOpportunityScore ?? 0) >= 75);
    assert.equal(result.rawRpcThb, 130_000);
    assert.equal(result.adjustedRpcThb, Math.round((780_000 / (6 + 5)) * 100) / 100);
    assert.equal(result.dataConfidence.level, 'HIGH');
    assert.ok(result.opportunityTags.includes('HIGH_DEMAND'));
    assert.ok(result.opportunityTags.includes('POSITIVE_GROWTH'));
    assert.ok(result.opportunityTags.includes('LOW_COMPETITION'));
    assert.ok(result.opportunityTags.includes('STRONG_RPC'));
  });

  it('2. High revenue but extremely high creator competition is penalized in Competition and Commercial Score', () => {
    const lowComp = evaluateProductCommercialV2(
      buildVerifiedMetrics({ revenueThb7d: 600_000, creatorCount: 6 }),
      { nowMs: NOW_MS }
    );
    const crowded = evaluateProductCommercialV2(
      buildVerifiedMetrics({ revenueThb7d: 600_000, creatorCount: 650 }),
      { nowMs: NOW_MS }
    );

    assert.equal(crowded.rawRpcThb, Math.round((600_000 / 650) * 100) / 100);
    assert.equal(crowded.adjustedRpcThb, Math.round((600_000 / 655) * 100) / 100);
    assert.ok((crowded.competitionScore.score ?? 100) < 25);
    assert.ok(crowded.riskTags.includes('EXTREME_COMPETITION'));
    assert.equal(crowded.isTopTierEligible, false);
    assert.ok(
      (crowded.commercialOpportunityScore ?? 100) <
        (lowComp.commercialOpportunityScore ?? 0) - 25
    );
  });

  it('3. Low revenue with very few creators is distinguished from real low-competition opportunity', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        priceThb: 150,
        commissionRate: 15,
        revenueThb7d: 3_000,
        salesVolume7d: 20,
        revenueGrowthRate: 10,
        creatorCount: 1,
        rating: 4.7,
        reviewCount: 60,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.rawRpcThb, 3_000);
    assert.equal(result.adjustedRpcThb, 500);
    assert.ok((result.competitionScore.score ?? 100) < 30);
    assert.equal(result.eligibilityStatus, 'RESTRICTED_WEAK_DEMAND');
    assert.equal(result.isTopTierEligible, false);
    assert.ok((result.commercialOpportunityScore ?? 100) <= DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation.weakDemandCap);
    assert.ok(result.riskTags.includes('WEAK_DEMAND'));
  });

  it('4. High commission but weak demand cannot rank highly', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        priceThb: 250,
        commissionRate: 35,
        revenueThb7d: 2_500,
        salesVolume7d: 10,
        revenueGrowthRate: 0,
        creatorCount: 2,
        rating: 4.6,
        reviewCount: 80,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.eligibilityStatus, 'RESTRICTED_WEAK_DEMAND');
    assert.equal(result.isTopTierEligible, false);
    assert.ok((result.demandScore.score ?? 100) < 30);
    assert.ok((result.commercialOpportunityScore ?? 100) <= 35);
    assert.ok(result.riskTags.includes('WEAK_DEMAND'));
  });

  it('5. Strong demand but verified 0% commission is marked NOT_MONETIZABLE and excluded/capped at 0', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        priceThb: 490,
        commissionRate: 0,
        revenueThb7d: 1_200_000,
        salesVolume7d: 2450,
        revenueGrowthRate: 60,
        creatorCount: 4,
        rating: 4.9,
        reviewCount: 600,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.earningScore.status, 'NOT_MONETIZABLE');
    assert.equal(result.earningScore.score, 0);
    assert.equal(result.earningScore.payoutPerSaleThb, 0);
    assert.equal(result.eligibilityStatus, 'NOT_MONETIZABLE');
    assert.equal(result.isTopTierEligible, false);
    assert.equal(result.commercialOpportunityScore, 0);
    assert.ok(result.riskTags.includes('ZERO_COMMISSION'));
    assert.ok(result.riskTags.includes('NOT_MONETIZABLE'));
    // Data confidence remains independent of commercial attractiveness
    assert.equal(result.dataConfidence.level, 'HIGH');
  });

  it('6. Missing commission does not fabricate an earning score and marks INSUFFICIENT_DATA', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        commissionRate: null,
        revenueThb7d: 600_000,
        salesVolume7d: 2400,
        creatorCount: 5,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.earningScore.status, 'INSUFFICIENT');
    assert.equal(result.earningScore.score, null);
    assert.equal(result.earningScore.payoutPerSaleThb, null);
    assert.equal(result.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(result.commercialOpportunityScore, null);
    assert.equal(result.isTopTierEligible, false);
    assert.ok(result.missingMetrics.includes('commissionRate'));
  });

  it('7. Unverified creator count withholds RPC/competition and blocks top-tier eligibility', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 750_000,
        salesVolume7d: 3000,
        creatorCount: 4,
        creatorUnit: 'UNVERIFIED',
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.competitionScore.status, 'INSUFFICIENT');
    assert.equal(result.competitionScore.score, null);
    assert.equal(result.rawRpcThb, null);
    assert.equal(result.adjustedRpcThb, null);
    assert.equal(result.eligibilityStatus, 'PARTIAL_EVIDENCE');
    assert.equal(result.isTopTierEligible, false);
    assert.ok(
      (result.commercialOpportunityScore ?? 100) <=
        DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation.missingCompetitionCap
    );
    assert.ok(result.missingMetrics.includes('creatorCount'));
    assert.ok(result.riskTags.includes('MISSING_COMPETITION_DATA'));
  });

  it('8. Zero creators with positive revenue avoids Infinity RPC and avoids automatic perfect score', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 400_000,
        salesVolume7d: 1600,
        creatorCount: 0,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.competitionScore.status, 'SCORED');
    assert.equal(result.rawRpcThb, null);
    assert.equal(result.adjustedRpcThb, 400_000 / 5);
    assert.ok(Number.isFinite(result.competitionScore.adjustedRpcThb));
    assert.ok(
      (result.competitionScore.score ?? 100) <=
        DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.competition.zeroCreatorScoreCap
    );
    assert.equal(result.isTopTierEligible, false);
    assert.ok(result.riskTags.includes('ZERO_CREATORS_POSITIVE_REVENUE'));
  });

  it('9. Missing growth data is not treated as 0% growth and remains strictly below verified positive growth', () => {
    const missingGrowth = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 500_000,
        salesVolume7d: 2000,
        revenueGrowthRate: null,
      }),
      { nowMs: NOW_MS }
    );
    const flatZeroGrowth = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 500_000,
        salesVolume7d: 2000,
        revenueGrowthRate: 0,
        growthUnit: 'PERCENT',
      }),
      { nowMs: NOW_MS }
    );
    const positiveGrowth = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 500_000,
        salesVolume7d: 2000,
        revenueGrowthRate: 50,
        growthUnit: 'PERCENT',
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(missingGrowth.demandScore.growthStatus, 'MISSING');
    assert.equal(missingGrowth.demandScore.subcomponents.growthScore, null);
    assert.equal(missingGrowth.demandScore.subcomponents.verifiedGrowthPercent, null);
    assert.equal(flatZeroGrowth.demandScore.growthStatus, 'VERIFIED');
    assert.equal(flatZeroGrowth.demandScore.subcomponents.growthScore, 50);
    assert.ok((positiveGrowth.demandScore.score ?? 0) > (flatZeroGrowth.demandScore.score ?? 0));
    assert.ok((flatZeroGrowth.demandScore.score ?? 0) >= (missingGrowth.demandScore.score ?? 0));
    assert.ok(missingGrowth.missingMetrics.includes('revenueGrowthRate'));
  });

  it('10. Unverified growth unit (or missing period) is excluded from Demand and does not raise confidence', () => {
    const unverifiedUnit = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueGrowthRate: 0.65,
        growthUnit: 'UNVERIFIED',
      }),
      { nowMs: NOW_MS }
    );
    const missingPeriod = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueGrowthRate: 65,
        growthUnit: 'PERCENT',
        growthDateRange: null,
      }),
      { nowMs: NOW_MS }
    );
    const missingGrowth = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueGrowthRate: null,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(unverifiedUnit.demandScore.growthStatus, 'UNVERIFIED');
    assert.equal(unverifiedUnit.demandScore.subcomponents.growthScore, null);
    assert.equal(missingPeriod.demandScore.growthStatus, 'UNVERIFIED');
    assert.equal(missingPeriod.demandScore.subcomponents.growthScore, null);
    assert.equal(unverifiedUnit.dataConfidence.score, missingGrowth.dataConfidence.score);
  });

  it('11. High rating with very few reviews shrinks via Bayesian prior and is capped', () => {
    const lowSample = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        rating: 5.0,
        reviewCount: 2,
      }),
      { nowMs: NOW_MS }
    );
    const highSample = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        rating: 4.9,
        reviewCount: 400,
      }),
      { nowMs: NOW_MS }
    );

    assert.ok((lowSample.customerQualityScore.bayesianRating ?? 5) < 4.1);
    assert.ok(
      (lowSample.customerQualityScore.score ?? 100) <=
        DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.customerQuality.lowSampleScoreCap
    );
    assert.ok(lowSample.riskTags.includes('LOW_REVIEW_SAMPLE'));
    assert.ok((highSample.customerQualityScore.score ?? 0) > (lowSample.customerQualityScore.score ?? 100) + 25);
  });

  it('12. Poor rating with a large review sample triggers RESTRICTED_POOR_QUALITY penalty', () => {
    const result = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        revenueThb7d: 750_000,
        salesVolume7d: 3000,
        commissionRate: 18,
        creatorCount: 6,
        rating: 3.1,
        reviewCount: 450,
      }),
      { nowMs: NOW_MS }
    );

    assert.equal(result.customerQualityScore.riskFlag, 'POOR_CUSTOMER_QUALITY');
    assert.equal(result.eligibilityStatus, 'RESTRICTED_POOR_QUALITY');
    assert.equal(result.isTopTierEligible, false);
    assert.ok(
      (result.commercialOpportunityScore ?? 100) <=
        DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation.poorQualityCap
    );
    assert.ok(result.riskTags.includes('POOR_CUSTOMER_QUALITY'));
  });

  it('13. Synthetic revenue cannot award high demand and significantly reduces Data Confidence', () => {
    const base = buildVerifiedMetrics({
      priceThb: 299,
      salesVolume7d: 1500,
      revenueThb7d: null,
    });
    const syntheticRev = computeSyntheticRevenueEstimate(base.salesVolume7d, base.priceThb);
    assert.equal(syntheticRev.provenance, 'SYNTHETIC');

    const withSyntheticOnlyRev: ProductValidatedMetrics = {
      ...base,
      salesVolume7d: validateNumericMetric({
        rawInput: null,
        unit: 'COUNT',
        fetchedAt: NOW_ISO,
        nowMs: NOW_MS,
      }),
      revenueThb7d: syntheticRev,
    };

    const resultBlocked = evaluateProductCommercialV2(withSyntheticOnlyRev, { nowMs: NOW_MS });
    assert.equal(resultBlocked.demandScore.status, 'INSUFFICIENT');
    assert.equal(resultBlocked.demandScore.score, null);
    assert.equal(resultBlocked.commercialOpportunityScore, null);
    assert.ok(resultBlocked.riskTags.includes('SYNTHETIC_REVENUE'));
    assert.ok(resultBlocked.dataConfidence.score < 60);

    // Even when SOURCE salesVolume exists alongside SYNTHETIC revenue, synthetic revenue is excluded and confidence drops
    const withSourceSalesAndSyntheticRev: ProductValidatedMetrics = {
      ...base,
      revenueThb7d: syntheticRev,
    };
    const verifiedAll = evaluateProductCommercialV2(buildVerifiedMetrics({}), { nowMs: NOW_MS });
    const partialSynthetic = evaluateProductCommercialV2(withSourceSalesAndSyntheticRev, {
      nowMs: NOW_MS,
    });
    assert.ok(partialSynthetic.demandScore.excludedMetrics.some((e) => e.includes('SYNTHETIC')));
    assert.equal(partialSynthetic.competitionScore.status, 'INSUFFICIENT');
    assert.ok(partialSynthetic.dataConfidence.score < verifiedAll.dataConfidence.score - 20);
  });

  it('14. Stale source data is excluded from scoring and lowers Data Confidence', () => {
    const staleFetchedAt = new Date(NOW_MS - DEFAULT_METRIC_STALE_MS - 3_600_000).toISOString();
    const staleMetrics = buildVerifiedMetrics({ fetchedAt: staleFetchedAt });

    const result = evaluateProductCommercialV2(staleMetrics, { nowMs: NOW_MS });

    assert.equal(result.demandScore.status, 'INSUFFICIENT');
    assert.equal(result.earningScore.status, 'INSUFFICIENT');
    assert.equal(result.competitionScore.status, 'INSUFFICIENT');
    assert.equal(result.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(result.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(result.commercialOpportunityScore, null);
    assert.ok(result.riskTags.includes('STALE_DATA'));
    assert.ok(result.dataConfidence.score < 35);
    assert.ok(['LOW', 'VERY_LOW'].includes(result.dataConfidence.level));
  });

  it('15. Several missing dimensions remain INSUFFICIENT_DATA without average imputation', () => {
    const metrics = buildVerifiedMetrics({
      revenueThb7d: 900_000,
      salesVolume7d: 3500,
      commissionRate: 20,
      creatorCount: null,
      rating: null,
      reviewCount: null,
      revenueGrowthRate: null,
    });

    const result = evaluateProductCommercialV2(metrics, { nowMs: NOW_MS });

    assert.equal(result.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(result.commercialOpportunityScore, null);
    assert.equal(result.isTopTierEligible, false);
    assert.ok(result.dataConfidence.score < 55);
  });

  it('16. Very small product pool produces stable absolute scores without percentile distortion', () => {
    const weakItem: ProductItem = {
      id: 'weak_1',
      thaiTitle: 'สินค้าทดลอง 1',
      clearTitle: { my: 'Weak', en: 'Weak' },
      whatItIs: { my: 'Weak', en: 'Weak' },
      whySilentWorks: { my: 'Weak', en: 'Weak' },
      category: 'home',
      categoryLabel: { my: 'Home', en: 'Home' },
      shopName: 'Shop A',
      priceThb: 100,
      commissionRate: 10,
      commissionThb: 10,
      visualTags: [],
      validatedMetrics: buildVerifiedMetrics({
        priceThb: 100,
        commissionRate: 10,
        revenueThb7d: 2_000,
        salesVolume7d: 20,
        creatorCount: 4,
      }),
    };

    const singlePool = evaluateProductPoolCommercialV2([weakItem], { nowMs: NOW_MS });
    const largerPool = evaluateProductPoolCommercialV2(
      [
        weakItem,
        {
          ...weakItem,
          id: 'strong_1',
          validatedMetrics: buildVerifiedMetrics({
            revenueThb7d: 900_000,
            salesVolume7d: 3600,
            creatorCount: 5,
          }),
        },
      ],
      { nowMs: NOW_MS }
    );

    assert.equal(singlePool.smallPoolWarning, true);
    assert.equal(
      singlePool.results[0].score.commercialOpportunityScore,
      largerPool.results[0].score.commercialOpportunityScore
    );
    // Weak item in a 1-item pool must NOT receive an inflated percentile score like 100
    assert.ok((singlePool.results[0].score.commercialOpportunityScore ?? 100) <= 35);
  });

  it('17. Identical products produce 100% deterministic results and ignore visual suitability', () => {
    const sharedMetrics = buildVerifiedMetrics({
      priceThb: 299,
      commissionRate: 0.15,
      commissionUnit: 'RATIO',
      revenueThb7d: 550_000,
      salesVolume7d: 1840,
      revenueGrowthRate: 0.35,
      growthUnit: 'RATIO',
      creatorCount: 7,
      rating: 4.7,
      reviewCount: 210,
    });

    const productA: ProductItem = {
      id: 'prod_same_a',
      thaiTitle: 'เซรั่มบำรุงผิว',
      clearTitle: { my: 'Serum', en: 'Serum' },
      whatItIs: { my: 'Skincare', en: 'Skincare' },
      whySilentWorks: { my: 'Glow', en: 'Glow' },
      category: 'beauty',
      categoryLabel: { my: 'Beauty', en: 'Beauty' },
      shopName: 'Shop TH',
      priceThb: 299,
      commissionRate: 15,
      commissionThb: 44.85,
      visualTags: ['Macro Texture', 'ASMR Sound', 'Instant Before-After'],
      scoreBreakdown: {
        total: 95,
        grade: 'top',
        visualDemo: 98,
        aiSuitability: 96,
        salesDemand: 90,
        commissionValue: 88,
        speechPenalty: 0,
      },
      validatedMetrics: sharedMetrics,
    };

    const productB: ProductItem = {
      ...productA,
      category: 'wellness',
      visualTags: [],
      scoreBreakdown: {
        total: 42,
        grade: 'low',
        visualDemo: 35,
        aiSuitability: 35,
        salesDemand: 60,
        commissionValue: 60,
        speechPenalty: 16,
      },
      validatedMetrics: sharedMetrics,
    };

    const evalA1 = evaluateProductCommercialV2(productA, { nowMs: NOW_MS });
    const evalA2 = evaluateProductCommercialV2(productA, { nowMs: NOW_MS });
    const evalB = evaluateProductCommercialV2(productB, { nowMs: NOW_MS });

    assert.deepEqual(evalA1, evalA2);
    // Visual suitability and V1 silent-visual score must have ZERO effect on Commercial Opportunity V2
    assert.deepEqual(evalA1, evalB);
  });

  it('Enforces exact payout without 1 THB floor, separates ConversionEvidence, and ranks monetizable winners first', () => {
    const tinyPayout = evaluateProductCommercialV2(
      buildVerifiedMetrics({
        priceThb: 29,
        commissionRate: 2,
        commissionUnit: 'PERCENT',
        revenueThb7d: 145_000,
        videoRevenueThb7d: 110_000,
        liveRevenueThb7d: 15_000,
        salesVolume7d: 5000,
        creatorCount: 6,
      }),
      { nowMs: NOW_MS }
    );
    assert.equal(tinyPayout.earningScore.payoutPerSaleThb, 0.58);
    assert.equal(tinyPayout.conversionEvidence.dominantChannel, 'VIDEO');
    assert.ok(tinyPayout.conversionEvidence.videoRevenueShare !== null);
    assert.match(tinyPayout.conversionEvidence.disclaimer, /does not guarantee/i);

    const zeroComm = buildVerifiedMetrics({
      commissionRate: 0,
      revenueThb7d: 990_000,
      salesVolume7d: 4000,
      creatorCount: 3,
    });
    const winner = buildVerifiedMetrics({
      priceThb: 390,
      commissionRate: 18,
      revenueThb7d: 780_000,
      salesVolume7d: 2000,
      revenueGrowthRate: 45,
      creatorCount: 6,
    });
    const incomplete = buildVerifiedMetrics({
      commissionRate: null,
      creatorCount: null,
    });

    const ranked = rankCommercialOpportunitiesV2(
      [
        { id: 'zero_comm', validatedMetrics: zeroComm },
        { id: 'incomplete', validatedMetrics: incomplete },
        { id: 'winner', validatedMetrics: winner },
      ],
      { nowMs: NOW_MS }
    );

    assert.equal(ranked.results[0].productId, 'winner');
    assert.equal(ranked.results[1].productId, 'incomplete');
    assert.equal(ranked.results[2].productId, 'zero_comm');

    // Phase 1 parser + V1 scoreEngine still operate cleanly alongside V2
    const raw = parseRawProductRow(
      {
        product_id: '998877665544',
        product_name: 'สินค้าทดสอบ V1+V2',
        unit_price: 250,
        commission_rate: 0,
        sales_volumn: 400,
        revenue: 100_000,
        video_revenue: 80_000,
      },
      'fallback_v2',
      'rank',
      NOW_ISO,
      { nowMs: NOW_MS }
    );
    assert.ok(raw);
    const v1 = computeDirectKalodataScore({
      thaiTitle: raw.thaiTitle,
      category: 'home',
      priceThb: raw.priceThb,
      commissionRate: raw.commissionRate,
      commissionThb: 0,
      salesVolume7d: raw.salesVolume7d,
      revenueThb7d: raw.revenueThb7d,
      videoRevenueThb7d: raw.videoRevenueThb7d,
      revenueGrowthRate: raw.revenueGrowthRate,
      hasImage: false,
    });
    const v2 = evaluateProductCommercialV2(raw.validatedMetrics, { nowMs: NOW_MS });
    assert.ok(v1.total > 0);
    assert.equal(v2.eligibilityStatus, 'NOT_MONETIZABLE');
  });
});
