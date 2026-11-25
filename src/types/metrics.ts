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
}

export type ProductMetricSourceEndpoint =
  | 'rank'
  | 'detail'
  | 'legacy_product'
  | 'unknown';

export interface ProductValidatedMetrics {
  priceThb: ValidatedMetric<number>;
  commissionRate: ValidatedMetric<number>;
  commissionThb: ValidatedMetric<number>;
  salesVolume7d: ValidatedMetric<number>;
  revenueThb7d: ValidatedMetric<number>;
  videoRevenueThb7d: ValidatedMetric<number>;
  liveRevenueThb7d: ValidatedMetric<number>;
  revenueGrowthRate: ValidatedMetric<number>;
  creatorCount: ValidatedMetric<number>;
  rating: ValidatedMetric<number>;
  reviewCount: ValidatedMetric<number>;
  fetchedAt: string | null;
  dateRange: string | null;
  sourceEndpoint: ProductMetricSourceEndpoint;
  unresolvedFields: string[];
}
