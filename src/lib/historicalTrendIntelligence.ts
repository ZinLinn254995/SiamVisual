import type {
  HistoricalMetricObservationPoint,
  HistoricalMetricTrendResult,
  HistoricalProductTrendReport,
  HistoricalTrendBaselineStatus,
  HistoricalTrendClassification,
  HistoricalTrendExcludedCounts,
  HistoricalTrendIncomparabilityReason,
  HistoricalTrendMetricKey,
  MetricUnit,
  ObservationMetricKey,
  ProductMetricSourceEndpoint,
  ProductObservationSnapshot,
} from '../types/metrics.ts';
import { validateMetricTimestamp } from './metricFoundation.ts';

export interface HistoricalMetricRuleConfig {
  observationKey: ObservationMetricKey;
  unit: MetricUnit;
  label: string;
  /** Minimum percentage delta (positive) to classify as RISING (ignored when useAbsolutePointsThreshold is true). */
  risingMinPct: number;
  /** Maximum percentage delta (negative) to classify as DECLINING (ignored when useAbsolutePointsThreshold is true). */
  decliningMaxPct: number;
  /** Minimum absolute delta in native unit to prevent micro-rounding noise from triggering RISING/DECLINING. */
  minAbsDelta: number;
  /** For percentage-point metrics (commissionRate), evaluate direction directly in percentage points. */
  useAbsolutePointsThreshold?: boolean;
  /** Minimum relative swing (%) or step reversal magnitude to classify a >=3-point oscillating series as VOLATILE. */
  volatileMinSwingPct: number;
  /** Minimum per-leg magnitude (%) on BOTH rising and falling legs to treat a direction reversal as material volatility. */
  volatileMinLegPct: number;
  /** Minimum absolute swing in native unit required for VOLATILE. */
  volatileMinAbsSwing: number;
}

export interface HistoricalTrendConfig {
  minObservations: number;
  minSpanHours: number;
  minPointsForVolatile: number;
  metrics: Record<HistoricalTrendMetricKey, HistoricalMetricRuleConfig>;
}

export const HISTORICAL_TREND_METRIC_KEYS: readonly HistoricalTrendMetricKey[] = [
  'revenue',
  'salesVolume',
  'videoRevenue',
  'liveRevenue',
  'shoppingMallRevenue',
  'unitPrice',
  'commissionRate',
] as const;

export const DEFAULT_HISTORICAL_TREND_CONFIG: HistoricalTrendConfig = {
  minObservations: 2,
  minSpanHours: 12,
  minPointsForVolatile: 3,
  metrics: {
    revenue: {
      observationKey: 'revenueThb',
      unit: 'THB',
      label: 'Revenue (7d)',
      risingMinPct: 5,
      decliningMaxPct: -5,
      minAbsDelta: 100,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 12,
      volatileMinAbsSwing: 500,
    },
    salesVolume: {
      observationKey: 'salesVolume',
      unit: 'COUNT',
      label: 'Sales Volume (7d)',
      risingMinPct: 5,
      decliningMaxPct: -5,
      minAbsDelta: 2,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 12,
      volatileMinAbsSwing: 5,
    },
    videoRevenue: {
      observationKey: 'videoRevenueThb',
      unit: 'THB',
      label: 'Video Revenue (7d)',
      risingMinPct: 5,
      decliningMaxPct: -5,
      minAbsDelta: 100,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 12,
      volatileMinAbsSwing: 500,
    },
    liveRevenue: {
      observationKey: 'liveRevenueThb',
      unit: 'THB',
      label: 'Live Revenue (7d)',
      risingMinPct: 5,
      decliningMaxPct: -5,
      minAbsDelta: 100,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 12,
      volatileMinAbsSwing: 500,
    },
    shoppingMallRevenue: {
      observationKey: 'shoppingMallRevenueThb',
      unit: 'THB',
      label: 'Showcase / Mall Revenue (7d)',
      risingMinPct: 5,
      decliningMaxPct: -5,
      minAbsDelta: 100,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 12,
      volatileMinAbsSwing: 500,
    },
    unitPrice: {
      observationKey: 'unitPriceThb',
      unit: 'THB',
      label: 'Unit Price',
      risingMinPct: 2,
      decliningMaxPct: -2,
      minAbsDelta: 1,
      volatileMinSwingPct: 8,
      volatileMinLegPct: 4,
      volatileMinAbsSwing: 5,
    },
    commissionRate: {
      observationKey: 'commissionRate',
      unit: 'PERCENT',
      label: 'Commission Rate',
      risingMinPct: 0,
      decliningMaxPct: 0,
      minAbsDelta: 1, // >= 1.0 percentage point change
      useAbsolutePointsThreshold: true,
      volatileMinSwingPct: 20,
      volatileMinLegPct: 10,
      volatileMinAbsSwing: 2, // >= 2.0 percentage points swing with reversal
    },
  },
};

export interface AnalyzeHistoricalTrendsOptions {
  /** Expected productId; snapshots with a different productId are excluded as PRODUCT_IDENTITY_MISMATCH. */
  productId?: string;
  /** Target dateRange (e.g. 'last7Day'). When omitted, inferred ONLY if all local snapshots share one dateRange. */
  dateRange?: string;
  /** Reference timestamp for rejecting future observations (defaults to Date.now()). */
  nowMs?: number;
  /** Override minimum observation count or span hours. */
  minObservations?: number;
  minSpanHours?: number;
  /** Optional config override. */
  config?: Partial<Pick<HistoricalTrendConfig, 'minObservations' | 'minSpanHours' | 'minPointsForVolatile'>>;
}

type ProvenanceFamily = 'kalodata_openapi_v1' | 'legacy_product' | 'unknown';

function getProvenanceFamily(endpoint: ProductMetricSourceEndpoint | undefined): ProvenanceFamily {
  if (endpoint === 'rank' || endpoint === 'detail') {
    return 'kalodata_openapi_v1';
  }
  if (endpoint === 'legacy_product') {
    return 'legacy_product';
  }
  return 'unknown';
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function dedupeReasons(
  reasons: HistoricalTrendIncomparabilityReason[]
): HistoricalTrendIncomparabilityReason[] {
  return Array.from(new Set(reasons));
}

function normalizeValidNonFutureIso(
  iso: string | null | undefined,
  nowMs: number
): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const check = validateMetricTimestamp(iso, { nowMs, staleAfterMs: -1 });
  if (!check.valid || check.future || !check.normalizedIso) return null;
  return check.normalizedIso;
}

function readObservationNumericValue(
  snapshot: ProductObservationSnapshot,
  obsKey: ObservationMetricKey
): number | null {
  const raw = snapshot.observations?.[obsKey];
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return null;
  }
  if (obsKey === 'commissionRate' && raw > 100) {
    return null;
  }
  return raw;
}

function buildEmptyMetricResult(
  metric: HistoricalTrendMetricKey,
  rule: HistoricalMetricRuleConfig,
  classification: 'INSUFFICIENT_HISTORY' | 'INCOMPARABLE_DATA',
  incomparabilityReasons: HistoricalTrendIncomparabilityReason[],
  points: HistoricalMetricObservationPoint[],
  explanation: string
): HistoricalMetricTrendResult {
  const earliest = points.length > 0 ? points[0] : null;
  const latest = points.length > 0 ? points[points.length - 1] : null;
  let spanHours: number | null = null;
  let spanDays: number | null = null;
  if (earliest && latest && points.length >= 2) {
    const diffMs = Date.parse(latest.observedAt) - Date.parse(earliest.observedAt);
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      spanHours = roundTo(diffMs / 3_600_000, 1);
      spanDays = roundTo(spanHours / 24, 1);
    }
  }

  return {
    metric,
    unit: rule.unit,
    provenance: 'DERIVED',
    classification,
    baselineStatus: 'NOT_APPLICABLE',
    pointCount: points.length,
    earliestValue: earliest ? earliest.value : null,
    latestValue: latest ? latest.value : null,
    earliestObservedAt: earliest ? earliest.observedAt : null,
    latestObservedAt: latest ? latest.observedAt : null,
    spanHours,
    spanDays,
    absoluteDelta: null,
    deltaPct: null,
    maxSwingPct: null,
    directionReversals: 0,
    incomparabilityReasons: dedupeReasons(incomparabilityReasons),
    points,
    explanation,
  };
}

function analyzeSingleMetricTrend(
  metric: HistoricalTrendMetricKey,
  snapshots: ProductObservationSnapshot[],
  targetDateRange: string | null,
  reportIncomparabilityReasons: HistoricalTrendIncomparabilityReason[],
  cfg: HistoricalTrendConfig,
  nowMs: number
): HistoricalMetricTrendResult {
  const rule = cfg.metrics[metric];
  const metricReasons: HistoricalTrendIncomparabilityReason[] = [];

  if (!targetDateRange) {
    const reasons = dedupeReasons(reportIncomparabilityReasons);
    const classification: 'INSUFFICIENT_HISTORY' | 'INCOMPARABLE_DATA' =
      reasons.length > 0 ? 'INCOMPARABLE_DATA' : 'INSUFFICIENT_HISTORY';
    return buildEmptyMetricResult(
      metric,
      rule,
      classification,
      reasons,
      [],
      reasons.length > 0
        ? `${rule.label}: Incomparable data (${reasons.join(', ')}).`
        : `${rule.label}: Insufficient trusted local history (requires ≥${cfg.minObservations} distinct-day observations).`
    );
  }

  const rawPoints: HistoricalMetricObservationPoint[] = [];
  const seenExactMetricTimestamps = new Set<string>();
  let duplicateMetricTimestampsSkipped = 0;

  for (const snap of snapshots) {
    const val = readObservationNumericValue(snap, rule.observationKey);
    if (val === null) continue;

    const meta = snap.metricMeta?.[rule.observationKey];
    if (meta?.dateRange && meta.dateRange.trim() !== targetDateRange) {
      metricReasons.push('DATE_RANGE_MISMATCH');
      continue;
    }

    if (meta?.unit && meta.unit !== rule.unit) {
      metricReasons.push('UNIT_MISMATCH');
      continue;
    }

    const endpoint = meta?.sourceEndpoint ?? snap.sourceEndpoint;

    // Resolve observation timestamp strictly: prefer per-metric fetchedAt if present; reject invalid/future.
    let pointIso: string | null = null;
    let precision: HistoricalMetricObservationPoint['timestampPrecision'] = 'SNAPSHOT_FALLBACK';

    if (meta && meta.fetchedAt !== null && meta.fetchedAt !== undefined) {
      const validMetricIso = normalizeValidNonFutureIso(meta.fetchedAt, nowMs);
      if (!validMetricIso) {
        metricReasons.push('INVALID_OR_FUTURE_TIMESTAMPS');
        continue;
      }
      pointIso = validMetricIso;
      precision = meta.timestampPrecision;
    } else if (meta && meta.timestampPrecision === 'UNKNOWN') {
      // Fall back to verified snapshot observedAt only if snapshot itself is valid; mark UNKNOWN precision
      pointIso = normalizeValidNonFutureIso(snap.observedAt, nowMs);
      precision = 'UNKNOWN';
    } else {
      pointIso = normalizeValidNonFutureIso(snap.observedAt, nowMs);
      precision = 'SNAPSHOT_FALLBACK';
    }

    if (!pointIso) {
      metricReasons.push('INVALID_OR_FUTURE_TIMESTAMPS');
      continue;
    }

    // Prevent stale re-recorded exact metric timestamps across different days from fabricating a trend
    if (precision === 'EXACT_METRIC') {
      if (seenExactMetricTimestamps.has(pointIso)) {
        duplicateMetricTimestampsSkipped += 1;
        metricReasons.push('DUPLICATE_METRIC_TIMESTAMP');
        continue;
      }
      seenExactMetricTimestamps.add(pointIso);
    }

    rawPoints.push({
      observedAt: pointIso,
      observationDay: pointIso.slice(0, 10),
      value: val,
      unit: rule.unit,
      sourceEndpoint: endpoint,
      dateRange: targetDateRange,
      timestampPrecision: precision,
    });
  }

  // Verify provenance family consistency across extracted metric points
  const provenanceFamilies = new Set(
    rawPoints.map((p) => getProvenanceFamily(p.sourceEndpoint))
  );
  let comparablePoints = rawPoints;

  if (provenanceFamilies.size > 1) {
    metricReasons.push('PROVENANCE_INCOMPATIBLE');
    const kalodataOnly = rawPoints.filter(
      (p) => getProvenanceFamily(p.sourceEndpoint) === 'kalodata_openapi_v1'
    );
    if (kalodataOnly.length >= cfg.minObservations) {
      comparablePoints = kalodataOnly;
    } else {
      comparablePoints = [];
    }
  }

  // Sort chronologically and deduplicate by UTC observationDay (keeping latest observation per UTC day)
  const byDay = new Map<string, HistoricalMetricObservationPoint>();
  for (const pt of comparablePoints
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))) {
    const existing = byDay.get(pt.observationDay);
    if (!existing || Date.parse(pt.observedAt) >= Date.parse(existing.observedAt)) {
      byDay.set(pt.observationDay, pt);
    }
  }

  const points = Array.from(byDay.values()).sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  );

  const combinedReasons = dedupeReasons([...reportIncomparabilityReasons, ...metricReasons]);

  if (points.length < cfg.minObservations) {
    const hasHardIncomparability =
      metricReasons.length > 0 ||
      (points.length < cfg.minObservations &&
        reportIncomparabilityReasons.length > 0 &&
        snapshots.length < cfg.minObservations);

    if (hasHardIncomparability) {
      const reasonList = combinedReasons.length > 0 ? combinedReasons : metricReasons;
      const dupNote =
        duplicateMetricTimestampsSkipped > 0
          ? ` (${duplicateMetricTimestampsSkipped} duplicate metric timestamp(s) excluded)`
          : '';
      return buildEmptyMetricResult(
        metric,
        rule,
        'INCOMPARABLE_DATA',
        reasonList,
        points,
        `${rule.label}: Incomparable data (${reasonList.join(', ')})${dupNote}.`
      );
    }

    return buildEmptyMetricResult(
      metric,
      rule,
      'INSUFFICIENT_HISTORY',
      [],
      points,
      `${rule.label}: Insufficient history (${points.length}/${cfg.minObservations} distinct trusted UTC day(s)).`
    );
  }

  const earliest = points[0];
  const latest = points[points.length - 1];
  const spanMs = Date.parse(latest.observedAt) - Date.parse(earliest.observedAt);
  const spanHours = roundTo(Math.max(0, spanMs) / 3_600_000, 1);
  const spanDays = roundTo(spanHours / 24, 1);

  if (spanHours < cfg.minSpanHours) {
    return buildEmptyMetricResult(
      metric,
      rule,
      'INSUFFICIENT_HISTORY',
      metricReasons,
      points,
      `${rule.label}: Observation span (${spanHours}h) is below minimum ${cfg.minSpanHours}h required for trend classification.`
    );
  }

  const absoluteDelta = roundTo(latest.value - earliest.value, 2);
  const allZero = points.every((p) => p.value === 0);

  let baselineStatus: HistoricalTrendBaselineStatus;
  let deltaPct: number | null = null;

  if (allZero) {
    baselineStatus = 'ALL_ZERO';
    deltaPct = null;
  } else if (earliest.value === 0) {
    baselineStatus = 'ZERO_BASELINE';
    // Percentage change from 0 is mathematically undefined; NEVER return Infinity, NaN, or fabricated %.
    deltaPct = null;
  } else {
    baselineStatus = 'POSITIVE_BASELINE';
    deltaPct = roundTo(((latest.value - earliest.value) / earliest.value) * 100, 1);
  }

  // Analyze step-by-step movements, peak-to-trough swing, and direction reversals
  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const absSwing = roundTo(maxVal - minVal, 2);
  const positiveValues = values.filter((v) => v > 0);
  const meanPositive =
    positiveValues.length > 0
      ? positiveValues.reduce((sum, v) => sum + v, 0) / positiveValues.length
      : 0;

  let maxSwingPct: number | null = null;
  if (allZero) {
    maxSwingPct = 0;
  } else if (meanPositive > 0) {
    maxSwingPct = roundTo((absSwing / meanPositive) * 100, 1);
  }

  // Detect material direction reversals across consecutive intervals
  let prevSign: -1 | 0 | 1 = 0;
  let directionReversals = 0;
  let maxUpLegPct = 0;
  let maxDownLegPct = 0;
  let maxUpLegAbs = 0;
  let maxDownLegAbs = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1].value;
    const curr = points[i].value;
    const stepDiff = curr - prev;
    const absStep = Math.abs(stepDiff);
    const stepBase = Math.max(prev, curr, meanPositive);
    const stepPct = stepBase > 0 ? (absStep / stepBase) * 100 : 0;

    const isMaterialStep = rule.useAbsolutePointsThreshold
      ? absStep >= rule.minAbsDelta * 0.75
      : absStep >= rule.minAbsDelta && stepPct >= Math.max(2, rule.risingMinPct * 0.6);

    if (!isMaterialStep) continue;

    const sign: -1 | 1 = stepDiff > 0 ? 1 : -1;
    if (sign > 0) {
      maxUpLegPct = Math.max(maxUpLegPct, stepPct);
      maxUpLegAbs = Math.max(maxUpLegAbs, absStep);
    } else {
      maxDownLegPct = Math.max(maxDownLegPct, stepPct);
      maxDownLegAbs = Math.max(maxDownLegAbs, absStep);
    }

    if (prevSign !== 0 && sign !== prevSign) {
      directionReversals += 1;
    }
    prevSign = sign;
  }

  // Deterministic classification
  let classification: HistoricalTrendClassification;
  let explanation: string;

  if (allZero) {
    classification = 'STABLE';
    explanation = `${rule.label}: Consistently 0 across ${points.length} observations (${spanDays}d); percentage change not applicable (ALL_ZERO).`;
  } else {
    const isVolatileByReversal =
      points.length >= cfg.minPointsForVolatile &&
      directionReversals >= 1 &&
      absSwing >= rule.volatileMinAbsSwing &&
      (rule.useAbsolutePointsThreshold
        ? maxUpLegAbs >= rule.minAbsDelta && maxDownLegAbs >= rule.minAbsDelta
        : maxUpLegPct >= rule.volatileMinLegPct &&
          maxDownLegPct >= rule.volatileMinLegPct &&
          (maxSwingPct ?? 0) >= rule.volatileMinSwingPct);

    if (isVolatileByReversal) {
      classification = 'VOLATILE';
      const zeroNote =
        baselineStatus === 'ZERO_BASELINE'
          ? ' (started from 0 baseline; % change undefined)'
          : deltaPct !== null
            ? ` (net ${deltaPct > 0 ? '+' : ''}${deltaPct}%)`
            : '';
      explanation = `${rule.label}: Volatile across ${points.length} observations (${spanDays}d) with ${directionReversals} material reversal(s) and ${maxSwingPct ?? 0}% swing${zeroNote}.`;
    } else if (baselineStatus === 'ZERO_BASELINE') {
      if (latest.value >= rule.minAbsDelta) {
        classification = 'RISING';
        explanation = `${rule.label}: Rising from 0 baseline (+${absoluteDelta} ${rule.unit} over ${spanDays}d); percentage growth is undefined (ZERO_BASELINE).`;
      } else {
        classification = 'STABLE';
        explanation = `${rule.label}: Near-zero change from 0 baseline (+${absoluteDelta} ${rule.unit} over ${spanDays}d); percentage growth is undefined (ZERO_BASELINE).`;
      }
    } else if (rule.useAbsolutePointsThreshold) {
      if (absoluteDelta >= rule.minAbsDelta) {
        classification = 'RISING';
        explanation = `${rule.label}: Rising +${absoluteDelta}pp (${earliest.value}% → ${latest.value}%) over ${spanDays}d.`;
      } else if (absoluteDelta <= -rule.minAbsDelta) {
        classification = 'DECLINING';
        explanation = `${rule.label}: Declining ${absoluteDelta}pp (${earliest.value}% → ${latest.value}%) over ${spanDays}d.`;
      } else {
        classification = 'STABLE';
        explanation = `${rule.label}: Stable (${earliest.value}% → ${latest.value}%, ${absoluteDelta >= 0 ? '+' : ''}${absoluteDelta}pp) over ${spanDays}d.`;
      }
    } else {
      const pct = deltaPct ?? 0;
      if (pct >= rule.risingMinPct && absoluteDelta >= rule.minAbsDelta) {
        classification = 'RISING';
        explanation = `${rule.label}: Rising +${pct}% (+${absoluteDelta} ${rule.unit}) across ${points.length} observations (${spanDays}d).`;
      } else if (pct <= rule.decliningMaxPct && Math.abs(absoluteDelta) >= rule.minAbsDelta) {
        classification = 'DECLINING';
        explanation = `${rule.label}: Declining ${pct}% (${absoluteDelta} ${rule.unit}) across ${points.length} observations (${spanDays}d).`;
      } else {
        classification = 'STABLE';
        explanation = `${rule.label}: Stable (${pct >= 0 ? '+' : ''}${pct}%, ${absoluteDelta >= 0 ? '+' : ''}${absoluteDelta} ${rule.unit}) across ${points.length} observations (${spanDays}d).`;
      }
    }
  }

  return {
    metric,
    unit: rule.unit,
    provenance: 'DERIVED',
    classification,
    baselineStatus,
    pointCount: points.length,
    earliestValue: earliest.value,
    latestValue: latest.value,
    earliestObservedAt: earliest.observedAt,
    latestObservedAt: latest.observedAt,
    spanHours,
    spanDays,
    absoluteDelta,
    deltaPct,
    maxSwingPct,
    directionReversals,
    incomparabilityReasons: dedupeReasons(metricReasons),
    points,
    explanation,
  };
}

function isActionableTrend(cls: HistoricalTrendClassification): boolean {
  return cls === 'RISING' || cls === 'STABLE' || cls === 'DECLINING' || cls === 'VOLATILE';
}

function synthesizeOverallTrend(
  metrics: Record<HistoricalTrendMetricKey, HistoricalMetricTrendResult>,
  comparableSnapshotCount: number,
  reportIncomparabilityReasons: HistoricalTrendIncomparabilityReason[],
  minObservations: number
): { overallTrend: HistoricalTrendClassification; overallExplanation: string } {
  const rev = metrics.revenue;
  const sales = metrics.salesVolume;

  if (comparableSnapshotCount < minObservations) {
    if (reportIncomparabilityReasons.length > 0) {
      return {
        overallTrend: 'INCOMPARABLE_DATA',
        overallExplanation: `Historical snapshots cannot be compared (${reportIncomparabilityReasons.join(', ')}).`,
      };
    }
    return {
      overallTrend: 'INSUFFICIENT_HISTORY',
      overallExplanation: `Insufficient trusted local history (${comparableSnapshotCount}/${minObservations} comparable UTC-day observations).`,
    };
  }

  const revActionable = isActionableTrend(rev.classification);
  const salesActionable = isActionableTrend(sales.classification);

  if (revActionable && salesActionable) {
    if (rev.classification === 'VOLATILE' || sales.classification === 'VOLATILE') {
      return {
        overallTrend: 'VOLATILE',
        overallExplanation: `Primary demand metrics show volatility (Revenue: ${rev.classification}, Sales Volume: ${sales.classification}).`,
      };
    }
    if (
      (rev.classification === 'RISING' && sales.classification === 'DECLINING') ||
      (rev.classification === 'DECLINING' && sales.classification === 'RISING')
    ) {
      return {
        overallTrend: 'VOLATILE',
        overallExplanation: `Diverging demand signals (Revenue: ${rev.classification} vs Sales Volume: ${sales.classification}); check unit price shifts.`,
      };
    }
    if (rev.classification === 'RISING' || sales.classification === 'RISING') {
      return {
        overallTrend: 'RISING',
        overallExplanation: `Observed demand is rising (Revenue: ${rev.classification}, Sales Volume: ${sales.classification}).`,
      };
    }
    if (rev.classification === 'DECLINING' || sales.classification === 'DECLINING') {
      return {
        overallTrend: 'DECLINING',
        overallExplanation: `Observed demand is declining (Revenue: ${rev.classification}, Sales Volume: ${sales.classification}).`,
      };
    }
    return {
      overallTrend: 'STABLE',
      overallExplanation: `Observed demand is stable across Revenue and Sales Volume.`,
    };
  }

  if (revActionable) {
    return {
      overallTrend: rev.classification,
      overallExplanation: `Overall trend derived from Revenue (${rev.classification}); Sales Volume is ${sales.classification}.`,
    };
  }

  if (salesActionable) {
    return {
      overallTrend: sales.classification,
      overallExplanation: `Overall trend derived from Sales Volume (${sales.classification}); Revenue is ${rev.classification}.`,
    };
  }

  if (
    rev.classification === 'INCOMPARABLE_DATA' ||
    sales.classification === 'INCOMPARABLE_DATA' ||
    reportIncomparabilityReasons.length > 0
  ) {
    const reasons = dedupeReasons([
      ...reportIncomparabilityReasons,
      ...rev.incomparabilityReasons,
      ...sales.incomparabilityReasons,
    ]);
    return {
      overallTrend: 'INCOMPARABLE_DATA',
      overallExplanation: `Primary demand metrics are incomparable (${reasons.join(', ') || 'INCOMPARABLE_DATA'}).`,
    };
  }

  return {
    overallTrend: 'INSUFFICIENT_HISTORY',
    overallExplanation:
      'Insufficient trusted local multi-day Revenue and Sales Volume observations for trend classification.',
  };
}

/**
 * Phase 14 Historical Trend Intelligence Engine.
 *
 * Strictly evidence-based multi-day trend analysis across 7 tracked source metrics:
 * - Revenue, Sales Volume, Video Revenue, Live Revenue, Showcase/Shopping Mall Revenue,
 *   Unit Price, Commission Rate.
 *
 * STRICT GUARDRAILS:
 * - Only compares trusted LOCAL_OBSERVED snapshots with matching productId, compatible dateRange,
 *   compatible source provenance, matching metric units, and valid non-future timestamps.
 * - Never fabricates missing observations, never treats IMPORTED_UNVERIFIED snapshots as verified,
 *   and never divides by zero on ZERO_BASELINE series (deltaPct remains strictly null).
 * - Strictly separate from Commercial Opportunity Score, Conversion Evidence, Video Suitability,
 *   and Data Confidence (does NOT alter scoring formulas, weights, or eligibility gates).
 */
export function analyzeProductHistoricalTrends(
  records: ProductObservationSnapshot[] | undefined | null,
  options?: AnalyzeHistoricalTrendsOptions
): HistoricalProductTrendReport {
  const nowMs = options?.nowMs ?? Date.now();
  const cfg: HistoricalTrendConfig = {
    ...DEFAULT_HISTORICAL_TREND_CONFIG,
    minObservations:
      options?.minObservations ??
      options?.config?.minObservations ??
      DEFAULT_HISTORICAL_TREND_CONFIG.minObservations,
    minSpanHours:
      options?.minSpanHours ??
      options?.config?.minSpanHours ??
      DEFAULT_HISTORICAL_TREND_CONFIG.minSpanHours,
    minPointsForVolatile:
      options?.config?.minPointsForVolatile ??
      DEFAULT_HISTORICAL_TREND_CONFIG.minPointsForVolatile,
  };

  const list = Array.isArray(records) ? records.filter(Boolean) : [];
  const excluded: HistoricalTrendExcludedCounts = {
    productIdentityMismatch: 0,
    invalidOrFutureTimestamp: 0,
    importedUnverified: 0,
    dateRangeMismatch: 0,
    provenanceIncompatible: 0,
    sameDayDeduplicated: 0,
  };
  const reportReasons: HistoricalTrendIncomparabilityReason[] = [];

  // Step 1: Product Identity Verification
  const expectedProductId = options?.productId?.trim() || null;
  const distinctProductIds = Array.from(
    new Set(
      list
        .map((r) => (typeof r.productId === 'string' ? r.productId.trim() : ''))
        .filter(Boolean)
    )
  );

  let resolvedProductId: string | null = expectedProductId;
  let identityMatched: ProductObservationSnapshot[] = [];

  if (expectedProductId) {
    for (const r of list) {
      if (typeof r.productId === 'string' && r.productId.trim() === expectedProductId) {
        identityMatched.push(r);
      } else {
        excluded.productIdentityMismatch += 1;
      }
    }
    if (excluded.productIdentityMismatch > 0 && identityMatched.length < cfg.minObservations) {
      reportReasons.push('PRODUCT_IDENTITY_MISMATCH');
    }
  } else if (distinctProductIds.length > 1) {
    // Mixed product identities with no explicit target productId -> strictly INCOMPARABLE_DATA
    excluded.productIdentityMismatch = list.length;
    reportReasons.push('PRODUCT_IDENTITY_MISMATCH');
    identityMatched = [];
    resolvedProductId = null;
  } else {
    resolvedProductId = distinctProductIds[0] ?? null;
    identityMatched = list.filter(
      (r) => typeof r.productId === 'string' && r.productId.trim().length > 0
    );
    excluded.productIdentityMismatch = list.length - identityMatched.length;
  }

  // Step 2: Timestamp Validity & Trust Boundary Verification
  const validLocalSnapshots: ProductObservationSnapshot[] = [];
  let localObservedCount = 0;
  let importedUnverifiedCount = 0;

  for (const r of identityMatched) {
    const validIso = normalizeValidNonFutureIso(r.observedAt, nowMs);
    if (!validIso) {
      excluded.invalidOrFutureTimestamp += 1;
      continue;
    }

    if (r.trustStatus === 'IMPORTED_UNVERIFIED') {
      importedUnverifiedCount += 1;
      excluded.importedUnverified += 1;
      continue;
    }

    localObservedCount += 1;
    validLocalSnapshots.push({
      ...r,
      observedAt: validIso,
      observationDay: validIso.slice(0, 10),
    });
  }

  if (
    validLocalSnapshots.length < cfg.minObservations &&
    excluded.invalidOrFutureTimestamp > 0 &&
    identityMatched.length >= cfg.minObservations
  ) {
    reportReasons.push('INVALID_OR_FUTURE_TIMESTAMPS');
  }

  if (
    validLocalSnapshots.length < cfg.minObservations &&
    importedUnverifiedCount > 0 &&
    validLocalSnapshots.length + importedUnverifiedCount >= cfg.minObservations
  ) {
    reportReasons.push('IMPORTED_UNVERIFIED_ONLY');
  }

  // Step 3: Date Range Comparability
  const distinctDateRanges = Array.from(
    new Set(
      validLocalSnapshots
        .map((r) => (typeof r.dateRange === 'string' ? r.dateRange.trim() : ''))
        .filter(Boolean)
    )
  );

  let targetDateRange: string | null = options?.dateRange?.trim() || null;
  let dateRangeMatched: ProductObservationSnapshot[] = [];

  if (targetDateRange) {
    for (const r of validLocalSnapshots) {
      if (r.dateRange.trim() === targetDateRange) {
        dateRangeMatched.push(r);
      } else {
        excluded.dateRangeMismatch += 1;
      }
    }
    if (excluded.dateRangeMismatch > 0 && dateRangeMatched.length < cfg.minObservations) {
      reportReasons.push('DATE_RANGE_MISMATCH');
    }
  } else if (distinctDateRanges.length > 1) {
    excluded.dateRangeMismatch = validLocalSnapshots.length;
    reportReasons.push('DATE_RANGE_MISMATCH');
    dateRangeMatched = [];
    targetDateRange = null;
  } else {
    targetDateRange = distinctDateRanges[0] ?? null;
    dateRangeMatched = validLocalSnapshots;
  }

  // Step 4: Source Provenance Family Compatibility
  const distinctFamilies = Array.from(
    new Set(dateRangeMatched.map((r) => getProvenanceFamily(r.sourceEndpoint)))
  );

  let provenanceMatched = dateRangeMatched;
  if (distinctFamilies.length > 1) {
    const kalodataRecords = dateRangeMatched.filter(
      (r) => getProvenanceFamily(r.sourceEndpoint) === 'kalodata_openapi_v1'
    );
    if (kalodataRecords.length >= cfg.minObservations) {
      excluded.provenanceIncompatible = dateRangeMatched.length - kalodataRecords.length;
      provenanceMatched = kalodataRecords;
    } else {
      excluded.provenanceIncompatible = dateRangeMatched.length;
      provenanceMatched = [];
      reportReasons.push('PROVENANCE_INCOMPATIBLE');
    }
  }

  // Step 5: UTC-Day Deduplication (chronological, latest valid observation per UTC day)
  const byDay = new Map<string, ProductObservationSnapshot>();
  for (const snap of provenanceMatched
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))) {
    const existing = byDay.get(snap.observationDay);
    if (!existing) {
      byDay.set(snap.observationDay, snap);
    } else {
      excluded.sameDayDeduplicated += 1;
      if (Date.parse(snap.observedAt) >= Date.parse(existing.observedAt)) {
        byDay.set(snap.observationDay, snap);
      }
    }
  }

  const comparableSnapshots = Array.from(byDay.values()).sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  );

  const earliestObservedAt =
    comparableSnapshots.length > 0 ? comparableSnapshots[0].observedAt : null;
  const latestObservedAt =
    comparableSnapshots.length > 0
      ? comparableSnapshots[comparableSnapshots.length - 1].observedAt
      : null;

  let spanHours: number | null = null;
  let spanDays: number | null = null;
  if (earliestObservedAt && latestObservedAt && comparableSnapshots.length >= 2) {
    const diffMs = Date.parse(latestObservedAt) - Date.parse(earliestObservedAt);
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      spanHours = roundTo(diffMs / 3_600_000, 1);
      spanDays = roundTo(spanHours / 24, 1);
    }
  }

  const dedupedReportReasons = dedupeReasons(reportReasons);

  // Step 6: Evaluate All 7 Tracked Metrics Independently
  const metrics = {} as Record<HistoricalTrendMetricKey, HistoricalMetricTrendResult>;
  for (const metricKey of HISTORICAL_TREND_METRIC_KEYS) {
    metrics[metricKey] = analyzeSingleMetricTrend(
      metricKey,
      comparableSnapshots,
      targetDateRange,
      dedupedReportReasons,
      cfg,
      nowMs
    );
  }

  // Step 7: Synthesize Overall Commercial Demand Momentum
  const { overallTrend, overallExplanation } = synthesizeOverallTrend(
    metrics,
    comparableSnapshots.length,
    dedupedReportReasons,
    cfg.minObservations
  );

  return {
    provenance: 'DERIVED',
    trustScope: 'LOCAL_OBSERVED_ONLY',
    productId: resolvedProductId,
    dateRange: targetDateRange,
    overallTrend,
    overallExplanation,
    totalSnapshotsProvided: list.length,
    comparableSnapshotCount: comparableSnapshots.length,
    localObservedSnapshotCount: localObservedCount,
    importedUnverifiedSnapshotCount: importedUnverifiedCount,
    earliestObservedAt,
    latestObservedAt,
    spanHours,
    spanDays,
    excludedSnapshots: excluded,
    incomparabilityReasons: dedupedReportReasons,
    metrics,
    nonGuaranteeNotice:
      'Historical trends reflect past locally observed snapshots only. They do not guarantee future sales, demand continuity, or affiliate conversion.',
  };
}

export function buildHistoricalTrendsMap(
  snapshotsByProductId: Record<string, ProductObservationSnapshot[]>,
  options?: Omit<AnalyzeHistoricalTrendsOptions, 'productId'>
): Record<string, HistoricalProductTrendReport> {
  const out: Record<string, HistoricalProductTrendReport> = {};
  for (const [productId, records] of Object.entries(snapshotsByProductId)) {
    out[productId] = analyzeProductHistoricalTrends(records, {
      ...options,
      productId,
    });
  }
  return out;
}
