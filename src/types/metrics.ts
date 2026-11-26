export type MetricState =
  | 'OK'
  | 'ZERO'
  | 'MISSING'
  | 'UNAVAILABLE'
  | 'INVALID'
  | 'STALE';

export type MetricProvenance = 'SOURCE' | 'SYNTHETIC';

export type MetricUnit =
  | 'THB'
  | 'COUNT'
  | 'PERCENT'
  | 'RATIO'
  | 'RATING_5'
  | 'UNVERIFIED'
  | 'TEXT';

export interface ValidatedMetric<T = number> {
  value: T | null;
  state: MetricState;
  provenance: MetricProvenance;
  rawInput: unknown;
  unit: MetricUnit;
  fetchedAt: string | null;
  dateRange: string | null;
  note: string | null;
  /** Source endpoint that originally produced this individual metric observation. */
  sourceEndpoint?: ProductMetricSourceEndpoint;
}

export type ProductMetricSourceEndpoint =
  | 'rank'
  | 'detail'
  | 'legacy_product'
  | 'unknown';

export type SnapshotTrustStatus = 'LOCAL_OBSERVED' | 'IMPORTED_UNVERIFIED';

export type ObservationMetricKey =
  | 'revenueThb'
  | 'salesVolume'
  | 'videoRevenueThb'
  | 'liveRevenueThb'
  | 'shoppingMallRevenueThb'
  | 'unitPriceThb'
  | 'commissionRate'
  | 'revenueGrowthRate'
  | 'creatorCountVerified'
  | 'creatorCountUnverifiedRaw';

export interface ProductObservationMetricMeta {
  /** Actual source observation timestamp for this specific metric, or null when unknown. Never fabricated. */
  fetchedAt: string | null;
  /** Distinguishes exact per-metric timestamp vs legacy snapshot-level fallback vs unknown. */
  timestampPrecision: 'EXACT_METRIC' | 'SNAPSHOT_FALLBACK' | 'UNKNOWN';
  sourceEndpoint: ProductMetricSourceEndpoint;
  dateRange: string | null;
  /** Optional explicit unit tag for cross-snapshot comparability checks. */
  unit?: MetricUnit;
}

export interface SnapshotImportedAuditMetadata {
  importedAt: string;
  claimedTrustStatus?: string | null;
  claimedSourceEndpoint?: ProductMetricSourceEndpoint | null;
  claimedCreatorCountVerified?: number | boolean | null;
  claimedRevenueGrowthVerified?: boolean | null;
  originalProvenance?: string | null;
  originalVerificationStatus?: string | null;
}

export interface ProductValidatedMetrics {
  priceThb: ValidatedMetric<number>;
  commissionRate: ValidatedMetric<number>;
  commissionThb: ValidatedMetric<number>;
  salesVolume7d: ValidatedMetric<number>;
  revenueThb7d: ValidatedMetric<number>;
  videoRevenueThb7d: ValidatedMetric<number>;
  liveRevenueThb7d: ValidatedMetric<number>;
  shoppingMallRevenueThb7d?: ValidatedMetric<number>;
  revenueGrowthRate: ValidatedMetric<number>;
  creatorCount: ValidatedMetric<number>;
  rating: ValidatedMetric<number>;
  reviewCount: ValidatedMetric<number>;
  fetchedAt: string | null;
  dateRange: string | null;
  sourceEndpoint: ProductMetricSourceEndpoint;
  unresolvedFields: string[];
}

export interface ProductSourceObservationValues {
  revenueThb: number | null;
  salesVolume: number | null;
  videoRevenueThb: number | null;
  liveRevenueThb: number | null;
  shoppingMallRevenueThb: number | null;
  /** Source-observed realized unit price in THB (optional for backward compatibility with pre-Phase 14 v1 snapshots). */
  unitPriceThb?: number | null;
  commissionRate: number | null;
  revenueGrowthRate: number | null;
  revenueGrowthVerified: boolean;
  /** Strictly populated ONLY when creatorCount has verified COUNT semantics. Never populated for UNVERIFIED creator_number or imported snapshots. */
  creatorCountVerified: number | null;
  /** Diagnostic raw creator_number recorded ONLY when upstream semantics remain UNVERIFIED or downgraded from imported JSON. Never fed into verified scoring or strategy gates. */
  creatorCountUnverifiedRaw?: number | null;
}

export interface ProductObservationSnapshot {
  snapshotVersion: 1;
  productId: string;
  observedAt: string;
  /** UTC YYYY-MM-DD deduplication bucket so daily observations do not overwrite prior days. */
  observationDay: string;
  dateRange: string;
  sourceEndpoint: ProductMetricSourceEndpoint;
  /** Trust boundary classification: locally observed vs imported untrusted backup reference. */
  trustStatus: SnapshotTrustStatus;
  dataConfidenceScore: number | null;
  dataConfidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' | null;
  observations: ProductSourceObservationValues;
  /** Per-metric observation timestamps and provenance preserved independently across /rank and /detail merges. */
  metricMeta?: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>;
  /** Preserved audit metadata for imported backup snapshots so original claims remain inspectable without granting verified trust. */
  importedAudit?: SnapshotImportedAuditMetadata;
}

export interface SnapshotTrendDerivation {
  provenance: 'DERIVED';
  trustScope: 'LOCAL_OBSERVED_ONLY' | 'INCLUDES_IMPORTED_UNVERIFIED';
  productId: string;
  dateRange: string;
  observationCount: number;
  earliestObservedAt: string;
  latestObservedAt: string;
  spanHours: number;
  spanDays: number;
  revenueDeltaPct: number | null;
  salesDeltaPct: number | null;
  videoRevenueDeltaPct: number | null;
  verifiedCreatorDeltaPct: number | null;
}

export type HistoricalTrendMetricKey =
  | 'revenue'
  | 'salesVolume'
  | 'videoRevenue'
  | 'liveRevenue'
  | 'shoppingMallRevenue'
  | 'unitPrice'
  | 'commissionRate';

export type HistoricalTrendClassification =
  | 'RISING'
  | 'STABLE'
  | 'DECLINING'
  | 'VOLATILE'
  | 'INSUFFICIENT_HISTORY'
  | 'INCOMPARABLE_DATA';

export type HistoricalTrendBaselineStatus =
  | 'POSITIVE_BASELINE'
  | 'ZERO_BASELINE'
  | 'ALL_ZERO'
  | 'NOT_APPLICABLE';

export type HistoricalTrendIncomparabilityReason =
  | 'PRODUCT_IDENTITY_MISMATCH'
  | 'DATE_RANGE_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'PROVENANCE_INCOMPATIBLE'
  | 'IMPORTED_UNVERIFIED_ONLY'
  | 'DUPLICATE_METRIC_TIMESTAMP'
  | 'INVALID_OR_FUTURE_TIMESTAMPS';

export interface HistoricalMetricObservationPoint {
  observedAt: string;
  observationDay: string;
  value: number;
  unit: MetricUnit;
  sourceEndpoint: ProductMetricSourceEndpoint;
  dateRange: string;
  timestampPrecision: 'EXACT_METRIC' | 'SNAPSHOT_FALLBACK' | 'UNKNOWN';
}

export interface HistoricalMetricTrendResult {
  metric: HistoricalTrendMetricKey;
  unit: MetricUnit;
  provenance: 'DERIVED';
  classification: HistoricalTrendClassification;
  baselineStatus: HistoricalTrendBaselineStatus;
  pointCount: number;
  earliestValue: number | null;
  latestValue: number | null;
  earliestObservedAt: string | null;
  latestObservedAt: string | null;
  spanHours: number | null;
  spanDays: number | null;
  /** Exact latest - earliest difference in native metric unit (THB, COUNT, or percentage points). */
  absoluteDelta: number | null;
  /** Percentage change ((latest - earliest) / earliest) * 100. Strictly null on ZERO_BASELINE, ALL_ZERO, or non-comparable/insufficient series. */
  deltaPct: number | null;
  /** Largest step-to-step or peak-to-trough relative swing percentage observed across points (null when < 2 points or zero scale). */
  maxSwingPct: number | null;
  directionReversals: number;
  incomparabilityReasons: HistoricalTrendIncomparabilityReason[];
  points: HistoricalMetricObservationPoint[];
  explanation: string;
}

export interface HistoricalTrendExcludedCounts {
  productIdentityMismatch: number;
  invalidOrFutureTimestamp: number;
  importedUnverified: number;
  dateRangeMismatch: number;
  provenanceIncompatible: number;
  sameDayDeduplicated: number;
}

export interface HistoricalProductTrendReport {
  provenance: 'DERIVED';
  trustScope: 'LOCAL_OBSERVED_ONLY';
  productId: string | null;
  dateRange: string | null;
  overallTrend: HistoricalTrendClassification;
  overallExplanation: string;
  totalSnapshotsProvided: number;
  comparableSnapshotCount: number;
  localObservedSnapshotCount: number;
  importedUnverifiedSnapshotCount: number;
  earliestObservedAt: string | null;
  latestObservedAt: string | null;
  spanHours: number | null;
  spanDays: number | null;
  excludedSnapshots: HistoricalTrendExcludedCounts;
  incomparabilityReasons: HistoricalTrendIncomparabilityReason[];
  metrics: Record<HistoricalTrendMetricKey, HistoricalMetricTrendResult>;
  nonGuaranteeNotice: string;
}


