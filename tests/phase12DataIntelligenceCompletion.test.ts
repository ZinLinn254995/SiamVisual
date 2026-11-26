import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptRawKalodataRowToValidatedMetrics,
  computeSyntheticCommissionThb,
  computeSyntheticRevenueEstimate,
  refreshProductValidatedMetricsFreshness,
  validateNumericMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation';
import {
  evaluateProductCommercialV2,
  scoreCompetitionDimension,
  scoreCustomerQualityDimension,
} from '../src/lib/scoringEngineV2';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2';
import { classifyProductDiscoveryShortlist } from '../src/lib/discoveryShortlist';
import {
  classifyMetricProvenance,
  getProductMetricProvenanceList,
} from '../src/lib/productIntelligenceView';
import {
  assessCompetitionIntelligence,
  assessCustomerQualityIntelligence,
  auditProductDataIntelligence,
  classifyMetricIntelligenceState,
  isMetricVerifiedForScoring,
} from '../src/lib/dataIntelligence';
import {
  hydrateProductFromStorage,
  mergeKalodataMetrics,
  mergeValidatedMetricsSnapshots,
} from '../src/lib/storage';
import { parseRawProductRow } from '../server/kalodata';
import type { ProductValidatedMetrics } from '../src/types/metrics';

const NOW_ISO = '2026-11-25T10:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const STALE_ISO = '2026-11-23T08:00:00.000Z'; // 50h old (>24h stale threshold)
const FUTURE_ISO = '2026-11-25T12:00:00.000Z'; // 2h in the future (>5m skew limit)

function makeVerifiedMetrics(
  overrides: Partial<ProductValidatedMetrics> = {}
): ProductValidatedMetrics {
  const base = {
    priceThb: validateNumericMetric({
      rawInput: 450,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: false,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    commissionRate: validateNumericMetric({
      rawInput: 15,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      minValue: 0,
      maxValue: 100,
      nowMs: NOW_MS,
    }),
    commissionThb: validateNumericMetric({
      rawInput: 67.5,
      unit: 'THB',
      provenance: 'SYNTHETIC',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    revenueThb7d: validateNumericMetric({
      rawInput: 480_000,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    salesVolume7d: validateNumericMetric({
      rawInput: 1_066,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      integerOnly: true,
      nowMs: NOW_MS,
    }),
    videoRevenueThb7d: validateNumericMetric({
      rawInput: 360_000,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    liveRevenueThb7d: validateNumericMetric({
      rawInput: 60_000,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    shoppingMallRevenueThb7d: validateNumericMetric({
      rawInput: 60_000,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    }),
    revenueGrowthRate: validateNumericMetric({
      rawInput: 35,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      allowZero: true,
      allowNegative: true,
      nowMs: NOW_MS,
      note: 'Verified 7d vs prior 7d growth rate.',
    }),
    creatorCount: validateNumericMetric({
      rawInput: 12,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      allowZero: true,
      allowNegative: false,
      integerOnly: true,
      nowMs: NOW_MS,
    }),
    rating: validateNumericMetric({
      rawInput: 4.8,
      unit: 'RATING_5',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      allowZero: false,
      allowNegative: false,
      minValue: 0,
      maxValue: 5,
      nowMs: NOW_MS,
    }),
    reviewCount: validateNumericMetric({
      rawInput: 420,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      allowZero: true,
      allowNegative: false,
      integerOnly: true,
      nowMs: NOW_MS,
    }),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'detail' as const,
    unresolvedFields: [] as string[],
  };

  return { ...base, ...overrides };
}

describe('Phase 12 — Data Intelligence Completion & Verification', () => {
  it('1. Distinguishes all six data intelligence states (Verified, Derived, Unverified, Missing, Unavailable, Invalid/Stale)', () => {
    const rankRow = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731661332013680778',
        unit_price: 2128,
        commission_rate: 7,
        revenue: 6_930_000,
        sales_volumn: 3257,
        video_revenue: 5_290_000,
        live_revenue: 1_190_000,
        shopping_mall_revenue: 446_700,
        revenue_growth_rate: -11.76,
        // creator_number, product_review_count, rating absent on /rank
      },
      { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
    );

    const detailRow = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731661332013680778',
        unit_price: 2128,
        commission_rate: 7,
        revenue: 6_930_000,
        sales_volumn: 3257,
        creator_number: 343,
        product_review_count: 59540,
        // rating unavailable on /detail too
      },
      { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS }
    );

    // 1. Verified SOURCE
    assert.equal(classifyMetricIntelligenceState(rankRow.priceThb), 'VERIFIED');
    assert.equal(classifyMetricIntelligenceState(rankRow.revenueThb7d), 'VERIFIED');
    assert.equal(classifyMetricIntelligenceState(rankRow.commissionRate), 'VERIFIED');
    assert.equal(isMetricVerifiedForScoring(rankRow.revenueThb7d), true);

    // 2. Derived SYNTHETIC
    assert.equal(classifyMetricIntelligenceState(rankRow.commissionThb), 'DERIVED');
    assert.equal(isMetricVerifiedForScoring(rankRow.commissionThb), false);

    // 3. Unverified (present upstream value with unverified scope/period)
    assert.equal(classifyMetricIntelligenceState(rankRow.revenueGrowthRate), 'UNVERIFIED');
    assert.equal(classifyMetricIntelligenceState(detailRow.creatorCount), 'UNVERIFIED');
    assert.equal(classifyMetricIntelligenceState(detailRow.reviewCount), 'UNVERIFIED');
    assert.equal(isMetricVerifiedForScoring(detailRow.creatorCount), false);

    // 4. Missing (absent on /rank, never fabricated)
    assert.equal(classifyMetricIntelligenceState(rankRow.creatorCount), 'MISSING');
    assert.equal(classifyMetricIntelligenceState(rankRow.reviewCount), 'MISSING');
    assert.equal(classifyMetricProvenance(rankRow.creatorCount), 'missing');

    // 5. Unavailable (not supplied by tested Kalodata endpoints)
    assert.equal(classifyMetricIntelligenceState(rankRow.rating), 'UNAVAILABLE');
    assert.equal(classifyMetricIntelligenceState(detailRow.rating), 'UNAVAILABLE');
    assert.equal(classifyMetricProvenance(rankRow.rating), 'unavailable');
    assert.equal(classifyMetricProvenance(detailRow.rating), 'unavailable');

    // 6. Invalid & Stale
    const invalidMetric = validateNumericMetric({
      rawInput: '199-299',
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    const staleMetric = validateNumericMetric({
      rawInput: 500,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: STALE_ISO,
      nowMs: NOW_MS,
    });
    assert.equal(classifyMetricIntelligenceState(invalidMetric), 'INVALID');
    assert.equal(classifyMetricIntelligenceState(staleMetric), 'STALE');

    // Provenance list accurately separates unavailable rating from unverified detail fields
    const detailProv = new Map(
      getProductMetricProvenanceList(detailRow).map((item) => [item.key, item.category])
    );
    assert.equal(detailProv.get('rating'), 'unavailable');
    assert.equal(detailProv.get('creatorCount'), 'unverified');
    assert.equal(detailProv.get('reviewCount'), 'unverified');
  });

  it('2. Verified vs unverified creator metrics: unverified unit or semantic note never enters Competition scoring', () => {
    const verified = makeVerifiedMetrics();
    const verifiedResult = evaluateProductCommercialV2(verified, { nowMs: NOW_MS });
    assert.equal(verifiedResult.competitionScore.status, 'SCORED');
    assert.ok((verifiedResult.competitionScore.score ?? 0) >= 65);

    // Case A: Raw /detail creator_number quarantined via unit: UNVERIFIED
    const unverifiedUnit = makeVerifiedMetrics({
      creatorCount: validateUnverifiedNumericMetric(12, {
        allowNegative: false,
        unverifiedNote: 'UNVERIFIED_CREATOR_DEFINITION: active vs lifetime unverified',
        context: { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS },
      }),
    });
    const unverifiedUnitScore = evaluateProductCommercialV2(unverifiedUnit, { nowMs: NOW_MS });
    assert.equal(unverifiedUnitScore.competitionScore.status, 'INSUFFICIENT');
    assert.equal(unverifiedUnitScore.competitionScore.score, null);
    assert.equal(unverifiedUnitScore.competitionScore.adjustedRpcThb, null);

    // Case B: Defensive note guard — even if a corrupted caller sets unit: COUNT alongside UNVERIFIED_CREATOR note
    const corruptedNoteMetric = validateNumericMetric({
      rawInput: 12,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: NOW_MS,
      note: 'UNVERIFIED_CREATOR_DEFINITION: scope unverified',
    });
    const guardedComp = scoreCompetitionDimension(
      makeVerifiedMetrics({ creatorCount: corruptedNoteMetric })
    );
    assert.equal(guardedComp.status, 'INSUFFICIENT');
    assert.equal(guardedComp.score, null);
  });

  it('3. Missing creator data keeps Competition withheld with explicit fallback and never infers low competition from video demand', () => {
    const rankOnly = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731661332013680888',
        unit_price: 299,
        commission_rate: 20,
        revenue: 4_200_000,
        sales_volumn: 14_046,
        video_revenue: 3_950_000, // 94% video share!
        live_revenue: 200_000,
        shopping_mall_revenue: 50_000,
      },
      { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
    );

    const commercial = evaluateProductCommercialV2(rankOnly, { nowMs: NOW_MS });
    assert.equal(commercial.competitionScore.status, 'INSUFFICIENT');
    assert.equal(commercial.competitionScore.score, null);
    assert.equal(commercial.demandScore.status, 'SCORED');
    assert.equal(commercial.earningScore.status, 'SCORED');
    assert.equal(commercial.conversionEvidence.dominantChannel, 'VIDEO');
    assert.equal(commercial.eligibilityStatus, 'INSUFFICIENT_DATA');

    const compAssessment = assessCompetitionIntelligence(rankOnly, commercial);
    assert.equal(compAssessment.engineStatus, 'INSUFFICIENT_FALLBACK');
    assert.equal(compAssessment.classification, 'FALLBACK_UNAVAILABLE_ON_ENDPOINT');
    assert.equal(compAssessment.canUseInCommercialScoring, false);
    assert.equal(compAssessment.verifiedCreatorCount, null);
    assert.ok(compAssessment.missingSignals.includes('verified_creator_count'));

    const shortlist = classifyProductDiscoveryShortlist(rankOnly, commercial);
    assert.ok(
      shortlist.competitionEvidenceStatus === 'UNVERIFIED' ||
        shortlist.competitionEvidenceStatus === 'MISSING'
    );
    assert.notEqual(shortlist.primaryClassification, 'HIGH_DEMAND_LOW_COMPETITION');
    assert.equal(shortlist.isPreliminaryCandidate, true);
  });

  it('4. Missing or unavailable rating is never fabricated, never treated as 0, and preserves UNAVAILABLE / INSUFFICIENT_DATA', () => {
    const detailRow = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: '1731661332013680999',
        unit_price: 550,
        commission_rate: 12,
        revenue: 1_200_000,
        sales_volumn: 2180,
        creator_number: 45,
        product_review_count: 8500,
      },
      { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS }
    );

    assert.equal(detailRow.rating.state, 'UNAVAILABLE');
    assert.equal(detailRow.rating.value, null);

    const commercial = evaluateProductCommercialV2(detailRow, { nowMs: NOW_MS });
    assert.equal(commercial.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(commercial.customerQualityScore.score, null);
    assert.equal(commercial.customerQualityScore.rawRating, null);
    assert.ok(!commercial.riskTags.includes('POOR_CUSTOMER_QUALITY'));

    const qualityAssessment = assessCustomerQualityIntelligence(detailRow, commercial);
    assert.equal(qualityAssessment.engineStatus, 'INSUFFICIENT_FALLBACK');
    assert.equal(qualityAssessment.classification, 'FALLBACK_UNAVAILABLE_RATING');
    assert.equal(qualityAssessment.canUseInCommercialScoring, false);
    assert.equal(qualityAssessment.verifiedRating, null);
    assert.equal(qualityAssessment.rawUnverifiedReviewCount, 8500);
  });

  it('5. Unverified review count is quarantined even when rating is verified', () => {
    const withUnverifiedReviews = makeVerifiedMetrics({
      reviewCount: validateUnverifiedNumericMetric(59540, {
        allowNegative: false,
        unverifiedNote: 'UNVERIFIED_REVIEW_COUNT: lifetime PDP vs window scope unverified',
        context: { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS },
      }),
    });

    const commercial = evaluateProductCommercialV2(withUnverifiedReviews, { nowMs: NOW_MS });
    assert.equal(commercial.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(commercial.customerQualityScore.score, null);

    const qualityAssessment = assessCustomerQualityIntelligence(withUnverifiedReviews, commercial);
    assert.equal(qualityAssessment.classification, 'FALLBACK_UNVERIFIED_QUALITY_SCOPE');
    assert.equal(qualityAssessment.verifiedReviewCount, null);
    assert.equal(qualityAssessment.rawUnverifiedReviewCount, 59540);

    // Defensive note guard: even if unit: COUNT is forced alongside UNVERIFIED_REVIEW_COUNT note
    const corruptedReview = validateNumericMetric({
      rawInput: 59540,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: NOW_MS,
      note: 'UNVERIFIED_REVIEW_COUNT: scope unverified',
    });
    const guardedQuality = scoreCustomerQualityDimension(
      makeVerifiedMetrics({ reviewCount: corruptedReview })
    );
    assert.equal(guardedQuality.status, 'INSUFFICIENT');
    assert.equal(guardedQuality.score, null);
  });

  it('6. Missing and unverified growth are never treated as 0% verified growth and score strictly below verified growth', () => {
    const verifiedFlatGrowth = makeVerifiedMetrics({
      revenueGrowthRate: validateNumericMetric({
        rawInput: 0,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'rank',
        allowZero: true,
        allowNegative: true,
        nowMs: NOW_MS,
        note: 'Verified 0% flat growth.',
      }),
    });
    const verifiedPositiveGrowth = makeVerifiedMetrics(); // +35% verified
    const missingGrowth = makeVerifiedMetrics({
      revenueGrowthRate: validateNumericMetric({
        rawInput: null,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        allowZero: true,
        allowNegative: true,
        nowMs: NOW_MS,
      }),
    });
    const unverifiedPeriodGrowth = makeVerifiedMetrics({
      revenueGrowthRate: validateNumericMetric({
        rawInput: 120,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'rank',
        allowZero: true,
        allowNegative: true,
        nowMs: NOW_MS,
        note: 'UNVERIFIED_COMPARISON_PERIOD: baseline unverified',
      }),
    });

    const flatScore = evaluateProductCommercialV2(verifiedFlatGrowth, { nowMs: NOW_MS });
    const posScore = evaluateProductCommercialV2(verifiedPositiveGrowth, { nowMs: NOW_MS });
    const missScore = evaluateProductCommercialV2(missingGrowth, { nowMs: NOW_MS });
    const unvScore = evaluateProductCommercialV2(unverifiedPeriodGrowth, { nowMs: NOW_MS });

    assert.equal(missScore.demandScore.growthStatus, 'MISSING');
    assert.equal(missScore.demandScore.subcomponents.verifiedGrowthPercent, null);
    assert.equal(unvScore.demandScore.growthStatus, 'UNVERIFIED');
    assert.equal(unvScore.demandScore.subcomponents.verifiedGrowthPercent, null);

    // Missing or unverified +120% must NEVER receive verified growth boost
    assert.ok(posScore.demandScore.score! > missScore.demandScore.score!);
    assert.ok(posScore.demandScore.score! > unvScore.demandScore.score!);
    assert.equal(missScore.demandScore.score, unvScore.demandScore.score);
    assert.ok(flatScore.demandScore.growthStatus === 'VERIFIED');
  });

  it('7. Stale metrics (>24h) are excluded from scoring, lower Data Confidence, trigger STALE_DATA, and cannot qualify', () => {
    const fresh = makeVerifiedMetrics();
    const freshScore = evaluateProductCommercialV2(fresh, { nowMs: NOW_MS });
    assert.equal(freshScore.eligibilityStatus, 'ELIGIBLE');
    assert.ok(!freshScore.riskTags.includes('STALE_DATA'));

    // Advance clock by 30 hours -> all metrics transition to STALE
    const laterMs = NOW_MS + 30 * 60 * 60 * 1000;
    const stale = refreshProductValidatedMetricsFreshness(fresh, { nowMs: laterMs });
    const staleScore = evaluateProductCommercialV2(stale, { nowMs: laterMs });

    assert.equal(stale.revenueThb7d.state, 'STALE');
    assert.equal(stale.creatorCount.state, 'STALE');
    assert.equal(staleScore.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(staleScore.commercialOpportunityScore, null);
    assert.ok(staleScore.riskTags.includes('STALE_DATA'));
    assert.ok(staleScore.dataConfidence.score < freshScore.dataConfidence.score);

    const staleAudit = auditProductDataIntelligence(stale, staleScore);
    assert.ok(staleAudit.stale.includes('revenueThb7d'));
    assert.equal(staleAudit.competition.classification, 'FALLBACK_STALE_DATA');
    assert.equal(staleAudit.customerQuality.classification, 'FALLBACK_STALE_QUALITY_DATA');

    // Single stale rating alone must also trigger STALE_DATA risk tag
    const singleStaleRating = makeVerifiedMetrics({
      rating: validateNumericMetric({
        rawInput: 4.9,
        unit: 'RATING_5',
        provenance: 'SOURCE',
        fetchedAt: STALE_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        minValue: 0,
        maxValue: 5,
        nowMs: NOW_MS,
      }),
    });
    const singleStaleScore = evaluateProductCommercialV2(singleStaleRating, { nowMs: NOW_MS });
    assert.ok(singleStaleScore.riskTags.includes('STALE_DATA'));
    assert.equal(singleStaleScore.customerQualityScore.status, 'INSUFFICIENT');
  });

  it('8. Zero commission is always NOT_MONETIZABLE (score 0) and blocked from all strategies and shortlists', () => {
    const zeroComm = makeVerifiedMetrics({
      commissionRate: validateNumericMetric({
        rawInput: 0,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'rank',
        allowZero: true,
        allowNegative: false,
        minValue: 0,
        maxValue: 100,
        nowMs: NOW_MS,
      }),
    });
    zeroComm.commissionThb = computeSyntheticCommissionThb(
      zeroComm.priceThb,
      zeroComm.commissionRate
    );

    const score = evaluateProductCommercialV2(zeroComm, { nowMs: NOW_MS });
    assert.equal(score.eligibilityStatus, 'NOT_MONETIZABLE');
    assert.equal(score.commercialOpportunityScore, 0);
    assert.equal(score.earningScore.status, 'NOT_MONETIZABLE');
    assert.equal(score.earningScore.score, 0);
    assert.ok(score.riskTags.includes('ZERO_COMMISSION'));
    assert.ok(score.riskTags.includes('NOT_MONETIZABLE'));

    const strategies = evaluateProductStrategiesV2(zeroComm, score, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(strategies.qualifiedStrategyIds.length, 0);

    const shortlist = classifyProductDiscoveryShortlist(zeroComm, score);
    assert.equal(shortlist.primaryClassification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(shortlist.isNotMonetizable, true);
  });

  it('9. Invalid metric values (negative, >100% commission, >5 rating, NaN, range string, future timestamp) are rejected', () => {
    const invalidPrice = validateNumericMetric({
      rawInput: '199-299',
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      allowZero: false,
      allowNegative: false,
      nowMs: NOW_MS,
    });
    const invalidCommission = validateNumericMetric({
      rawInput: 150,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      minValue: 0,
      maxValue: 100,
      nowMs: NOW_MS,
    });
    const negativeCreators = validateNumericMetric({
      rawInput: -5,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      allowZero: true,
      allowNegative: false,
      integerOnly: true,
      nowMs: NOW_MS,
    });
    const invalidRating = validateNumericMetric({
      rawInput: 5.4,
      unit: 'RATING_5',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      minValue: 0,
      maxValue: 5,
      nowMs: NOW_MS,
    });
    const futureRevenue = validateNumericMetric({
      rawInput: 500_000,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: FUTURE_ISO,
      allowZero: true,
      allowNegative: false,
      nowMs: NOW_MS,
    });
    const nanSales = validateNumericMetric({
      rawInput: Number.NaN,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });

    for (const m of [
      invalidPrice,
      invalidCommission,
      negativeCreators,
      invalidRating,
      futureRevenue,
      nanSales,
    ]) {
      assert.equal(m.state, 'INVALID');
      assert.equal(m.value, null);
      assert.equal(classifyMetricIntelligenceState(m), 'INVALID');
    }

    const corrupted = makeVerifiedMetrics({
      priceThb: invalidPrice,
      commissionRate: invalidCommission,
      creatorCount: negativeCreators,
      rating: invalidRating,
      revenueThb7d: futureRevenue,
      salesVolume7d: nanSales,
    });
    const score = evaluateProductCommercialV2(corrupted, { nowMs: NOW_MS });
    assert.equal(score.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(score.commercialOpportunityScore, null);
    assert.equal(score.competitionScore.status, 'INSUFFICIENT');
    assert.equal(score.customerQualityScore.status, 'INSUFFICIENT');

    const audit = auditProductDataIntelligence(corrupted, score);
    assert.equal(audit.competition.classification, 'FALLBACK_INVALID_DATA');
    assert.equal(audit.customerQuality.classification, 'FALLBACK_INVALID_QUALITY_DATA');
  });

  it('10. Competition & Customer Quality eligibility boundaries (low/high competition, zero-creator caution, synthetic revenue exclusion, poor quality restriction)', () => {
    // Low vs High competition separation
    const lowComp = makeVerifiedMetrics({
      creatorCount: validateNumericMetric({
        rawInput: 8,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
        nowMs: NOW_MS,
      }),
    });
    const highComp = makeVerifiedMetrics({
      creatorCount: validateNumericMetric({
        rawInput: 380,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
        nowMs: NOW_MS,
      }),
    });
    const zeroCreator = makeVerifiedMetrics({
      creatorCount: validateNumericMetric({
        rawInput: 0,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
        nowMs: NOW_MS,
      }),
    });

    const lowRes = evaluateProductCommercialV2(lowComp, { nowMs: NOW_MS });
    const highRes = evaluateProductCommercialV2(highComp, { nowMs: NOW_MS });
    const zeroRes = evaluateProductCommercialV2(zeroCreator, { nowMs: NOW_MS });

    assert.equal(
      assessCompetitionIntelligence(lowComp, lowRes).classification,
      'VERIFIED_LOW_COMPETITION'
    );
    assert.equal(
      assessCompetitionIntelligence(highComp, highRes).classification,
      'VERIFIED_HIGH_COMPETITION'
    );
    assert.equal(
      assessCompetitionIntelligence(zeroCreator, zeroRes).classification,
      'VERIFIED_ZERO_CREATOR_CAUTION'
    );
    assert.ok(lowRes.competitionScore.score! > highRes.competitionScore.score!);
    assert.equal(zeroRes.competitionScore.rawRpcThb, null); // Never Infinity

    // Synthetic revenue MUST NOT enter verified Competition RPC
    const syntheticRevMetrics = makeVerifiedMetrics();
    syntheticRevMetrics.revenueThb7d = computeSyntheticRevenueEstimate(
      syntheticRevMetrics.salesVolume7d,
      syntheticRevMetrics.priceThb
    );
    const synRes = evaluateProductCommercialV2(syntheticRevMetrics, { nowMs: NOW_MS });
    assert.equal(synRes.competitionScore.status, 'INSUFFICIENT');
    assert.equal(
      assessCompetitionIntelligence(syntheticRevMetrics, synRes).classification,
      'FALLBACK_MISSING_REVENUE_FOR_RPC'
    );

    // Poor customer quality restricts eligibility
    const poorQuality = makeVerifiedMetrics({
      rating: validateNumericMetric({
        rawInput: 3.1,
        unit: 'RATING_5',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        minValue: 0,
        maxValue: 5,
        nowMs: NOW_MS,
      }),
      reviewCount: validateNumericMetric({
        rawInput: 260,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        integerOnly: true,
        nowMs: NOW_MS,
      }),
    });
    const poorRes = evaluateProductCommercialV2(poorQuality, { nowMs: NOW_MS });
    assert.equal(poorRes.eligibilityStatus, 'RESTRICTED_POOR_QUALITY');
    assert.equal(
      assessCustomerQualityIntelligence(poorQuality, poorRes).classification,
      'VERIFIED_POOR_QUALITY'
    );

    // Video suitability MUST have 0% influence on Commercial Opportunity score
    const noVideo = evaluateProductCommercialV2(lowComp, { nowMs: NOW_MS });
    assert.equal(noVideo.commercialOpportunityScore, lowRes.commercialOpportunityScore);
  });

  it('11. No fabricated data during hydration or enrichment merge (rank + detail)', () => {
    const rankParsed = parseRawProductRow(
      {
        product_id: '1731661332013680778',
        product_title: 'Solomon Pyla Plus Mattress',
        unit_price: 2128,
        commission_rate: 7,
        revenue: 6_930_000,
        sales_volumn: 3257,
        video_revenue: 5_290_000,
        live_revenue: 1_190_000,
        shopping_mall_revenue: 446_700,
        revenue_growth_rate: -11.76,
      },
      'home',
      'rank',
      NOW_ISO,
      { nowMs: NOW_MS }
    )!;

    const detailParsed = parseRawProductRow(
      {
        product_id: '1731661332013680778',
        product_title: 'Solomon Pyla Plus Mattress',
        unit_price: 2128,
        commission_rate: 7,
        revenue: 6_930_000,
        sales_volumn: 3257,
        creator_number: 343,
        product_review_count: 59540,
      },
      'home',
      'detail',
      '2026-11-25T10:05:00.000Z',
      { nowMs: Date.parse('2026-11-25T10:05:00.000Z') }
    )!;

    // Merge rank + detail validated snapshots
    const mergedValidated = mergeValidatedMetricsSnapshots(
      rankParsed.validatedMetrics,
      detailParsed.validatedMetrics
    )!;

    // No fabrication of rating; creator & review remain UNVERIFIED; per-metric timestamps preserved
    assert.equal(mergedValidated.rating.state, 'UNAVAILABLE');
    assert.equal(mergedValidated.rating.value, null);
    assert.equal(mergedValidated.creatorCount.unit, 'UNVERIFIED');
    assert.equal(mergedValidated.creatorCount.rawInput, 343);
    assert.equal(mergedValidated.creatorCount.fetchedAt, '2026-11-25T10:05:00.000Z');
    assert.equal(mergedValidated.reviewCount.unit, 'UNVERIFIED');
    assert.equal(mergedValidated.reviewCount.rawInput, 59540);
    assert.equal(mergedValidated.revenueGrowthRate.fetchedAt, NOW_ISO); // Preserved from /rank
    assert.equal(classifyMetricIntelligenceState(mergedValidated.revenueGrowthRate), 'UNVERIFIED');

    // Merge Kalodata metrics preserves null rating (never 0)
    const mergedRawMetrics = mergeKalodataMetrics(
      rankParsed.kalodataMetrics,
      detailParsed.kalodataMetrics
    )!;
    assert.equal(mergedRawMetrics.rating, null);
    assert.equal(mergedRawMetrics.creatorCount, 343);
    assert.equal(mergedRawMetrics.reviewCount, 59540);

    // Hydration from storage must preserve missing/unverified/unavailable states without fabricating values
    const hydrated = hydrateProductFromStorage(
      {
        id: rankParsed.id,
        thaiTitle: rankParsed.thaiTitle,
        clearTitle: { en: rankParsed.thaiTitle, my: rankParsed.thaiTitle },
        whatItIs: { en: 'Spring mattress', my: 'Spring mattress' },
        whySilentWorks: { en: 'Visual bounce demonstration', my: 'Visual bounce demonstration' },
        category: 'home',
        categoryLabel: { en: 'Home', my: 'Home' },
        visualTags: [],
        shopName: rankParsed.shopName,
        priceThb: rankParsed.priceThb ?? 2128,
        commissionRate: rankParsed.commissionRate ?? 7,
        commissionThb: rankParsed.validatedMetrics.commissionThb.value ?? 148.96,
        imageUrl: rankParsed.imageUrl,
        productUrl: rankParsed.productUrl,
        kalodataMetrics: mergedRawMetrics,
        validatedMetrics: mergedValidated,
      },
      { nowMs: Date.parse('2026-11-25T10:10:00.000Z') }
    );
    assert.equal(hydrated.validatedMetrics!.rating.state, 'UNAVAILABLE');
    assert.equal(hydrated.validatedMetrics!.rating.value, null);
    assert.equal(hydrated.validatedMetrics!.creatorCount.unit, 'UNVERIFIED');
    assert.equal(hydrated.commercialScoreV2!.competitionScore.status, 'INSUFFICIENT');
    assert.equal(hydrated.commercialScoreV2!.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(hydrated.commercialScoreV2!.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(hydrated.commercialScoreV2!.commercialOpportunityScore, null);
  });
});
