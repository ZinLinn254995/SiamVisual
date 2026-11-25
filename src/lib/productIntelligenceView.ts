import type {
  CommercialEligibilityStatus,
  CommercialScoreV2Result,
  DataConfidenceResult,
  HistoricalMetricSnapshot,
  MarketplaceIntelligenceRankingResult,
  OpportunityClassification,
  ProductItem,
  ProductStrategyReportV2,
  ProductValidatedMetrics,
  StrategyEligibilityStatus,
  StrategyEvaluationResult,
  StrategyId,
  StrategyProfileDefinition,
  StrategyRankingBucket,
  StrategyRequirementCheck,
  ValidatedMetric,
} from '../types.ts';
import {
  adaptProductItemToValidatedMetrics,
  refreshProductValidatedMetricsFreshness,
} from './metricFoundation.ts';
import { evaluateProductCommercialV2 } from './scoringEngineV2.ts';
import {
  evaluateProductStrategiesV2,
  rankProductIntelligenceV2,
} from './strategyEngineV2.ts';

export type ActiveStrategyView = 'overall' | StrategyId;

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

export type MetricProvenanceCategory =
  | 'verified_source'
  | 'derived'
  | 'unverified'
  | 'missing'
  | 'zero'
  | 'stale'
  | 'invalid'
  | 'unavailable';

export type MetricFieldKey =
  | 'priceThb'
  | 'commissionRate'
  | 'commissionThb'
  | 'revenueThb7d'
  | 'salesVolume7d'
  | 'videoRevenueThb7d'
  | 'liveRevenueThb7d'
  | 'revenueGrowthRate'
  | 'creatorCount'
  | 'rating'
  | 'reviewCount';

export interface ProductMetricProvenanceItem {
  key: MetricFieldKey;
  metric: ValidatedMetric<number>;
  category: MetricProvenanceCategory;
  isUnverifiedPhase0: boolean;
}

export interface ProductProvenanceSummary {
  verifiedSourceCount: number;
  derivedCount: number;
  unverifiedCount: number;
  missingOrUnavailableCount: number;
  staleCount: number;
  invalidCount: number;
  zeroCount: number;
  hasSyntheticRevenue: boolean;
  hasUnverifiedCoreMetrics: boolean;
}

export interface RankedIntelligenceCardItem {
  kind: 'ranked';
  product: ProductItem;
  rank: number;
  primaryScore: number | null;
  commercialOpportunityScore: number | null;
  strategyScore: number | null;
  opportunityClassification: OpportunityClassification;
  commercialEligibilityStatus: CommercialEligibilityStatus;
  strategyEligibilityStatus: StrategyEligibilityStatus | null;
  dataConfidence: DataConfidenceResult;
  bestStrategyId: StrategyId | null;
  qualifiedStrategyIds: StrategyId[];
  reasonsForRanking: string[];
  cautionInsights: string[];
  missingMetrics: string[];
  riskTags: string[];
  opportunityTags: string[];
  commercialScore: CommercialScoreV2Result;
  strategyReport: ProductStrategyReportV2;
  activeStrategyEvaluation: StrategyEvaluationResult | null;
  provenanceSummary: ProductProvenanceSummary;
}

export interface ExcludedIntelligenceCardItem {
  kind: 'excluded';
  product: ProductItem;
  strategyId: StrategyId;
  strategyScore: number | null;
  commercialOpportunityScore: number | null;
  opportunityClassification: OpportunityClassification;
  eligibilityStatus: Exclude<StrategyEligibilityStatus, 'QUALIFIED'>;
  dataConfidence: DataConfidenceResult;
  missingEvidence: string[];
  failedRequirements: StrategyRequirementCheck[];
  riskTags: string[];
  explanation: string;
  commercialScore: CommercialScoreV2Result;
  strategyReport: ProductStrategyReportV2;
  provenanceSummary: ProductProvenanceSummary;
}

export interface StrategyTabSummary {
  id: StrategyId;
  profile: StrategyProfileDefinition;
  qualifiedCount: number;
  excludedCount: number;
  statusCounts: Record<StrategyEligibilityStatus, number>;
  unavailableReason: string | null;
  requiresHistoricalSnapshots: boolean;
}

export interface ProductIntelligenceViewModel {
  activeView: ActiveStrategyView;
  poolSize: number;
  smallPoolWarning: boolean;
  poolNotice: string;
  duplicateProductIdsRemoved: string[];
  overallCount: number;
  strategySummaries: StrategyTabSummary[];
  activeBucket: StrategyRankingBucket<ProductItem> | null;
  rankedEntries: RankedIntelligenceCardItem[];
  excludedEntries: ExcludedIntelligenceCardItem[];
  isHistoricalDataUnavailable: boolean;
  rankingResult: MarketplaceIntelligenceRankingResult<ProductItem>;
}

const METRIC_KEYS_ORDER: MetricFieldKey[] = [
  'priceThb',
  'commissionRate',
  'commissionThb',
  'revenueThb7d',
  'salesVolume7d',
  'videoRevenueThb7d',
  'liveRevenueThb7d',
  'revenueGrowthRate',
  'creatorCount',
  'rating',
  'reviewCount',
];

export function classifyMetricProvenance(
  metric: ValidatedMetric<number>
): MetricProvenanceCategory {
  if (metric.state === 'STALE') return 'stale';
  if (metric.state === 'INVALID') return 'invalid';
  if (metric.unit === 'UNVERIFIED') return 'unverified';
  if (metric.state === 'UNAVAILABLE') return 'unavailable';
  if (metric.state === 'MISSING') return 'missing';
  if (metric.state === 'ZERO') return 'zero';
  if (metric.provenance === 'SYNTHETIC') return 'derived';
  return 'verified_source';
}

export function getProductMetricProvenanceList(
  validatedMetrics: ProductValidatedMetrics
): ProductMetricProvenanceItem[] {
  return METRIC_KEYS_ORDER.map((key) => {
    const metric = validatedMetrics[key];
    const category = classifyMetricProvenance(metric);
    return {
      key,
      metric,
      category,
      isUnverifiedPhase0:
        metric.unit === 'UNVERIFIED' ||
        (metric.state === 'UNAVAILABLE' &&
          validatedMetrics.unresolvedFields.includes(key)),
    };
  });
}

export function summarizeProductProvenance(
  validatedMetrics: ProductValidatedMetrics
): ProductProvenanceSummary {
  const items = getProductMetricProvenanceList(validatedMetrics);
  let verifiedSourceCount = 0;
  let derivedCount = 0;
  let unverifiedCount = 0;
  let missingOrUnavailableCount = 0;
  let staleCount = 0;
  let invalidCount = 0;
  let zeroCount = 0;

  for (const item of items) {
    switch (item.category) {
      case 'verified_source':
        verifiedSourceCount += 1;
        break;
      case 'derived':
        derivedCount += 1;
        break;
      case 'unverified':
        unverifiedCount += 1;
        break;
      case 'missing':
      case 'unavailable':
        missingOrUnavailableCount += 1;
        break;
      case 'stale':
        staleCount += 1;
        break;
      case 'invalid':
        invalidCount += 1;
        break;
      case 'zero':
        zeroCount += 1;
        break;
    }
  }

  return {
    verifiedSourceCount,
    derivedCount,
    unverifiedCount,
    missingOrUnavailableCount,
    staleCount,
    invalidCount,
    zeroCount,
    hasSyntheticRevenue: validatedMetrics.revenueThb7d.provenance === 'SYNTHETIC',
    hasUnverifiedCoreMetrics:
      validatedMetrics.revenueGrowthRate.unit === 'UNVERIFIED' ||
      validatedMetrics.creatorCount.unit === 'UNVERIFIED' ||
      validatedMetrics.rating.unit === 'UNVERIFIED' ||
      validatedMetrics.reviewCount.unit === 'UNVERIFIED',
  };
}

export function ensureProductV2Intelligence(
  product: ProductItem,
  options?: {
    nowMs?: number;
    historicalSnapshots?: HistoricalMetricSnapshot[];
  }
): ProductItem {
  const baseValidated =
    product.validatedMetrics ??
    adaptProductItemToValidatedMetrics(product, { nowMs: options?.nowMs });
  const validatedMetrics =
    options?.nowMs !== undefined
      ? refreshProductValidatedMetricsFreshness(baseValidated, { nowMs: options.nowMs })
      : baseValidated;

  const freshnessChanged = validatedMetrics !== product.validatedMetrics;

  const commercialScoreV2 =
    !freshnessChanged && product.commercialScoreV2
      ? product.commercialScoreV2
      : evaluateProductCommercialV2(validatedMetrics, { nowMs: options?.nowMs });

  const strategyIntelligenceV2 =
    !freshnessChanged && !options?.historicalSnapshots && product.strategyIntelligenceV2
      ? product.strategyIntelligenceV2
      : evaluateProductStrategiesV2(validatedMetrics, commercialScoreV2, {
          scoringConfig:
            options?.nowMs !== undefined ? { nowMs: options.nowMs } : undefined,
          historicalSnapshots: options?.historicalSnapshots,
        });

  if (
    !freshnessChanged &&
    product.validatedMetrics &&
    product.commercialScoreV2 &&
    product.strategyIntelligenceV2 &&
    !options?.historicalSnapshots
  ) {
    return product;
  }

  return {
    ...product,
    validatedMetrics,
    commercialScoreV2,
    strategyIntelligenceV2,
  };
}

export function buildProductIntelligenceView(
  products: ProductItem[],
  activeView: ActiveStrategyView,
  options?: {
    nowMs?: number;
    historicalSnapshotsByProductId?: Record<string, HistoricalMetricSnapshot[]>;
  }
): ProductIntelligenceViewModel {
  const preparedProducts = products.map((product) =>
    ensureProductV2Intelligence(product, {
      nowMs: options?.nowMs,
      historicalSnapshots: options?.historicalSnapshotsByProductId?.[product.id],
    })
  );

  const rankingResult = rankProductIntelligenceV2(
    preparedProducts.map((product) => ({
      item: product,
      productId: product.id,
      validatedMetrics: product.validatedMetrics!,
      commercialScore: product.commercialScoreV2,
      historicalSnapshots: options?.historicalSnapshotsByProductId?.[product.id],
    })),
    {
      scoringConfig:
        options?.nowMs !== undefined ? { nowMs: options.nowMs } : undefined,
    }
  );

  const overallEntryById = new Map(
    rankingResult.overallRanking.map((entry) => [entry.productId, entry])
  );

  const attachEntryReport = (
    product: ProductItem,
    commercialScore: CommercialScoreV2Result,
    strategyReport: ProductStrategyReportV2
  ): ProductItem => ({
    ...product,
    validatedMetrics:
      product.validatedMetrics ??
      adaptProductItemToValidatedMetrics(product, { nowMs: options?.nowMs }),
    commercialScoreV2: commercialScore,
    strategyIntelligenceV2: strategyReport,
  });

  const strategySummaries: StrategyTabSummary[] = ALL_STRATEGY_IDS.map((id) => {
    const bucket = rankingResult.strategyRankings[id];
    return {
      id,
      profile: bucket.profile,
      qualifiedCount: bucket.qualifiedCount,
      excludedCount: bucket.excludedCandidates.length,
      statusCounts: bucket.statusCounts,
      unavailableReason: bucket.unavailableReason,
      requiresHistoricalSnapshots: bucket.profile.requiresHistoricalSnapshots,
    };
  });

  if (activeView === 'overall') {
    const rankedEntries: RankedIntelligenceCardItem[] =
      rankingResult.overallRanking.map((entry) => {
        const enrichedProduct = attachEntryReport(
          entry.item,
          entry.commercialScore,
          entry.strategyReport
        );
        return {
          kind: 'ranked',
          product: enrichedProduct,
          rank: entry.rank,
          primaryScore: entry.commercialOpportunityScore,
          commercialOpportunityScore: entry.commercialOpportunityScore,
          strategyScore: null,
          opportunityClassification: entry.opportunityClassification,
          commercialEligibilityStatus: entry.eligibilityStatus,
          strategyEligibilityStatus: entry.bestStrategyId
            ? entry.strategyReport.strategies[entry.bestStrategyId].eligibilityStatus
            : null,
          dataConfidence: entry.dataConfidence,
          bestStrategyId: entry.bestStrategyId,
          qualifiedStrategyIds: entry.qualifiedStrategyIds,
          reasonsForRanking: entry.opportunityInsights,
          cautionInsights: entry.cautionInsights,
          missingMetrics: entry.missingMetrics,
          riskTags: entry.riskTags,
          opportunityTags: entry.opportunityTags,
          commercialScore: entry.commercialScore,
          strategyReport: entry.strategyReport,
          activeStrategyEvaluation: entry.bestStrategyId
            ? entry.strategyReport.strategies[entry.bestStrategyId]
            : null,
          provenanceSummary: summarizeProductProvenance(enrichedProduct.validatedMetrics!),
        };
      });

    return {
      activeView,
      poolSize: rankingResult.poolSize,
      smallPoolWarning: rankingResult.smallPoolWarning,
      poolNotice: rankingResult.poolNotice,
      duplicateProductIdsRemoved: rankingResult.duplicateProductIdsRemoved ?? [],
      overallCount: rankingResult.overallRanking.length,
      strategySummaries,
      activeBucket: null,
      rankedEntries,
      excludedEntries: [],
      isHistoricalDataUnavailable: false,
      rankingResult,
    };
  }

  const bucket = rankingResult.strategyRankings[activeView];

  const rankedEntries: RankedIntelligenceCardItem[] =
    bucket.qualifiedRankings.map((entry) => {
      const overall = overallEntryById.get(entry.productId);
      const commercialScore =
        overall?.commercialScore ?? entry.item.commercialScoreV2!;
      const strategyReport =
        overall?.strategyReport ?? entry.item.strategyIntelligenceV2!;
      const enrichedProduct = attachEntryReport(
        entry.item,
        commercialScore,
        strategyReport
      );

      return {
        kind: 'ranked',
        product: enrichedProduct,
        rank: entry.rank,
        primaryScore: entry.strategyScore,
        commercialOpportunityScore: entry.commercialOpportunityScore,
        strategyScore: entry.strategyScore,
        opportunityClassification: strategyReport.opportunityClassification,
        commercialEligibilityStatus: commercialScore.eligibilityStatus,
        strategyEligibilityStatus: entry.eligibilityStatus,
        dataConfidence: entry.dataConfidence,
        bestStrategyId: strategyReport.bestStrategyId,
        qualifiedStrategyIds: strategyReport.qualifiedStrategyIds,
        reasonsForRanking: entry.reasonsForRanking,
        cautionInsights: strategyReport.cautionInsights,
        missingMetrics: entry.missingEvidence,
        riskTags: entry.riskTags,
        opportunityTags: entry.opportunityTags,
        commercialScore,
        strategyReport,
        activeStrategyEvaluation: entry.evaluation,
        provenanceSummary: summarizeProductProvenance(enrichedProduct.validatedMetrics!),
      };
    });

  const excludedEntries: ExcludedIntelligenceCardItem[] =
    bucket.excludedCandidates.map((entry) => {
      const overall = overallEntryById.get(entry.productId);
      const commercialScore =
        overall?.commercialScore ?? entry.item.commercialScoreV2!;
      const strategyReport =
        overall?.strategyReport ?? entry.item.strategyIntelligenceV2!;
      const enrichedProduct = attachEntryReport(
        entry.item,
        commercialScore,
        strategyReport
      );

      return {
        kind: 'excluded',
        product: enrichedProduct,
        strategyId: entry.strategyId,
        strategyScore: entry.strategyScore,
        commercialOpportunityScore: entry.commercialOpportunityScore,
        opportunityClassification: strategyReport.opportunityClassification,
        eligibilityStatus: entry.eligibilityStatus,
        dataConfidence: entry.dataConfidence,
        missingEvidence: entry.missingEvidence,
        failedRequirements: entry.failedRequirements,
        riskTags: entry.riskTags,
        explanation: entry.explanation,
        commercialScore,
        strategyReport,
        provenanceSummary: summarizeProductProvenance(enrichedProduct.validatedMetrics!),
      };
    });

  const isHistoricalDataUnavailable =
    bucket.profile.requiresHistoricalSnapshots &&
    bucket.qualifiedCount === 0 &&
    (bucket.statusCounts.DATA_UNAVAILABLE > 0 || Boolean(bucket.unavailableReason));

  return {
    activeView,
    poolSize: rankingResult.poolSize,
    smallPoolWarning: rankingResult.smallPoolWarning,
    poolNotice: rankingResult.poolNotice,
    duplicateProductIdsRemoved: rankingResult.duplicateProductIdsRemoved ?? [],
    overallCount: rankingResult.overallRanking.length,
    strategySummaries,
    activeBucket: bucket,
    rankedEntries,
    excludedEntries,
    isHistoricalDataUnavailable,
    rankingResult,
  };
}

export function sortProductsByV2Overall(
  products: ProductItem[],
  options?: {
    nowMs?: number;
    historicalSnapshotsByProductId?: Record<string, HistoricalMetricSnapshot[]>;
  }
): ProductItem[] {
  const view = buildProductIntelligenceView(products, 'overall', options);
  return view.rankedEntries.map((entry) => entry.product);
}

export type ClassificationTone =
  | 'top'
  | 'strong'
  | 'moderate'
  | 'watchlist'
  | 'insufficient'
  | 'not_monetizable';

export function getClassificationTone(
  classification: OpportunityClassification
): ClassificationTone {
  switch (classification) {
    case 'TOP_OPPORTUNITY':
      return 'top';
    case 'STRONG_OPPORTUNITY':
      return 'strong';
    case 'MODERATE_OPPORTUNITY':
      return 'moderate';
    case 'WATCHLIST':
      return 'watchlist';
    case 'NOT_MONETIZABLE':
      return 'not_monetizable';
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return 'insufficient';
  }
}

export function getToneClasses(tone: ClassificationTone): {
  text: string;
  stroke: string;
  bar: string;
  dot: string;
  border: string;
} {
  switch (tone) {
    case 'top':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        stroke: '#10B981',
        bar: 'bg-emerald-500 dark:bg-emerald-400',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        border: 'border-emerald-200/80 dark:border-emerald-900/60',
      };
    case 'strong':
      return {
        text: 'text-teal-700 dark:text-teal-400',
        stroke: '#0D9488',
        bar: 'bg-teal-500 dark:bg-teal-400',
        dot: 'bg-teal-500 dark:bg-teal-400',
        border: 'border-teal-200/80 dark:border-teal-900/60',
      };
    case 'moderate':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        stroke: '#0284C7',
        bar: 'bg-sky-500 dark:bg-sky-400',
        dot: 'bg-sky-500 dark:bg-sky-400',
        border: 'border-sky-200/80 dark:border-sky-900/60',
      };
    case 'watchlist':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        stroke: '#D97706',
        bar: 'bg-amber-500 dark:bg-amber-400',
        dot: 'bg-amber-500 dark:bg-amber-400',
        border: 'border-amber-200/80 dark:border-amber-900/60',
      };
    case 'not_monetizable':
      return {
        text: 'text-rose-700 dark:text-rose-400',
        stroke: '#E11D48',
        bar: 'bg-rose-500 dark:bg-rose-400',
        dot: 'bg-rose-500 dark:bg-rose-400',
        border: 'border-rose-200/80 dark:border-rose-900/60',
      };
    case 'insufficient':
    default:
      return {
        text: 'text-slate-600 dark:text-slate-400',
        stroke: '#64748B',
        bar: 'bg-slate-400 dark:bg-slate-500',
        dot: 'bg-slate-400 dark:bg-slate-500',
        border: 'border-slate-200/80 dark:border-slate-800',
      };
  }
}

export function getDimensionBarClass(
  score: number | null,
  status: CommercialScoreV2Result['demandScore']['status']
): { barClass: string; textClass: string } {
  if (status === 'NOT_MONETIZABLE' || status === 'INVALID') {
    return {
      barClass: 'bg-rose-500 dark:bg-rose-400',
      textClass: 'text-rose-700 dark:text-rose-400',
    };
  }
  if (score === null || status === 'INSUFFICIENT') {
    return {
      barClass: 'bg-slate-300 dark:bg-slate-700',
      textClass: 'text-slate-500 dark:text-slate-400',
    };
  }
  if (score >= 70) {
    return {
      barClass: 'bg-emerald-500 dark:bg-emerald-400',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  if (score >= 45) {
    return {
      barClass: 'bg-teal-500 dark:bg-teal-400',
      textClass: 'text-teal-700 dark:text-teal-400',
    };
  }
  if (score >= 25) {
    return {
      barClass: 'bg-amber-500 dark:bg-amber-400',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    barClass: 'bg-rose-500 dark:bg-rose-400',
    textClass: 'text-rose-700 dark:text-rose-400',
  };
}
