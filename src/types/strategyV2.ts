import type { ValidatedMetric } from './metrics';
import type {
  CommercialEligibilityStatus,
  CommercialScoreV2Result,
  DataConfidenceResult,
} from './scoringV2';

export type StrategyId =
  | 'early_market_opportunity'
  | 'underserved_demand'
  | 'creator_yield_opportunity'
  | 'fast_rising_products'
  | 'profit_maximizer'
  | 'video_proven_winners'
  | 'trust_based_winners'
  | 'trend_timing_opportunity';

export type StrategyEligibilityStatus =
  | 'QUALIFIED'
  | 'PARTIAL_EVIDENCE'
  | 'INSUFFICIENT_DATA'
  | 'NOT_ELIGIBLE'
  | 'DATA_UNAVAILABLE';

export type OpportunityClassification =
  | 'TOP_OPPORTUNITY'
  | 'STRONG_OPPORTUNITY'
  | 'MODERATE_OPPORTUNITY'
  | 'WATCHLIST'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NOT_MONETIZABLE';

export interface HistoricalMetricSnapshot {
  fetchedAt: string;
  dateRange?: string | null;
  revenueThb7d?: ValidatedMetric<number>;
  salesVolume7d?: ValidatedMetric<number>;
  creatorCount?: ValidatedMetric<number>;
  revenueGrowthRate?: ValidatedMetric<number>;
}

export interface StrategyRequirementCheck {
  key: string;
  label: string;
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'MISSING' | 'UNVERIFIED' | 'DATA_UNAVAILABLE';
  detail: string;
}

export interface StrategyProfileDefinition {
  id: StrategyId;
  name: string;
  isPrimary?: boolean;
  requiresHistoricalSnapshots: boolean;
  description: string;
  requiredMetrics: string[];
  optionalSupportingMetrics: string[];
  minimumEvidenceSummary: string;
  exclusionSummary: string;
  rankingFormulaSummary: string;
  minConfidenceScore: number;
}

export interface StrategyEvaluationResult {
  strategyId: StrategyId;
  strategyName: string;
  eligibilityStatus: StrategyEligibilityStatus;
  strategyScore: number | null;
  commercialOpportunityScore: number | null;
  dataConfidence: DataConfidenceResult;
  minConfidenceRequired: number;
  requiredMetrics: string[];
  optionalSupportingMetrics: string[];
  passedRequirements: StrategyRequirementCheck[];
  failedRequirements: StrategyRequirementCheck[];
  missingEvidence: string[];
  opportunityTags: string[];
  riskTags: string[];
  rankingReasons: string[];
  explanation: string;
}

export interface ProductStrategyReportV2 {
  engineVersion: 'v2-strategy';
  opportunityClassification: OpportunityClassification;
  bestStrategyId: StrategyId | null;
  qualifiedStrategyIds: StrategyId[];
  strategies: Record<StrategyId, StrategyEvaluationResult>;
  opportunityInsights: string[];
  cautionInsights: string[];
}

export interface OverallRankedProductEntry<TItem = unknown> {
  rank: number;
  productId: string;
  item: TItem;
  commercialOpportunityScore: number | null;
  eligibilityStatus: CommercialEligibilityStatus;
  opportunityClassification: OpportunityClassification;
  dataConfidence: DataConfidenceResult;
  bestStrategyId: StrategyId | null;
  qualifiedStrategyIds: StrategyId[];
  opportunityInsights: string[];
  cautionInsights: string[];
  missingMetrics: string[];
  riskTags: string[];
  opportunityTags: string[];
  commercialScore: CommercialScoreV2Result;
  strategyReport: ProductStrategyReportV2;
}

export interface StrategyRankedEntry<TItem = unknown> {
  rank: number;
  productId: string;
  item: TItem;
  strategyId: StrategyId;
  strategyScore: number;
  commercialOpportunityScore: number | null;
  dataConfidence: DataConfidenceResult;
  eligibilityStatus: StrategyEligibilityStatus;
  reasonsForRanking: string[];
  missingEvidence: string[];
  opportunityTags: string[];
  riskTags: string[];
  evaluation: StrategyEvaluationResult;
}

export interface StrategyExcludedEntry<TItem = unknown> {
  productId: string;
  item: TItem;
  strategyId: StrategyId;
  eligibilityStatus: Exclude<StrategyEligibilityStatus, 'QUALIFIED'>;
  strategyScore: number | null;
  commercialOpportunityScore: number | null;
  dataConfidence: DataConfidenceResult;
  missingEvidence: string[];
  failedRequirements: StrategyRequirementCheck[];
  riskTags: string[];
  explanation: string;
}

export interface StrategyRankingBucket<TItem = unknown> {
  profile: StrategyProfileDefinition;
  qualifiedRankings: Array<StrategyRankedEntry<TItem>>;
  excludedCandidates: Array<StrategyExcludedEntry<TItem>>;
  qualifiedCount: number;
  statusCounts: Record<StrategyEligibilityStatus, number>;
  unavailableReason: string | null;
}

export interface MarketplaceIntelligenceRankingResult<TItem = unknown> {
  poolSize: number;
  smallPoolWarning: boolean;
  poolNotice: string;
  duplicateProductIdsRemoved?: string[];
  overallRanking: Array<OverallRankedProductEntry<TItem>>;
  strategyRankings: Record<StrategyId, StrategyRankingBucket<TItem>>;
}

export interface StrategyThresholdsConfig {
  overallClassification: {
    topMinScore: number;
    topMinConfidence: number;
    strongMinScore: number;
    strongMinConfidence: number;
    moderateMinScore: number;
    moderateMinConfidence: number;
    watchlistMinConfidence: number;
  };
  earlyMarket: {
    minAbsoluteDemand: number;
    minGrowthPercent: number;
    minCompetitionScore: number;
    maxCreatorCount: number;
    minEarningScore: number;
    minConfidence: number;
  };
  underservedDemand: {
    minAbsoluteDemand: number;
    minCompetitionScore: number;
    minEarningScore: number;
    minConfidence: number;
  };
  creatorYield: {
    minDemandScore: number;
    minRevenueThb: number;
    minAdjustedRpcThb: number;
    minCompetitionScore: number;
    minEarningScore: number;
    minConfidence: number;
  };
  fastRising: {
    minSnapshots: number;
    minHoursBetweenSnapshots: number;
    minDemandScore: number;
    minDemandGrowthPct: number;
    minSpreadOverCreatorGrowthPct: number;
    minConfidence: number;
  };
  profitMaximizer: {
    minDemandScore: number;
    minPayoutPerSaleThb: number;
    minEarningScore: number;
    minCompetitionScore: number;
    minConfidence: number;
  };
  videoProven: {
    minDemandScore: number;
    minVideoRevenueThb: number;
    minVideoShare: number;
    minCompetitionScore: number;
    minEarningScore: number;
    minConfidence: number;
  };
  trustBased: {
    minDemandScore: number;
    minEarningScore: number;
    minCompetitionScore: number;
    minReviewCount: number;
    minBayesianRating: number;
    minQualityScore: number;
    minConfidence: number;
  };
  trendTiming: {
    minSnapshots: number;
    minHoursSpan: number;
    minDemandScore: number;
    minDemandGrowthPct: number;
    minSpreadOverCreatorGrowthPct: number;
    minCompetitionScore: number;
    minConfidence: number;
  };
}
