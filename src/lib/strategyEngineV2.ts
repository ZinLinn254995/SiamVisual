import type { ProductItem } from '../types.ts';
import type { ProductValidatedMetrics, ValidatedMetric } from '../types/metrics.ts';
import type { CommercialScoreV2Result } from '../types/scoringV2.ts';
import type {
  HistoricalMetricSnapshot,
  MarketplaceIntelligenceRankingResult,
  OpportunityClassification,
  OverallRankedProductEntry,
  ProductStrategyReportV2,
  StrategyEligibilityStatus,
  StrategyEvaluationResult,
  StrategyExcludedEntry,
  StrategyId,
  StrategyProfileDefinition,
  StrategyRankedEntry,
  StrategyRankingBucket,
  StrategyRequirementCheck,
  StrategyThresholdsConfig,
} from '../types/strategyV2.ts';
import {
  adaptProductItemToValidatedMetrics,
  isUsableScoringMetric,
  validateMetricTimestamp,
} from './metricFoundation.ts';
import {
  evaluateProductCommercialV2,
  type PartialCommercialScoringV2Config,
  resolveMetricsInput,
  resolveScoringV2Config,
} from './scoringEngineV2.ts';

export const DEFAULT_STRATEGY_THRESHOLDS_V2: StrategyThresholdsConfig = {
  overallClassification: {
    topMinScore: 75,
    topMinConfidence: 70,
    strongMinScore: 62,
    strongMinConfidence: 60,
    moderateMinScore: 45,
    moderateMinConfidence: 50,
    watchlistMinConfidence: 30,
  },
  earlyMarket: {
    minAbsoluteDemand: 45,
    minGrowthPercent: 10,
    minCompetitionScore: 50,
    maxCreatorCount: 60,
    minEarningScore: 35,
    minConfidence: 60,
  },
  underservedDemand: {
    minAbsoluteDemand: 50,
    minCompetitionScore: 45,
    minEarningScore: 35,
    minConfidence: 48,
  },
  creatorYield: {
    minDemandScore: 40,
    minRevenueThb: 20_000,
    minAdjustedRpcThb: 3_000,
    minCompetitionScore: 40,
    minEarningScore: 35,
    minConfidence: 55,
  },
  fastRising: {
    minSnapshots: 2,
    minHoursBetweenSnapshots: 12,
    minDemandScore: 35,
    minDemandGrowthPct: 15,
    minSpreadOverCreatorGrowthPct: 5,
    minConfidence: 60,
  },
  profitMaximizer: {
    minDemandScore: 38,
    minPayoutPerSaleThb: 20,
    minEarningScore: 48,
    minCompetitionScore: 30,
    minConfidence: 55,
  },
  videoProven: {
    minDemandScore: 40,
    minVideoRevenueThb: 25_000,
    minVideoShare: 0.25,
    minCompetitionScore: 30,
    minEarningScore: 30,
    minConfidence: 52,
  },
  trustBased: {
    minDemandScore: 40,
    minEarningScore: 35,
    minCompetitionScore: 25,
    minReviewCount: 30,
    minBayesianRating: 4.25,
    minQualityScore: 70,
    minConfidence: 58,
  },
  trendTiming: {
    minSnapshots: 3,
    minHoursSpan: 24,
    minDemandScore: 35,
    minDemandGrowthPct: 10,
    minSpreadOverCreatorGrowthPct: 5,
    minCompetitionScore: 35,
    minConfidence: 60,
  },
};

export const STRATEGY_PROFILES_V2: Record<StrategyId, StrategyProfileDefinition> = {
  early_market_opportunity: {
    id: 'early_market_opportunity',
    name: 'Early Market Opportunity',
    isPrimary: true,
    requiresHistoricalSnapshots: false,
    description:
      'Strong absolute demand with verified positive demand growth, low creator crowding, strong RPC, and attractive affiliate payout.',
    requiredMetrics: [
      'revenueThb7d',
      'salesVolume7d',
      'revenueGrowthRate',
      'creatorCount',
      'priceThb',
      'commissionRate',
    ],
    optionalSupportingMetrics: ['rating', 'reviewCount', 'videoRevenueThb7d'],
    minimumEvidenceSummary:
      'Requires verified demand, verified growth unit & period, verified creator count (> 0), verified commission (> 0%), and confidence >= 60.',
    exclusionSummary:
      'Excludes 0% commission, flat/negative growth, crowded creator supply (> 60 creators or competition < 50), 0-creator anomalies, weak demand, and poor quality.',
    rankingFormulaSummary:
      '0.28 * absoluteDemand + 0.24 * growthScore + 0.28 * competitionScore + 0.20 * earningScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.earlyMarket.minConfidence,
  },
  underserved_demand: {
    id: 'underserved_demand',
    name: 'Underserved Demand',
    requiresHistoricalSnapshots: false,
    description:
      'Strong revenue or sales volume with relatively low creator competition and monetizable earning potential; works even without growth data.',
    requiredMetrics: ['revenueThb7d', 'creatorCount', 'priceThb', 'commissionRate'],
    optionalSupportingMetrics: ['salesVolume7d', 'revenueGrowthRate', 'rating', 'reviewCount'],
    minimumEvidenceSummary:
      'Requires verified strong demand (absoluteDemand >= 50), verified creator count (> 0), verified commission (> 0%), and confidence >= 48.',
    exclusionSummary:
      'Excludes 0% commission, weak demand, high creator crowding, 0-creator unverified attribution, and poor customer quality.',
    rankingFormulaSummary:
      '0.42 * absoluteDemand + 0.36 * competitionScore + 0.22 * earningScore + optional verified growth adjustment (-8 to +6)',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.underservedDemand.minConfidence,
  },
  creator_yield_opportunity: {
    id: 'creator_yield_opportunity',
    name: 'Creator Yield Opportunity',
    requiresHistoricalSnapshots: false,
    description:
      'High smoothed revenue per creator (RPC) backed by meaningful market demand and attractive affiliate payout.',
    requiredMetrics: ['revenueThb7d', 'creatorCount', 'priceThb', 'commissionRate'],
    optionalSupportingMetrics: ['salesVolume7d', 'revenueGrowthRate', 'rating', 'reviewCount'],
    minimumEvidenceSummary:
      'Requires verified revenue >= ฿20,000, creatorCount >= 1, adjusted RPC >= ฿3,000, demand >= 40, commission > 0%, and confidence >= 55.',
    exclusionSummary:
      'Excludes tiny low-revenue products with 1 creator, 0-creator products (undefined raw RPC), 0% commission, and poor customer quality.',
    rankingFormulaSummary:
      '0.40 * adjustedRpcScore + 0.28 * earningScore + 0.20 * demandScore + 0.12 * creatorDensityScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.creatorYield.minConfidence,
  },
  fast_rising_products: {
    id: 'fast_rising_products',
    name: 'Fast Rising Products',
    requiresHistoricalSnapshots: true,
    description:
      'Accelerating demand growth that outpaces creator growth, backed by verified longitudinal snapshots.',
    requiredMetrics: [
      'historicalSnapshots (>=2)',
      'revenueThb7d',
      'creatorCount',
      'priceThb',
      'commissionRate',
    ],
    optionalSupportingMetrics: ['salesVolume7d', 'revenueGrowthRate'],
    minimumEvidenceSummary:
      'Requires >= 2 time-separated verified snapshots with revenue and creator counts showing accelerating demand outpacing creator growth.',
    exclusionSummary:
      'Returns DATA_UNAVAILABLE whenever verified historical snapshots are absent; excludes 0% commission and shrinking demand.',
    rankingFormulaSummary:
      '0.35 * demandVelocityScore + 0.25 * demandVsCreatorSpreadScore + 0.22 * demandScore + 0.18 * earningScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.fastRising.minConfidence,
  },
  profit_maximizer: {
    id: 'profit_maximizer',
    name: 'Profit Maximizer',
    requiresHistoricalSnapshots: false,
    description:
      'Strong affiliate THB payout per sale supported by verified market demand and manageable competition (never commission % alone).',
    requiredMetrics: ['priceThb', 'commissionRate', 'revenueThb7d', 'creatorCount'],
    optionalSupportingMetrics: ['salesVolume7d', 'rating', 'reviewCount'],
    minimumEvidenceSummary:
      'Requires verified payout >= ฿20/sale, earning >= 48, demand >= 38, competition >= 30, and confidence >= 55.',
    exclusionSummary:
      'Excludes 0% commission, high-commission products with weak demand, sub-฿20 low payouts, and poor customer quality.',
    rankingFormulaSummary:
      '0.36 * payoutScore + 0.26 * earningScore + 0.23 * demandScore + 0.15 * competitionScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.profitMaximizer.minConfidence,
  },
  video_proven_winners: {
    id: 'video_proven_winners',
    name: 'Video Proven Winners',
    requiresHistoricalSnapshots: false,
    description:
      'Strong historical short-video revenue and video share paired with verified demand and manageable competition.',
    requiredMetrics: [
      'videoRevenueThb7d',
      'revenueThb7d',
      'creatorCount',
      'priceThb',
      'commissionRate',
    ],
    optionalSupportingMetrics: ['liveRevenueThb7d', 'salesVolume7d', 'rating', 'reviewCount'],
    minimumEvidenceSummary:
      'Requires verified video revenue >= ฿25,000, video share >= 25%, demand >= 40, competition >= 30, commission > 0%, and confidence >= 52.',
    exclusionSummary:
      'Never treats visual suitability as sales proof and never claims past video sales guarantee future user conversion.',
    rankingFormulaSummary:
      '0.34 * videoRevenueScaleScore + 0.24 * videoShareScore + 0.20 * demandScore + 0.12 * competitionScore + 0.10 * earningScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.videoProven.minConfidence,
  },
  trust_based_winners: {
    id: 'trust_based_winners',
    name: 'Trust-Based Winners',
    requiresHistoricalSnapshots: false,
    description:
      'High Bayesian-adjusted customer rating supported by a meaningful review sample, verified demand, and solid earning potential.',
    requiredMetrics: [
      'rating',
      'reviewCount',
      'revenueThb7d',
      'creatorCount',
      'priceThb',
      'commissionRate',
    ],
    optionalSupportingMetrics: ['salesVolume7d', 'revenueGrowthRate'],
    minimumEvidenceSummary:
      'Requires reviewCount >= 30, Bayesian rating >= 4.25, customerQualityScore >= 70, demand >= 40, earning >= 35, and confidence >= 58.',
    exclusionSummary:
      'Excludes small review samples (< 30 reviews), poor ratings, weak demand, and 0% commission products.',
    rankingFormulaSummary:
      '0.42 * customerQualityScore + 0.24 * demandScore + 0.22 * earningScore + 0.12 * competitionScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.trustBased.minConfidence,
  },
  trend_timing_opportunity: {
    id: 'trend_timing_opportunity',
    name: 'Trend Timing Opportunity',
    requiresHistoricalSnapshots: true,
    description:
      'Emerging demand expansion where market interest is growing faster than creator supply across longitudinal snapshots.',
    requiredMetrics: [
      'historicalSnapshots (>=3)',
      'revenueThb7d',
      'creatorCount',
      'priceThb',
      'commissionRate',
    ],
    optionalSupportingMetrics: ['salesVolume7d', 'revenueGrowthRate'],
    minimumEvidenceSummary:
      'Requires >= 3 longitudinal verified snapshots spanning >= 24 hours showing accelerating demand relative to creator supply.',
    exclusionSummary:
      'Returns DATA_UNAVAILABLE whenever longitudinal snapshots are absent; never fabricates historical trajectories.',
    rankingFormulaSummary:
      '0.32 * trajectoryScore + 0.28 * demandVsCreatorSpreadScore + 0.22 * competitionScore + 0.18 * demandScore',
    minConfidenceScore: DEFAULT_STRATEGY_THRESHOLDS_V2.trendTiming.minConfidence,
  },
};

export const ALL_STRATEGY_IDS: StrategyId[] = [
  'early_market_opportunity',
  'underserved_demand',
  'creator_yield_opportunity',
  'fast_rising_products',
  'profit_maximizer',
  'video_proven_winners',
  'trust_based_winners',
  'trend_timing_opportunity',
];

export type PartialStrategyThresholdsConfig = {
  [K in keyof StrategyThresholdsConfig]?: Partial<StrategyThresholdsConfig[K]>;
};

export interface EvaluateProductStrategiesOptions {
  scoringConfig?: PartialCommercialScoringV2Config;
  thresholds?: PartialStrategyThresholdsConfig;
  historicalSnapshots?: HistoricalMetricSnapshot[];
}

export interface StrategyCandidateInput<TItem = ProductItem> {
  item: TItem;
  productId?: string;
  validatedMetrics?: ProductValidatedMetrics;
  commercialScore?: CommercialScoreV2Result;
  historicalSnapshots?: HistoricalMetricSnapshot[];
}

function resolveStrategyThresholds(
  overrides?: PartialStrategyThresholdsConfig
): StrategyThresholdsConfig {
  if (!overrides) return DEFAULT_STRATEGY_THRESHOLDS_V2;
  return {
    overallClassification: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.overallClassification,
      ...overrides.overallClassification,
    },
    earlyMarket: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.earlyMarket,
      ...overrides.earlyMarket,
    },
    underservedDemand: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.underservedDemand,
      ...overrides.underservedDemand,
    },
    creatorYield: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.creatorYield,
      ...overrides.creatorYield,
    },
    fastRising: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.fastRising,
      ...overrides.fastRising,
    },
    profitMaximizer: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.profitMaximizer,
      ...overrides.profitMaximizer,
    },
    videoProven: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.videoProven,
      ...overrides.videoProven,
    },
    trustBased: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.trustBased,
      ...overrides.trustBased,
    },
    trendTiming: {
      ...DEFAULT_STRATEGY_THRESHOLDS_V2.trendTiming,
      ...overrides.trendTiming,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function logScale(value: number, pivot: number, maxRef: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const p = Math.max(1e-6, pivot);
  const m = Math.max(p * 2, maxRef);
  return clamp((Math.log10(1 + value / p) / Math.log10(1 + m / p)) * 100, 0, 100);
}

interface HistoricalTrajectoryAnalysis {
  available: boolean;
  snapshotCount: number;
  spanHours: number;
  demandGrowthPct: number | null;
  creatorGrowthPct: number | null;
  accelerationPct: number | null;
  spreadPct: number | null;
  reason: string;
}

function analyzeHistoricalSnapshots(
  snapshots: HistoricalMetricSnapshot[] | undefined,
  minSnapshots: number,
  minHoursSpan: number,
  options?: { nowMs?: number; targetDateRange?: string | null }
): HistoricalTrajectoryAnalysis {
  if (!Array.isArray(snapshots) || snapshots.length < minSnapshots) {
    return {
      available: false,
      snapshotCount: Array.isArray(snapshots) ? snapshots.length : 0,
      spanHours: 0,
      demandGrowthPct: null,
      creatorGrowthPct: null,
      accelerationPct: null,
      spreadPct: null,
      reason: `Historical snapshots unavailable (${Array.isArray(snapshots) ? snapshots.length : 0} provided; ${minSnapshots} verified snapshots required).`,
    };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const targetDateRange =
    typeof options?.targetDateRange === 'string' && options.targetDateRange.trim()
      ? options.targetDateRange.trim()
      : null;

  const isMetricTimestampSafe = (metric: ValidatedMetric<number> | undefined): boolean => {
    if (!metric) return false;
    if (!metric.fetchedAt) return true;
    const check = validateMetricTimestamp(metric.fetchedAt, {
      nowMs,
      staleAfterMs: -1,
    });
    return check.valid && !check.future;
  };

  const validOrderedRaw = snapshots
    .map((snap) => {
      const tsCheck = validateMetricTimestamp(snap.fetchedAt, {
        nowMs,
        staleAfterMs: -1,
      });
      return {
        snap,
        ms: tsCheck.valid && !tsCheck.future && tsCheck.normalizedIso
          ? Date.parse(tsCheck.normalizedIso)
          : Number.NaN,
      };
    })
    .filter((entry) => {
      if (!Number.isFinite(entry.ms)) return false;
      // Trust boundary: imported unverified backup snapshots must never qualify historical strategies
      if (entry.snap.trustStatus === 'IMPORTED_UNVERIFIED') return false;
      // Date range compatibility: do not compare incompatible observation windows
      if (
        targetDateRange &&
        entry.snap.dateRange &&
        entry.snap.dateRange.trim() &&
        entry.snap.dateRange.trim() !== targetDateRange
      ) {
        return false;
      }
      if (!isUsableScoringMetric(entry.snap.revenueThb7d)) return false;
      if (!isUsableScoringMetric(entry.snap.creatorCount)) return false;
      if (entry.snap.creatorCount.unit !== 'COUNT') return false;
      if (!isMetricTimestampSafe(entry.snap.revenueThb7d)) return false;
      if (!isMetricTimestampSafe(entry.snap.creatorCount)) return false;
      return true;
    })
    .sort((a, b) => a.ms - b.ms);

  // Deduplicate identical or near-duplicate snapshots (< 6h apart) so duplicate captures
  // cannot inflate snapshot counts or fabricate longitudinal acceleration.
  const MIN_DISTINCT_SNAPSHOT_GAP_MS = 6 * 3_600_000;
  const validOrdered: typeof validOrderedRaw = [];
  for (const entry of validOrderedRaw) {
    const prev = validOrdered[validOrdered.length - 1];
    if (prev && entry.ms - prev.ms < MIN_DISTINCT_SNAPSHOT_GAP_MS) {
      continue;
    }
    validOrdered.push(entry);
  }

  if (validOrdered.length < minSnapshots) {
    return {
      available: false,
      snapshotCount: validOrdered.length,
      spanHours: 0,
      demandGrowthPct: null,
      creatorGrowthPct: null,
      accelerationPct: null,
      spreadPct: null,
      reason: `Only ${validOrdered.length} trusted verified snapshots with valid non-future timestamps, revenue, and creatorCount; ${minSnapshots} required.`,
    };
  }

  const first = validOrdered[0];
  const last = validOrdered[validOrdered.length - 1];
  const spanHours = (last.ms - first.ms) / 3_600_000;
  if (spanHours < minHoursSpan) {
    return {
      available: false,
      snapshotCount: validOrdered.length,
      spanHours,
      demandGrowthPct: null,
      creatorGrowthPct: null,
      accelerationPct: null,
      spreadPct: null,
      reason: `Snapshot time span (${spanHours.toFixed(1)}h) is shorter than minimum ${minHoursSpan}h longitudinal requirement.`,
    };
  }

  const revStart = first.snap.revenueThb7d!.value!;
  const revEnd = last.snap.revenueThb7d!.value!;
  const creatorsStart = first.snap.creatorCount!.value!;
  const creatorsEnd = last.snap.creatorCount!.value!;

  if (revStart <= 0) {
    return {
      available: false,
      snapshotCount: validOrdered.length,
      spanHours,
      demandGrowthPct: null,
      creatorGrowthPct: null,
      accelerationPct: null,
      spreadPct: null,
      reason: 'Baseline snapshot revenue is 0; percentage demand growth trajectory is undefined.',
    };
  }

  const demandGrowthPct = ((revEnd - revStart) / revStart) * 100;
  const creatorGrowthPct =
    creatorsStart > 0
      ? ((creatorsEnd - creatorsStart) / creatorsStart) * 100
      : creatorsEnd === 0
        ? 0
        : creatorsEnd * 100;

  let accelerationPct: number | null = null;
  if (validOrdered.length >= 3) {
    const mid = validOrdered[Math.floor(validOrdered.length / 2)];
    const revMid = mid.snap.revenueThb7d!.value!;
    if (revMid > 0) {
      const firstHalfGrowth = ((revMid - revStart) / revStart) * 100;
      const secondHalfGrowth = ((revEnd - revMid) / revMid) * 100;
      accelerationPct = secondHalfGrowth - firstHalfGrowth;
    }
  } else if (
    isUsableScoringMetric(last.snap.revenueGrowthRate) &&
    (last.snap.revenueGrowthRate.unit === 'PERCENT' || last.snap.revenueGrowthRate.unit === 'RATIO') &&
    isUsableScoringMetric(first.snap.revenueGrowthRate) &&
    (first.snap.revenueGrowthRate.unit === 'PERCENT' || first.snap.revenueGrowthRate.unit === 'RATIO')
  ) {
    const g1 =
      first.snap.revenueGrowthRate.unit === 'RATIO'
        ? first.snap.revenueGrowthRate.value! * 100
        : first.snap.revenueGrowthRate.value!;
    const g2 =
      last.snap.revenueGrowthRate.unit === 'RATIO'
        ? last.snap.revenueGrowthRate.value! * 100
        : last.snap.revenueGrowthRate.value!;
    accelerationPct = g2 - g1;
  }

  const spreadPct = demandGrowthPct - creatorGrowthPct;

  return {
    available: true,
    snapshotCount: validOrdered.length,
    spanHours,
    demandGrowthPct: Math.round(demandGrowthPct * 10) / 10,
    creatorGrowthPct: Math.round(creatorGrowthPct * 10) / 10,
    accelerationPct: accelerationPct !== null ? Math.round(accelerationPct * 10) / 10 : null,
    spreadPct: Math.round(spreadPct * 10) / 10,
    reason: `Verified ${validOrdered.length} snapshots across ${spanHours.toFixed(1)}h (demand ${demandGrowthPct >= 0 ? '+' : ''}${demandGrowthPct.toFixed(1)}%, creators ${creatorGrowthPct >= 0 ? '+' : ''}${creatorGrowthPct.toFixed(1)}%).`,
  };
}

function makeCheck(
  key: string,
  label: string,
  passed: boolean,
  status: StrategyRequirementCheck['status'],
  detail: string
): StrategyRequirementCheck {
  return { key, label, passed, status, detail };
}

function buildStrategyEvaluation(params: {
  profile: StrategyProfileDefinition;
  commercial: CommercialScoreV2Result;
  checks: StrategyRequirementCheck[];
  rawScoreIfQualified: number | null;
  rankingReasons: string[];
  opportunityTags?: string[];
  riskTags?: string[];
  forceDataUnavailable?: boolean;
  unavailableReason?: string;
}): StrategyEvaluationResult {
  const { profile, commercial, checks, rawScoreIfQualified, rankingReasons } = params;
  const passedRequirements = checks.filter((c) => c.passed);
  const failedRequirements = checks.filter((c) => !c.passed);

  const missingEvidence = failedRequirements
    .filter(
      (c) =>
        c.status === 'MISSING' ||
        c.status === 'UNVERIFIED' ||
        c.status === 'DATA_UNAVAILABLE'
    )
    .map((c) => `${c.key}: ${c.detail}`);

  const baseOppTags = Array.from(
    new Set([...(params.opportunityTags ?? [])])
  );
  const baseRiskTags = Array.from(
    new Set([...commercial.riskTags, ...(params.riskTags ?? [])])
  );

  let eligibilityStatus: StrategyEligibilityStatus;
  let strategyScore: number | null = null;
  let explanation: string;

  if (params.forceDataUnavailable) {
    eligibilityStatus = 'DATA_UNAVAILABLE';
    explanation =
      params.unavailableReason ??
      `${profile.name} is DATA_UNAVAILABLE because required historical snapshot evidence is missing.`;
  } else if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    eligibilityStatus = 'NOT_ELIGIBLE';
    explanation = `${profile.name}: Excluded (NOT_ELIGIBLE) due to verified 0% affiliate commission.`;
  } else if (
    failedRequirements.some(
      (c) => c.status === 'MISSING' || c.status === 'UNVERIFIED'
    )
  ) {
    eligibilityStatus = 'INSUFFICIENT_DATA';
    explanation = `${profile.name}: INSUFFICIENT_DATA — ${missingEvidence.join(' ')}`;
  } else if (
    failedRequirements.some(
      (c) => c.status === 'FAILED' && c.key !== 'data_confidence'
    )
  ) {
    eligibilityStatus = 'NOT_ELIGIBLE';
    const failSummary = failedRequirements
      .filter((c) => c.status === 'FAILED')
      .map((c) => c.detail)
      .join(' ');
    explanation = `${profile.name}: NOT_ELIGIBLE — ${failSummary}`;
  } else if (
    failedRequirements.some((c) => c.key === 'data_confidence') ||
    commercial.dataConfidence.score < profile.minConfidenceScore
  ) {
    eligibilityStatus = 'PARTIAL_EVIDENCE';
    explanation = `${profile.name}: PARTIAL_EVIDENCE — core thresholds met, but Data Confidence (${commercial.dataConfidence.score}/100) is below ${profile.minConfidenceScore} required for qualification.`;
  } else if (rawScoreIfQualified === null || !Number.isFinite(rawScoreIfQualified)) {
    eligibilityStatus = 'INSUFFICIENT_DATA';
    explanation = `${profile.name}: INSUFFICIENT_DATA — Required inputs to compute strategy score are unavailable.`;
  } else {
    eligibilityStatus = 'QUALIFIED';
    strategyScore = Math.round(clamp(rawScoreIfQualified, 0, 100));
    explanation = `${profile.name}: QUALIFIED (${strategyScore}/100) — ${rankingReasons.join(' ')}`;
  }

  return {
    strategyId: profile.id,
    strategyName: profile.name,
    eligibilityStatus,
    strategyScore,
    commercialOpportunityScore: commercial.commercialOpportunityScore,
    dataConfidence: commercial.dataConfidence,
    minConfidenceRequired: profile.minConfidenceScore,
    requiredMetrics: profile.requiredMetrics,
    optionalSupportingMetrics: profile.optionalSupportingMetrics,
    passedRequirements,
    failedRequirements,
    missingEvidence,
    opportunityTags: eligibilityStatus === 'QUALIFIED' ? baseOppTags : [],
    riskTags: baseRiskTags,
    rankingReasons: eligibilityStatus === 'QUALIFIED' ? rankingReasons : [],
    explanation,
  };
}

function checkMetricAvailability(
  key: string,
  label: string,
  metric: ValidatedMetric<number>,
  detailIfOk: string
): StrategyRequirementCheck {
  if (isUsableScoringMetric(metric)) {
    return makeCheck(key, label, true, 'PASSED', detailIfOk);
  }
  if (metric.unit === 'UNVERIFIED' || metric.state === 'UNAVAILABLE') {
    return makeCheck(
      key,
      label,
      false,
      'UNVERIFIED',
      `${label} is unverified (${metric.state}/${metric.unit}).`
    );
  }
  if (metric.provenance === 'SYNTHETIC' && (metric.state === 'OK' || metric.state === 'ZERO')) {
    return makeCheck(
      key,
      label,
      false,
      'UNVERIFIED',
      `${label} is SYNTHETIC rather than verified SOURCE data.`
    );
  }
  return makeCheck(
    key,
    label,
    false,
    'MISSING',
    `${label} is ${metric.state.toLowerCase()}.`
  );
}

function evaluateStrategy1EarlyMarket(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.early_market_opportunity;
  const cfg = thresholds.earlyMarket;
  const checks: StrategyRequirementCheck[] = [];

  // Commission & price
  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const passEarning = commercial.earningScore.score >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'earning_potential',
        'Affiliate Earning Potential',
        passEarning,
        passEarning ? 'PASSED' : 'FAILED',
        `Earning score ${commercial.earningScore.score}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  // Demand & absolute demand
  const absDemand = commercial.demandScore.subcomponents.absoluteDemandScore;
  if (commercial.demandScore.score === null || absDemand === null) {
    checks.push(checkMetricAvailability('demand', 'Verified Market Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = absDemand >= cfg.minAbsoluteDemand;
    checks.push(
      makeCheck(
        'absolute_demand',
        'Strong Absolute Demand',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Absolute demand ${absDemand}/100 (min ${cfg.minAbsoluteDemand}).`
      )
    );
  }

  // Verified positive growth
  const growthPct = commercial.demandScore.subcomponents.verifiedGrowthPercent;
  const growthScore = commercial.demandScore.subcomponents.growthScore;
  if (commercial.demandScore.growthStatus !== 'VERIFIED' || growthPct === null || growthScore === null) {
    const status =
      commercial.demandScore.growthStatus === 'MISSING' ? 'MISSING' : 'UNVERIFIED';
    checks.push(
      makeCheck(
        'verified_growth',
        'Verified Demand Growth',
        false,
        status,
        `Demand growth status is ${commercial.demandScore.growthStatus}.`
      )
    );
  } else {
    const passGrowth = growthPct >= cfg.minGrowthPercent;
    checks.push(
      makeCheck(
        'verified_growth',
        'Verified Positive Growth',
        passGrowth,
        passGrowth ? 'PASSED' : 'FAILED',
        `Verified demand growth ${growthPct >= 0 ? '+' : ''}${growthPct}% (min +${cfg.minGrowthPercent}%).`
      )
    );
  }

  // Competition & creators
  if (commercial.competitionScore.score === null || commercial.competitionScore.creatorCount === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Verified Creator Competition', metrics.creatorCount, ''));
  } else if (commercial.competitionScore.riskFlag === 'ZERO_CREATORS_POSITIVE_REVENUE') {
    checks.push(
      makeCheck(
        'creator_competition',
        'Active Creator Proof & Low Competition',
        false,
        'FAILED',
        '0 reported creators with positive revenue; affiliate traction unconfirmed.'
      )
    );
  } else {
    const creators = commercial.competitionScore.creatorCount;
    const compScore = commercial.competitionScore.score;
    const passComp = compScore >= cfg.minCompetitionScore && creators <= cfg.maxCreatorCount;
    checks.push(
      makeCheck(
        'creator_competition',
        'Low Creator Competition & Strong RPC',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${compScore}/100 with ${creators} creators (need >= ${cfg.minCompetitionScore}, <= ${cfg.maxCreatorCount} creators).`
      )
    );
  }

  // Quality gate
  if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    checks.push(
      makeCheck(
        'customer_quality',
        'Acceptable Customer Quality',
        false,
        'FAILED',
        `Verified poor customer quality (${commercial.customerQualityScore.bayesianRating}/5).`
      )
    );
  }

  // Confidence gate
  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const rawScore =
    absDemand !== null &&
    growthScore !== null &&
    commercial.competitionScore.score !== null &&
    commercial.earningScore.score !== null
      ? 0.28 * absDemand +
        0.24 * growthScore +
        0.28 * commercial.competitionScore.score +
        0.2 * commercial.earningScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Strong absolute demand (${absDemand}/100) with +${growthPct}% verified growth.`,
      `Low creator crowding (${commercial.competitionScore.creatorCount} creators, adjRPC ฿${commercial.adjustedRpcThb}).`,
      `Attractive affiliate payout (฿${commercial.earningScore.payoutPerSaleThb}/sale).`,
    ],
    opportunityTags: ['EARLY_MARKET_WINNER', 'HIGH_DEMAND', 'POSITIVE_GROWTH', 'LOW_COMPETITION'],
  });
}

function evaluateStrategy2UnderservedDemand(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.underserved_demand;
  const cfg = thresholds.underservedDemand;
  const checks: StrategyRequirementCheck[] = [];

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const passEarning = commercial.earningScore.score >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'earning_potential',
        'Sufficient Earning Potential',
        passEarning,
        passEarning ? 'PASSED' : 'FAILED',
        `Earning score ${commercial.earningScore.score}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  const absDemand = commercial.demandScore.subcomponents.absoluteDemandScore;
  if (commercial.demandScore.score === null || absDemand === null) {
    checks.push(checkMetricAvailability('demand', 'Verified Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = absDemand >= cfg.minAbsoluteDemand;
    checks.push(
      makeCheck(
        'absolute_demand',
        'Strong Absolute Demand',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Absolute demand ${absDemand}/100 (min ${cfg.minAbsoluteDemand}).`
      )
    );
  }

  if (commercial.competitionScore.score === null || commercial.competitionScore.creatorCount === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Verified Creator Count', metrics.creatorCount, ''));
  } else if (commercial.competitionScore.riskFlag === 'ZERO_CREATORS_POSITIVE_REVENUE') {
    checks.push(
      makeCheck(
        'creator_competition',
        'Manageable Creator Competition',
        false,
        'FAILED',
        '0 reported creators with positive revenue; underserved affiliate supply unconfirmed.'
      )
    );
  } else {
    const compScore = commercial.competitionScore.score;
    const passComp = compScore >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'creator_competition',
        'Manageable Creator Competition',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${compScore}/100 with ${commercial.competitionScore.creatorCount} creators (min ${cfg.minCompetitionScore}).`
      )
    );
  }

  if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    checks.push(
      makeCheck(
        'customer_quality',
        'Acceptable Customer Quality',
        false,
        'FAILED',
        `Verified poor customer quality (${commercial.customerQualityScore.bayesianRating}/5).`
      )
    );
  }

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  // Positive growth is desirable bonus (+0..6) when verified, NOT mandatory
  let growthAdjustment = 0;
  const gScore = commercial.demandScore.subcomponents.growthScore;
  if (commercial.demandScore.growthStatus === 'VERIFIED' && gScore !== null) {
    if (gScore > 50) {
      growthAdjustment = ((gScore - 50) / 50) * 6;
    } else if (gScore < 35) {
      growthAdjustment = -8;
    }
  }

  const rawScore =
    absDemand !== null &&
    commercial.competitionScore.score !== null &&
    commercial.earningScore.score !== null
      ? 0.42 * absDemand +
        0.36 * commercial.competitionScore.score +
        0.22 * commercial.earningScore.score +
        growthAdjustment
      : null;

  const growthNote =
    commercial.demandScore.growthStatus === 'VERIFIED'
      ? `Verified growth ${commercial.demandScore.subcomponents.verifiedGrowthPercent}% included as bonus.`
      : 'Qualified without requiring historical growth data.';

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Strong demand (${absDemand}/100) paired with low creator competition (${commercial.competitionScore.score}/100).`,
      growthNote,
    ],
    opportunityTags: ['UNDERSERVED_DEMAND', 'LOW_COMPETITION'],
  });
}

function evaluateStrategy3CreatorYield(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.creator_yield_opportunity;
  const cfg = thresholds.creatorYield;
  const checks: StrategyRequirementCheck[] = [];

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const passEarning = commercial.earningScore.score >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'earning_potential',
        'Attractive Affiliate Payout',
        passEarning,
        passEarning ? 'PASSED' : 'FAILED',
        `Earning score ${commercial.earningScore.score}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  const revUsable = isUsableScoringMetric(metrics.revenueThb7d) && metrics.revenueThb7d.unit === 'THB';
  if (!revUsable || commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('revenueThb7d', 'Verified Market Revenue', metrics.revenueThb7d, ''));
  } else {
    const rev = metrics.revenueThb7d.value!;
    const passDemand =
      commercial.demandScore.score >= cfg.minDemandScore && rev >= cfg.minRevenueThb;
    checks.push(
      makeCheck(
        'meaningful_demand',
        'Meaningful Market Demand (Anti-Tiny-Product Guard)',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand ${commercial.demandScore.score}/100 and revenue ฿${rev.toLocaleString('en-US')} (min demand ${cfg.minDemandScore}, min ฿${cfg.minRevenueThb.toLocaleString('en-US')}).`
      )
    );
  }

  if (
    commercial.competitionScore.score === null ||
    commercial.competitionScore.adjustedRpcThb === null ||
    commercial.competitionScore.creatorCount === null
  ) {
    checks.push(checkMetricAvailability('creatorCount', 'Verified Creator Count & RPC', metrics.creatorCount, ''));
  } else if (commercial.competitionScore.creatorCount <= 0) {
    checks.push(
      makeCheck(
        'verified_rpc',
        'Active Creator Yield (Raw & Adjusted RPC)',
        false,
        'FAILED',
        '0 creators reported; raw RPC is undefined.'
      )
    );
  } else {
    const adjRpc = commercial.competitionScore.adjustedRpcThb;
    const compScore = commercial.competitionScore.score;
    const passRpc = adjRpc >= cfg.minAdjustedRpcThb && compScore >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'verified_rpc',
        'Strong Smoothed Revenue Per Creator',
        passRpc,
        passRpc ? 'PASSED' : 'FAILED',
        `Adjusted RPC ฿${adjRpc.toLocaleString('en-US')} (raw ฿${commercial.competitionScore.rawRpcThb?.toLocaleString('en-US')}) and competition ${compScore}/100.`
      )
    );
  }

  if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    checks.push(
      makeCheck(
        'customer_quality',
        'Acceptable Customer Quality',
        false,
        'FAILED',
        `Verified poor customer quality (${commercial.customerQualityScore.bayesianRating}/5).`
      )
    );
  }

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const adjRpcScore = commercial.competitionScore.subcomponents.adjustedRpcScore;
  const densityScore = commercial.competitionScore.subcomponents.creatorDensityScore;
  const rawScore =
    adjRpcScore !== null &&
    densityScore !== null &&
    commercial.earningScore.score !== null &&
    commercial.demandScore.score !== null
      ? 0.4 * adjRpcScore +
        0.28 * commercial.earningScore.score +
        0.2 * commercial.demandScore.score +
        0.12 * densityScore
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Strong smoothed RPC ฿${commercial.adjustedRpcThb?.toLocaleString('en-US')}/creator (raw ฿${commercial.rawRpcThb?.toLocaleString('en-US')}).`,
      `Backed by meaningful demand (${commercial.demandScore.score}/100) and ฿${commercial.earningScore.payoutPerSaleThb}/sale payout.`,
    ],
    opportunityTags: ['CREATOR_YIELD_WINNER', 'STRONG_RPC'],
  });
}

function evaluateStrategy4FastRising(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig,
  snapshots?: HistoricalMetricSnapshot[],
  nowMs?: number
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.fast_rising_products;
  const cfg = thresholds.fastRising;
  const trajectory = analyzeHistoricalSnapshots(
    snapshots,
    cfg.minSnapshots,
    cfg.minHoursBetweenSnapshots,
    { nowMs, targetDateRange: metrics.dateRange }
  );

  if (!trajectory.available) {
    const checks: StrategyRequirementCheck[] = [
      makeCheck(
        'historical_snapshots',
        'Verified Historical Snapshots',
        false,
        'DATA_UNAVAILABLE',
        trajectory.reason
      ),
    ];
    if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
      checks.push(
        makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
      );
    }
    return buildStrategyEvaluation({
      profile,
      commercial,
      checks,
      rawScoreIfQualified: null,
      rankingReasons: [],
      forceDataUnavailable: true,
      unavailableReason: `${profile.name}: DATA_UNAVAILABLE — ${trajectory.reason}`,
    });
  }

  const checks: StrategyRequirementCheck[] = [
    makeCheck('historical_snapshots', 'Verified Historical Snapshots', true, 'PASSED', trajectory.reason),
  ];

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  }

  if (commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('demand', 'Commercial Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = commercial.demandScore.score >= cfg.minDemandScore;
    checks.push(
      makeCheck(
        'commercial_demand',
        'Meaningful Commercial Demand',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand score ${commercial.demandScore.score}/100 (min ${cfg.minDemandScore}).`
      )
    );
  }

  const dGrowth = trajectory.demandGrowthPct ?? 0;
  const spread = trajectory.spreadPct ?? 0;
  const accelOk = trajectory.accelerationPct === null ? dGrowth >= cfg.minDemandGrowthPct : trajectory.accelerationPct >= 0;
  const passVelocity =
    dGrowth >= cfg.minDemandGrowthPct &&
    spread >= cfg.minSpreadOverCreatorGrowthPct &&
    accelOk;
  checks.push(
    makeCheck(
      'demand_vs_creator_growth',
      'Accelerating Demand Outpacing Creator Growth',
      passVelocity,
      passVelocity ? 'PASSED' : 'FAILED',
      `Demand growth ${dGrowth}%, creator growth ${trajectory.creatorGrowthPct}%, spread +${spread}%, acceleration ${trajectory.accelerationPct ?? 'N/A'}%.`
    )
  );

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const velocityScore = clamp(50 + 50 * Math.tanh(dGrowth / 60), 0, 100);
  const spreadScore = clamp(50 + 50 * Math.tanh(spread / 45), 0, 100);
  const rawScore =
    commercial.demandScore.score !== null && commercial.earningScore.score !== null
      ? 0.35 * velocityScore +
        0.25 * spreadScore +
        0.22 * commercial.demandScore.score +
        0.18 * commercial.earningScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Verified historical demand growth (+${dGrowth}%) outpaced creator growth (${trajectory.creatorGrowthPct}%) by +${spread}%.`,
    ],
    opportunityTags: ['FAST_RISING', 'POSITIVE_GROWTH'],
  });
}

function evaluateStrategy5ProfitMaximizer(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.profit_maximizer;
  const cfg = thresholds.profitMaximizer;
  const checks: StrategyRequirementCheck[] = [];

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (
    commercial.earningScore.score === null ||
    commercial.earningScore.payoutPerSaleThb === null
  ) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const payout = commercial.earningScore.payoutPerSaleThb;
    const eScore = commercial.earningScore.score;
    const passPayout = payout >= cfg.minPayoutPerSaleThb && eScore >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'payout_per_sale',
        'Strong Affiliate Payout Per Sale',
        passPayout,
        passPayout ? 'PASSED' : 'FAILED',
        `Payout ฿${payout}/sale (min ฿${cfg.minPayoutPerSaleThb}) and realized earning ${eScore}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  if (commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('demand', 'Sufficient Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = commercial.demandScore.score >= cfg.minDemandScore;
    checks.push(
      makeCheck(
        'sufficient_demand',
        'Sufficient Demand Backing',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand score ${commercial.demandScore.score}/100 (min ${cfg.minDemandScore}).`
      )
    );
  }

  if (commercial.competitionScore.score === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Acceptable Competition', metrics.creatorCount, ''));
  } else {
    const passComp = commercial.competitionScore.score >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'acceptable_competition',
        'Acceptable Creator Competition',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${commercial.competitionScore.score}/100 (min ${cfg.minCompetitionScore}).`
      )
    );
  }

  if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    checks.push(
      makeCheck(
        'customer_quality',
        'Acceptable Customer Quality',
        false,
        'FAILED',
        `Verified poor customer quality (${commercial.customerQualityScore.bayesianRating}/5).`
      )
    );
  }

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const payoutScore = commercial.earningScore.subcomponents.payoutScore;
  const rawScore =
    payoutScore !== null &&
    commercial.earningScore.score !== null &&
    commercial.demandScore.score !== null &&
    commercial.competitionScore.score !== null
      ? 0.36 * payoutScore +
        0.26 * commercial.earningScore.score +
        0.23 * commercial.demandScore.score +
        0.15 * commercial.competitionScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `High payout ฿${commercial.earningScore.payoutPerSaleThb}/sale (${commercial.earningScore.verifiedCommissionPercent}%) backed by ${commercial.demandScore.score}/100 demand.`,
    ],
    opportunityTags: ['PROFIT_MAXIMIZER', 'ATTRACTIVE_EARNING'],
  });
}

function evaluateStrategy6VideoProven(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.video_proven_winners;
  const cfg = thresholds.videoProven;
  const checks: StrategyRequirementCheck[] = [];
  const conv = commercial.conversionEvidence;

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const passEarning = commercial.earningScore.score >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'earning_potential',
        'Monetizable Earning Potential',
        passEarning,
        passEarning ? 'PASSED' : 'FAILED',
        `Earning score ${commercial.earningScore.score}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  if (commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('demand', 'Commercial Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = commercial.demandScore.score >= cfg.minDemandScore;
    checks.push(
      makeCheck(
        'commercial_demand',
        'Sufficient Commercial Demand',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand score ${commercial.demandScore.score}/100 (min ${cfg.minDemandScore}).`
      )
    );
  }

  if (commercial.competitionScore.score === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Manageable Competition', metrics.creatorCount, ''));
  } else {
    const passComp = commercial.competitionScore.score >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'manageable_competition',
        'Manageable Creator Competition',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${commercial.competitionScore.score}/100 (min ${cfg.minCompetitionScore}).`
      )
    );
  }

  const videoUsable = isUsableScoringMetric(conv.videoRevenueThb) && conv.videoRevenueThb.unit === 'THB';
  const totalUsable = isUsableScoringMetric(conv.totalRevenueThb) && conv.totalRevenueThb.unit === 'THB';
  if (!videoUsable) {
    checks.push(checkMetricAvailability('videoRevenueThb7d', 'Verified Video Revenue', conv.videoRevenueThb, ''));
  } else if (!totalUsable) {
    checks.push(checkMetricAvailability('revenueThb7d', 'Verified Total Revenue', conv.totalRevenueThb, ''));
  } else if (conv.videoRevenueShare === null) {
    const tRev = conv.totalRevenueThb.value ?? 0;
    const vRev = conv.videoRevenueThb.value ?? 0;
    checks.push(
      makeCheck(
        'video_sales_evidence',
        'Consistent Video & Total Revenue',
        false,
        'FAILED',
        tRev <= 0
          ? 'Total verified revenue is 0; video revenue share is undefined.'
          : `Video revenue (฿${vRev.toLocaleString('en-US')}) exceeds total revenue (฿${tRev.toLocaleString('en-US')}) beyond tolerance; channel data is inconsistent.`
      )
    );
  } else {
    const vRev = conv.videoRevenueThb.value!;
    const vShare = conv.videoRevenueShare;
    const passVideo = vRev >= cfg.minVideoRevenueThb && vShare >= cfg.minVideoShare;
    checks.push(
      makeCheck(
        'video_sales_evidence',
        'Strong Video Revenue & Share',
        passVideo,
        passVideo ? 'PASSED' : 'FAILED',
        `Video revenue ฿${vRev.toLocaleString('en-US')} (${Math.round(vShare * 100)}% share; need >= ฿${cfg.minVideoRevenueThb.toLocaleString('en-US')} & >= ${Math.round(cfg.minVideoShare * 100)}%).`
      )
    );
  }

  if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    checks.push(
      makeCheck(
        'customer_quality',
        'Acceptable Customer Quality',
        false,
        'FAILED',
        `Verified poor customer quality (${commercial.customerQualityScore.bayesianRating}/5).`
      )
    );
  }

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const vRevVal = videoUsable ? conv.videoRevenueThb.value! : 0;
  const vShareVal = conv.videoRevenueShare ?? 0;
  const videoScaleScore = logScale(vRevVal, 2_000, 1_500_000);
  const videoShareScore = clamp(vShareVal * 100, 0, 100);

  const rawScore =
    videoUsable &&
    conv.videoRevenueShare !== null &&
    commercial.demandScore.score !== null &&
    commercial.competitionScore.score !== null &&
    commercial.earningScore.score !== null
      ? 0.34 * videoScaleScore +
        0.24 * videoShareScore +
        0.2 * commercial.demandScore.score +
        0.12 * commercial.competitionScore.score +
        0.1 * commercial.earningScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Historical video channel revenue ฿${vRevVal.toLocaleString('en-US')} (${Math.round(vShareVal * 100)}% share); past channel evidence does not guarantee individual conversion.`,
    ],
    opportunityTags: ['VIDEO_PROVEN', 'CHANNEL_VIDEO_EVIDENCE'],
  });
}

function evaluateStrategy7TrustBased(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.trust_based_winners;
  const cfg = thresholds.trustBased;
  const checks: StrategyRequirementCheck[] = [];
  const q = commercial.customerQualityScore;

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  } else {
    const passEarning = commercial.earningScore.score >= cfg.minEarningScore;
    checks.push(
      makeCheck(
        'earning_potential',
        'Attractive Earning Potential',
        passEarning,
        passEarning ? 'PASSED' : 'FAILED',
        `Earning score ${commercial.earningScore.score}/100 (min ${cfg.minEarningScore}).`
      )
    );
  }

  if (commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('demand', 'Sufficient Demand', metrics.revenueThb7d, ''));
  } else {
    const passDemand = commercial.demandScore.score >= cfg.minDemandScore;
    checks.push(
      makeCheck(
        'sufficient_demand',
        'Sufficient Demand',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand score ${commercial.demandScore.score}/100 (min ${cfg.minDemandScore}).`
      )
    );
  }

  if (commercial.competitionScore.score === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Creator Competition', metrics.creatorCount, ''));
  } else {
    const passComp = commercial.competitionScore.score >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'competition',
        'Reasonable Competition',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${commercial.competitionScore.score}/100 (min ${cfg.minCompetitionScore}).`
      )
    );
  }

  if (q.score === null || q.bayesianRating === null || q.reviewCount === null) {
    if (!isUsableScoringMetric(metrics.rating) || metrics.rating.unit !== 'RATING_5') {
      checks.push(checkMetricAvailability('rating', 'Verified Product Rating', metrics.rating, ''));
    } else {
      checks.push(checkMetricAvailability('reviewCount', 'Verified Review Count', metrics.reviewCount, ''));
    }
  } else {
    const passSample = q.reviewCount >= cfg.minReviewCount;
    checks.push(
      makeCheck(
        'review_sample_size',
        'Meaningful Review Sample Size',
        passSample,
        passSample ? 'PASSED' : 'FAILED',
        `Verified review sample n=${q.reviewCount} (min ${cfg.minReviewCount} reviews required).`
      )
    );
    const passQuality =
      q.bayesianRating >= cfg.minBayesianRating && q.score >= cfg.minQualityScore;
    checks.push(
      makeCheck(
        'bayesian_customer_quality',
        'Strong Bayesian Customer Rating',
        passQuality,
        passQuality ? 'PASSED' : 'FAILED',
        `Bayesian rating ${q.bayesianRating}/5 (${q.score}/100; min ${cfg.minBayesianRating}/5 & ${cfg.minQualityScore}/100).`
      )
    );
  }

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const rawScore =
    q.score !== null &&
    commercial.demandScore.score !== null &&
    commercial.earningScore.score !== null &&
    commercial.competitionScore.score !== null
      ? 0.42 * q.score +
        0.24 * commercial.demandScore.score +
        0.22 * commercial.earningScore.score +
        0.12 * commercial.competitionScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `High Bayesian customer trust (${q.bayesianRating}/5 across ${q.reviewCount} reviews) with solid demand & payout.`,
    ],
    opportunityTags: ['TRUST_BASED_WINNER', 'STRONG_CUSTOMER_QUALITY'],
  });
}

function evaluateStrategy8TrendTiming(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  thresholds: StrategyThresholdsConfig,
  snapshots?: HistoricalMetricSnapshot[],
  nowMs?: number
): StrategyEvaluationResult {
  const profile = STRATEGY_PROFILES_V2.trend_timing_opportunity;
  const cfg = thresholds.trendTiming;
  const trajectory = analyzeHistoricalSnapshots(
    snapshots,
    cfg.minSnapshots,
    cfg.minHoursSpan,
    { nowMs, targetDateRange: metrics.dateRange }
  );

  if (!trajectory.available) {
    const checks: StrategyRequirementCheck[] = [
      makeCheck(
        'longitudinal_snapshots',
        'Longitudinal Snapshot History',
        false,
        'DATA_UNAVAILABLE',
        trajectory.reason
      ),
    ];
    if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
      checks.push(
        makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
      );
    }
    return buildStrategyEvaluation({
      profile,
      commercial,
      checks,
      rawScoreIfQualified: null,
      rankingReasons: [],
      forceDataUnavailable: true,
      unavailableReason: `${profile.name}: DATA_UNAVAILABLE — ${trajectory.reason}`,
    });
  }

  const checks: StrategyRequirementCheck[] = [
    makeCheck('longitudinal_snapshots', 'Longitudinal Snapshot History', true, 'PASSED', trajectory.reason),
  ];

  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    checks.push(
      makeCheck('monetizable_commission', 'Monetizable Commission', false, 'FAILED', 'Verified 0% commission.')
    );
  } else if (commercial.earningScore.score === null) {
    checks.push(checkMetricAvailability('commissionRate', 'Commission & Price', metrics.commissionRate, ''));
  }

  if (commercial.demandScore.score === null) {
    checks.push(checkMetricAvailability('demand', 'Demand Level', metrics.revenueThb7d, ''));
  } else {
    const passDemand = commercial.demandScore.score >= cfg.minDemandScore;
    checks.push(
      makeCheck(
        'demand_level',
        'Emerging Demand Support',
        passDemand,
        passDemand ? 'PASSED' : 'FAILED',
        `Demand score ${commercial.demandScore.score}/100 (min ${cfg.minDemandScore}).`
      )
    );
  }

  if (commercial.competitionScore.score === null) {
    checks.push(checkMetricAvailability('creatorCount', 'Creator Competition', metrics.creatorCount, ''));
  } else {
    const passComp = commercial.competitionScore.score >= cfg.minCompetitionScore;
    checks.push(
      makeCheck(
        'competition',
        'Uncongested Creator Supply',
        passComp,
        passComp ? 'PASSED' : 'FAILED',
        `Competition score ${commercial.competitionScore.score}/100 (min ${cfg.minCompetitionScore}).`
      )
    );
  }

  const dGrowth = trajectory.demandGrowthPct ?? 0;
  const spread = trajectory.spreadPct ?? 0;
  const passTiming =
    dGrowth >= cfg.minDemandGrowthPct && spread >= cfg.minSpreadOverCreatorGrowthPct;
  checks.push(
    makeCheck(
      'trend_timing_spread',
      'Demand Expansion Ahead of Creator Supply',
      passTiming,
      passTiming ? 'PASSED' : 'FAILED',
      `Longitudinal demand growth +${dGrowth}% vs creator growth ${trajectory.creatorGrowthPct}% (spread +${spread}%).`
    )
  );

  const passConf = commercial.dataConfidence.score >= cfg.minConfidence;
  checks.push(
    makeCheck(
      'data_confidence',
      'Minimum Data Confidence',
      passConf,
      passConf ? 'PASSED' : 'FAILED',
      `Data Confidence ${commercial.dataConfidence.score}/100 (min ${cfg.minConfidence}).`
    )
  );

  const trajScore = clamp(50 + 50 * Math.tanh(dGrowth / 55), 0, 100);
  const spreadScore = clamp(50 + 50 * Math.tanh(spread / 45), 0, 100);
  const rawScore =
    commercial.competitionScore.score !== null && commercial.demandScore.score !== null
      ? 0.32 * trajScore +
        0.28 * spreadScore +
        0.22 * commercial.competitionScore.score +
        0.18 * commercial.demandScore.score
      : null;

  return buildStrategyEvaluation({
    profile,
    commercial,
    checks,
    rawScoreIfQualified: rawScore,
    rankingReasons: [
      `Longitudinal trajectory confirms emerging demand (+${dGrowth}%) outpacing creator supply (+${trajectory.creatorGrowthPct}%).`,
    ],
    opportunityTags: ['TREND_TIMING_OPPORTUNITY', 'POSITIVE_GROWTH'],
  });
}

/**
 * Classifies overall commercial opportunity consistently with Phase 2 eligibility
 * and prevents low-confidence products from masquerading as verified top opportunities.
 */
export function classifyProductOpportunityV2(
  commercial: CommercialScoreV2Result,
  qualifiedStrategyIds: StrategyId[],
  thresholdsInput?: PartialStrategyThresholdsConfig
): OpportunityClassification {
  const cfg = resolveStrategyThresholds(thresholdsInput).overallClassification;
  const score = commercial.commercialOpportunityScore;
  const conf = commercial.dataConfidence.score;

  if (commercial.eligibilityStatus === 'NOT_MONETIZABLE') {
    return 'NOT_MONETIZABLE';
  }
  if (commercial.eligibilityStatus === 'INSUFFICIENT_DATA' || score === null) {
    return 'INSUFFICIENT_EVIDENCE';
  }
  // Low confidence products are barred from TOP_OPPORTUNITY / STRONG_OPPORTUNITY
  if (conf < cfg.watchlistMinConfidence) {
    return 'INSUFFICIENT_EVIDENCE';
  }
  if (
    commercial.eligibilityStatus === 'ELIGIBLE' &&
    commercial.isTopTierEligible &&
    score >= cfg.topMinScore &&
    conf >= cfg.topMinConfidence &&
    qualifiedStrategyIds.length >= 1
  ) {
    return 'TOP_OPPORTUNITY';
  }
  if (
    commercial.eligibilityStatus === 'ELIGIBLE' &&
    score >= cfg.strongMinScore &&
    conf >= cfg.strongMinConfidence
  ) {
    return 'STRONG_OPPORTUNITY';
  }
  if (
    (commercial.eligibilityStatus === 'ELIGIBLE' ||
      commercial.eligibilityStatus === 'PARTIAL_EVIDENCE') &&
    score >= cfg.moderateMinScore &&
    conf >= cfg.moderateMinConfidence
  ) {
    return 'MODERATE_OPPORTUNITY';
  }
  return 'WATCHLIST';
}

function generateOpportunityInsights(
  metrics: ProductValidatedMetrics,
  commercial: CommercialScoreV2Result,
  strategies: Record<StrategyId, StrategyEvaluationResult>
): { opportunityInsights: string[]; cautionInsights: string[] } {
  const opportunityInsights: string[] = [];
  const cautionInsights: string[] = [];

  if (
    (commercial.demandScore.score ?? 0) >= 65 &&
    (commercial.competitionScore.score ?? 0) >= 60 &&
    commercial.competitionScore.riskFlag !== 'ZERO_CREATORS_POSITIVE_REVENUE'
  ) {
    opportunityInsights.push('High demand with relatively low creator competition.');
  }
  if (
    commercial.adjustedRpcThb !== null &&
    commercial.adjustedRpcThb >= 15_000 &&
    (commercial.competitionScore.creatorCount ?? 0) > 0
  ) {
    opportunityInsights.push(
      `Strong revenue per creator (฿${commercial.adjustedRpcThb.toLocaleString('en-US')} adjusted RPC).`
    );
  }
  if (
    (commercial.earningScore.payoutPerSaleThb ?? 0) >= 20 &&
    (commercial.demandScore.score ?? 0) >= 45
  ) {
    opportunityInsights.push(
      `Attractive payout (฿${commercial.earningScore.payoutPerSaleThb}/sale) with proven demand.`
    );
  }
  if (
    commercial.demandScore.growthStatus === 'VERIFIED' &&
    (commercial.demandScore.subcomponents.verifiedGrowthPercent ?? 0) >= 15
  ) {
    opportunityInsights.push(
      `Verified positive demand growth (+${commercial.demandScore.subcomponents.verifiedGrowthPercent}%).`
    );
  }
  if (
    (commercial.customerQualityScore.score ?? 0) >= 70 &&
    (commercial.customerQualityScore.reviewCount ?? 0) >= 30
  ) {
    opportunityInsights.push(
      `Strong customer rating (${commercial.customerQualityScore.rawRating}/5) supported by sufficient reviews (${commercial.customerQualityScore.reviewCount}).`
    );
  }
  if (
    commercial.conversionEvidence.evidenceLevel === 'STRONG' ||
    commercial.conversionEvidence.evidenceLevel === 'MODERATE'
  ) {
    opportunityInsights.push(
      `Video sales evidence exists (${commercial.conversionEvidence.dominantChannel.toLowerCase()} channel attribution; does not guarantee future creator conversion).`
    );
  }

  // Factual cautions aligned strictly with ValidatedMetric states
  if (commercial.earningScore.status === 'NOT_MONETIZABLE') {
    cautionInsights.push('Verified 0% commission excludes this product from monetizable strategies.');
  } else if (metrics.commissionRate.state === 'MISSING') {
    cautionInsights.push('Affiliate commission rate is missing.');
  } else if (metrics.commissionRate.unit === 'UNVERIFIED' || metrics.commissionRate.state === 'UNAVAILABLE') {
    cautionInsights.push('Affiliate commission unit is unverified.');
  }

  if (commercial.demandScore.growthStatus === 'MISSING') {
    cautionInsights.push('Growth evidence is unavailable.');
  } else if (commercial.demandScore.growthStatus === 'UNVERIFIED') {
    cautionInsights.push('Growth unit or comparison period is unverified.');
  }

  if (metrics.creatorCount.state === 'MISSING') {
    cautionInsights.push('Creator competition data is missing.');
  } else if (metrics.creatorCount.unit === 'UNVERIFIED' || metrics.creatorCount.state === 'UNAVAILABLE') {
    cautionInsights.push('Creator competition data is unverified.');
  } else if (commercial.competitionScore.riskFlag === 'ZERO_CREATORS_POSITIVE_REVENUE') {
    cautionInsights.push('0 creators reported despite positive revenue; affiliate traction unconfirmed.');
  } else if (commercial.competitionScore.riskFlag === 'EXTREME_COMPETITION') {
    cautionInsights.push('High creator competition reduces per-creator upside.');
  }

  if (commercial.demandScore.score !== null && commercial.demandScore.score < 30) {
    cautionInsights.push('Weak market demand limits commercial opportunity.');
  }
  if (commercial.customerQualityScore.riskFlag === 'LOW_REVIEW_SAMPLE') {
    cautionInsights.push(
      `Small review sample (${commercial.customerQualityScore.reviewCount} reviews) is not statistically reliable.`
    );
  } else if (commercial.customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
    cautionInsights.push('Verified poor customer rating across meaningful reviews.');
  }
  if (commercial.dataConfidence.level === 'LOW' || commercial.dataConfidence.level === 'VERY_LOW') {
    cautionInsights.push(
      `Low data confidence (${commercial.dataConfidence.score}/100) prevents top-opportunity promotion.`
    );
  }
  if (
    strategies.fast_rising_products.eligibilityStatus === 'DATA_UNAVAILABLE' ||
    strategies.trend_timing_opportunity.eligibilityStatus === 'DATA_UNAVAILABLE'
  ) {
    cautionInsights.push(
      'Historical snapshots are unavailable for Fast Rising and Trend Timing strategies.'
    );
  }

  return { opportunityInsights, cautionInsights };
}

/**
 * Evaluates all 8 strategies for a single product on top of Phase 1 & Phase 2 outputs.
 * Pure & deterministic.
 */
export function evaluateProductStrategiesV2(
  input: ProductValidatedMetrics | ProductItem,
  commercialInput?: CommercialScoreV2Result,
  options?: EvaluateProductStrategiesOptions
): ProductStrategyReportV2 {
  const scoringConfig = resolveScoringV2Config(options?.scoringConfig);
  const thresholds = resolveStrategyThresholds(options?.thresholds);

  const metrics = resolveMetricsInput(input, scoringConfig);

  const commercial =
    commercialInput ?? evaluateProductCommercialV2(metrics, scoringConfig);

  const strategies: Record<StrategyId, StrategyEvaluationResult> = {
    early_market_opportunity: evaluateStrategy1EarlyMarket(metrics, commercial, thresholds),
    underserved_demand: evaluateStrategy2UnderservedDemand(metrics, commercial, thresholds),
    creator_yield_opportunity: evaluateStrategy3CreatorYield(metrics, commercial, thresholds),
    fast_rising_products: evaluateStrategy4FastRising(
      metrics,
      commercial,
      thresholds,
      options?.historicalSnapshots,
      scoringConfig.nowMs
    ),
    profit_maximizer: evaluateStrategy5ProfitMaximizer(metrics, commercial, thresholds),
    video_proven_winners: evaluateStrategy6VideoProven(metrics, commercial, thresholds),
    trust_based_winners: evaluateStrategy7TrustBased(metrics, commercial, thresholds),
    trend_timing_opportunity: evaluateStrategy8TrendTiming(
      metrics,
      commercial,
      thresholds,
      options?.historicalSnapshots,
      scoringConfig.nowMs
    ),
  };

  const qualifiedStrategies = ALL_STRATEGY_IDS.filter(
    (id) => strategies[id].eligibilityStatus === 'QUALIFIED' && strategies[id].strategyScore !== null
  ).sort((a, b) => {
    const scoreDiff = (strategies[b].strategyScore ?? -1) - (strategies[a].strategyScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    if (a === 'early_market_opportunity') return -1;
    if (b === 'early_market_opportunity') return 1;
    return a.localeCompare(b);
  });

  const bestStrategyId = qualifiedStrategies[0] ?? null;
  const opportunityClassification = classifyProductOpportunityV2(
    commercial,
    qualifiedStrategies,
    options?.thresholds
  );
  const { opportunityInsights, cautionInsights } = generateOpportunityInsights(
    metrics,
    commercial,
    strategies
  );

  return {
    engineVersion: 'v2-strategy',
    opportunityClassification,
    bestStrategyId,
    qualifiedStrategyIds: qualifiedStrategies,
    strategies,
    opportunityInsights,
    cautionInsights,
  };
}

const CLASSIFICATION_SORT_PRIORITY: Record<OpportunityClassification, number> = {
  TOP_OPPORTUNITY: 5,
  STRONG_OPPORTUNITY: 4,
  MODERATE_OPPORTUNITY: 3,
  WATCHLIST: 2,
  INSUFFICIENT_EVIDENCE: 1,
  NOT_MONETIZABLE: 0,
};

function resolveCandidateId<TItem>(
  entry: ProductItem | ProductValidatedMetrics | StrategyCandidateInput<TItem>,
  fallbackIndex: number
): string {
  if ('productId' in entry && typeof entry.productId === 'string' && entry.productId.trim()) {
    return entry.productId.trim();
  }
  if ('id' in entry && typeof entry.id === 'string' && entry.id.trim()) {
    return entry.id.trim();
  }
  if (
    'item' in entry &&
    entry.item &&
    typeof entry.item === 'object' &&
    'id' in entry.item &&
    typeof (entry.item as { id?: unknown }).id === 'string'
  ) {
    const itemId = ((entry.item as { id: string }).id || '').trim();
    if (itemId) return itemId;
  }
  return `product_${fallbackIndex}`;
}

interface EvaluatedStrategyPoolEntry<TItem> {
  productId: string;
  item: TItem;
  fetchedAtMs: number;
  commercialScore: CommercialScoreV2Result;
  strategyReport: ProductStrategyReportV2;
}

function isBetterDuplicateStrategyCandidate<TItem>(
  candidate: EvaluatedStrategyPoolEntry<TItem>,
  existing: EvaluatedStrategyPoolEntry<TItem>
): boolean {
  const tsDiff = candidate.fetchedAtMs - existing.fetchedAtMs;
  if (tsDiff !== 0) return tsDiff > 0;

  const confDiff =
    candidate.commercialScore.dataConfidence.score -
    existing.commercialScore.dataConfidence.score;
  if (confDiff !== 0) return confDiff > 0;

  const classDiff =
    CLASSIFICATION_SORT_PRIORITY[candidate.strategyReport.opportunityClassification] -
    CLASSIFICATION_SORT_PRIORITY[existing.strategyReport.opportunityClassification];
  if (classDiff !== 0) return classDiff > 0;

  const scoreDiff =
    (candidate.commercialScore.commercialOpportunityScore ?? -1) -
    (existing.commercialScore.commercialOpportunityScore ?? -1);
  if (scoreDiff !== 0) return scoreDiff > 0;

  const missingDiff =
    existing.commercialScore.missingMetrics.length -
    candidate.commercialScore.missingMetrics.length;
  if (missingDiff !== 0) return missingDiff > 0;

  return (
    candidate.commercialScore.scoreExplanation.summary.localeCompare(
      existing.commercialScore.scoreExplanation.summary
    ) > 0
  );
}

/**
 * Deterministic overall + 8-strategy ranking engine.
 * - Independent of input array order (stable canonical tie-breaking by productId).
 * - Deduplicates identical productIds deterministically without allowing duplicates in rankings.
 * - Never mixes insufficient/unverified/not-eligible products into qualified strategy rankings.
 * - Avoids unstable small-pool percentiles.
 */
export function rankProductIntelligenceV2<
  TItem = ProductItem
>(
  inputs: Array<ProductItem | ProductValidatedMetrics | StrategyCandidateInput<TItem>>,
  options?: EvaluateProductStrategiesOptions
): MarketplaceIntelligenceRankingResult<TItem> {
  const scoringConfig = resolveScoringV2Config(options?.scoringConfig);

  const rawEvaluated: Array<EvaluatedStrategyPoolEntry<TItem>> = inputs.map((rawInput, index) => {
    const productId = resolveCandidateId(rawInput, index);

    let item: TItem;
    let rawMetrics: ProductValidatedMetrics;
    let precomputedCommercial: CommercialScoreV2Result | undefined;
    let snapshots = options?.historicalSnapshots;

    if ('item' in rawInput) {
      item = rawInput.item;
      if (rawInput.validatedMetrics) {
        rawMetrics = rawInput.validatedMetrics;
      } else if (item && typeof item === 'object' && 'thaiTitle' in item) {
        const prod = item as unknown as ProductItem;
        rawMetrics =
          prod.validatedMetrics ??
          adaptProductItemToValidatedMetrics(prod, {
            staleAfterMs: scoringConfig.staleAfterMs,
            nowMs: scoringConfig.nowMs,
          });
        precomputedCommercial =
          options?.scoringConfig === undefined
            ? (rawInput.commercialScore ?? prod.commercialScoreV2)
            : rawInput.commercialScore;
      } else {
        throw new Error(`StrategyCandidateInput "${productId}" requires validatedMetrics or a ProductItem.`);
      }
      precomputedCommercial = rawInput.commercialScore ?? precomputedCommercial;
      snapshots = rawInput.historicalSnapshots ?? snapshots;
    } else if ('thaiTitle' in rawInput) {
      item = rawInput as unknown as TItem;
      rawMetrics =
        rawInput.validatedMetrics ??
        adaptProductItemToValidatedMetrics(rawInput, {
          staleAfterMs: scoringConfig.staleAfterMs,
          nowMs: scoringConfig.nowMs,
        });
      precomputedCommercial =
        options?.scoringConfig === undefined
          ? rawInput.commercialScoreV2
          : undefined;
    } else {
      item = rawInput as unknown as TItem;
      rawMetrics = rawInput;
    }

    const metrics = resolveMetricsInput(rawMetrics, scoringConfig);
    const parsedTs = metrics.fetchedAt ? Date.parse(metrics.fetchedAt) : Number.NaN;
    const fetchedAtMs = Number.isFinite(parsedTs) ? parsedTs : -1;

    const commercialScore =
      precomputedCommercial ?? evaluateProductCommercialV2(metrics, scoringConfig);
    const strategyReport = evaluateProductStrategiesV2(metrics, commercialScore, {
      scoringConfig: options?.scoringConfig,
      thresholds: options?.thresholds,
      historicalSnapshots: snapshots,
    });

    return {
      productId,
      item,
      fetchedAtMs,
      commercialScore,
      strategyReport,
    };
  });

  const dedupMap = new Map<string, EvaluatedStrategyPoolEntry<TItem>>();
  const duplicateIdsSet = new Set<string>();
  for (const entry of rawEvaluated) {
    const existing = dedupMap.get(entry.productId);
    if (!existing) {
      dedupMap.set(entry.productId, entry);
    } else {
      duplicateIdsSet.add(entry.productId);
      if (isBetterDuplicateStrategyCandidate(entry, existing)) {
        dedupMap.set(entry.productId, entry);
      }
    }
  }

  const evaluated = Array.from(dedupMap.values());
  const duplicateProductIdsRemoved = Array.from(duplicateIdsSet).sort((a, b) =>
    a.localeCompare(b)
  );
  const poolSize = evaluated.length;
  const smallPoolWarning = poolSize < scoringConfig.aggregation.smallPoolWarningThreshold;

  const computePartialDimAverage = (score: CommercialScoreV2Result): number => {
    const vals: number[] = [];
    if (score.demandScore.score !== null) vals.push(score.demandScore.score);
    if (score.earningScore.score !== null) vals.push(score.earningScore.score);
    if (score.competitionScore.score !== null) vals.push(score.competitionScore.score);
    if (score.customerQualityScore.score !== null) vals.push(score.customerQualityScore.score);
    if (vals.length === 0) return -1;
    return vals.reduce((acc, v) => acc + v, 0) / vals.length;
  };

  // 1. Overall Commercial Ranking (input-order independent)
  const overallSorted = [...evaluated].sort((a, b) => {
    const classDiff =
      CLASSIFICATION_SORT_PRIORITY[b.strategyReport.opportunityClassification] -
      CLASSIFICATION_SORT_PRIORITY[a.strategyReport.opportunityClassification];
    if (classDiff !== 0) return classDiff;

    const scoreDiff =
      (b.commercialScore.commercialOpportunityScore ?? -1) -
      (a.commercialScore.commercialOpportunityScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;

    const confDiff = b.commercialScore.dataConfidence.score - a.commercialScore.dataConfidence.score;
    if (confDiff !== 0) return confDiff;

    const partialDimDiff =
      computePartialDimAverage(b.commercialScore) - computePartialDimAverage(a.commercialScore);
    if (Math.abs(partialDimDiff) > 1e-9) return partialDimDiff;

    const earningDiff =
      (b.commercialScore.earningScore.score ?? -1) - (a.commercialScore.earningScore.score ?? -1);
    if (earningDiff !== 0) return earningDiff;

    const demandDiff =
      (b.commercialScore.demandScore.score ?? -1) - (a.commercialScore.demandScore.score ?? -1);
    if (demandDiff !== 0) return demandDiff;

    return a.productId.localeCompare(b.productId);
  });

  const overallRanking: Array<OverallRankedProductEntry<TItem>> = overallSorted.map(
    (entry, idx) => ({
      rank: idx + 1,
      productId: entry.productId,
      item: entry.item,
      commercialOpportunityScore: entry.commercialScore.commercialOpportunityScore,
      eligibilityStatus: entry.commercialScore.eligibilityStatus,
      opportunityClassification: entry.strategyReport.opportunityClassification,
      dataConfidence: entry.commercialScore.dataConfidence,
      bestStrategyId: entry.strategyReport.bestStrategyId,
      qualifiedStrategyIds: entry.strategyReport.qualifiedStrategyIds,
      opportunityInsights: entry.strategyReport.opportunityInsights,
      cautionInsights: entry.strategyReport.cautionInsights,
      missingMetrics: entry.commercialScore.missingMetrics,
      riskTags: entry.commercialScore.riskTags,
      opportunityTags: entry.commercialScore.opportunityTags,
      commercialScore: entry.commercialScore,
      strategyReport: entry.strategyReport,
    })
  );

  // 2. Independent Strategy Rankings (only QUALIFIED in qualifiedRankings; input-order independent)
  const strategyRankings = {} as Record<StrategyId, StrategyRankingBucket<TItem>>;

  for (const strategyId of ALL_STRATEGY_IDS) {
    const profile = STRATEGY_PROFILES_V2[strategyId];
    const statusCounts: Record<StrategyEligibilityStatus, number> = {
      QUALIFIED: 0,
      PARTIAL_EVIDENCE: 0,
      INSUFFICIENT_DATA: 0,
      NOT_ELIGIBLE: 0,
      DATA_UNAVAILABLE: 0,
    };

    const qualifiedRaw: Array<
      Omit<StrategyRankedEntry<TItem>, 'rank'>
    > = [];
    const excludedRaw: Array<StrategyExcludedEntry<TItem>> = [];

    for (const entry of evaluated) {
      const evalResult = entry.strategyReport.strategies[strategyId];
      statusCounts[evalResult.eligibilityStatus] += 1;

      if (evalResult.eligibilityStatus === 'QUALIFIED' && evalResult.strategyScore !== null) {
        qualifiedRaw.push({
          productId: entry.productId,
          item: entry.item,
          strategyId,
          strategyScore: evalResult.strategyScore,
          commercialOpportunityScore: evalResult.commercialOpportunityScore,
          dataConfidence: evalResult.dataConfidence,
          eligibilityStatus: evalResult.eligibilityStatus,
          reasonsForRanking: evalResult.rankingReasons,
          missingEvidence: evalResult.missingEvidence,
          opportunityTags: evalResult.opportunityTags,
          riskTags: evalResult.riskTags,
          evaluation: evalResult,
        });
      } else {
        excludedRaw.push({
          productId: entry.productId,
          item: entry.item,
          strategyId,
          eligibilityStatus: evalResult.eligibilityStatus as Exclude<
            StrategyEligibilityStatus,
            'QUALIFIED'
          >,
          strategyScore: null,
          commercialOpportunityScore: evalResult.commercialOpportunityScore,
          dataConfidence: evalResult.dataConfidence,
          missingEvidence: evalResult.missingEvidence,
          failedRequirements: evalResult.failedRequirements,
          riskTags: evalResult.riskTags,
          explanation: evalResult.explanation,
        });
      }
    }

    qualifiedRaw.sort((a, b) => {
      const stratDiff = b.strategyScore - a.strategyScore;
      if (stratDiff !== 0) return stratDiff;

      const commDiff =
        (b.commercialOpportunityScore ?? -1) - (a.commercialOpportunityScore ?? -1);
      if (commDiff !== 0) return commDiff;

      const confDiff = b.dataConfidence.score - a.dataConfidence.score;
      if (confDiff !== 0) return confDiff;

      return a.productId.localeCompare(b.productId);
    });

    excludedRaw.sort((a, b) => a.productId.localeCompare(b.productId));

    const qualifiedRankings: Array<StrategyRankedEntry<TItem>> = qualifiedRaw.map(
      (entry, idx) => ({
        ...entry,
        rank: idx + 1,
      })
    );

    const unavailableReason =
      profile.requiresHistoricalSnapshots &&
      statusCounts.DATA_UNAVAILABLE === evaluated.length &&
      evaluated.length > 0
        ? excludedRaw[0]?.explanation ?? 'Required historical snapshots are unavailable.'
        : profile.requiresHistoricalSnapshots && evaluated.length === 0
          ? 'Historical snapshots are required for this strategy.'
          : null;

    strategyRankings[strategyId] = {
      profile,
      qualifiedRankings,
      excludedCandidates: excludedRaw,
      qualifiedCount: qualifiedRankings.length,
      statusCounts,
      unavailableReason,
    };
  }

  return {
    poolSize,
    smallPoolWarning,
    poolNotice:
      poolSize === 0
        ? 'Empty product pool: 0 candidates evaluated.'
        : smallPoolWarning
          ? `Small product pool (n=${poolSize} < ${scoringConfig.aggregation.smallPoolWarningThreshold}): deterministic absolute strategy criteria applied without unstable percentiles.`
          : `Evaluated ${poolSize} products across overall commercial ranking and 8 affiliate strategies.`,
    duplicateProductIdsRemoved,
    overallRanking,
    strategyRankings,
  };
}
