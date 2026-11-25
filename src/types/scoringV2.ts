import type { ValidatedMetric } from './metrics';

export type V2DimensionStatus =
  | 'SCORED'
  | 'ZERO'
  | 'NOT_MONETIZABLE'
  | 'INSUFFICIENT'
  | 'INVALID';

export type V2GrowthStatus =
  | 'VERIFIED'
  | 'MISSING'
  | 'UNVERIFIED'
  | 'STALE'
  | 'INVALID';

export type CommercialEligibilityStatus =
  | 'ELIGIBLE'
  | 'PARTIAL_EVIDENCE'
  | 'RESTRICTED_WEAK_DEMAND'
  | 'RESTRICTED_POOR_QUALITY'
  | 'NOT_MONETIZABLE'
  | 'INSUFFICIENT_DATA';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export type ConversionEvidenceLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';

export type DominantConversionChannel = 'VIDEO' | 'LIVE' | 'BALANCED' | 'UNKNOWN';

export interface DemandDimensionResult {
  score: number | null;
  status: V2DimensionStatus;
  growthStatus: V2GrowthStatus;
  subcomponents: {
    revenueScore: number | null;
    salesVolumeScore: number | null;
    absoluteDemandScore: number | null;
    growthScore: number | null;
    verifiedGrowthPercent: number | null;
  };
  usedMetrics: string[];
  excludedMetrics: string[];
  notes: string[];
}

export interface EarningDimensionResult {
  score: number | null;
  status: V2DimensionStatus;
  payoutPerSaleThb: number | null;
  payoutProvenance: 'SOURCE' | 'SYNTHETIC' | null;
  verifiedCommissionPercent: number | null;
  subcomponents: {
    rateScore: number | null;
    payoutScore: number | null;
    demandRealizationFactor: number | null;
  };
  usedMetrics: string[];
  excludedMetrics: string[];
  notes: string[];
}

export interface CompetitionDimensionResult {
  score: number | null;
  status: V2DimensionStatus;
  creatorCount: number | null;
  rawRpcThb: number | null;
  adjustedRpcThb: number | null;
  smoothingPriorCreators: number;
  riskFlag: 'ZERO_CREATORS_POSITIVE_REVENUE' | 'EXTREME_COMPETITION' | null;
  subcomponents: {
    creatorDensityScore: number | null;
    adjustedRpcScore: number | null;
    demandViabilityFactor: number | null;
  };
  usedMetrics: string[];
  excludedMetrics: string[];
  notes: string[];
}

export interface CustomerQualityDimensionResult {
  score: number | null;
  status: V2DimensionStatus;
  rawRating: number | null;
  reviewCount: number | null;
  bayesianRating: number | null;
  priorMean: number;
  priorWeight: number;
  riskFlag: 'LOW_REVIEW_SAMPLE' | 'POOR_CUSTOMER_QUALITY' | null;
  usedMetrics: string[];
  excludedMetrics: string[];
  notes: string[];
}

export interface DataConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  breakdown: {
    completeness: number;
    provenance: number;
    freshness: number;
    validity: number;
    dimensionCoverage: number;
  };
  positiveDrivers: string[];
  negativeDrivers: string[];
  explanation: string;
}

export interface ConversionEvidenceResult {
  videoRevenueThb: ValidatedMetric<number>;
  liveRevenueThb: ValidatedMetric<number>;
  totalRevenueThb: ValidatedMetric<number>;
  videoRevenueShare: number | null;
  liveRevenueShare: number | null;
  dominantChannel: DominantConversionChannel;
  evidenceLevel: ConversionEvidenceLevel;
  consistencyNote: string;
  disclaimer: string;
}

export interface CommercialScoreExplanation {
  summary: string;
  aggregationMethod: string;
  gateDecisions: string[];
  dimensionDetails: {
    demand: string;
    earning: string;
    competition: string;
    customerQuality: string;
  };
  confidenceSummary: string;
  conversionNote: string;
}

export interface CommercialScoreV2Result {
  engineVersion: 'v2';
  demandScore: DemandDimensionResult;
  earningScore: EarningDimensionResult;
  competitionScore: CompetitionDimensionResult;
  customerQualityScore: CustomerQualityDimensionResult;
  commercialOpportunityScore: number | null;
  rawRpcThb: number | null;
  adjustedRpcThb: number | null;
  dataConfidence: DataConfidenceResult;
  conversionEvidence: ConversionEvidenceResult;
  eligibilityStatus: CommercialEligibilityStatus;
  isTopTierEligible: boolean;
  riskTags: string[];
  opportunityTags: string[];
  missingMetrics: string[];
  scoreExplanation: CommercialScoreExplanation;
}

export interface CommercialScoringV2Config {
  staleAfterMs: number;
  nowMs?: number;
  allowSyntheticRevenue?: boolean;
  demand: {
    revenuePivotThb: number;
    revenueMaxRefThb: number;
    salesPivotUnits: number;
    salesMaxRefUnits: number;
    revenueWeightInAbsolute: number;
    salesWeightInAbsolute: number;
    absoluteWeightWithGrowth: number;
    growthWeightWithGrowth: number;
    growthScalePercent: number;
    missingGrowthCap: number;
    singleRevenueCap: number;
    singleSalesCap: number;
    weakDemandThreshold: number;
  };
  earning: {
    rateHalfSaturationPct: number;
    rateSteepness: number;
    payoutPivotThb: number;
    payoutMaxRefThb: number;
    rateWeight: number;
    payoutWeight: number;
    missingDemandCap: number;
  };
  competition: {
    smoothingPriorCreators: number;
    densityMidpointCreators: number;
    densitySteepness: number;
    rpcPivotThb: number;
    rpcMaxRefThb: number;
    densityWeight: number;
    rpcWeight: number;
    demandViabilityHalfThb: number;
    zeroCreatorScoreCap: number;
    extremeCompetitionThreshold: number;
  };
  customerQuality: {
    priorMean: number;
    priorWeight: number;
    minScoreRatingFloor: number;
    lowSampleThreshold: number;
    lowSampleScoreCap: number;
    poorQualityMinReviews: number;
    poorQualityBayesianThreshold: number;
  };
  aggregation: {
    weights: {
      demand: number;
      earning: number;
      competition: number;
      customerQuality: number;
    };
    geometricFloor: number;
    weakDemandCap: number;
    poorQualityMultiplier: number;
    poorQualityCap: number;
    highCompetitionCap: number;
    missingCompetitionCap: number;
    missingQualityMultiplier: number;
    missingQualityCap: number;
    zeroCreatorOverallCap: number;
    lowReviewSampleOverallCap: number;
    topTierMinScore: number;
    smallPoolWarningThreshold: number;
  };
}

export interface CommercialPoolProductResult<TItem = unknown> {
  item: TItem;
  productId: string;
  score: CommercialScoreV2Result;
}

export interface CommercialPoolEvaluationResult<TItem = unknown> {
  poolSize: number;
  smallPoolWarning: boolean;
  poolNotice: string;
  results: Array<CommercialPoolProductResult<TItem>>;
}
