import type { ProductItem } from '../types.ts';
import type { ProductValidatedMetrics, ValidatedMetric } from '../types/metrics.ts';
import type {
  CommercialEligibilityStatus,
  CommercialPoolEvaluationResult,
  CommercialPoolProductResult,
  CommercialScoreExplanation,
  CommercialScoreV2Result,
  CommercialScoringV2Config,
  CompetitionDimensionResult,
  ConfidenceLevel,
  ConversionEvidenceLevel,
  ConversionEvidenceResult,
  CustomerQualityDimensionResult,
  DataConfidenceResult,
  DemandDimensionResult,
  DominantConversionChannel,
  EarningDimensionResult,
  V2GrowthStatus,
} from '../types/scoringV2.ts';
import {
  adaptProductItemToValidatedMetrics,
  DEFAULT_METRIC_STALE_MS,
  isUsableScoringMetric,
  validateMetricTimestamp,
} from './metricFoundation.ts';

export const DEFAULT_COMMERCIAL_SCORING_V2_CONFIG: CommercialScoringV2Config = {
  staleAfterMs: DEFAULT_METRIC_STALE_MS,
  allowSyntheticRevenue: false,
  demand: {
    revenuePivotThb: 2000,
    revenueMaxRefThb: 2_000_000,
    salesPivotUnits: 8,
    salesMaxRefUnits: 10_000,
    revenueWeightInAbsolute: 0.65,
    salesWeightInAbsolute: 0.35,
    absoluteWeightWithGrowth: 0.78,
    growthWeightWithGrowth: 0.22,
    growthScalePercent: 65,
    missingGrowthCap: 80,
    singleRevenueCap: 82,
    singleSalesCap: 72,
    weakDemandThreshold: 30,
  },
  earning: {
    rateHalfSaturationPct: 8,
    rateSteepness: 1.35,
    payoutPivotThb: 6,
    payoutMaxRefThb: 250,
    rateWeight: 0.4,
    payoutWeight: 0.6,
    missingDemandCap: 75,
  },
  competition: {
    smoothingPriorCreators: 5,
    densityMidpointCreators: 35,
    densitySteepness: 1.15,
    rpcPivotThb: 800,
    rpcMaxRefThb: 60_000,
    densityWeight: 0.42,
    rpcWeight: 0.58,
    demandViabilityHalfThb: 12_000,
    zeroCreatorScoreCap: 68,
    extremeCompetitionThreshold: 26,
  },
  customerQuality: {
    priorMean: 3.8,
    priorWeight: 25,
    minScoreRatingFloor: 2.5,
    lowSampleThreshold: 10,
    lowSampleScoreCap: 60,
    poorQualityMinReviews: 20,
    poorQualityBayesianThreshold: 3.7,
  },
  aggregation: {
    weights: {
      demand: 0.35,
      earning: 0.28,
      competition: 0.25,
      customerQuality: 0.12,
    },
    geometricFloor: 4,
    weakDemandCap: 35,
    poorQualityMultiplier: 0.72,
    poorQualityCap: 48,
    highCompetitionCap: 55,
    missingCompetitionCap: 52,
    missingQualityMultiplier: 0.9,
    missingQualityCap: 82,
    zeroCreatorOverallCap: 72,
    lowReviewSampleOverallCap: 76,
    topTierMinScore: 75,
    smallPoolWarningThreshold: 10,
  },
};

export type PartialCommercialScoringV2Config = {
  staleAfterMs?: number;
  nowMs?: number;
  allowSyntheticRevenue?: boolean;
  demand?: Partial<CommercialScoringV2Config['demand']>;
  earning?: Partial<CommercialScoringV2Config['earning']>;
  competition?: Partial<CommercialScoringV2Config['competition']>;
  customerQuality?: Partial<CommercialScoringV2Config['customerQuality']>;
  aggregation?: Omit<Partial<CommercialScoringV2Config['aggregation']>, 'weights'> & {
    weights?: Partial<CommercialScoringV2Config['aggregation']['weights']>;
  };
};

export function resolveScoringV2Config(
  overrides?: PartialCommercialScoringV2Config
): CommercialScoringV2Config {
  if (!overrides) return DEFAULT_COMMERCIAL_SCORING_V2_CONFIG;
  return {
    staleAfterMs: overrides.staleAfterMs ?? DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.staleAfterMs,
    nowMs: overrides.nowMs,
    allowSyntheticRevenue:
      overrides.allowSyntheticRevenue ?? DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.allowSyntheticRevenue,
    demand: {
      ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.demand,
      ...overrides.demand,
    },
    earning: {
      ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.earning,
      ...overrides.earning,
    },
    competition: {
      ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.competition,
      ...overrides.competition,
    },
    customerQuality: {
      ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.customerQuality,
      ...overrides.customerQuality,
    },
    aggregation: {
      ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation,
      ...overrides.aggregation,
      weights: {
        ...DEFAULT_COMMERCIAL_SCORING_V2_CONFIG.aggregation.weights,
        ...overrides.aggregation?.weights,
      },
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Smooth log-saturation curve mapping [0, maxRef] to [0, 100].
 * Returns 0 for x <= 0 and saturates smoothly at 100 for x >= maxRef.
 */
function logSaturationScore(value: number, pivot: number, maxRef: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const safePivot = Math.max(1e-6, pivot);
  const safeMax = Math.max(safePivot * 2, maxRef);
  const num = Math.log10(1 + value / safePivot);
  const den = Math.log10(1 + safeMax / safePivot);
  return clamp((num / den) * 100, 0, 100);
}

const MAX_TIMESTAMP_SPREAD_MS = 6 * 3_600_000;

function refreshMetricFreshness(
  metric: ValidatedMetric<number>,
  config: CommercialScoringV2Config
): ValidatedMetric<number> {
  if (metric.state !== 'OK' && metric.state !== 'ZERO') {
    return metric;
  }
  if (!metric.fetchedAt) {
    return metric;
  }
  const tsCheck = validateMetricTimestamp(metric.fetchedAt, {
    staleAfterMs: config.staleAfterMs,
    nowMs: config.nowMs,
  });
  if (tsCheck.future) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: tsCheck.reason ?? metric.note ?? 'Metric timestamp is in the future.',
    };
  }
  if (config.nowMs === undefined) {
    return metric;
  }
  if (!tsCheck.valid || tsCheck.stale) {
    return {
      ...metric,
      state: 'STALE',
      note: tsCheck.reason ?? metric.note ?? 'Metric exceeded freshness TTL.',
    };
  }
  return metric;
}

function sanitizeMetricDomain(
  metric: ValidatedMetric<number>,
  rules: {
    allowZero?: boolean;
    allowNegative?: boolean;
    minValue?: number;
    maxValue?: number;
    commissionUnitCheck?: boolean;
  }
): ValidatedMetric<number> {
  if (metric.state !== 'OK' && metric.state !== 'ZERO') {
    return metric;
  }
  if (metric.value === null || !Number.isFinite(metric.value)) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: 'Non-finite numeric value rejected by domain invariant guard.',
    };
  }
  if (metric.state === 'ZERO' && metric.value !== 0) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: 'ZERO state with non-zero numeric value rejected by domain invariant guard.',
    };
  }
  if (rules.allowZero === false && metric.value === 0) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: 'Zero value rejected for strictly positive metric.',
    };
  }
  if (rules.allowNegative === false && metric.value < 0) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: `Negative value (${metric.value}) rejected by domain invariant guard.`,
    };
  }
  if (rules.minValue !== undefined && metric.value < rules.minValue) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: `Value (${metric.value}) is below minimum (${rules.minValue}).`,
    };
  }
  if (rules.maxValue !== undefined && metric.value > rules.maxValue) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: `Value (${metric.value}) exceeds maximum (${rules.maxValue}).`,
    };
  }
  if (rules.commissionUnitCheck) {
    if (metric.unit === 'PERCENT' && (metric.value < 0 || metric.value > 100)) {
      return {
        ...metric,
        value: null,
        state: 'INVALID',
        note: `Commission percentage (${metric.value}%) outside [0, 100].`,
      };
    }
    if (metric.unit === 'RATIO' && (metric.value < 0 || metric.value > 1)) {
      return {
        ...metric,
        value: null,
        state: 'INVALID',
        note: `Commission ratio (${metric.value}) outside [0, 1].`,
      };
    }
  }
  if (rules.allowZero !== false && metric.value === 0 && metric.state === 'OK') {
    return {
      ...metric,
      state: 'ZERO',
    };
  }
  return metric;
}

function normalizeValidatedMetricsWithFreshness(
  metrics: ProductValidatedMetrics,
  config: CommercialScoringV2Config
): ProductValidatedMetrics {
  return {
    ...metrics,
    priceThb: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.priceThb, { allowZero: false, allowNegative: false }),
      config
    ),
    commissionRate: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.commissionRate, {
        allowZero: true,
        allowNegative: false,
        commissionUnitCheck: true,
      }),
      config
    ),
    commissionThb: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.commissionThb, { allowZero: true, allowNegative: false }),
      config
    ),
    salesVolume7d: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.salesVolume7d, { allowZero: true, allowNegative: false }),
      config
    ),
    revenueThb7d: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.revenueThb7d, { allowZero: true, allowNegative: false }),
      config
    ),
    videoRevenueThb7d: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.videoRevenueThb7d, { allowZero: true, allowNegative: false }),
      config
    ),
    liveRevenueThb7d: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.liveRevenueThb7d, { allowZero: true, allowNegative: false }),
      config
    ),
    revenueGrowthRate: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.revenueGrowthRate, { allowZero: true, allowNegative: true }),
      config
    ),
    creatorCount: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.creatorCount, { allowZero: true, allowNegative: false }),
      config
    ),
    rating: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.rating, {
        allowZero: true,
        allowNegative: false,
        minValue: 0,
        maxValue: 5,
      }),
      config
    ),
    reviewCount: refreshMetricFreshness(
      sanitizeMetricDomain(metrics.reviewCount, { allowZero: true, allowNegative: false }),
      config
    ),
  };
}

export interface MetricConflictAssessment {
  riskTags: string[];
  confidencePenalty: number;
  drivers: string[];
}

export function detectMetricConflicts(
  metrics: ProductValidatedMetrics
): MetricConflictAssessment {
  const riskTags: string[] = [];
  const drivers: string[] = [];
  let confidencePenalty = 0;

  const coreMetrics: ValidatedMetric<number>[] = [
    metrics.priceThb,
    metrics.commissionRate,
    metrics.salesVolume7d,
    metrics.revenueThb7d,
    metrics.videoRevenueThb7d,
    metrics.liveRevenueThb7d,
    metrics.revenueGrowthRate,
    metrics.creatorCount,
    metrics.rating,
    metrics.reviewCount,
  ];

  // 1. Conflicting timestamps across active SOURCE metrics
  const timestampMsList: number[] = [];
  for (const m of coreMetrics) {
    if (
      m.provenance === 'SOURCE' &&
      (m.state === 'OK' || m.state === 'ZERO') &&
      m.fetchedAt
    ) {
      const parsed = Date.parse(m.fetchedAt);
      if (Number.isFinite(parsed)) {
        timestampMsList.push(parsed);
      }
    }
  }
  if (timestampMsList.length >= 2) {
    const minTs = Math.min(...timestampMsList);
    const maxTs = Math.max(...timestampMsList);
    if (maxTs - minTs > MAX_TIMESTAMP_SPREAD_MS) {
      const spreadHours = roundToDecimals((maxTs - minTs) / 3_600_000, 1);
      riskTags.push('CONFLICTING_TIMESTAMPS');
      drivers.push(`Snapshot timestamps conflict across metrics (span ${spreadHours}h > 6h).`);
      confidencePenalty += 12;
    }
  }

  // 2. Conflicting period dateRange across period-scoped metrics
  const periodMetrics = [
    metrics.revenueThb7d,
    metrics.salesVolume7d,
    metrics.videoRevenueThb7d,
    metrics.liveRevenueThb7d,
  ];
  const dateRanges = new Set<string>();
  for (const m of periodMetrics) {
    if (
      m.provenance === 'SOURCE' &&
      (m.state === 'OK' || m.state === 'ZERO') &&
      m.dateRange &&
      m.dateRange.trim()
    ) {
      dateRanges.add(m.dateRange.trim().toLowerCase());
    }
  }
  if (dateRanges.size > 1) {
    riskTags.push('CONFLICTING_DATE_RANGES');
    drivers.push(
      `Conflicting period dateRange values (${Array.from(dateRanges).join(' vs ')}) across demand metrics.`
    );
    confidencePenalty += 10;
  }

  // 3. Conflicting channel revenues vs total revenue
  const totalRev =
    isUsableScoringMetric(metrics.revenueThb7d) && metrics.revenueThb7d.unit === 'THB'
      ? metrics.revenueThb7d.value
      : null;
  const videoRev =
    isUsableScoringMetric(metrics.videoRevenueThb7d) && metrics.videoRevenueThb7d.unit === 'THB'
      ? metrics.videoRevenueThb7d.value
      : null;
  const liveRev =
    isUsableScoringMetric(metrics.liveRevenueThb7d) && metrics.liveRevenueThb7d.unit === 'THB'
      ? metrics.liveRevenueThb7d.value
      : null;
  if (totalRev !== null) {
    if (
      (videoRev !== null && videoRev > Math.max(100, totalRev * 1.05)) ||
      (liveRev !== null && liveRev > Math.max(100, totalRev * 1.05)) ||
      (videoRev !== null &&
        liveRev !== null &&
        videoRev + liveRev > Math.max(100, totalRev * 1.15))
    ) {
      riskTags.push('CONFLICTING_REVENUE_CHANNELS');
      drivers.push('Video/Live channel revenue exceeds total reported revenue beyond tolerance.');
      confidencePenalty += 10;
    }
  }

  // 4. Conflicting commissionThb vs priceThb * commissionRate
  if (
    isUsableScoringMetric(metrics.priceThb) &&
    metrics.priceThb.value > 0 &&
    isUsableScoringMetric(metrics.commissionRate) &&
    (metrics.commissionRate.unit === 'PERCENT' || metrics.commissionRate.unit === 'RATIO') &&
    (metrics.commissionThb.state === 'OK' || metrics.commissionThb.state === 'ZERO') &&
    metrics.commissionThb.value !== null &&
    Number.isFinite(metrics.commissionThb.value)
  ) {
    const rateRatio =
      metrics.commissionRate.unit === 'RATIO'
        ? metrics.commissionRate.value
        : metrics.commissionRate.value / 100;
    const expectedPayout = roundToDecimals(metrics.priceThb.value * rateRatio, 2);
    if (Math.abs(metrics.commissionThb.value - expectedPayout) > Math.max(1, expectedPayout * 0.25)) {
      riskTags.push('CONFLICTING_PAYOUT_METRIC');
      drivers.push(
        `Reported commissionThb (฿${metrics.commissionThb.value}) conflicts with price * commissionRate (฿${expectedPayout}).`
      );
      confidencePenalty += 8;
    }
  }

  // 5. Conflicting revenue vs salesVolume / price*volume (>5x divergence or zero/positive mismatch)
  if (
    totalRev !== null &&
    isUsableScoringMetric(metrics.salesVolume7d) &&
    metrics.salesVolume7d.unit === 'COUNT' &&
    metrics.salesVolume7d.value !== null
  ) {
    const rev = totalRev;
    const vol = metrics.salesVolume7d.value;
    if ((rev === 0 && vol > 0) || (vol === 0 && rev > 0)) {
      riskTags.push('CONFLICTING_REVENUE_AND_VOLUME');
      drivers.push('Zero vs positive conflict between verified revenue and sales volume.');
      confidencePenalty += 10;
    } else if (rev > 0 && vol > 0 && isUsableScoringMetric(metrics.priceThb) && metrics.priceThb.value !== null && metrics.priceThb.value > 0) {
      const implied = vol * metrics.priceThb.value;
      const ratio = Math.max(rev, implied) / Math.max(1, Math.min(rev, implied));
      if (ratio > 5) {
        riskTags.push('CONFLICTING_REVENUE_AND_VOLUME');
        drivers.push(
          `Reported revenue (฿${rev}) diverges >5x from price * salesVolume (฿${Math.round(implied)}).`
        );
        confidencePenalty += 10;
      }
    }
  }

  if (coreMetrics.some((m) => m.state === 'INVALID')) {
    riskTags.push('INVALID_METRICS_EXCLUDED');
  }

  return {
    riskTags,
    confidencePenalty,
    drivers,
  };
}

function isVerifiedGrowthMetric(
  metric: ValidatedMetric<number>
): { usable: boolean; status: V2GrowthStatus; growthPercent: number | null; reason: string } {
  if (metric.state === 'STALE') {
    return { usable: false, status: 'STALE', growthPercent: null, reason: 'Growth metric is stale.' };
  }
  if (metric.state === 'INVALID') {
    return { usable: false, status: 'INVALID', growthPercent: null, reason: 'Growth metric is invalid.' };
  }
  if (metric.state === 'MISSING') {
    return { usable: false, status: 'MISSING', growthPercent: null, reason: 'Growth metric is missing.' };
  }
  if (metric.unit === 'UNVERIFIED' || metric.state === 'UNAVAILABLE') {
    return {
      usable: false,
      status: 'UNVERIFIED',
      growthPercent: null,
      reason: 'Growth unit or comparison period is unverified.',
    };
  }
  if (!isUsableScoringMetric(metric)) {
    return {
      usable: false,
      status: 'UNVERIFIED',
      growthPercent: null,
      reason: 'Growth metric failed SOURCE usability check.',
    };
  }
  if (metric.unit !== 'PERCENT' && metric.unit !== 'RATIO') {
    return {
      usable: false,
      status: 'UNVERIFIED',
      growthPercent: null,
      reason: `Unsupported growth unit "${metric.unit}".`,
    };
  }
  const dateRange = metric.dateRange?.trim().toLowerCase() ?? '';
  if (!dateRange || dateRange === 'unknown' || dateRange === 'unverified') {
    return {
      usable: false,
      status: 'UNVERIFIED',
      growthPercent: null,
      reason: 'Growth comparison period/dateRange is missing or unverified.',
    };
  }
  if (metric.note && /UNVERIFIED_COMPARISON_PERIOD/i.test(metric.note)) {
    return {
      usable: false,
      status: 'UNVERIFIED',
      growthPercent: null,
      reason: 'Growth comparison period explicitly flagged as unverified.',
    };
  }

  const growthPercent =
    metric.unit === 'RATIO' ? roundToDecimals(metric.value * 100, 2) : roundToDecimals(metric.value, 2);
  return {
    usable: true,
    status: 'VERIFIED',
    growthPercent,
    reason: `Verified ${metric.unit} growth (${growthPercent >= 0 ? '+' : ''}${growthPercent}%) over "${metric.dateRange}".`,
  };
}

/**
 * Dimension A: Demand Score
 * Measures verified revenue + verified sales volume (as a single non-double-counted Market Scale)
 * plus verified historical growth when both unit and comparison period are verified.
 */
export function scoreDemandDimension(
  metrics: ProductValidatedMetrics,
  configInput?: PartialCommercialScoringV2Config
): DemandDimensionResult {
  const config = resolveScoringV2Config(configInput);
  const dCfg = config.demand;
  const revMetric = metrics.revenueThb7d;
  const volMetric = metrics.salesVolume7d;
  const growthMetric = metrics.revenueGrowthRate;

  const usedMetrics: string[] = [];
  const excludedMetrics: string[] = [];
  const notes: string[] = [];

  const revUsable = isUsableScoringMetric(revMetric);
  const volUsable = isUsableScoringMetric(volMetric);

  if (!revUsable) {
    if (revMetric.provenance === 'SYNTHETIC' && (revMetric.state === 'OK' || revMetric.state === 'ZERO')) {
      excludedMetrics.push('revenueThb7d (SYNTHETIC_EXCLUDED)');
      notes.push('Synthetic revenue excluded from verified demand scoring.');
    } else {
      excludedMetrics.push(`revenueThb7d (${revMetric.state})`);
    }
  } else {
    usedMetrics.push('revenueThb7d');
  }

  if (!volUsable) {
    if (volMetric.provenance === 'SYNTHETIC' && (volMetric.state === 'OK' || volMetric.state === 'ZERO')) {
      excludedMetrics.push('salesVolume7d (SYNTHETIC_EXCLUDED)');
      notes.push('Synthetic sales volume excluded from verified demand scoring.');
    } else {
      excludedMetrics.push(`salesVolume7d (${volMetric.state})`);
    }
  } else {
    usedMetrics.push('salesVolume7d');
  }

  const growthCheck = isVerifiedGrowthMetric(growthMetric);
  if (growthCheck.usable) {
    usedMetrics.push('revenueGrowthRate');
    notes.push(growthCheck.reason);
  } else {
    excludedMetrics.push(`revenueGrowthRate (${growthCheck.status})`);
    notes.push(`${growthCheck.reason} Missing/unverified growth is never treated as 0%.`);
  }

  if (!revUsable && !volUsable) {
    return {
      score: null,
      status: 'INSUFFICIENT',
      growthStatus: growthCheck.status,
      subcomponents: {
        revenueScore: null,
        salesVolumeScore: null,
        absoluteDemandScore: null,
        growthScore: null,
        verifiedGrowthPercent: null,
      },
      usedMetrics,
      excludedMetrics,
      notes: [
        'Insufficient demand evidence: neither verified SOURCE revenue nor verified SOURCE sales volume is available.',
        ...notes,
      ],
    };
  }

  const revValue = revUsable ? revMetric.value : null;
  const volValue = volUsable ? volMetric.value : null;

  const revenueScore =
    revValue !== null
      ? roundToDecimals(
          logSaturationScore(revValue, dCfg.revenuePivotThb, dCfg.revenueMaxRefThb),
          2
        )
      : null;
  const salesVolumeScore =
    volValue !== null
      ? roundToDecimals(
          logSaturationScore(volValue, dCfg.salesPivotUnits, dCfg.salesMaxRefUnits),
          2
        )
      : null;

  let absoluteDemandScore: number;
  if (revenueScore !== null && salesVolumeScore !== null && revValue !== null && volValue !== null) {
    if (revValue === 0 && volValue === 0) {
      absoluteDemandScore = 0;
      notes.push('Both verified revenue and sales volume are zero.');
    } else if (revValue === 0 && volValue > 0) {
      // Data inconsistency: sales reported with zero THB revenue
      absoluteDemandScore = roundToDecimals(Math.min(20, salesVolumeScore * 0.35), 2);
      notes.push('Anomaly: positive sales volume with zero revenue; absolute demand capped conservatively.');
    } else if (volValue === 0 && revValue > 0) {
      absoluteDemandScore = roundToDecimals(Math.min(25, revenueScore * 0.4), 2);
      notes.push('Anomaly: positive revenue with zero sales volume; absolute demand capped conservatively.');
    } else {
      const wSum = dCfg.revenueWeightInAbsolute + dCfg.salesWeightInAbsolute;
      absoluteDemandScore = roundToDecimals(
        (dCfg.revenueWeightInAbsolute * revenueScore + dCfg.salesWeightInAbsolute * salesVolumeScore) /
          wSum,
        2
      );
    }
  } else if (revenueScore !== null) {
    absoluteDemandScore = roundToDecimals(
      Math.min(dCfg.singleRevenueCap, revenueScore * 0.94),
      2
    );
    notes.push('Scored from verified revenue only (sales volume missing/unusable); capped below corroborated maximum.');
  } else {
    // Only verified salesVolume available
    absoluteDemandScore = roundToDecimals(
      Math.min(dCfg.singleSalesCap, (salesVolumeScore ?? 0) * 0.88),
      2
    );
    notes.push('Scored from verified sales volume only without verified THB revenue; capped conservatively.');
  }

  let growthScore: number | null = null;
  let finalScore: number;

  if (absoluteDemandScore <= 0) {
    if (growthCheck.usable && growthCheck.growthPercent !== null) {
      growthScore = roundToDecimals(
        clamp(50 + 50 * Math.tanh(growthCheck.growthPercent / dCfg.growthScalePercent), 0, 100),
        2
      );
    }
    finalScore = 0;
    return {
      score: 0,
      status: 'ZERO',
      growthStatus: growthCheck.status,
      subcomponents: {
        revenueScore,
        salesVolumeScore,
        absoluteDemandScore: 0,
        growthScore,
        verifiedGrowthPercent: growthCheck.growthPercent,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  if (growthCheck.usable && growthCheck.growthPercent !== null) {
    growthScore = roundToDecimals(
      clamp(50 + 50 * Math.tanh(growthCheck.growthPercent / dCfg.growthScalePercent), 0, 100),
      2
    );
    finalScore = Math.round(
      clamp(
        dCfg.absoluteWeightWithGrowth * absoluteDemandScore + dCfg.growthWeightWithGrowth * growthScore,
        0,
        100
      )
    );
  } else {
    // Keep missing/unverified growth strictly below verified flat/positive growth
    // across all demand levels while preserving genuine absolute demand strength.
    finalScore = Math.round(
      clamp(Math.min(dCfg.missingGrowthCap, absoluteDemandScore * 0.88), 0, 100)
    );
  }

  return {
    score: finalScore,
    status: 'SCORED',
    growthStatus: growthCheck.status,
    subcomponents: {
      revenueScore,
      salesVolumeScore,
      absoluteDemandScore,
      growthScore,
      verifiedGrowthPercent: growthCheck.growthPercent,
    },
    usedMetrics,
    excludedMetrics,
    notes,
  };
}

/**
 * Dimension B: Earning Score
 * Measures affiliate earning potential using verified price, verified commission rate,
 * exact payout per sale (never with an artificial minimum floor), and demand realization.
 */
export function scoreEarningDimension(
  metrics: ProductValidatedMetrics,
  demandResult: DemandDimensionResult,
  configInput?: PartialCommercialScoringV2Config
): EarningDimensionResult {
  const config = resolveScoringV2Config(configInput);
  const eCfg = config.earning;
  const priceMetric = metrics.priceThb;
  const rateMetric = metrics.commissionRate;
  const sourcePayoutMetric = metrics.commissionThb;

  const usedMetrics: string[] = [];
  const excludedMetrics: string[] = [];
  const notes: string[] = [];

  // Genuine verified 0% commission -> NOT_MONETIZABLE regardless of price or demand
  if (
    (rateMetric.state === 'ZERO' || (rateMetric.state === 'OK' && rateMetric.value === 0)) &&
    rateMetric.provenance === 'SOURCE' &&
    rateMetric.value === 0
  ) {
    usedMetrics.push('commissionRate');
    notes.push('Verified 0% affiliate commission: product is NOT_MONETIZABLE.');
    return {
      score: 0,
      status: 'NOT_MONETIZABLE',
      payoutPerSaleThb: 0,
      payoutProvenance: 'SYNTHETIC',
      verifiedCommissionPercent: 0,
      subcomponents: {
        rateScore: 0,
        payoutScore: 0,
        demandRealizationFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  if (!isUsableScoringMetric(rateMetric)) {
    excludedMetrics.push(`commissionRate (${rateMetric.state}/${rateMetric.unit})`);
    notes.push('Commission rate is missing, stale, invalid, or unit-unverified; earning score withheld.');
    return {
      score: null,
      status: 'INSUFFICIENT',
      payoutPerSaleThb: null,
      payoutProvenance: null,
      verifiedCommissionPercent: null,
      subcomponents: {
        rateScore: null,
        payoutScore: null,
        demandRealizationFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  if (rateMetric.unit !== 'PERCENT' && rateMetric.unit !== 'RATIO') {
    excludedMetrics.push(`commissionRate (${rateMetric.unit})`);
    notes.push(`Commission unit "${rateMetric.unit}" is not verified as PERCENT or RATIO.`);
    return {
      score: null,
      status: 'INSUFFICIENT',
      payoutPerSaleThb: null,
      payoutProvenance: null,
      verifiedCommissionPercent: null,
      subcomponents: {
        rateScore: null,
        payoutScore: null,
        demandRealizationFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  const ratePct =
    rateMetric.unit === 'RATIO' ? roundToDecimals(rateMetric.value * 100, 4) : rateMetric.value;
  if (ratePct < 0 || ratePct > 100) {
    excludedMetrics.push('commissionRate (OUT_OF_RANGE)');
    return {
      score: null,
      status: 'INVALID',
      payoutPerSaleThb: null,
      payoutProvenance: null,
      verifiedCommissionPercent: null,
      subcomponents: {
        rateScore: null,
        payoutScore: null,
        demandRealizationFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes: [`Invalid commission percentage (${ratePct}%).`],
    };
  }

  usedMetrics.push('commissionRate');

  if (!isUsableScoringMetric(priceMetric) || priceMetric.value <= 0) {
    excludedMetrics.push(`priceThb (${priceMetric.state})`);
    notes.push('Verified unit price is required to compute THB affiliate payout per sale.');
    return {
      score: null,
      status: 'INSUFFICIENT',
      payoutPerSaleThb: null,
      payoutProvenance: null,
      verifiedCommissionPercent: roundToDecimals(ratePct, 2),
      subcomponents: {
        rateScore: null,
        payoutScore: null,
        demandRealizationFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  usedMetrics.push('priceThb');

  const expectedPayout = roundToDecimals(priceMetric.value * (ratePct / 100), 2);
  let payoutPerSaleThb: number;
  let payoutProvenance: 'SOURCE' | 'SYNTHETIC';
  if (isUsableScoringMetric(sourcePayoutMetric) && sourcePayoutMetric.unit === 'THB') {
    const payoutDisagrees =
      Math.abs(sourcePayoutMetric.value - expectedPayout) > Math.max(1, expectedPayout * 0.25);
    if (payoutDisagrees) {
      payoutPerSaleThb = expectedPayout;
      payoutProvenance = 'SYNTHETIC';
      excludedMetrics.push('commissionThb (CONFLICTING_WITH_PRICE_AND_RATE)');
      notes.push(
        `Conflicting SOURCE commissionThb (฿${sourcePayoutMetric.value}) disagrees with priceThb * commissionRate (฿${expectedPayout}); used exact calculated payout.`
      );
    } else {
      payoutPerSaleThb = roundToDecimals(sourcePayoutMetric.value, 2);
      payoutProvenance = 'SOURCE';
      usedMetrics.push('commissionThb');
    }
  } else {
    // Exact calculation without any artificial minimum floor (e.g., ฿0.58 stays 0.58)
    payoutPerSaleThb = expectedPayout;
    payoutProvenance = 'SYNTHETIC';
    notes.push('Payout per sale calculated as priceThb * verified commissionRate (no synthetic floor).');
  }

  const rateRatio = Math.pow(ratePct, eCfg.rateSteepness);
  const halfRatio = Math.pow(eCfg.rateHalfSaturationPct, eCfg.rateSteepness);
  const rateScore = roundToDecimals(clamp((100 * rateRatio) / (rateRatio + halfRatio), 0, 100), 2);
  const payoutScore = roundToDecimals(
    logSaturationScore(payoutPerSaleThb, eCfg.payoutPivotThb, eCfg.payoutMaxRefThb),
    2
  );

  const baseEarning = eCfg.rateWeight * rateScore + eCfg.payoutWeight * payoutScore;

  let demandRealizationFactor: number;
  let cappedByMissingDemand = false;
  if (demandResult.score === null) {
    demandRealizationFactor = 0.72;
    cappedByMissingDemand = true;
    notes.push('Demand evidence is unavailable; earning score capped conservatively.');
  } else if (demandResult.score === 0) {
    demandRealizationFactor = 0.25;
    notes.push('Zero verified demand limits realized earning opportunity.');
  } else if (demandResult.score < config.demand.weakDemandThreshold) {
    demandRealizationFactor = roundToDecimals(0.45 + 0.55 * (demandResult.score / 50), 4);
    notes.push('Weak demand discounts theoretical high commission.');
  } else {
    demandRealizationFactor = roundToDecimals(
      0.7 + 0.3 * Math.min(1, demandResult.score / 55),
      4
    );
  }

  let finalScore = baseEarning * demandRealizationFactor;
  if (cappedByMissingDemand) {
    finalScore = Math.min(eCfg.missingDemandCap, finalScore);
  }

  return {
    score: Math.round(clamp(finalScore, 0, 100)),
    status: 'SCORED',
    payoutPerSaleThb,
    payoutProvenance,
    verifiedCommissionPercent: roundToDecimals(ratePct, 2),
    subcomponents: {
      rateScore,
      payoutScore,
      demandRealizationFactor,
    },
    usedMetrics,
    excludedMetrics,
    notes,
  };
}

/**
 * Dimension C: Competition Score
 * Higher score = lower affiliate crowding + stronger smoothed revenue per creator (RPC).
 * Exposes raw RPC and smoothed adjusted RPC separately, never invents creator counts,
 * and handles 0 creators cautiously without Infinity RPC or automatic 100 score.
 */
export function scoreCompetitionDimension(
  metrics: ProductValidatedMetrics,
  configInput?: PartialCommercialScoringV2Config
): CompetitionDimensionResult {
  const config = resolveScoringV2Config(configInput);
  const cCfg = config.competition;
  const creatorMetric = metrics.creatorCount;
  const revMetric = metrics.revenueThb7d;

  const usedMetrics: string[] = [];
  const excludedMetrics: string[] = [];
  const notes: string[] = [];

  const creatorUsable = isUsableScoringMetric(creatorMetric) && creatorMetric.unit === 'COUNT';
  const revUsable = isUsableScoringMetric(revMetric) && revMetric.unit === 'THB';

  if (!creatorUsable) {
    excludedMetrics.push(`creatorCount (${creatorMetric.state}/${creatorMetric.unit})`);
    notes.push('Creator count is missing, stale, invalid, or unverified; RPC cannot be calculated.');
  } else {
    usedMetrics.push('creatorCount');
  }

  if (!revUsable) {
    if (revMetric.provenance === 'SYNTHETIC' && (revMetric.state === 'OK' || revMetric.state === 'ZERO')) {
      excludedMetrics.push('revenueThb7d (SYNTHETIC_EXCLUDED)');
      notes.push('Synthetic revenue cannot be used to compute verified RPC.');
    } else {
      excludedMetrics.push(`revenueThb7d (${revMetric.state}/${revMetric.unit})`);
    }
  } else {
    usedMetrics.push('revenueThb7d');
  }

  if (!creatorUsable || !revUsable) {
    return {
      score: null,
      status: 'INSUFFICIENT',
      creatorCount: creatorUsable ? creatorMetric.value : null,
      rawRpcThb: null,
      adjustedRpcThb: null,
      smoothingPriorCreators: cCfg.smoothingPriorCreators,
      riskFlag: null,
      subcomponents: {
        creatorDensityScore: null,
        adjustedRpcScore: null,
        demandViabilityFactor: null,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  const creators = creatorMetric.value;
  const revenue = revMetric.value;
  const prior = cCfg.smoothingPriorCreators;

  const rawRpcThb = creators > 0 ? roundToDecimals(revenue / creators, 2) : null;
  const adjustedRpcThb = roundToDecimals(revenue / (creators + prior), 2);

  if (creators === 0) {
    notes.push(
      `Reported 0 creators: raw RPC withheld (null instead of Infinity); smoothed adjusted RPC uses +${prior} prior creators.`
    );
  } else {
    notes.push(
      `Raw RPC = ฿${rawRpcThb}/creator; Adjusted RPC uses Laplace smoothing revenue / (${creators} + ${prior}) = ฿${adjustedRpcThb}/creator.`
    );
  }

  if (revenue <= 0) {
    notes.push('Zero verified revenue produces zero competition opportunity regardless of low creator count.');
    return {
      score: 0,
      status: 'ZERO',
      creatorCount: creators,
      rawRpcThb,
      adjustedRpcThb: 0,
      smoothingPriorCreators: prior,
      riskFlag: null,
      subcomponents: {
        creatorDensityScore: 0,
        adjustedRpcScore: 0,
        demandViabilityFactor: 0,
      },
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  const adjustedRpcScore = roundToDecimals(
    logSaturationScore(adjustedRpcThb, cCfg.rpcPivotThb, cCfg.rpcMaxRefThb),
    2
  );

  const creatorDensityScore = roundToDecimals(
    clamp(
      100 / (1 + Math.pow(creators / cCfg.densityMidpointCreators, cCfg.densitySteepness)),
      0,
      100
    ),
    2
  );

  // Distinguish genuine low-competition opportunities from tiny/dead products with few creators
  const demandViabilityFactor = roundToDecimals(
    revenue / (revenue + cCfg.demandViabilityHalfThb),
    4
  );

  let blended =
    cCfg.densityWeight * (creatorDensityScore * demandViabilityFactor) +
    cCfg.rpcWeight * adjustedRpcScore;

  let riskFlag: CompetitionDimensionResult['riskFlag'] = null;
  if (creators === 0 && revenue > 0) {
    riskFlag = 'ZERO_CREATORS_POSITIVE_REVENUE';
    blended = Math.min(cCfg.zeroCreatorScoreCap, blended);
    notes.push(
      `Zero creators with positive revenue capped at ${cCfg.zeroCreatorScoreCap} (possible shop-direct sales or unattributed creators).`
    );
  }

  const finalScore = Math.round(clamp(blended, 0, 100));
  if (
    creators > cCfg.densityMidpointCreators &&
    (finalScore < cCfg.extremeCompetitionThreshold ||
      (creators >= 150 && adjustedRpcThb < 10_000))
  ) {
    riskFlag = 'EXTREME_COMPETITION';
    notes.push(`High creator saturation (${creators} creators) compresses opportunity.`);
  }

  return {
    score: finalScore,
    status: 'SCORED',
    creatorCount: creators,
    rawRpcThb,
    adjustedRpcThb,
    smoothingPriorCreators: prior,
    riskFlag,
    subcomponents: {
      creatorDensityScore,
      adjustedRpcScore,
      demandViabilityFactor,
    },
    usedMetrics,
    excludedMetrics,
    notes,
  };
}

/**
 * Dimension D: Customer Rating Quality Score
 * Accounts for review sample size via Bayesian shrinkage toward a conservative prior mean.
 */
export function scoreCustomerQualityDimension(
  metrics: ProductValidatedMetrics,
  configInput?: PartialCommercialScoringV2Config
): CustomerQualityDimensionResult {
  const config = resolveScoringV2Config(configInput);
  const qCfg = config.customerQuality;
  const ratingMetric = metrics.rating;
  const reviewMetric = metrics.reviewCount;

  const usedMetrics: string[] = [];
  const excludedMetrics: string[] = [];
  const notes: string[] = [];

  const ratingUsable = isUsableScoringMetric(ratingMetric) && ratingMetric.unit === 'RATING_5';
  const reviewUsable = isUsableScoringMetric(reviewMetric) && reviewMetric.unit === 'COUNT';

  if (!ratingUsable) {
    excludedMetrics.push(`rating (${ratingMetric.state}/${ratingMetric.unit})`);
  } else {
    usedMetrics.push('rating');
  }

  if (!reviewUsable) {
    excludedMetrics.push(`reviewCount (${reviewMetric.state}/${reviewMetric.unit})`);
  } else {
    usedMetrics.push('reviewCount');
  }

  if (!ratingUsable || !reviewUsable) {
    notes.push('Missing or unverified rating/review count; customer quality remains insufficient.');
    return {
      score: null,
      status: 'INSUFFICIENT',
      rawRating: ratingUsable ? ratingMetric.value : null,
      reviewCount: reviewUsable ? reviewMetric.value : null,
      bayesianRating: null,
      priorMean: qCfg.priorMean,
      priorWeight: qCfg.priorWeight,
      riskFlag: null,
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  const rawRating = ratingMetric.value;
  const reviewCount = reviewMetric.value;

  if (reviewCount === 0) {
    notes.push('Zero verified reviews: insufficient sample size to evaluate customer quality.');
    return {
      score: null,
      status: 'INSUFFICIENT',
      rawRating,
      reviewCount: 0,
      bayesianRating: null,
      priorMean: qCfg.priorMean,
      priorWeight: qCfg.priorWeight,
      riskFlag: null,
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  if (rawRating <= 0 || rawRating > 5) {
    notes.push(`Rating (${rawRating}) is invalid when reviewCount (${reviewCount}) > 0.`);
    return {
      score: null,
      status: 'INVALID',
      rawRating,
      reviewCount,
      bayesianRating: null,
      priorMean: qCfg.priorMean,
      priorWeight: qCfg.priorWeight,
      riskFlag: null,
      usedMetrics,
      excludedMetrics,
      notes,
    };
  }

  const bayesianRating = roundToDecimals(
    (qCfg.priorWeight * qCfg.priorMean + reviewCount * rawRating) / (qCfg.priorWeight + reviewCount),
    3
  );
  const span = Math.max(0.5, 5 - qCfg.minScoreRatingFloor);
  let rawScore = clamp(((bayesianRating - qCfg.minScoreRatingFloor) / span) * 100, 0, 100);

  let riskFlag: CustomerQualityDimensionResult['riskFlag'] = null;
  if (reviewCount < qCfg.lowSampleThreshold) {
    riskFlag = 'LOW_REVIEW_SAMPLE';
    rawScore = Math.min(qCfg.lowSampleScoreCap, rawScore);
    notes.push(
      `Small review sample (n=${reviewCount} < ${qCfg.lowSampleThreshold}): shrunk toward ${qCfg.priorMean} prior and capped at ${qCfg.lowSampleScoreCap}.`
    );
  } else if (
    reviewCount >= qCfg.poorQualityMinReviews &&
    bayesianRating < qCfg.poorQualityBayesianThreshold
  ) {
    riskFlag = 'POOR_CUSTOMER_QUALITY';
    notes.push(
      `Verified poor customer quality: Bayesian rating ${bayesianRating} (< ${qCfg.poorQualityBayesianThreshold}) across ${reviewCount} reviews.`
    );
  } else {
    notes.push(
      `Bayesian rating ${bayesianRating}/5.0 from ${rawRating}/5.0 across ${reviewCount} verified reviews.`
    );
  }

  return {
    score: Math.round(rawScore),
    status: 'SCORED',
    rawRating: roundToDecimals(rawRating, 2),
    reviewCount,
    bayesianRating,
    priorMean: qCfg.priorMean,
    priorWeight: qCfg.priorWeight,
    riskFlag,
    usedMetrics,
    excludedMetrics,
    notes,
  };
}

/**
 * Independent Data Confidence Score (0-100).
 * Reliability indicator only — NOT a commercial dimension.
 */
export function computeDataConfidence(
  metrics: ProductValidatedMetrics,
  dimensions: {
    demandScore: DemandDimensionResult;
    earningScore: EarningDimensionResult;
    competitionScore: CompetitionDimensionResult;
    customerQualityScore: CustomerQualityDimensionResult;
  },
  configInput?: PartialCommercialScoringV2Config
): DataConfidenceResult {
  const config = resolveScoringV2Config(configInput);
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  const fields: Array<{
    key: string;
    label: string;
    metric: ValidatedMetric<number>;
    weight: number;
    requiresNonUnverified?: boolean;
  }> = [
    { key: 'revenueThb7d', label: '7d Revenue', metric: metrics.revenueThb7d, weight: 20 },
    { key: 'salesVolume7d', label: '7d Sales Volume', metric: metrics.salesVolume7d, weight: 15 },
    { key: 'commissionRate', label: 'Commission Rate', metric: metrics.commissionRate, weight: 18 },
    { key: 'creatorCount', label: 'Creator Count', metric: metrics.creatorCount, weight: 15 },
    { key: 'priceThb', label: 'Price (THB)', metric: metrics.priceThb, weight: 10 },
    { key: 'revenueGrowthRate', label: 'Revenue Growth', metric: metrics.revenueGrowthRate, weight: 10 },
    { key: 'rating', label: 'Product Rating', metric: metrics.rating, weight: 6 },
    { key: 'reviewCount', label: 'Review Count', metric: metrics.reviewCount, weight: 6 },
  ];

  let completenessPoints = 0;
  let provenancePoints = 0;
  let freshnessPoints = 0;
  let validityPoints = 0;
  const totalWeight = fields.reduce((acc, f) => acc + f.weight, 0);

  let usableCount = 0;
  let syntheticPrimaryCount = 0;
  let staleCount = 0;
  let invalidCount = 0;
  let unverifiedCount = 0;
  let missingCount = 0;

  for (const field of fields) {
    const m = field.metric;
    const isGrowthField = field.key === 'revenueGrowthRate';
    const growthVerified = isGrowthField ? isVerifiedGrowthMetric(m).usable : true;
    const usableSource = isUsableScoringMetric(m) && growthVerified;

    if (usableSource) {
      usableCount += 1;
      completenessPoints += field.weight;
      provenancePoints += field.weight;
      validityPoints += field.weight;

      // Freshness granularity within TTL
      let freshnessRatio = 1.0;
      if (config.nowMs !== undefined && m.fetchedAt) {
        const tsCheck = validateMetricTimestamp(m.fetchedAt, {
          staleAfterMs: config.staleAfterMs,
          nowMs: config.nowMs,
        });
        if (tsCheck.ageMs !== null && config.staleAfterMs > 0) {
          const halfTtl = config.staleAfterMs * 0.5;
          if (tsCheck.ageMs > halfTtl) {
            freshnessRatio = 0.85;
          }
        }
      }
      freshnessPoints += field.weight * freshnessRatio;
    } else if (m.provenance === 'SYNTHETIC' && (m.state === 'OK' || m.state === 'ZERO')) {
      syntheticPrimaryCount += 1;
      completenessPoints += field.weight * 0.35;
      provenancePoints += field.weight * 0.1;
      freshnessPoints += field.weight * 0.5;
      validityPoints += field.weight * 0.6;
      negativeDrivers.push(`${field.label} is SYNTHETIC rather than upstream SOURCE data.`);
    } else if (m.state === 'STALE') {
      staleCount += 1;
      completenessPoints += field.weight * 0.25;
      provenancePoints += field.weight * 0.5;
      freshnessPoints += 0;
      validityPoints += field.weight * 0.4;
      negativeDrivers.push(`${field.label} is STALE (exceeds freshness TTL).`);
    } else if (m.state === 'INVALID') {
      invalidCount += 1;
      negativeDrivers.push(`${field.label} has INVALID input data.`);
    } else if (m.state === 'UNAVAILABLE' || m.unit === 'UNVERIFIED' || (isGrowthField && !growthVerified && m.state !== 'MISSING')) {
      unverifiedCount += 1;
      negativeDrivers.push(`${field.label} has UNVERIFIED unit/semantics (adds 0 confidence).`);
    } else {
      missingCount += 1;
      negativeDrivers.push(`${field.label} is MISSING.`);
    }
  }

  const completeness = roundToDecimals((completenessPoints / totalWeight) * 100, 1);
  const provenance = roundToDecimals((provenancePoints / totalWeight) * 100, 1);
  const freshness = roundToDecimals((freshnessPoints / totalWeight) * 100, 1);
  const validity = roundToDecimals((validityPoints / totalWeight) * 100, 1);

  const dimWeights = [
    { name: 'Demand', scored: dimensions.demandScore.score !== null, weight: 35 },
    {
      name: 'Earning',
      scored:
        dimensions.earningScore.score !== null ||
        dimensions.earningScore.status === 'NOT_MONETIZABLE',
      weight: 30,
    },
    { name: 'Competition', scored: dimensions.competitionScore.score !== null, weight: 25 },
    { name: 'Customer Quality', scored: dimensions.customerQualityScore.score !== null, weight: 10 },
  ];
  const dimensionCoverage = roundToDecimals(
    dimWeights.reduce((acc, d) => acc + (d.scored ? d.weight : 0), 0),
    1
  );

  if (usableCount >= 6) {
    positiveDrivers.push(`${usableCount}/8 core commercial inputs are verified fresh SOURCE metrics.`);
  } else if (usableCount > 0) {
    positiveDrivers.push(`${usableCount}/8 core commercial inputs are verified fresh SOURCE metrics.`);
  }
  if (
    dimensions.demandScore.score !== null &&
    dimensions.earningScore.score !== null &&
    dimensions.competitionScore.score !== null
  ) {
    positiveDrivers.push('All 3 core commercial pillars (Demand, Earning, Competition) have verified evidence.');
  }

  let rawConfidence =
    0.32 * completeness +
    0.22 * provenance +
    0.16 * freshness +
    0.12 * validity +
    0.18 * dimensionCoverage;

  // Explicit penalties for severe reliability issues & missing core commercial pillars
  if (syntheticPrimaryCount > 0) {
    rawConfidence -= Math.min(28, syntheticPrimaryCount * 15);
  }
  if (staleCount > 0) {
    rawConfidence -= Math.min(35, staleCount * 10);
  }
  if (invalidCount > 0) {
    rawConfidence -= Math.min(25, invalidCount * 8);
  }
  if (dimensions.demandScore.score === null) {
    rawConfidence -= 15;
  }
  if (
    dimensions.earningScore.score === null &&
    dimensions.earningScore.status !== 'NOT_MONETIZABLE'
  ) {
    rawConfidence -= 15;
  }
  if (dimensions.competitionScore.score === null) {
    rawConfidence -= 15;
  }
  if (dimensions.customerQualityScore.score === null) {
    rawConfidence -= 6;
  }

  const conflicts = detectMetricConflicts(metrics);
  for (const driver of conflicts.drivers) {
    negativeDrivers.push(driver);
  }
  if (conflicts.confidencePenalty > 0) {
    rawConfidence -= Math.min(25, conflicts.confidencePenalty);
  }

  const score = Math.round(clamp(rawConfidence, 0, 100));
  const level: ConfidenceLevel =
    score >= 80 ? 'HIGH' : score >= 55 ? 'MEDIUM' : score >= 30 ? 'LOW' : 'VERY_LOW';

  const explanation =
    negativeDrivers.length === 0
      ? `High reliability (${score}/100): all core commercial inputs are fresh verified SOURCE metrics.`
      : `Confidence ${level} (${score}/100): ${usableCount}/8 verified SOURCE inputs; gaps/penalties: ${negativeDrivers.slice(0, 3).join(' ')}`;

  return {
    score,
    level,
    breakdown: {
      completeness,
      provenance,
      freshness,
      validity,
      dimensionCoverage,
    },
    positiveDrivers,
    negativeDrivers,
    explanation,
  };
}

/**
 * Separate Conversion Evidence tracker (video vs live channel attribution).
 * Never mixed into Commercial Opportunity Score and never claims user conversion guarantees.
 */
export function extractConversionEvidence(
  metrics: ProductValidatedMetrics
): ConversionEvidenceResult {
  const videoMetric = metrics.videoRevenueThb7d;
  const liveMetric = metrics.liveRevenueThb7d;
  const totalMetric = metrics.revenueThb7d;

  const videoUsable = isUsableScoringMetric(videoMetric) && videoMetric.unit === 'THB';
  const liveUsable = isUsableScoringMetric(liveMetric) && liveMetric.unit === 'THB';
  const totalUsable = isUsableScoringMetric(totalMetric) && totalMetric.unit === 'THB';

  const totalRev = totalUsable ? totalMetric.value : null;
  const videoRev = videoUsable ? videoMetric.value : null;
  const liveRev = liveUsable ? liveMetric.value : null;

  let videoRevenueShare: number | null = null;
  let liveRevenueShare: number | null = null;

  if (totalRev !== null && totalRev > 0) {
    if (videoRev !== null && videoRev <= totalRev * 1.05) {
      videoRevenueShare = roundToDecimals(clamp(videoRev / totalRev, 0, 1), 4);
    }
    if (liveRev !== null && liveRev <= totalRev * 1.05) {
      liveRevenueShare = roundToDecimals(clamp(liveRev / totalRev, 0, 1), 4);
    }
  }

  let dominantChannel: DominantConversionChannel = 'UNKNOWN';
  if (videoRev !== null && liveRev !== null) {
    if (videoRev === 0 && liveRev === 0) {
      dominantChannel = 'UNKNOWN';
    } else if (videoRev >= liveRev * 1.5 && videoRev > 0) {
      dominantChannel = 'VIDEO';
    } else if (liveRev >= videoRev * 1.5 && liveRev > 0) {
      dominantChannel = 'LIVE';
    } else {
      dominantChannel = 'BALANCED';
    }
  } else if (videoRevenueShare !== null) {
    dominantChannel = videoRevenueShare >= 0.45 ? 'VIDEO' : videoRevenueShare === 0 ? 'UNKNOWN' : 'BALANCED';
  }

  let evidenceLevel: ConversionEvidenceLevel = 'INSUFFICIENT';
  let consistencyNote: string;

  const channelExceedsTotal =
    totalRev !== null &&
    ((videoRev !== null && videoRev > Math.max(100, totalRev * 1.05)) ||
      (liveRev !== null && liveRev > Math.max(100, totalRev * 1.05)));

  if (!videoUsable && !liveUsable) {
    consistencyNote = 'Video and Live channel revenue metrics are unavailable.';
  } else if (channelExceedsTotal) {
    evidenceLevel = 'WEAK';
    consistencyNote =
      'Inconsistent channel revenue: video or live revenue exceeds total reported revenue beyond tolerance.';
  } else if (videoRev === 0 && (liveRev === null || liveRev === 0)) {
    evidenceLevel = 'WEAK';
    consistencyNote = 'Zero verified video/live affiliate channel revenue reported in this window.';
  } else if (videoRev !== null && videoRev >= 50_000 && (videoRevenueShare === null || videoRevenueShare >= 0.35)) {
    evidenceLevel = 'STRONG';
    consistencyNote = `Strong existing short-video channel revenue (฿${videoRev.toLocaleString('en-US')}${videoRevenueShare !== null ? `, ${Math.round(videoRevenueShare * 100)}% share` : ''}).`;
  } else if ((videoRev ?? 0) > 0 || (liveRev ?? 0) > 0) {
    evidenceLevel = 'MODERATE';
    consistencyNote = `Partial channel conversion evidence across ${dominantChannel.toLowerCase()} revenue.`;
  } else {
    consistencyNote = 'Limited channel revenue evidence available.';
  }

  return {
    videoRevenueThb: videoMetric,
    liveRevenueThb: liveMetric,
    totalRevenueThb: totalMetric,
    videoRevenueShare,
    liveRevenueShare,
    dominantChannel,
    evidenceLevel,
    consistencyNote,
    disclaimer:
      'Conversion evidence reflects past channel sales only. It does not guarantee an individual creator will achieve similar conversion and is excluded from the Commercial Opportunity Score.',
  };
}

export function resolveMetricsInput(
  input: ProductValidatedMetrics | ProductItem,
  config: CommercialScoringV2Config
): ProductValidatedMetrics {
  const isValidatedMetrics = (
    val: ProductValidatedMetrics | ProductItem
  ): val is ProductValidatedMetrics =>
    'priceThb' in val &&
    typeof val.priceThb === 'object' &&
    val.priceThb !== null &&
    'state' in val.priceThb;

  const baseMetrics = isValidatedMetrics(input)
    ? input
    : adaptProductItemToValidatedMetrics(input, {
        staleAfterMs: config.staleAfterMs,
        nowMs: config.nowMs,
      });

  return normalizeValidatedMetricsWithFreshness(baseMetrics, config);
}

function collectMissingMetricKeys(
  metrics: ProductValidatedMetrics,
  growthStatus: V2GrowthStatus
): string[] {
  const missing: string[] = [];
  const check = (key: string, metric: ValidatedMetric<number>) => {
    if (!isUsableScoringMetric(metric)) {
      missing.push(key);
    }
  };
  check('priceThb', metrics.priceThb);
  check('commissionRate', metrics.commissionRate);
  check('salesVolume7d', metrics.salesVolume7d);
  check('revenueThb7d', metrics.revenueThb7d);
  if (growthStatus !== 'VERIFIED') {
    missing.push('revenueGrowthRate');
  }
  check('creatorCount', metrics.creatorCount);
  check('rating', metrics.rating);
  check('reviewCount', metrics.reviewCount);
  return missing;
}

/**
 * Pure deterministic Commercial Scoring Engine V2 entry point.
 * Combines 4 independent dimensions using weighted geometric aggregation,
 * explicit eligibility gates, critical weakness caps/penalties, and separate Data Confidence.
 */
export function evaluateProductCommercialV2(
  input: ProductValidatedMetrics | ProductItem,
  configInput?: PartialCommercialScoringV2Config
): CommercialScoreV2Result {
  const config = resolveScoringV2Config(configInput);
  const metrics = resolveMetricsInput(input, config);

  const demandScore = scoreDemandDimension(metrics, config);
  const earningScore = scoreEarningDimension(metrics, demandScore, config);
  const competitionScore = scoreCompetitionDimension(metrics, config);
  const customerQualityScore = scoreCustomerQualityDimension(metrics, config);

  const dataConfidence = computeDataConfidence(
    metrics,
    {
      demandScore,
      earningScore,
      competitionScore,
      customerQualityScore,
    },
    config
  );
  const conversionEvidence = extractConversionEvidence(metrics);

  const missingMetrics = collectMissingMetricKeys(metrics, demandScore.growthStatus);
  const conflictCheck = detectMetricConflicts(metrics);
  const riskTags: string[] = [...conflictCheck.riskTags];
  const opportunityTags: string[] = [];
  const gateDecisions: string[] = [];

  if (
    metrics.revenueThb7d.provenance === 'SYNTHETIC' &&
    (metrics.revenueThb7d.state === 'OK' || metrics.revenueThb7d.state === 'ZERO')
  ) {
    riskTags.push('SYNTHETIC_REVENUE');
  }
  if (
    metrics.revenueThb7d.state === 'STALE' ||
    metrics.salesVolume7d.state === 'STALE' ||
    metrics.commissionRate.state === 'STALE' ||
    metrics.creatorCount.state === 'STALE'
  ) {
    riskTags.push('STALE_DATA');
  }

  // Opportunity & Risk tags from independent dimensions
  if (demandScore.score !== null) {
    if (demandScore.score >= 70) {
      opportunityTags.push('HIGH_DEMAND');
    } else if (demandScore.score < config.demand.weakDemandThreshold) {
      riskTags.push('WEAK_DEMAND');
    }
  }
  if (
    demandScore.growthStatus === 'VERIFIED' &&
    demandScore.subcomponents.verifiedGrowthPercent !== null
  ) {
    if (demandScore.subcomponents.verifiedGrowthPercent >= 20) {
      opportunityTags.push('POSITIVE_GROWTH');
    } else if (demandScore.subcomponents.verifiedGrowthPercent <= -15) {
      riskTags.push('NEGATIVE_GROWTH');
    }
  }
  if (earningScore.status === 'NOT_MONETIZABLE') {
    riskTags.push('ZERO_COMMISSION', 'NOT_MONETIZABLE');
  } else if (earningScore.score !== null && earningScore.score >= 70) {
    opportunityTags.push('ATTRACTIVE_EARNING');
  }
  if (competitionScore.score !== null) {
    if (
      competitionScore.score >= 70 &&
      competitionScore.riskFlag !== 'ZERO_CREATORS_POSITIVE_REVENUE'
    ) {
      opportunityTags.push('LOW_COMPETITION');
    }
    if ((competitionScore.adjustedRpcThb ?? 0) >= 15_000) {
      opportunityTags.push('STRONG_RPC');
    }
    if (competitionScore.riskFlag) {
      riskTags.push(competitionScore.riskFlag);
    }
  }
  if (customerQualityScore.score !== null) {
    if (
      customerQualityScore.score >= 78 &&
      customerQualityScore.riskFlag === null
    ) {
      opportunityTags.push('STRONG_CUSTOMER_QUALITY');
    }
    if (customerQualityScore.riskFlag) {
      riskTags.push(customerQualityScore.riskFlag);
    }
  }

  // Hybrid Aggregation + Explicit Eligibility Gates
  const agg = config.aggregation;
  const w = agg.weights;

  let eligibilityStatus: CommercialEligibilityStatus;
  let commercialOpportunityScore: number | null;
  let aggregationMethod =
    'Weighted geometric mean + explicit eligibility gates and weakness caps (no average imputation)';

  const scoredDimCount = [
    demandScore.score !== null,
    earningScore.score !== null,
    competitionScore.score !== null,
    customerQualityScore.score !== null,
  ].filter(Boolean).length;

  // Gate 1: Verified 0% commission -> NOT_MONETIZABLE
  if (earningScore.status === 'NOT_MONETIZABLE') {
    eligibilityStatus = 'NOT_MONETIZABLE';
    commercialOpportunityScore = 0;
    gateDecisions.push('Gate NOT_MONETIZABLE: Verified 0% commission forces commercial score to 0.');
  }
  // Gate 2: Missing Demand or Earning, or >= 2 missing dimensions -> INSUFFICIENT_DATA
  else if (
    demandScore.score === null ||
    earningScore.score === null ||
    scoredDimCount <= 2
  ) {
    eligibilityStatus = 'INSUFFICIENT_DATA';
    commercialOpportunityScore = null;
    if (demandScore.score === null) {
      riskTags.push('MISSING_DEMAND_DATA');
    }
    if (earningScore.score === null) {
      riskTags.push('MISSING_EARNING_DATA');
    }
    if (competitionScore.score === null) {
      riskTags.push('MISSING_COMPETITION_DATA');
    }
    gateDecisions.push(
      'Gate INSUFFICIENT_DATA: Cannot compute commercial score without verified Demand, Earning, and >= 3 of 4 commercial dimensions (missing metrics are never replaced with averages).'
    );
  } else {
    // At least 3 of 4 dimensions are scored, including Demand and Earning
    const presentPairs: Array<{ score: number; weight: number; key: string }> = [
      { score: demandScore.score, weight: w.demand, key: 'demand' },
      { score: earningScore.score, weight: w.earning, key: 'earning' },
    ];
    if (competitionScore.score !== null) {
      presentPairs.push({ score: competitionScore.score, weight: w.competition, key: 'competition' });
    }
    if (customerQualityScore.score !== null) {
      presentPairs.push({
        score: customerQualityScore.score,
        weight: w.customerQuality,
        key: 'customerQuality',
      });
    }

    const totalPresentWeight = presentPairs.reduce((sum, p) => sum + p.weight, 0);

    // Zero on Demand collapses commercial viability
    if (demandScore.score === 0) {
      commercialOpportunityScore = 0;
      eligibilityStatus = 'RESTRICTED_WEAK_DEMAND';
      gateDecisions.push('Gate RESTRICTED_WEAK_DEMAND: Zero verified demand collapses opportunity to 0.');
    } else {
      const logWeightedSum = presentPairs.reduce((acc, p) => {
        const normalizedWeight = p.weight / totalPresentWeight;
        const floored = Math.max(agg.geometricFloor, p.score) / 100;
        return acc + normalizedWeight * Math.log(floored);
      }, 0);
      let score = 100 * Math.exp(logWeightedSum);

      if (competitionScore.score === null) {
        // Missing Competition while Demand, Earning, Quality exist: partial evidence only, strictly capped
        eligibilityStatus = 'PARTIAL_EVIDENCE';
        riskTags.push('MISSING_COMPETITION_DATA');
        score = Math.min(agg.missingCompetitionCap, score * 0.78);
        gateDecisions.push(
          `Gate PARTIAL_EVIDENCE: Missing verified creator competition data caps score at ${agg.missingCompetitionCap} and blocks top-tier eligibility.`
        );
      } else {
        eligibilityStatus = 'ELIGIBLE';
        if (customerQualityScore.score === null) {
          riskTags.push('UNVERIFIED_CUSTOMER_QUALITY');
          score = Math.min(agg.missingQualityCap, score * agg.missingQualityMultiplier);
          gateDecisions.push(
            `Prudence discount: Unverified customer rating/reviews apply ${agg.missingQualityMultiplier}x factor and cap at ${agg.missingQualityCap}.`
          );
        }
      }

      // Critical Weakness Gate: Very Weak Demand
      if (demandScore.score < config.demand.weakDemandThreshold) {
        eligibilityStatus = 'RESTRICTED_WEAK_DEMAND';
        score = Math.min(agg.weakDemandCap, score);
        gateDecisions.push(
          `Gate RESTRICTED_WEAK_DEMAND: Demand (${demandScore.score}) < ${config.demand.weakDemandThreshold} caps commercial opportunity at ${agg.weakDemandCap}.`
        );
      }

      // Critical Weakness Gate: Verified Poor Customer Quality
      if (customerQualityScore.riskFlag === 'POOR_CUSTOMER_QUALITY') {
        if (eligibilityStatus === 'ELIGIBLE' || eligibilityStatus === 'PARTIAL_EVIDENCE') {
          eligibilityStatus = 'RESTRICTED_POOR_QUALITY';
        }
        score = Math.min(agg.poorQualityCap, score * agg.poorQualityMultiplier);
        gateDecisions.push(
          `Gate RESTRICTED_POOR_QUALITY: Verified low rating across ${customerQualityScore.reviewCount} reviews applies ${agg.poorQualityMultiplier}x penalty and caps at ${agg.poorQualityCap}.`
        );
      }

      // Critical Weakness Gate: Extreme Competition
      if (
        competitionScore.score !== null &&
        (competitionScore.riskFlag === 'EXTREME_COMPETITION' ||
          competitionScore.score < config.competition.extremeCompetitionThreshold)
      ) {
        score = Math.min(agg.highCompetitionCap, score);
        gateDecisions.push(
          `Gate EXTREME_COMPETITION: Heavy creator saturation (competition ${competitionScore.score}, ${competitionScore.creatorCount} creators) caps score at ${agg.highCompetitionCap}.`
        );
      }

      // Caution Caps: Zero Creators with Positive Revenue / Low Review Sample
      if (competitionScore.riskFlag === 'ZERO_CREATORS_POSITIVE_REVENUE') {
        score = Math.min(agg.zeroCreatorOverallCap, score);
        gateDecisions.push(
          `Caution cap: 0 reported creators with positive revenue caps score at ${agg.zeroCreatorOverallCap}.`
        );
      }
      if (customerQualityScore.riskFlag === 'LOW_REVIEW_SAMPLE') {
        score = Math.min(agg.lowReviewSampleOverallCap, score);
        gateDecisions.push(
          `Caution cap: Low review count (n=${customerQualityScore.reviewCount}) caps score at ${agg.lowReviewSampleOverallCap}.`
        );
      }

      commercialOpportunityScore = Math.round(clamp(score, 0, 100));
    }
  }

  const isTopTierEligible =
    eligibilityStatus === 'ELIGIBLE' &&
    commercialOpportunityScore !== null &&
    commercialOpportunityScore >= agg.topTierMinScore &&
    competitionScore.score !== null &&
    competitionScore.riskFlag !== 'ZERO_CREATORS_POSITIVE_REVENUE';

  const dedupedRiskTags = Array.from(new Set(riskTags));
  const dedupedOpportunityTags = Array.from(new Set(opportunityTags));

  const scoreExplanation: CommercialScoreExplanation = {
    summary:
      commercialOpportunityScore === null
        ? `Commercial score withheld (${eligibilityStatus}); ${missingMetrics.length} metrics missing or unverified.`
        : `Commercial Opportunity ${commercialOpportunityScore}/100 (${eligibilityStatus}; Confidence ${dataConfidence.level} ${dataConfidence.score}/100).`,
    aggregationMethod,
    gateDecisions,
    dimensionDetails: {
      demand:
        demandScore.score === null
          ? `INSUFFICIENT (${demandScore.notes[0] ?? 'missing data'})`
          : `${demandScore.score}/100 (absolute=${demandScore.subcomponents.absoluteDemandScore}, growth=${demandScore.subcomponents.growthScore ?? demandScore.growthStatus})`,
      earning:
        earningScore.score === null
          ? `INSUFFICIENT (${earningScore.notes[0] ?? 'missing commission'})`
          : `${earningScore.score}/100 (${earningScore.verifiedCommissionPercent}% -> ฿${earningScore.payoutPerSaleThb}/sale, status=${earningScore.status})`,
      competition:
        competitionScore.score === null
          ? `INSUFFICIENT (${competitionScore.notes[0] ?? 'missing creator count'})`
          : `${competitionScore.score}/100 (creators=${competitionScore.creatorCount}, rawRPC=${competitionScore.rawRpcThb === null ? 'N/A' : `฿${competitionScore.rawRpcThb}`}, adjRPC=฿${competitionScore.adjustedRpcThb})`,
      customerQuality:
        customerQualityScore.score === null
          ? `INSUFFICIENT (${customerQualityScore.notes[0] ?? 'missing reviews'})`
          : `${customerQualityScore.score}/100 (raw=${customerQualityScore.rawRating}, n=${customerQualityScore.reviewCount}, bayesian=${customerQualityScore.bayesianRating})`,
    },
    confidenceSummary: dataConfidence.explanation,
    conversionNote: `${conversionEvidence.consistencyNote} ${conversionEvidence.disclaimer}`,
  };

  return {
    engineVersion: 'v2',
    demandScore,
    earningScore,
    competitionScore,
    customerQualityScore,
    commercialOpportunityScore,
    rawRpcThb: competitionScore.rawRpcThb,
    adjustedRpcThb: competitionScore.adjustedRpcThb,
    dataConfidence,
    conversionEvidence,
    eligibilityStatus,
    isTopTierEligible,
    riskTags: dedupedRiskTags,
    opportunityTags: dedupedOpportunityTags,
    missingMetrics,
    scoreExplanation,
  };
}

/**
 * Evaluates a pool of products deterministically using absolute reference scales.
 * Never destabilizes rankings with small-pool percentiles; explicitly flags small pools.
 */
export function evaluateProductPoolCommercialV2<
  TItem extends
    | ProductItem
    | ProductValidatedMetrics
    | { id?: string; validatedMetrics: ProductValidatedMetrics }
>(
  items: TItem[],
  configInput?: PartialCommercialScoringV2Config
): CommercialPoolEvaluationResult<TItem> {
  const config = resolveScoringV2Config(configInput);
  const poolSize = items.length;
  const smallPoolWarning = poolSize < config.aggregation.smallPoolWarningThreshold;

  const results: Array<CommercialPoolProductResult<TItem>> = items.map((item, idx) => {
    const id = 'id' in item && typeof item.id === 'string' && item.id ? item.id : `item_${idx}`;
    let score: CommercialScoreV2Result;
    if ('thaiTitle' in item) {
      score = evaluateProductCommercialV2(item as ProductItem, config);
    } else if ('validatedMetrics' in item && item.validatedMetrics) {
      score = evaluateProductCommercialV2(item.validatedMetrics, config);
    } else {
      score = evaluateProductCommercialV2(item as ProductValidatedMetrics, config);
    }
    return {
      item,
      productId: id,
      score,
    };
  });

  return {
    poolSize,
    smallPoolWarning,
    poolNotice: smallPoolWarning
      ? `Small product pool (n=${poolSize} < ${config.aggregation.smallPoolWarningThreshold}): scores use deterministic absolute reference curves rather than unstable in-pool percentiles.`
      : `Evaluated pool of ${poolSize} products using deterministic absolute reference curves.`,
    results,
  };
}

const ELIGIBILITY_RANK_PRIORITY: Record<CommercialEligibilityStatus, number> = {
  ELIGIBLE: 5,
  PARTIAL_EVIDENCE: 4,
  RESTRICTED_WEAK_DEMAND: 3,
  RESTRICTED_POOR_QUALITY: 2,
  INSUFFICIENT_DATA: 1,
  NOT_MONETIZABLE: 0,
};

function isBetterDuplicateCandidate<TItem>(
  candidate: CommercialPoolProductResult<TItem>,
  existing: CommercialPoolProductResult<TItem>
): boolean {
  const confDiff = candidate.score.dataConfidence.score - existing.score.dataConfidence.score;
  if (confDiff !== 0) return confDiff > 0;

  const tierDiff =
    ELIGIBILITY_RANK_PRIORITY[candidate.score.eligibilityStatus] -
    ELIGIBILITY_RANK_PRIORITY[existing.score.eligibilityStatus];
  if (tierDiff !== 0) return tierDiff > 0;

  const scoreDiff =
    (candidate.score.commercialOpportunityScore ?? -1) -
    (existing.score.commercialOpportunityScore ?? -1);
  if (scoreDiff !== 0) return scoreDiff > 0;

  return false;
}

/**
 * Deterministically ranks evaluated V2 commercial opportunities.
 * Excludes/demotes NOT_MONETIZABLE and INSUFFICIENT_DATA below monetizable candidates.
 * Deduplicates identical productIds deterministically.
 */
export function rankCommercialOpportunitiesV2<
  TItem extends
    | ProductItem
    | ProductValidatedMetrics
    | { id?: string; validatedMetrics: ProductValidatedMetrics }
>(
  items: TItem[],
  configInput?: PartialCommercialScoringV2Config
): CommercialPoolEvaluationResult<TItem> {
  const evaluated = evaluateProductPoolCommercialV2(items, configInput);
  const dedupMap = new Map<string, CommercialPoolProductResult<TItem>>();
  for (const res of evaluated.results) {
    const existing = dedupMap.get(res.productId);
    if (!existing || isBetterDuplicateCandidate(res, existing)) {
      dedupMap.set(res.productId, res);
    }
  }
  const sortedResults = Array.from(dedupMap.values()).sort((a, b) => {
    const tierDiff =
      ELIGIBILITY_RANK_PRIORITY[b.score.eligibilityStatus] -
      ELIGIBILITY_RANK_PRIORITY[a.score.eligibilityStatus];
    if (tierDiff !== 0) return tierDiff;

    const scoreDiff =
      (b.score.commercialOpportunityScore ?? -1) -
      (a.score.commercialOpportunityScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;

    const confDiff = b.score.dataConfidence.score - a.score.dataConfidence.score;
    if (confDiff !== 0) return confDiff;

    return a.productId.localeCompare(b.productId);
  });

  const config = resolveScoringV2Config(configInput);
  const dedupSize = sortedResults.length;
  return {
    ...evaluated,
    poolSize: dedupSize,
    smallPoolWarning: dedupSize < config.aggregation.smallPoolWarningThreshold,
    results: sortedResults,
  };
}
