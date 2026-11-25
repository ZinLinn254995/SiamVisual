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

