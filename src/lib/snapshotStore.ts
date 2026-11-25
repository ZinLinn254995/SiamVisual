import type {
  HistoricalMetricSnapshot,
  ProductItem,
  ProductMetricSourceEndpoint,
  ProductObservationSnapshot,
  ProductSourceObservationValues,
  ProductValidatedMetrics,
  SnapshotTrendDerivation,
  ValidatedMetric,
} from '../types.ts';
import {
  adaptProductItemToValidatedMetrics,
  isUsableScoringMetric,
  parseStrictFiniteNumber,
} from './metricFoundation.ts';

export const PRODUCT_SNAPSHOTS_STORAGE_KEY = 'siamvisual_product_snapshots_v1';
export const MAX_SNAPSHOTS_PER_PRODUCT = 90;
export const MAX_TRACKED_SNAPSHOT_PRODUCTS = 250;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SnapshotAppendResult {
  snapshots: ProductObservationSnapshot[];
  added: boolean;
  updated: boolean;
  deduplicated: boolean;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Ignore environments where localStorage is inaccessible
  }
  return null;
}

function toUtcObservationDay(isoTimestamp: string): string | null {
  const ms = Date.parse(isoTimestamp);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function isSourceObservedNumber(metric: ValidatedMetric<number> | undefined): boolean {
  if (!metric) return false;
  return (
    metric.provenance === 'SOURCE' &&
    (metric.state === 'OK' || metric.state === 'ZERO') &&
    typeof metric.value === 'number' &&
    Number.isFinite(metric.value)
  );
}

function hasUnverifiedNote(metric: ValidatedMetric<number> | undefined): boolean {
  return Boolean(metric?.note && /UNVERIFIED/i.test(metric.note));
}

function normalizeFiniteOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return null;
}

function areObservationsEqual(
  a: ProductSourceObservationValues,
  b: ProductSourceObservationValues
): boolean {
  return (
    a.revenueThb === b.revenueThb &&
    a.salesVolume === b.salesVolume &&
    a.videoRevenueThb === b.videoRevenueThb &&
    a.liveRevenueThb === b.liveRevenueThb &&
    a.shoppingMallRevenueThb === b.shoppingMallRevenueThb &&
    a.commissionRate === b.commissionRate &&
    a.revenueGrowthRate === b.revenueGrowthRate &&
    a.revenueGrowthVerified === b.revenueGrowthVerified &&
    a.creatorCountVerified === b.creatorCountVerified &&
    (a.creatorCountUnverifiedRaw ?? null) === (b.creatorCountUnverifiedRaw ?? null)
  );
}

function countObservedFields(obs: ProductSourceObservationValues): number {
  let count = 0;
  if (obs.revenueThb !== null) count += 1;
  if (obs.salesVolume !== null) count += 1;
  if (obs.videoRevenueThb !== null) count += 1;
  if (obs.liveRevenueThb !== null) count += 1;
  if (obs.shoppingMallRevenueThb !== null) count += 1;
  if (obs.commissionRate !== null) count += 1;
  if (obs.revenueGrowthRate !== null) count += 1;
  if (obs.creatorCountVerified !== null) count += 1;
  return count;
}

function mergeSameDayObservationValues(
  existing: ProductSourceObservationValues,
  incoming: ProductSourceObservationValues
): ProductSourceObservationValues {
  // Never drop previously captured verified source observations on the same UTC day;
  // fill gaps or accept richer same-day enrichment (e.g. /rank followed by /detail).
  const mergedGrowthVerified =
    incoming.revenueGrowthRate !== null && incoming.revenueGrowthVerified
      ? true
      : existing.revenueGrowthVerified;
  const mergedGrowthRate =
    incoming.revenueGrowthRate !== null && incoming.revenueGrowthVerified
      ? incoming.revenueGrowthRate
      : existing.revenueGrowthRate !== null
        ? existing.revenueGrowthRate
        : incoming.revenueGrowthRate;

  return {
    revenueThb: incoming.revenueThb ?? existing.revenueThb,
    salesVolume: incoming.salesVolume ?? existing.salesVolume,
    videoRevenueThb: incoming.videoRevenueThb ?? existing.videoRevenueThb,
    liveRevenueThb: incoming.liveRevenueThb ?? existing.liveRevenueThb,
    shoppingMallRevenueThb:
      incoming.shoppingMallRevenueThb ?? existing.shoppingMallRevenueThb,
    commissionRate: incoming.commissionRate ?? existing.commissionRate,
    revenueGrowthRate: mergedGrowthRate,
    revenueGrowthVerified: mergedGrowthVerified,
    creatorCountVerified: incoming.creatorCountVerified ?? existing.creatorCountVerified,
    creatorCountUnverifiedRaw:
      incoming.creatorCountUnverifiedRaw ?? existing.creatorCountUnverifiedRaw ?? null,
  };
}

/**
 * Extracts a strict, non-fabricated SOURCE observation snapshot from a ProductItem.
 * - Never fabricates missing metrics.
 * - Never records SYNTHETIC revenue as a SOURCE observation.
 * - Never records UNVERIFIED creator_number as a verified creator count.
 */
export function createObservationSnapshotFromProduct(
  product: ProductItem,
  options?: { nowMs?: number }
): ProductObservationSnapshot | null {
  if (!product?.id || typeof product.id !== 'string') return null;

  const validated: ProductValidatedMetrics =
    product.validatedMetrics ??
    adaptProductItemToValidatedMetrics(product, { nowMs: options?.nowMs });

  const observedAt = validated.fetchedAt ?? product.kalodataMetrics?.fetchedAt ?? null;
  if (!observedAt) return null;

  const observationDay = toUtcObservationDay(observedAt);
  if (!observationDay) return null;

  const dateRange =
    validated.dateRange ?? product.kalodataMetrics?.dateRange ?? 'last7Day';

  const revenueThb = isSourceObservedNumber(validated.revenueThb7d)
    ? validated.revenueThb7d.value
    : null;
  const salesVolume = isSourceObservedNumber(validated.salesVolume7d)
    ? validated.salesVolume7d.value
    : null;
  const videoRevenueThb = isSourceObservedNumber(validated.videoRevenueThb7d)
    ? validated.videoRevenueThb7d.value
    : null;
  const liveRevenueThb = isSourceObservedNumber(validated.liveRevenueThb7d)
    ? validated.liveRevenueThb7d.value
    : null;
  const shoppingMallRevenueThb = isSourceObservedNumber(
    validated.shoppingMallRevenueThb7d
  )
    ? validated.shoppingMallRevenueThb7d!.value
    : null;
  const commissionRate = isSourceObservedNumber(validated.commissionRate)
    ? validated.commissionRate.value
    : null;

  const growthIsSource = isSourceObservedNumber(validated.revenueGrowthRate);
  const revenueGrowthRate = growthIsSource
    ? validated.revenueGrowthRate.value
    : null;
  const revenueGrowthVerified =
    growthIsSource &&
    validated.revenueGrowthRate.unit === 'PERCENT' &&
    !hasUnverifiedNote(validated.revenueGrowthRate);

  const creatorIsVerified =
    isSourceObservedNumber(validated.creatorCount) &&
    validated.creatorCount.unit === 'COUNT' &&
    isUsableScoringMetric(validated.creatorCount) &&
    !hasUnverifiedNote(validated.creatorCount);

  const creatorCountVerified = creatorIsVerified
    ? validated.creatorCount.value
    : null;
  const rawUnverifiedCreator =
    !creatorIsVerified && validated.creatorCount.unit === 'UNVERIFIED'
      ? parseStrictFiniteNumber(
          validated.creatorCount.value ?? validated.creatorCount.rawInput
        )
      : null;
  const creatorCountUnverifiedRaw =
    rawUnverifiedCreator !== null && rawUnverifiedCreator >= 0
      ? rawUnverifiedCreator
      : null;

  const observations: ProductSourceObservationValues = {
    revenueThb,
    salesVolume,
    videoRevenueThb,
    liveRevenueThb,
    shoppingMallRevenueThb,
    commissionRate,
    revenueGrowthRate,
    revenueGrowthVerified,
    creatorCountVerified,
    creatorCountUnverifiedRaw,
  };

  // Refuse to write empty snapshots with zero genuine source observations
  if (countObservedFields(observations) === 0 && creatorCountUnverifiedRaw === null) {
    return null;
  }

  return {
    snapshotVersion: 1,
    productId: product.id,
    observedAt,
    observationDay,
    dateRange,
    sourceEndpoint: validated.sourceEndpoint ?? 'unknown',
    dataConfidenceScore: product.commercialScoreV2?.dataConfidence.score ?? null,
    dataConfidenceLevel: product.commercialScoreV2?.dataConfidence.level ?? null,
    observations,
  };
}

/**
 * Append-only daily snapshot recorder:
 * - Distinct observation days are NEVER overwritten; they accumulate chronologically.
 * - Same (dateRange, observationDay) entries are deduplicated cleanly:
 *   - Identical observations are skipped (deduplicated: true).
 *   - Same-day enrichment (e.g., /rank followed by /detail) merges newly observed fields
 *     without dropping existing verified fields.
 */
export function appendObservationSnapshot(
  existing: ProductObservationSnapshot[],
  incoming: ProductObservationSnapshot,
  maxPerProduct = MAX_SNAPSHOTS_PER_PRODUCT
): SnapshotAppendResult {
  const sameBucketIndex = existing.findIndex(
    (entry) =>
      entry.productId === incoming.productId &&
      entry.dateRange === incoming.dateRange &&
      entry.observationDay === incoming.observationDay
  );

  if (sameBucketIndex === -1) {
    const next = [...existing, incoming]
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
      .slice(-Math.max(1, maxPerProduct));
    return { snapshots: next, added: true, updated: false, deduplicated: false };
  }

  const current = existing[sameBucketIndex];
  const mergedObs = mergeSameDayObservationValues(
    current.observations,
    incoming.observations
  );

  const observationsChanged = !areObservationsEqual(current.observations, mergedObs);
  const incomingConfidence = incoming.dataConfidenceScore ?? -1;
  const currentConfidence = current.dataConfidenceScore ?? -1;
  const confidenceImproved = incomingConfidence > currentConfidence;
  const endpointUpgraded =
    current.sourceEndpoint !== 'detail' && incoming.sourceEndpoint === 'detail';

  if (!observationsChanged && !confidenceImproved && !endpointUpgraded) {
    return { snapshots: existing, added: false, updated: false, deduplicated: true };
  }

  const mergedEntry: ProductObservationSnapshot = {
    ...current,
    observedAt:
      Date.parse(incoming.observedAt) >= Date.parse(current.observedAt)
        ? incoming.observedAt
        : current.observedAt,
    sourceEndpoint: endpointUpgraded ? 'detail' : current.sourceEndpoint,
    dataConfidenceScore:
      confidenceImproved ? incoming.dataConfidenceScore : current.dataConfidenceScore,
    dataConfidenceLevel:
      confidenceImproved ? incoming.dataConfidenceLevel : current.dataConfidenceLevel,
    observations: mergedObs,
  };

  const next = existing
    .map((entry, idx) => (idx === sameBucketIndex ? mergedEntry : entry))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .slice(-Math.max(1, maxPerProduct));

  return { snapshots: next, added: false, updated: true, deduplicated: true };
}

function makeVerifiedSnapshotMetric(
  value: number,
  unit: ValidatedMetric<number>['unit'],
  fetchedAt: string,
  dateRange: string,
  note: string | null = null
): ValidatedMetric<number> {
  return {
    value,
    state: value === 0 ? 'ZERO' : 'OK',
    provenance: 'SOURCE',
    rawInput: value,
    unit,
    fetchedAt,
    dateRange,
    note,
  };
}

/**
 * Converts persisted ProductObservationSnapshot records into HistoricalMetricSnapshot[]
 * for strategyEngineV2 (`fast_rising_products`, `trend_timing_opportunity`).
 *
 * STRICT GUARDRAIL:
 * - Only genuinely verified SOURCE fields are emitted.
 * - Unverified `creatorCountUnverifiedRaw` is NEVER passed into `HistoricalMetricSnapshot.creatorCount`.
 * - Unverified `revenueGrowthRate` is NEVER passed into `HistoricalMetricSnapshot.revenueGrowthRate`.
 */
export function toStrategyHistoricalSnapshots(
  records: ProductObservationSnapshot[],
  options?: { dateRange?: string }
): HistoricalMetricSnapshot[] {
  const targetDateRange = options?.dateRange ?? 'last7Day';

  return records
    .filter((record) => record.dateRange === targetDateRange)
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .map((record) => {
      const snapshot: HistoricalMetricSnapshot = {
        fetchedAt: record.observedAt,
        dateRange: record.dateRange,
      };

      if (record.observations.revenueThb !== null) {
        snapshot.revenueThb7d = makeVerifiedSnapshotMetric(
          record.observations.revenueThb,
          'THB',
          record.observedAt,
          record.dateRange
        );
      }

      if (record.observations.salesVolume !== null) {
        snapshot.salesVolume7d = makeVerifiedSnapshotMetric(
          record.observations.salesVolume,
          'COUNT',
          record.observedAt,
          record.dateRange
        );
      }

      if (record.observations.creatorCountVerified !== null) {
        snapshot.creatorCount = makeVerifiedSnapshotMetric(
          record.observations.creatorCountVerified,
          'COUNT',
          record.observedAt,
          record.dateRange
        );
      }

      if (
        record.observations.revenueGrowthRate !== null &&
        record.observations.revenueGrowthVerified
      ) {
        snapshot.revenueGrowthRate = makeVerifiedSnapshotMetric(
          record.observations.revenueGrowthRate,
          'PERCENT',
          record.observedAt,
          record.dateRange
        );
      }

      return snapshot;
    });
}

export function buildStrategySnapshotsMap(
  snapshotsByProductId: Record<string, ProductObservationSnapshot[]>,
  options?: { dateRange?: string }
): Record<string, HistoricalMetricSnapshot[]> {
  const out: Record<string, HistoricalMetricSnapshot[]> = {};
  for (const [productId, list] of Object.entries(snapshotsByProductId)) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const converted = toStrategyHistoricalSnapshots(list, options);
    if (converted.length > 0) {
      out[productId] = converted;
    }
  }
  return out;
}

function computePercentDelta(
  earliest: number | null,
  latest: number | null
): number | null {
  if (earliest === null || latest === null || earliest <= 0) return null;
  return Math.round(((latest - earliest) / earliest) * 1000) / 10;
}

/**
 * Computes strictly DERIVED multi-day trend deltas from stored SOURCE observations.
 * Returns null if fewer than 2 time-separated (>=12h) observations exist.
 * Never fabricates historical trends or modifies source records.
 */
export function deriveSnapshotTrend(
  records: ProductObservationSnapshot[],
  options?: { dateRange?: string; minSpanHours?: number }
): SnapshotTrendDerivation | null {
  const targetDateRange = options?.dateRange ?? 'last7Day';
  const minSpanHours = options?.minSpanHours ?? 12;

  const filtered = records
    .filter((record) => record.dateRange === targetDateRange)
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  if (filtered.length < 2) return null;

  const earliest = filtered[0];
  const latest = filtered[filtered.length - 1];
  const earliestMs = Date.parse(earliest.observedAt);
  const latestMs = Date.parse(latest.observedAt);
  if (!Number.isFinite(earliestMs) || !Number.isFinite(latestMs)) return null;

  const spanHours = (latestMs - earliestMs) / 3_600_000;
  if (spanHours < minSpanHours) return null;

  return {
    provenance: 'DERIVED',
    productId: latest.productId,
    dateRange: targetDateRange,
    observationCount: filtered.length,
    earliestObservedAt: earliest.observedAt,
    latestObservedAt: latest.observedAt,
    spanHours: Math.round(spanHours * 10) / 10,
    spanDays: Math.round((spanHours / 24) * 10) / 10,
    revenueDeltaPct: computePercentDelta(
      earliest.observations.revenueThb,
      latest.observations.revenueThb
    ),
    salesDeltaPct: computePercentDelta(
      earliest.observations.salesVolume,
      latest.observations.salesVolume
    ),
    videoRevenueDeltaPct: computePercentDelta(
      earliest.observations.videoRevenueThb,
      latest.observations.videoRevenueThb
    ),
    verifiedCreatorDeltaPct: computePercentDelta(
      earliest.observations.creatorCountVerified,
      latest.observations.creatorCountVerified
    ),
  };
}

export function isValidProductObservationSnapshot(
  value: unknown
): value is ProductObservationSnapshot {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.snapshotVersion !== 1) return false;
  if (typeof obj.productId !== 'string' || !obj.productId.trim()) return false;
  if (typeof obj.observedAt !== 'string' || !Number.isFinite(Date.parse(obj.observedAt))) {
    return false;
  }
  if (typeof obj.observationDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.observationDay)) {
    return false;
  }
  if (typeof obj.dateRange !== 'string' || !obj.dateRange.trim()) return false;
  if (!obj.observations || typeof obj.observations !== 'object') return false;
  return true;
}

function sanitizeSnapshotRecord(raw: ProductObservationSnapshot): ProductObservationSnapshot {
  const allowedEndpoints: ProductMetricSourceEndpoint[] = [
    'rank',
    'detail',
    'legacy_product',
    'unknown',
  ];
  const endpoint: ProductMetricSourceEndpoint = allowedEndpoints.includes(raw.sourceEndpoint)
    ? raw.sourceEndpoint
    : 'unknown';

  const obs = raw.observations;
  return {
    snapshotVersion: 1,
    productId: raw.productId.trim(),
    observedAt: raw.observedAt,
    observationDay: raw.observationDay,
    dateRange: raw.dateRange,
    sourceEndpoint: endpoint,
    dataConfidenceScore: normalizeFiniteOrNull(raw.dataConfidenceScore),
    dataConfidenceLevel:
      raw.dataConfidenceLevel === 'HIGH' ||
      raw.dataConfidenceLevel === 'MEDIUM' ||
      raw.dataConfidenceLevel === 'LOW' ||
      raw.dataConfidenceLevel === 'VERY_LOW'
        ? raw.dataConfidenceLevel
        : null,
    observations: {
      revenueThb: normalizeFiniteOrNull(obs.revenueThb),
      salesVolume: normalizeFiniteOrNull(obs.salesVolume),
      videoRevenueThb: normalizeFiniteOrNull(obs.videoRevenueThb),
      liveRevenueThb: normalizeFiniteOrNull(obs.liveRevenueThb),
      shoppingMallRevenueThb: normalizeFiniteOrNull(obs.shoppingMallRevenueThb),
      commissionRate: normalizeFiniteOrNull(obs.commissionRate),
      revenueGrowthRate: normalizeFiniteOrNull(obs.revenueGrowthRate),
      revenueGrowthVerified: Boolean(obs.revenueGrowthVerified),
      creatorCountVerified: normalizeFiniteOrNull(obs.creatorCountVerified),
      creatorCountUnverifiedRaw: normalizeFiniteOrNull(obs.creatorCountUnverifiedRaw),
    },
  };
}

export function sanitizeProductSnapshotsMap(
  raw: unknown
): Record<string, ProductObservationSnapshot[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, ProductObservationSnapshot[]> = {};
  for (const [productId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    let cleanList: ProductObservationSnapshot[] = [];
    for (const item of list) {
      if (!isValidProductObservationSnapshot(item)) continue;
      if (item.productId !== productId) continue;
      cleanList = appendObservationSnapshot(cleanList, sanitizeSnapshotRecord(item)).snapshots;
    }
    if (cleanList.length > 0) {
      result[productId] = cleanList;
    }
  }
  return result;
}

export function loadProductSnapshotsFromStorage(
  storage: StorageLike | null = getDefaultStorage()
): Record<string, ProductObservationSnapshot[]> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PRODUCT_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeProductSnapshotsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function persistProductSnapshotsToStorage(
  map: Record<string, ProductObservationSnapshot[]>,
  storage: StorageLike | null = getDefaultStorage()
): Record<string, ProductObservationSnapshot[]> {
  const entries = Object.entries(map)
    .filter(([, list]) => Array.isArray(list) && list.length > 0)
    .sort((a, b) => {
      const aLatest = Date.parse(a[1][a[1].length - 1]?.observedAt ?? '') || 0;
      const bLatest = Date.parse(b[1][b[1].length - 1]?.observedAt ?? '') || 0;
      return bLatest - aLatest;
    })
    .slice(0, MAX_TRACKED_SNAPSHOT_PRODUCTS);

  const trimmed = Object.fromEntries(entries);
  if (storage) {
    try {
      storage.setItem(PRODUCT_SNAPSHOTS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }
  return trimmed;
}

export function recordProductSnapshotsInStorage(
  products: ProductItem[],
  options?: {
    storage?: StorageLike | null;
    nowMs?: number;
  }
): {
  snapshotsByProductId: Record<string, ProductObservationSnapshot[]>;
  addedCount: number;
  updatedCount: number;
  deduplicatedCount: number;
} {
  const storage = options?.storage !== undefined ? options.storage : getDefaultStorage();
  const current = loadProductSnapshotsFromStorage(storage);
  const next: Record<string, ProductObservationSnapshot[]> = { ...current };

  let addedCount = 0;
  let updatedCount = 0;
  let deduplicatedCount = 0;

  for (const product of products) {
    const snapshot = createObservationSnapshotFromProduct(product, {
      nowMs: options?.nowMs,
    });
    if (!snapshot) continue;

    const existingList = next[product.id] ?? [];
    const result = appendObservationSnapshot(existingList, snapshot);
    next[product.id] = result.snapshots;

    if (result.added) addedCount += 1;
    else if (result.updated) updatedCount += 1;
    else if (result.deduplicated) deduplicatedCount += 1;
  }

  const persisted =
    addedCount > 0 || updatedCount > 0
      ? persistProductSnapshotsToStorage(next, storage)
      : current;

  return {
    snapshotsByProductId: persisted,
    addedCount,
    updatedCount,
    deduplicatedCount,
  };
}

export function mergeRestoredProductSnapshots(
  current: Record<string, ProductObservationSnapshot[]>,
  imported: Record<string, ProductObservationSnapshot[]>,
  storage: StorageLike | null = getDefaultStorage()
): {
  merged: Record<string, ProductObservationSnapshot[]>;
  addedSnapshots: number;
} {
  const merged: Record<string, ProductObservationSnapshot[]> = { ...current };
  let addedSnapshots = 0;

  for (const [productId, importedList] of Object.entries(imported)) {
    if (!Array.isArray(importedList)) continue;
    let bucket = merged[productId] ?? [];
    for (const rawItem of importedList) {
      if (!isValidProductObservationSnapshot(rawItem)) continue;
      const clean = sanitizeSnapshotRecord(rawItem);
      const res = appendObservationSnapshot(bucket, clean);
      bucket = res.snapshots;
      if (res.added) addedSnapshots += 1;
    }
    if (bucket.length > 0) {
      merged[productId] = bucket;
    }
  }

  const persisted = persistProductSnapshotsToStorage(merged, storage);
  return { merged: persisted, addedSnapshots };
}
