import type { ProductValidatedMetrics, ValidatedMetric } from '../types/metrics';
import type { CommercialScoreV2Result } from '../types/scoringV2';

/**
 * Phase 12 Six-State Data Intelligence Taxonomy (with Invalid and Stale separated
 * so callers can distinguish malformed values from expired observations).
 *
 * 1. VERIFIED    — Authentic SOURCE metric with verified unit & semantics.
 * 2. DERIVED     — Computed SYNTHETIC metric (e.g., commissionThb = price * rate); never SOURCE.
 * 3. UNVERIFIED  — Raw upstream value exists, but unit, scope, or comparison period is unverified.
 * 4. MISSING     — Field absent from payload (never coerced to 0 or fabricated).
 * 5. UNAVAILABLE — Endpoint does not supply this metric (e.g., rating on Kalodata /rank & /detail).
 * 6. INVALID / STALE — Malformed/out-of-range value or expired (>24h) observation.
 */
export type MetricIntelligenceState =
  | 'VERIFIED'
  | 'DERIVED'
  | 'UNVERIFIED'
  | 'MISSING'
  | 'UNAVAILABLE'
  | 'INVALID'
  | 'STALE';

export type CompetitionIntelligenceClassification =
  | 'VERIFIED_LOW_COMPETITION'
  | 'VERIFIED_MODERATE_COMPETITION'
  | 'VERIFIED_HIGH_COMPETITION'
  | 'VERIFIED_ZERO_CREATOR_CAUTION'
  | 'VERIFIED_ZERO_REVENUE'
  | 'FALLBACK_UNVERIFIED_CREATOR_SCOPE'
  | 'FALLBACK_UNAVAILABLE_ON_ENDPOINT'
  | 'FALLBACK_MISSING_CREATOR_DATA'
  | 'FALLBACK_MISSING_REVENUE_FOR_RPC'
  | 'FALLBACK_STALE_DATA'
  | 'FALLBACK_INVALID_DATA';

export interface CompetitionIntelligenceAssessment {
  engineStatus: 'VERIFIED_SCORED' | 'ZERO_REVENUE' | 'INSUFFICIENT_FALLBACK';
  classification: CompetitionIntelligenceClassification;
  canUseInCommercialScoring: boolean;
  creatorIntelligenceState: MetricIntelligenceState;
  revenueIntelligenceState: MetricIntelligenceState;
  verifiedCreatorCount: number | null;
  rawUnverifiedCreatorNumber: number | null;
  rawRpcThb: number | null;
  adjustedRpcThb: number | null;
  score: number | null;
  explanation: string;
  missingSignals: string[];
}

export type CustomerQualityIntelligenceClassification =
  | 'VERIFIED_STRONG_QUALITY'
  | 'VERIFIED_ACCEPTABLE_QUALITY'
  | 'VERIFIED_LOW_REVIEW_SAMPLE'
  | 'VERIFIED_POOR_QUALITY'
  | 'FALLBACK_UNAVAILABLE_RATING'
  | 'FALLBACK_UNVERIFIED_QUALITY_SCOPE'
  | 'FALLBACK_ZERO_REVIEWS'
  | 'FALLBACK_MISSING_QUALITY_DATA'
  | 'FALLBACK_STALE_QUALITY_DATA'
  | 'FALLBACK_INVALID_QUALITY_DATA';

export interface CustomerQualityIntelligenceAssessment {
  engineStatus: 'VERIFIED_SCORED' | 'INSUFFICIENT_FALLBACK';
  classification: CustomerQualityIntelligenceClassification;
  canUseInCommercialScoring: boolean;
  ratingIntelligenceState: MetricIntelligenceState;
  reviewCountIntelligenceState: MetricIntelligenceState;
  verifiedRating: number | null;
  verifiedReviewCount: number | null;
  rawUnverifiedReviewCount: number | null;
  bayesianRating: number | null;
  score: number | null;
  explanation: string;
  missingSignals: string[];
}

export interface ProductDataIntelligenceAudit {
  byField: Record<string, MetricIntelligenceState>;
  verified: string[];
  derived: string[];
  unverified: string[];
  missing: string[];
  unavailable: string[];
  invalid: string[];
  stale: string[];
  competition: CompetitionIntelligenceAssessment;
  customerQuality: CustomerQualityIntelligenceAssessment;
}

const UNVERIFIED_SEMANTIC_NOTE_PATTERN =
  /UNVERIFIED_(?:UNIT|SEMANTICS|SCOPE|CREATOR|REVIEW|RATING|COMPARISON_PERIOD|COMMISSION)/i;

function hasPresentRawInput(rawInput: unknown): boolean {
  if (rawInput === null || rawInput === undefined) return false;
  if (typeof rawInput === 'string') return rawInput.trim().length > 0;
  return true;
}

function parseFiniteRawNumber(rawInput: unknown): number | null {
  if (typeof rawInput === 'number') {
    return Number.isFinite(rawInput) ? rawInput : null;
  }
  if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
    const parsed = Number(rawInput.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function hasUnverifiedSemanticNote(metric: ValidatedMetric<number>): boolean {
  return Boolean(metric.note && UNVERIFIED_SEMANTIC_NOTE_PATTERN.test(metric.note));
}

/**
 * Classifies any ValidatedMetric into SiamVisual's strict six-state data intelligence taxonomy
 * (with INVALID and STALE separated for precise diagnostics).
 */
export function classifyMetricIntelligenceState(
  metric: ValidatedMetric<number>
): MetricIntelligenceState {
  if (metric.state === 'STALE') return 'STALE';
  if (metric.state === 'INVALID') return 'INVALID';

  const rawPresent = hasPresentRawInput(metric.rawInput);

  if (metric.state === 'MISSING') {
    return 'MISSING';
  }

  if (metric.state === 'UNAVAILABLE') {
    // When an upstream value was actually returned (e.g., /detail creator_number: 343 or
    // product_review_count: 59540) and quarantined because its unit/semantics are UNVERIFIED,
    // classify it as UNVERIFIED rather than UNAVAILABLE.
    if (rawPresent && (metric.unit === 'UNVERIFIED' || hasUnverifiedSemanticNote(metric))) {
      return 'UNVERIFIED';
    }
    return 'UNAVAILABLE';
  }

  if (metric.unit === 'UNVERIFIED' || hasUnverifiedSemanticNote(metric)) {
    return 'UNVERIFIED';
  }

  if (metric.value === null || !Number.isFinite(metric.value)) {
    return 'INVALID';
  }

  if (metric.provenance === 'SYNTHETIC') {
    return 'DERIVED';
  }

  return 'VERIFIED';
}

export function isMetricVerifiedForScoring(metric: ValidatedMetric<number>): boolean {
  return classifyMetricIntelligenceState(metric) === 'VERIFIED';
}

/**
 * Competition Intelligence Assessment with reliable, honest fallback classification.
 * Never fabricates creator counts, creator concentration, active seller counts, or ad saturation.
 * Keeps Competition strictly separated from Demand, Earning, and Video Conversion Evidence.
 */
export function assessCompetitionIntelligence(
  validated: ProductValidatedMetrics,
  commercialScore: CommercialScoreV2Result
): CompetitionIntelligenceAssessment {
  const creatorState = classifyMetricIntelligenceState(validated.creatorCount);
  const revenueState = classifyMetricIntelligenceState(validated.revenueThb7d);
  const comp = commercialScore.competitionScore;

  const rawUnverifiedCreatorNumber =
    creatorState === 'UNVERIFIED'
      ? parseFiniteRawNumber(validated.creatorCount.rawInput)
      : null;

  const baseMissingSignals = [
    'creator_revenue_concentration',
    'active_selling_creator_count',
    'paid_ad_saturation',
  ];

  if (comp.status === 'ZERO') {
    return {
      engineStatus: 'ZERO_REVENUE',
      classification: 'VERIFIED_ZERO_REVENUE',
      canUseInCommercialScoring: true,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: comp.creatorCount,
      rawUnverifiedCreatorNumber: null,
      rawRpcThb: comp.rawRpcThb,
      adjustedRpcThb: comp.adjustedRpcThb,
      score: 0,
      explanation:
        'Verified 7d revenue is 0 THB; competition opportunity is 0 regardless of creator count.',
      missingSignals: baseMissingSignals,
    };
  }

  if (
    comp.status === 'SCORED' &&
    comp.score !== null &&
    creatorState === 'VERIFIED' &&
    revenueState === 'VERIFIED'
  ) {
    let classification: CompetitionIntelligenceClassification;
    let explanation: string;

    if (comp.riskFlag === 'ZERO_CREATORS_POSITIVE_REVENUE') {
      classification = 'VERIFIED_ZERO_CREATOR_CAUTION';
      explanation =
        'Verified creator count is 0 with positive revenue; score is capped because sales may be shop-direct or unattributed.';
    } else if (comp.riskFlag === 'EXTREME_COMPETITION' || comp.score < 40) {
      classification = 'VERIFIED_HIGH_COMPETITION';
      explanation =
        'Verified creator saturation compresses per-creator opportunity (high competition).';
    } else if (comp.score >= 65) {
      classification = 'VERIFIED_LOW_COMPETITION';
      explanation =
        'Verified creator density and smoothed revenue per creator indicate manageable competition.';
    } else {
      classification = 'VERIFIED_MODERATE_COMPETITION';
      explanation =
        'Verified creator density and smoothed revenue per creator indicate moderate competition.';
    }

    return {
      engineStatus: 'VERIFIED_SCORED',
      classification,
      canUseInCommercialScoring: true,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: comp.creatorCount,
      rawUnverifiedCreatorNumber: null,
      rawRpcThb: comp.rawRpcThb,
      adjustedRpcThb: comp.adjustedRpcThb,
      score: comp.score,
      explanation,
      missingSignals: baseMissingSignals,
    };
  }

  // Fallback path — never fabricate competition score or infer low competition from video sales
  const missingSignals = ['verified_creator_count', ...baseMissingSignals];

  if (creatorState === 'STALE' || revenueState === 'STALE') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_STALE_DATA',
      canUseInCommercialScoring: false,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: null,
      rawUnverifiedCreatorNumber,
      rawRpcThb: null,
      adjustedRpcThb: null,
      score: null,
      explanation:
        'Competition scoring withheld because creator count or 7d revenue observation is stale (>24h).',
      missingSignals,
    };
  }

  if (creatorState === 'INVALID' || revenueState === 'INVALID') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_INVALID_DATA',
      canUseInCommercialScoring: false,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: null,
      rawUnverifiedCreatorNumber: null,
      rawRpcThb: null,
      adjustedRpcThb: null,
      score: null,
      explanation:
        'Competition scoring withheld because creator count or 7d revenue failed validation.',
      missingSignals,
    };
  }

  if (creatorState === 'UNVERIFIED') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_UNVERIFIED_CREATOR_SCOPE',
      canUseInCommercialScoring: false,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: null,
      rawUnverifiedCreatorNumber,
      rawRpcThb: null,
      adjustedRpcThb: null,
      score: null,
      explanation:
        'Upstream creator_number is present but quarantined: active-window vs selling-creators vs lifetime semantics remain unverified.',
      missingSignals,
    };
  }

  if (creatorState === 'VERIFIED' && revenueState !== 'VERIFIED') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_MISSING_REVENUE_FOR_RPC',
      canUseInCommercialScoring: false,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: validated.creatorCount.value,
      rawUnverifiedCreatorNumber: null,
      rawRpcThb: null,
      adjustedRpcThb: null,
      score: null,
      explanation:
        'Verified SOURCE 7d revenue is required to compute Revenue per Creator (RPC); synthetic or missing revenue is excluded.',
      missingSignals: ['verified_source_revenue_7d', ...baseMissingSignals],
    };
  }

  const endpoint = validated.creatorCount.sourceEndpoint ?? validated.sourceEndpoint;
  if (creatorState === 'UNAVAILABLE' || endpoint === 'rank') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_UNAVAILABLE_ON_ENDPOINT',
      canUseInCommercialScoring: false,
      creatorIntelligenceState: creatorState,
      revenueIntelligenceState: revenueState,
      verifiedCreatorCount: null,
      rawUnverifiedCreatorNumber: null,
      rawRpcThb: null,
      adjustedRpcThb: null,
      score: null,
      explanation:
        'Competition evidence is unavailable on the queried endpoint (/tiktok/product/rank omits creator_number); competition is not inferred from demand or video sales.',
      missingSignals,
    };
  }

  return {
    engineStatus: 'INSUFFICIENT_FALLBACK',
    classification: 'FALLBACK_MISSING_CREATOR_DATA',
    canUseInCommercialScoring: false,
    creatorIntelligenceState: creatorState,
    revenueIntelligenceState: revenueState,
    verifiedCreatorCount: null,
    rawUnverifiedCreatorNumber: null,
    rawRpcThb: null,
    adjustedRpcThb: null,
    score: null,
    explanation:
      'Creator count is missing; competition intelligence cannot be scored without fabricating creator data.',
    missingSignals,
  };
}

/**
 * Customer Quality Intelligence Assessment with reliable, honest fallback classification.
 * Never fabricates ratings, never substitutes missing rating with 0, and keeps unverified
 * product_review_count quarantined from verified Customer Quality scoring.
 */
export function assessCustomerQualityIntelligence(
  validated: ProductValidatedMetrics,
  commercialScore: CommercialScoreV2Result
): CustomerQualityIntelligenceAssessment {
  const ratingState = classifyMetricIntelligenceState(validated.rating);
  const reviewState = classifyMetricIntelligenceState(validated.reviewCount);
  const quality = commercialScore.customerQualityScore;

  const rawUnverifiedReviewCount =
    reviewState === 'UNVERIFIED'
      ? parseFiniteRawNumber(validated.reviewCount.rawInput)
      : null;

  if (
    quality.status === 'SCORED' &&
    quality.score !== null &&
    ratingState === 'VERIFIED' &&
    reviewState === 'VERIFIED'
  ) {
    let classification: CustomerQualityIntelligenceClassification;
    let explanation: string;

    if (quality.riskFlag === 'POOR_CUSTOMER_QUALITY') {
      classification = 'VERIFIED_POOR_QUALITY';
      explanation =
        'Verified customer rating and review sample indicate poor customer satisfaction (restricted eligibility).';
    } else if (quality.riskFlag === 'LOW_REVIEW_SAMPLE') {
      classification = 'VERIFIED_LOW_REVIEW_SAMPLE';
      explanation =
        'Verified rating is backed by a small review sample; Bayesian shrinkage and score cap applied.';
    } else if (quality.score >= 78) {
      classification = 'VERIFIED_STRONG_QUALITY';
      explanation =
        'Verified customer rating and review depth indicate strong customer satisfaction.';
    } else {
      classification = 'VERIFIED_ACCEPTABLE_QUALITY';
      explanation =
        'Verified customer rating and review depth indicate acceptable customer quality.';
    }

    return {
      engineStatus: 'VERIFIED_SCORED',
      classification,
      canUseInCommercialScoring: true,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: quality.rawRating,
      verifiedReviewCount: quality.reviewCount,
      rawUnverifiedReviewCount: null,
      bayesianRating: quality.bayesianRating,
      score: quality.score,
      explanation,
      missingSignals: [],
    };
  }

  const missingSignals: string[] = [];
  if (ratingState !== 'VERIFIED') missingSignals.push('verified_product_rating');
  if (reviewState !== 'VERIFIED') missingSignals.push('verified_review_count');

  if (ratingState === 'STALE' || reviewState === 'STALE') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_STALE_QUALITY_DATA',
      canUseInCommercialScoring: false,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: null,
      verifiedReviewCount: null,
      rawUnverifiedReviewCount,
      bayesianRating: null,
      score: null,
      explanation:
        'Customer quality scoring withheld because rating or review count is stale (>24h).',
      missingSignals,
    };
  }

  if (ratingState === 'INVALID' || reviewState === 'INVALID') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_INVALID_QUALITY_DATA',
      canUseInCommercialScoring: false,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: null,
      verifiedReviewCount: null,
      rawUnverifiedReviewCount,
      bayesianRating: null,
      score: null,
      explanation:
        'Customer quality scoring withheld because rating or review count failed validation.',
      missingSignals,
    };
  }

  if (ratingState === 'UNAVAILABLE') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_UNAVAILABLE_RATING',
      canUseInCommercialScoring: false,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: null,
      verifiedReviewCount: reviewState === 'VERIFIED' ? validated.reviewCount.value : null,
      rawUnverifiedReviewCount,
      bayesianRating: null,
      score: null,
      explanation:
        'Product star rating is unavailable on tested Kalodata /rank and /detail endpoints; missing rating is never fabricated or treated as 0.',
      missingSignals,
    };
  }

  if (ratingState === 'UNVERIFIED' || reviewState === 'UNVERIFIED') {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_UNVERIFIED_QUALITY_SCOPE',
      canUseInCommercialScoring: false,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: ratingState === 'VERIFIED' ? validated.rating.value : null,
      verifiedReviewCount: reviewState === 'VERIFIED' ? validated.reviewCount.value : null,
      rawUnverifiedReviewCount,
      bayesianRating: null,
      score: null,
      explanation:
        'Rating or review count semantics remain unverified (e.g., lifetime vs window-scoped review count); customer quality remains withheld.',
      missingSignals,
    };
  }

  if (ratingState === 'VERIFIED' && reviewState === 'VERIFIED' && validated.reviewCount.value === 0) {
    return {
      engineStatus: 'INSUFFICIENT_FALLBACK',
      classification: 'FALLBACK_ZERO_REVIEWS',
      canUseInCommercialScoring: false,
      ratingIntelligenceState: ratingState,
      reviewCountIntelligenceState: reviewState,
      verifiedRating: validated.rating.value,
      verifiedReviewCount: 0,
      rawUnverifiedReviewCount: null,
      bayesianRating: null,
      score: null,
      explanation:
        'Verified review count is 0; insufficient sample size to score customer quality.',
      missingSignals: ['minimum_review_sample'],
    };
  }

  return {
    engineStatus: 'INSUFFICIENT_FALLBACK',
    classification: 'FALLBACK_MISSING_QUALITY_DATA',
    canUseInCommercialScoring: false,
    ratingIntelligenceState: ratingState,
    reviewCountIntelligenceState: reviewState,
    verifiedRating: ratingState === 'VERIFIED' ? validated.rating.value : null,
    verifiedReviewCount: reviewState === 'VERIFIED' ? validated.reviewCount.value : null,
    rawUnverifiedReviewCount,
    bayesianRating: null,
    score: null,
    explanation:
      'Product rating or review count is missing; customer quality cannot be scored without fabrication.',
    missingSignals,
  };
}

/**
 * Audits all metrics on a product into SiamVisual's six-state data intelligence taxonomy,
 * along with Competition and Customer Quality intelligence assessments.
 */
export function auditProductDataIntelligence(
  validated: ProductValidatedMetrics,
  commercialScore: CommercialScoreV2Result
): ProductDataIntelligenceAudit {
  const entries: Array<[string, ValidatedMetric<number>]> = [
    ['priceThb', validated.priceThb],
    ['commissionRate', validated.commissionRate],
    ['commissionThb', validated.commissionThb],
    ['revenueThb7d', validated.revenueThb7d],
    ['salesVolume7d', validated.salesVolume7d],
    ['videoRevenueThb7d', validated.videoRevenueThb7d],
    ['liveRevenueThb7d', validated.liveRevenueThb7d],
    ...(validated.shoppingMallRevenueThb7d
      ? ([['shoppingMallRevenueThb7d', validated.shoppingMallRevenueThb7d]] as Array<
          [string, ValidatedMetric<number>]
        >)
      : []),
    ['revenueGrowthRate', validated.revenueGrowthRate],
    ['creatorCount', validated.creatorCount],
    ['rating', validated.rating],
    ['reviewCount', validated.reviewCount],
  ];

  const byField: Record<string, MetricIntelligenceState> = {};
  const verified: string[] = [];
  const derived: string[] = [];
  const unverified: string[] = [];
  const missing: string[] = [];
  const unavailable: string[] = [];
  const invalid: string[] = [];
  const stale: string[] = [];

  for (const [key, metric] of entries) {
    const state = classifyMetricIntelligenceState(metric);
    byField[key] = state;
    switch (state) {
      case 'VERIFIED':
        verified.push(key);
        break;
      case 'DERIVED':
        derived.push(key);
        break;
      case 'UNVERIFIED':
        unverified.push(key);
        break;
      case 'MISSING':
        missing.push(key);
        break;
      case 'UNAVAILABLE':
        unavailable.push(key);
        break;
      case 'INVALID':
        invalid.push(key);
        break;
      case 'STALE':
        stale.push(key);
        break;
    }
  }

  return {
    byField,
    verified,
    derived,
    unverified,
    missing,
    unavailable,
    invalid,
    stale,
    competition: assessCompetitionIntelligence(validated, commercialScore),
    customerQuality: assessCustomerQualityIntelligence(validated, commercialScore),
  };
}
