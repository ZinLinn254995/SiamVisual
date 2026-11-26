import type {
  HistoricalMetricSnapshot,
  ObservationMetricKey,
  ProductItem,
  ProductMetricSourceEndpoint,
  ProductObservationMetricMeta,
  ProductObservationSnapshot,
  ProductSourceObservationValues,
  ProductValidatedMetrics,
  SnapshotImportedAuditMetadata,
  SnapshotTrendDerivation,
  SnapshotTrustStatus,
  ValidatedMetric,
} from '../types.ts';
import {
  adaptProductItemToValidatedMetrics,
  isUsableScoringMetric,
  parseStrictFiniteNumber,
  validateMetricTimestamp,
} from './metricFoundation.ts';

export const PRODUCT_SNAPSHOTS_STORAGE_KEY = 'siamvisual_product_snapshots_v1';
export const MAX_SNAPSHOTS_PER_PRODUCT = 90;
export const MAX_TRACKED_SNAPSHOT_PRODUCTS = 250;

const ALLOWED_SOURCE_ENDPOINTS: readonly ProductMetricSourceEndpoint[] = [
  'rank',
  'detail',
  'legacy_product',
  'unknown',
];

const OBSERVATION_METRIC_KEYS: readonly ObservationMetricKey[] = [
  'revenueThb',
  'salesVolume',
  'videoRevenueThb',
  'liveRevenueThb',
  'shoppingMallRevenueThb',
  'unitPriceThb',
  'commissionRate',
  'revenueGrowthRate',
  'creatorCountVerified',
  'creatorCountUnverifiedRaw',
];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SnapshotAppendResult {
  snapshots: ProductObservationSnapshot[];
  added: boolean;
  updated: boolean;
  deduplicated: boolean;
  rejectedReason?: string;
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

function normalizeEndpoint(value: unknown): ProductMetricSourceEndpoint {
  if (
    typeof value === 'string' &&
    (ALLOWED_SOURCE_ENDPOINTS as readonly string[]).includes(value)
  ) {
    return value as ProductMetricSourceEndpoint;
  }
  return 'unknown';
}

function normalizeNonFutureTimestamp(
  iso: unknown,
  nowMs: number
): { valid: boolean; normalizedIso: string | null; future: boolean } {
  if (typeof iso !== 'string' || !iso.trim()) {
    return { valid: false, normalizedIso: null, future: false };
  }
  const check = validateMetricTimestamp(iso, { nowMs, staleAfterMs: -1 });
  return {
    valid: check.valid && !check.future && Boolean(check.normalizedIso),
    normalizedIso: check.normalizedIso,
    future: check.future,
  };
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

function normalizeNonNegativeFiniteOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return val;
  return null;
}

function normalizeCommissionRateOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100) {
    return val;
  }
  return null;
}

function normalizeTrustStatusForLocal(raw: unknown): SnapshotTrustStatus {
  return raw === 'IMPORTED_UNVERIFIED' ? 'IMPORTED_UNVERIFIED' : 'LOCAL_OBSERVED';
}

function isMetricCompatibleWithDateRange(
  metricDateRange: string | null | undefined,
  snapshotDateRange: string
): boolean {
  if (!metricDateRange || !metricDateRange.trim()) return true;
  return metricDateRange.trim() === snapshotDateRange.trim();
}

function extractPerMetricMetaFromValidated(
  metric: ValidatedMetric<number> | undefined,
  fallbackEndpoint: ProductMetricSourceEndpoint,
  snapshotDateRange: string,
  nowMs: number
): { valid: boolean; meta: ProductObservationMetricMeta } {
  const endpoint = normalizeEndpoint(metric?.sourceEndpoint ?? fallbackEndpoint);
  const dateRange = metric?.dateRange ?? snapshotDateRange;
  const unit = metric?.unit;

  if (!isMetricCompatibleWithDateRange(metric?.dateRange, snapshotDateRange)) {
    return {
      valid: false,
      meta: {
        fetchedAt: null,
        timestampPrecision: 'UNKNOWN',
        sourceEndpoint: endpoint,
        dateRange,
        ...(unit ? { unit } : {}),
      },
    };
  }

  if (!metric?.fetchedAt || !metric.fetchedAt.trim()) {
    return {
      valid: true,
      meta: {
        fetchedAt: null,
        timestampPrecision: 'UNKNOWN',
        sourceEndpoint: endpoint,
        dateRange,
        ...(unit ? { unit } : {}),
      },
    };
  }

  const tsCheck = normalizeNonFutureTimestamp(metric.fetchedAt, nowMs);
  if (!tsCheck.valid || tsCheck.future || !tsCheck.normalizedIso) {
    return {
      valid: false,
      meta: {
        fetchedAt: null,
        timestampPrecision: 'UNKNOWN',
        sourceEndpoint: endpoint,
        dateRange,
        ...(unit ? { unit } : {}),
      },
    };
  }

  return {
    valid: true,
    meta: {
      fetchedAt: tsCheck.normalizedIso,
      timestampPrecision: 'EXACT_METRIC',
      sourceEndpoint: endpoint,
      dateRange,
      ...(unit ? { unit } : {}),
    },
  };
}

function sanitizeMetricMetaEntry(
  raw: unknown,
  fallbackEndpoint: ProductMetricSourceEndpoint,
  fallbackDateRange: string,
  nowMs: number
): ProductObservationMetricMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const sourceEndpoint = normalizeEndpoint(obj.sourceEndpoint ?? fallbackEndpoint);
  const dateRange =
    typeof obj.dateRange === 'string' && obj.dateRange.trim()
      ? obj.dateRange.trim()
      : fallbackDateRange;

  const rawUnit =
    obj.unit === 'THB' ||
    obj.unit === 'COUNT' ||
    obj.unit === 'PERCENT' ||
    obj.unit === 'RATIO' ||
    obj.unit === 'RATING_5' ||
    obj.unit === 'UNVERIFIED' ||
    obj.unit === 'TEXT'
      ? obj.unit
      : undefined;

  if (obj.fetchedAt === null || obj.fetchedAt === undefined || obj.fetchedAt === '') {
    return {
      fetchedAt: null,
      timestampPrecision: 'UNKNOWN',
      sourceEndpoint,
      dateRange,
      ...(rawUnit ? { unit: rawUnit } : {}),
    };
  }

  const tsCheck = normalizeNonFutureTimestamp(obj.fetchedAt, nowMs);
  if (!tsCheck.valid || tsCheck.future || !tsCheck.normalizedIso) {
    return {
      fetchedAt: null,
      timestampPrecision: 'UNKNOWN',
      sourceEndpoint,
      dateRange,
      ...(rawUnit ? { unit: rawUnit } : {}),
    };
  }

  const precision: ProductObservationMetricMeta['timestampPrecision'] =
    obj.timestampPrecision === 'EXACT_METRIC' ||
    obj.timestampPrecision === 'SNAPSHOT_FALLBACK'
      ? obj.timestampPrecision
      : 'EXACT_METRIC';

  return {
    fetchedAt: tsCheck.normalizedIso,
    timestampPrecision: precision,
    sourceEndpoint,
    dateRange,
    ...(rawUnit ? { unit: rawUnit } : {}),
  };
}

function areMetricMetaEqual(
  a?: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>,
  b?: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>
): boolean {
  for (const key of OBSERVATION_METRIC_KEYS) {
    const ma = a?.[key];
    const mb = b?.[key];
    if (!ma && !mb) continue;
    if (!ma || !mb) return false;
    if (
      ma.fetchedAt !== mb.fetchedAt ||
      ma.timestampPrecision !== mb.timestampPrecision ||
      ma.sourceEndpoint !== mb.sourceEndpoint ||
      ma.dateRange !== mb.dateRange ||
      ma.unit !== mb.unit
    ) {
      return false;
    }
  }
  return true;
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
    (a.unitPriceThb ?? null) === (b.unitPriceThb ?? null) &&
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
  if (obs.unitPriceThb !== null && obs.unitPriceThb !== undefined) count += 1;
  if (obs.commissionRate !== null) count += 1;
  if (obs.revenueGrowthRate !== null) count += 1;
  if (obs.creatorCountVerified !== null) count += 1;
  return count;
}

function shouldAdoptIncomingMetric(
  currentVal: number | null | undefined,
  incomingVal: number | null | undefined,
  currentMeta: ProductObservationMetricMeta | undefined,
  incomingMeta: ProductObservationMetricMeta | undefined,
  currentObservedAt: string,
  incomingObservedAt: string
): boolean {
  if (incomingVal === null || incomingVal === undefined) return false;
  if (currentVal === null || currentVal === undefined) return true;

  const curTs = currentMeta?.fetchedAt
    ? Date.parse(currentMeta.fetchedAt)
    : Date.parse(currentObservedAt);
  const incTs = incomingMeta?.fetchedAt
    ? Date.parse(incomingMeta.fetchedAt)
    : Date.parse(incomingObservedAt);

  if (Number.isFinite(incTs) && Number.isFinite(curTs)) {
    if (incTs > curTs) return true;
    if (incTs < curTs) return false;
  }

  // On equal timestamp, prefer /detail over /rank or unknown; otherwise preserve existing.
  if (
    currentMeta?.sourceEndpoint !== 'detail' &&
    incomingMeta?.sourceEndpoint === 'detail'
  ) {
    return true;
  }
  return false;
}

function mergeSameDayObservationAndMeta(
  current: ProductObservationSnapshot,
  incoming: ProductObservationSnapshot,
  isImportedTrust: boolean
): {
  observations: ProductSourceObservationValues;
  metricMeta: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>;
} {
  const curObs = current.observations;
  const incObs = incoming.observations;
  const curMetaMap = current.metricMeta ?? {};
  const incMetaMap = incoming.metricMeta ?? {};
  const nextMeta: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>> = {};

  const pickNumeric = (
    key: Exclude<ObservationMetricKey, 'revenueGrowthRate' | 'creatorCountVerified'>,
    curVal: number | null | undefined,
    incVal: number | null | undefined
  ): number | null => {
    const adopt = shouldAdoptIncomingMetric(
      curVal,
      incVal,
      curMetaMap[key],
      incMetaMap[key],
      current.observedAt,
      incoming.observedAt
    );
    const chosenVal = adopt ? incVal ?? null : curVal ?? null;
    const chosenMeta = adopt ? incMetaMap[key] : curMetaMap[key];
    if (chosenVal !== null && chosenMeta) {
      nextMeta[key] = chosenMeta;
    }
    return chosenVal;
  };

  const revenueThb = pickNumeric('revenueThb', curObs.revenueThb, incObs.revenueThb);
  const salesVolume = pickNumeric('salesVolume', curObs.salesVolume, incObs.salesVolume);
  const videoRevenueThb = pickNumeric(
    'videoRevenueThb',
    curObs.videoRevenueThb,
    incObs.videoRevenueThb
  );
  const liveRevenueThb = pickNumeric(
    'liveRevenueThb',
    curObs.liveRevenueThb,
    incObs.liveRevenueThb
  );
  const shoppingMallRevenueThb = pickNumeric(
    'shoppingMallRevenueThb',
    curObs.shoppingMallRevenueThb,
    incObs.shoppingMallRevenueThb
  );
  const unitPriceThb = pickNumeric(
    'unitPriceThb',
    curObs.unitPriceThb ?? null,
    incObs.unitPriceThb ?? null
  );
  const commissionRate = pickNumeric(
    'commissionRate',
    curObs.commissionRate,
    incObs.commissionRate
  );
  const creatorCountUnverifiedRaw = pickNumeric(
    'creatorCountUnverifiedRaw',
    curObs.creatorCountUnverifiedRaw ?? null,
    incObs.creatorCountUnverifiedRaw ?? null
  );

  // Growth rate & verification status:
  // Imported records NEVER gain revenueGrowthVerified=true.
  // Local records NEVER downgrade a verified growth rate to an unverified one.
  let revenueGrowthRate: number | null = curObs.revenueGrowthRate;
  let revenueGrowthVerified: boolean = isImportedTrust
    ? false
    : curObs.revenueGrowthVerified && curObs.revenueGrowthRate !== null;
  let growthMeta: ProductObservationMetricMeta | undefined = curMetaMap.revenueGrowthRate;

  if (isImportedTrust) {
    const adoptGrowth = shouldAdoptIncomingMetric(
      curObs.revenueGrowthRate,
      incObs.revenueGrowthRate,
      curMetaMap.revenueGrowthRate,
      incMetaMap.revenueGrowthRate,
      current.observedAt,
      incoming.observedAt
    );
    if (adoptGrowth) {
      revenueGrowthRate = incObs.revenueGrowthRate;
      growthMeta = incMetaMap.revenueGrowthRate;
    }
    revenueGrowthVerified = false;
  } else if (incObs.revenueGrowthRate !== null) {
    if (incObs.revenueGrowthVerified && !curObs.revenueGrowthVerified) {
      revenueGrowthRate = incObs.revenueGrowthRate;
      revenueGrowthVerified = true;
      growthMeta = incMetaMap.revenueGrowthRate;
    } else if (incObs.revenueGrowthVerified === curObs.revenueGrowthVerified) {
      const adoptGrowth = shouldAdoptIncomingMetric(
        curObs.revenueGrowthRate,
        incObs.revenueGrowthRate,
        curMetaMap.revenueGrowthRate,
        incMetaMap.revenueGrowthRate,
        current.observedAt,
        incoming.observedAt
      );
      if (adoptGrowth) {
        revenueGrowthRate = incObs.revenueGrowthRate;
        revenueGrowthVerified = incObs.revenueGrowthVerified;
        growthMeta = incMetaMap.revenueGrowthRate;
      }
    }
  }
  if (revenueGrowthRate !== null && growthMeta) {
    nextMeta.revenueGrowthRate = growthMeta;
  }

  // Verified creatorCount: ALWAYS null on imported records.
  let creatorCountVerified: number | null = null;
  if (!isImportedTrust) {
    const adoptCreator = shouldAdoptIncomingMetric(
      curObs.creatorCountVerified,
      incObs.creatorCountVerified,
      curMetaMap.creatorCountVerified,
      incMetaMap.creatorCountVerified,
      current.observedAt,
      incoming.observedAt
    );
    creatorCountVerified = adoptCreator
      ? incObs.creatorCountVerified
      : curObs.creatorCountVerified;
    const chosenCreatorMeta = adoptCreator
      ? incMetaMap.creatorCountVerified
      : curMetaMap.creatorCountVerified;
    if (creatorCountVerified !== null && chosenCreatorMeta) {
      nextMeta.creatorCountVerified = chosenCreatorMeta;
    }
  }

  return {
    observations: {
      revenueThb,
      salesVolume,
      videoRevenueThb,
      liveRevenueThb,
      shoppingMallRevenueThb,
      unitPriceThb,
      commissionRate,
      revenueGrowthRate,
      revenueGrowthVerified,
      creatorCountVerified,
      creatorCountUnverifiedRaw,
    },
    metricMeta: nextMeta,
  };
}

/**
 * Extracts a strict, non-fabricated LOCAL_OBSERVED snapshot from a ProductItem.
 * - Preserves each metric's own fetchedAt, sourceEndpoint, and dateRange independently.
 * - Never fabricates missing metrics or missing timestamps.
 * - Rejects invalid or future timestamps.
 * - Never records SYNTHETIC revenue as a SOURCE observation.
 * - Never records UNVERIFIED creator_number as a verified creator count.
 */
export function createObservationSnapshotFromProduct(
  product: ProductItem,
  options?: { nowMs?: number }
): ProductObservationSnapshot | null {
  if (!product?.id || typeof product.id !== 'string') return null;

  const nowMs = options?.nowMs ?? Date.now();
  const validated: ProductValidatedMetrics =
    product.validatedMetrics ??
    adaptProductItemToValidatedMetrics(product, { nowMs });

  const dateRange =
    validated.dateRange ?? product.kalodataMetrics?.dateRange ?? 'last7Day';
  const fallbackEndpoint = normalizeEndpoint(validated.sourceEndpoint);

  // Reject explicitly future envelope timestamps immediately
  const rawEnvelopeTs = validated.fetchedAt ?? product.kalodataMetrics?.fetchedAt ?? null;
  let validEnvelopeIso: string | null = null;
  if (rawEnvelopeTs !== null) {
    const envCheck = normalizeNonFutureTimestamp(rawEnvelopeTs, nowMs);
    if (envCheck.future || !envCheck.valid) {
      return null;
    }
    validEnvelopeIso = envCheck.normalizedIso;
  }

  const metricMeta: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>> = {};
  const validTimestampsMs: number[] = [];

  if (validEnvelopeIso) {
    validTimestampsMs.push(Date.parse(validEnvelopeIso));
  }

  const readSourceMetric = (
    key: ObservationMetricKey,
    metric: ValidatedMetric<number> | undefined,
    validator: (val: number) => boolean,
    expectedUnit?: ValidatedMetric<number>['unit']
  ): number | null => {
    if (!isSourceObservedNumber(metric)) return null;
    if (expectedUnit && metric!.unit !== expectedUnit) return null;
    if (!validator(metric!.value!)) return null;

    const metaRes = extractPerMetricMetaFromValidated(
      metric,
      fallbackEndpoint,
      dateRange,
      nowMs
    );
    if (!metaRes.valid) return null;

    metricMeta[key] = metaRes.meta;
    if (metaRes.meta.fetchedAt) {
      validTimestampsMs.push(Date.parse(metaRes.meta.fetchedAt));
    }
    return metric!.value!;
  };

  const revenueThb = readSourceMetric('revenueThb', validated.revenueThb7d, (v) => v >= 0, 'THB');
  const salesVolume = readSourceMetric(
    'salesVolume',
    validated.salesVolume7d,
    (v) => v >= 0,
    'COUNT'
  );
  const videoRevenueThb = readSourceMetric(
    'videoRevenueThb',
    validated.videoRevenueThb7d,
    (v) => v >= 0,
    'THB'
  );
  const liveRevenueThb = readSourceMetric(
    'liveRevenueThb',
    validated.liveRevenueThb7d,
    (v) => v >= 0,
    'THB'
  );
  const shoppingMallRevenueThb = readSourceMetric(
    'shoppingMallRevenueThb',
    validated.shoppingMallRevenueThb7d,
    (v) => v >= 0,
    'THB'
  );
  const unitPriceThb = readSourceMetric(
    'unitPriceThb',
    validated.priceThb,
    (v) => v >= 0,
    'THB'
  );
  const commissionRate = readSourceMetric(
    'commissionRate',
    validated.commissionRate,
    (v) => v >= 0 && v <= 100,
    'PERCENT'
  );

  const revenueGrowthRate = readSourceMetric(
    'revenueGrowthRate',
    validated.revenueGrowthRate,
    () => true
  );
  const revenueGrowthVerified =
    revenueGrowthRate !== null &&
    validated.revenueGrowthRate.unit === 'PERCENT' &&
    !hasUnverifiedNote(validated.revenueGrowthRate);

  const creatorIsVerified =
    isSourceObservedNumber(validated.creatorCount) &&
    validated.creatorCount.unit === 'COUNT' &&
    isUsableScoringMetric(validated.creatorCount) &&
    !hasUnverifiedNote(validated.creatorCount);

  let creatorCountVerified: number | null = null;
  let creatorCountUnverifiedRaw: number | null = null;

  if (creatorIsVerified) {
    creatorCountVerified = readSourceMetric(
      'creatorCountVerified',
      validated.creatorCount,
      (v) => v >= 0,
      'COUNT'
    );
  } else if (validated.creatorCount.unit === 'UNVERIFIED') {
    const rawUnverifiedCreator = parseStrictFiniteNumber(
      validated.creatorCount.value ?? validated.creatorCount.rawInput
    );
    if (rawUnverifiedCreator !== null && rawUnverifiedCreator >= 0) {
      const metaRes = extractPerMetricMetaFromValidated(
        validated.creatorCount,
        fallbackEndpoint,
        dateRange,
        nowMs
      );
      if (metaRes.valid) {
        creatorCountUnverifiedRaw = rawUnverifiedCreator;
        metricMeta.creatorCountUnverifiedRaw = metaRes.meta;
        if (metaRes.meta.fetchedAt) {
          validTimestampsMs.push(Date.parse(metaRes.meta.fetchedAt));
        }
      }
    }
  }

  const observations: ProductSourceObservationValues = {
    revenueThb,
    salesVolume,
    videoRevenueThb,
    liveRevenueThb,
    shoppingMallRevenueThb,
    unitPriceThb,
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

  // Must have at least one valid non-future observation timestamp to anchor on UTC timeline
  if (validTimestampsMs.length === 0) {
    return null;
  }

  const latestObservedMs = Math.max(...validTimestampsMs);
  const observedAt = new Date(latestObservedMs).toISOString();
  const observationDay = observedAt.slice(0, 10);

  return {
    snapshotVersion: 1,
    productId: product.id,
    observedAt,
    observationDay,
    dateRange,
    sourceEndpoint: fallbackEndpoint,
    trustStatus: 'LOCAL_OBSERVED',
    dataConfidenceScore: product.commercialScoreV2?.dataConfidence.score ?? null,
    dataConfidenceLevel: product.commercialScoreV2?.dataConfidence.level ?? null,
    observations,
    metricMeta,
  };
}

/**
 * Append-only daily snapshot recorder with strict trust-boundary protection:
 * - Rejects invalid or future timestamps.
 * - Distinct observation days are NEVER overwritten; they accumulate chronologically.
 * - IMPORTED_UNVERIFIED snapshots NEVER overwrite or modify LOCAL_OBSERVED snapshots.
 * - Same-day same-trust merges preserve per-metric timestamps and source endpoints independently.
 */
export function appendObservationSnapshot(
  existing: ProductObservationSnapshot[],
  incoming: ProductObservationSnapshot,
  maxPerProduct = MAX_SNAPSHOTS_PER_PRODUCT,
  options?: { nowMs?: number }
): SnapshotAppendResult {
  const nowMs = options?.nowMs ?? Date.now();
  if (!incoming?.productId || typeof incoming.productId !== 'string' || !incoming.productId.trim()) {
    return {
      snapshots: existing,
      added: false,
      updated: false,
      deduplicated: false,
      rejectedReason: 'Rejected snapshot with missing or invalid productId.',
    };
  }
  if (!incoming?.dateRange || typeof incoming.dateRange !== 'string' || !incoming.dateRange.trim()) {
    return {
      snapshots: existing,
      added: false,
      updated: false,
      deduplicated: false,
      rejectedReason: 'Rejected snapshot with missing or invalid dateRange.',
    };
  }
  const tsCheck = normalizeNonFutureTimestamp(incoming.observedAt, nowMs);
  if (!tsCheck.valid || tsCheck.future || !tsCheck.normalizedIso) {
    return {
      snapshots: existing,
      added: false,
      updated: false,
      deduplicated: false,
      rejectedReason: tsCheck.future
        ? 'Rejected snapshot with future observedAt timestamp.'
        : 'Rejected snapshot with invalid observedAt timestamp.',
    };
  }

  const normalizedIncoming: ProductObservationSnapshot = {
    ...incoming,
    productId: incoming.productId.trim(),
    dateRange: incoming.dateRange.trim(),
    observedAt: tsCheck.normalizedIso,
    observationDay: tsCheck.normalizedIso.slice(0, 10),
    trustStatus: normalizeTrustStatusForLocal(incoming.trustStatus),
  };

  const sameBucketIndex = existing.findIndex(
    (entry) =>
      entry.productId === normalizedIncoming.productId &&
      entry.dateRange === normalizedIncoming.dateRange &&
      entry.observationDay === normalizedIncoming.observationDay
  );

  if (sameBucketIndex === -1) {
    const next = [...existing, normalizedIncoming]
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
      .slice(-Math.max(1, maxPerProduct));
    return { snapshots: next, added: true, updated: false, deduplicated: false };
  }

  const current = existing[sameBucketIndex];
  const currentTrust = normalizeTrustStatusForLocal(current.trustStatus);
  const incomingTrust = normalizedIncoming.trustStatus;

  // TRUST BOUNDARY: Imported unverified records MUST NEVER overwrite or mutate local trusted records.
  if (currentTrust === 'LOCAL_OBSERVED' && incomingTrust === 'IMPORTED_UNVERIFIED') {
    return {
      snapshots: existing,
      added: false,
      updated: false,
      deduplicated: true,
      rejectedReason: 'Imported unverified snapshot cannot overwrite trusted local observation.',
    };
  }

  // Fresh trusted local observation cleanly supersedes an unverified imported reference on the same UTC day
  // without copying any unverified imported fields into verified fields.
  if (currentTrust === 'IMPORTED_UNVERIFIED' && incomingTrust === 'LOCAL_OBSERVED') {
    const next = existing
      .map((entry, idx) => (idx === sameBucketIndex ? normalizedIncoming : entry))
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
      .slice(-Math.max(1, maxPerProduct));
    return { snapshots: next, added: false, updated: true, deduplicated: true };
  }

  const isImportedTrust = currentTrust === 'IMPORTED_UNVERIFIED';
  const { observations: mergedObs, metricMeta: mergedMeta } =
    mergeSameDayObservationAndMeta(current, normalizedIncoming, isImportedTrust);

  const observationsChanged = !areObservationsEqual(current.observations, mergedObs);
  const metaChanged = !areMetricMetaEqual(current.metricMeta, mergedMeta);
  const incomingConfidence = normalizedIncoming.dataConfidenceScore ?? -1;
  const currentConfidence = current.dataConfidenceScore ?? -1;
  const confidenceImproved = incomingConfidence > currentConfidence;
  const endpointUpgraded =
    current.sourceEndpoint !== 'detail' && normalizedIncoming.sourceEndpoint === 'detail';

  if (!observationsChanged && !metaChanged && !confidenceImproved && !endpointUpgraded) {
    return { snapshots: existing, added: false, updated: false, deduplicated: true };
  }

  const mergedEntry: ProductObservationSnapshot = {
    ...current,
    trustStatus: currentTrust,
    observedAt:
      Date.parse(normalizedIncoming.observedAt) >= Date.parse(current.observedAt)
        ? normalizedIncoming.observedAt
        : current.observedAt,
    sourceEndpoint: endpointUpgraded ? 'detail' : current.sourceEndpoint,
    dataConfidenceScore:
      confidenceImproved
        ? normalizedIncoming.dataConfidenceScore
        : current.dataConfidenceScore,
    dataConfidenceLevel:
      confidenceImproved
        ? normalizedIncoming.dataConfidenceLevel
        : current.dataConfidenceLevel,
    observations: mergedObs,
    ...(Object.keys(mergedMeta).length > 0 ? { metricMeta: mergedMeta } : {}),
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
  fetchedAt: string | null,
  dateRange: string,
  sourceEndpoint: ProductMetricSourceEndpoint,
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
    sourceEndpoint,
  };
}

function resolveMetricTimestampForStrategy(
  record: ProductObservationSnapshot,
  key: ObservationMetricKey,
  targetDateRange: string,
  nowMs: number
): {
  eligible: boolean;
  fetchedAt: string | null;
  sourceEndpoint: ProductMetricSourceEndpoint;
  note: string | null;
} {
  const meta = record.metricMeta?.[key];
  if (!meta) {
    // Legacy pre-10.1 local snapshot without per-metric metadata: explicit documented fallback
    return {
      eligible: true,
      fetchedAt: record.observedAt,
      sourceEndpoint: record.sourceEndpoint,
      note: 'SNAPSHOT_LEVEL_TIMESTAMP_FALLBACK',
    };
  }

  if (!isMetricCompatibleWithDateRange(meta.dateRange, targetDateRange)) {
    return {
      eligible: false,
      fetchedAt: null,
      sourceEndpoint: meta.sourceEndpoint,
      note: 'INCOMPATIBLE_DATE_RANGE',
    };
  }

  if (meta.fetchedAt === null || meta.timestampPrecision === 'UNKNOWN') {
    return {
      eligible: true,
      fetchedAt: null,
      sourceEndpoint: meta.sourceEndpoint,
      note: 'METRIC_TIMESTAMP_UNKNOWN',
    };
  }

  const tsCheck = normalizeNonFutureTimestamp(meta.fetchedAt, nowMs);
  if (!tsCheck.valid || tsCheck.future || !tsCheck.normalizedIso) {
    return {
      eligible: false,
      fetchedAt: null,
      sourceEndpoint: meta.sourceEndpoint,
      note: 'INVALID_OR_FUTURE_METRIC_TIMESTAMP',
    };
  }

  return {
    eligible: true,
    fetchedAt: tsCheck.normalizedIso,
    sourceEndpoint: meta.sourceEndpoint,
    note:
      meta.timestampPrecision === 'SNAPSHOT_FALLBACK'
        ? 'SNAPSHOT_LEVEL_TIMESTAMP_FALLBACK'
        : null,
  };
}

/**
 * Filters snapshots to chronologically ordered, deduplicated records matching dateRange,
 * excluding invalid/future timestamps and (by default) excluding IMPORTED_UNVERIFIED records.
 */
function selectEligibleChronologicalSnapshots(
  records: ProductObservationSnapshot[],
  options?: {
    dateRange?: string;
    nowMs?: number;
    includeImportedReference?: boolean;
  }
): ProductObservationSnapshot[] {
  const targetDateRange = options?.dateRange ?? 'last7Day';
  const nowMs = options?.nowMs ?? Date.now();
  const includeImported = options?.includeImportedReference === true;

  const byDay = new Map<string, ProductObservationSnapshot>();
  const sorted = records
    .filter((record) => {
      if (!record || record.dateRange !== targetDateRange) return false;
      const trust = normalizeTrustStatusForLocal(record.trustStatus);
      if (!includeImported && trust !== 'LOCAL_OBSERVED') return false;
      const tsCheck = normalizeNonFutureTimestamp(record.observedAt, nowMs);
      return tsCheck.valid && !tsCheck.future && Boolean(tsCheck.normalizedIso);
    })
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  for (const record of sorted) {
    const normalizedIso = new Date(Date.parse(record.observedAt)).toISOString();
    const dayKey = normalizedIso.slice(0, 10);
    const existing = byDay.get(dayKey);
    if (!existing) {
      byDay.set(dayKey, record);
    } else if (
      normalizeTrustStatusForLocal(existing.trustStatus) === 'IMPORTED_UNVERIFIED' &&
      normalizeTrustStatusForLocal(record.trustStatus) === 'LOCAL_OBSERVED'
    ) {
      byDay.set(dayKey, record);
    } else if (
      normalizeTrustStatusForLocal(existing.trustStatus) ===
        normalizeTrustStatusForLocal(record.trustStatus) &&
      Date.parse(record.observedAt) >= Date.parse(existing.observedAt)
    ) {
      byDay.set(dayKey, record);
    }
  }

  return Array.from(byDay.values()).sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  );
}

/**
 * Converts trusted LOCAL_OBSERVED ProductObservationSnapshot records into
 * HistoricalMetricSnapshot[] for strategyEngineV2 (`fast_rising_products`, `trend_timing_opportunity`).
 *
 * STRICT GUARDRAILS:
 * - Only LOCAL_OBSERVED records with valid non-future timestamps are emitted.
 * - IMPORTED_UNVERIFIED backup references are NEVER emitted to historical strategy gates.
 * - Per-metric fetchedAt and sourceEndpoint are preserved independently (never collapsed when distinct).
 * - Unverified `creatorCountUnverifiedRaw` is NEVER passed into `HistoricalMetricSnapshot.creatorCount`.
 * - Unverified `revenueGrowthRate` is NEVER passed into `HistoricalMetricSnapshot.revenueGrowthRate`.
 */
export function toStrategyHistoricalSnapshots(
  records: ProductObservationSnapshot[],
  options?: { dateRange?: string; nowMs?: number }
): HistoricalMetricSnapshot[] {
  const targetDateRange = options?.dateRange ?? 'last7Day';
  const nowMs = options?.nowMs ?? Date.now();

  const eligible = selectEligibleChronologicalSnapshots(records, {
    dateRange: targetDateRange,
    nowMs,
    includeImportedReference: false,
  });

  return eligible.map((record) => {
    const snapshot: HistoricalMetricSnapshot = {
      fetchedAt: record.observedAt,
      dateRange: record.dateRange,
      trustStatus: 'LOCAL_OBSERVED',
    };

    if (record.observations.revenueThb !== null) {
      const m = resolveMetricTimestampForStrategy(
        record,
        'revenueThb',
        targetDateRange,
        nowMs
      );
      if (m.eligible) {
        snapshot.revenueThb7d = makeVerifiedSnapshotMetric(
          record.observations.revenueThb,
          'THB',
          m.fetchedAt,
          record.dateRange,
          m.sourceEndpoint,
          m.note
        );
      }
    }

    if (record.observations.salesVolume !== null) {
      const m = resolveMetricTimestampForStrategy(
        record,
        'salesVolume',
        targetDateRange,
        nowMs
      );
      if (m.eligible) {
        snapshot.salesVolume7d = makeVerifiedSnapshotMetric(
          record.observations.salesVolume,
          'COUNT',
          m.fetchedAt,
          record.dateRange,
          m.sourceEndpoint,
          m.note
        );
      }
    }

    if (record.observations.creatorCountVerified !== null) {
      const m = resolveMetricTimestampForStrategy(
        record,
        'creatorCountVerified',
        targetDateRange,
        nowMs
      );
      if (m.eligible) {
        snapshot.creatorCount = makeVerifiedSnapshotMetric(
          record.observations.creatorCountVerified,
          'COUNT',
          m.fetchedAt,
          record.dateRange,
          m.sourceEndpoint,
          m.note
        );
      }
    }

    if (
      record.observations.revenueGrowthRate !== null &&
      record.observations.revenueGrowthVerified
    ) {
      const m = resolveMetricTimestampForStrategy(
        record,
        'revenueGrowthRate',
        targetDateRange,
        nowMs
      );
      if (m.eligible) {
        snapshot.revenueGrowthRate = makeVerifiedSnapshotMetric(
          record.observations.revenueGrowthRate,
          'PERCENT',
          m.fetchedAt,
          record.dateRange,
          m.sourceEndpoint,
          m.note
        );
      }
    }

    return snapshot;
  });
}

export function buildStrategySnapshotsMap(
  snapshotsByProductId: Record<string, ProductObservationSnapshot[]>,
  options?: { dateRange?: string; nowMs?: number }
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
 * Computes strictly DERIVED multi-day trend deltas from stored observations.
 * - By default uses ONLY LOCAL_OBSERVED records with valid non-future timestamps.
 * - Returns null if fewer than 2 time-separated (>=12h) distinct-day observations exist.
 * - Never fabricates historical trends or modifies source records.
 */
export function deriveSnapshotTrend(
  records: ProductObservationSnapshot[],
  options?: {
    dateRange?: string;
    minSpanHours?: number;
    nowMs?: number;
    includeImportedReference?: boolean;
  }
): SnapshotTrendDerivation | null {
  const targetDateRange = options?.dateRange ?? 'last7Day';
  const minSpanHours = options?.minSpanHours ?? 12;
  const includeImported = options?.includeImportedReference === true;

  const filtered = selectEligibleChronologicalSnapshots(records, {
    dateRange: targetDateRange,
    nowMs: options?.nowMs,
    includeImportedReference: includeImported,
  });

  if (filtered.length < 2) return null;

  const earliest = filtered[0];
  const latest = filtered[filtered.length - 1];
  const earliestMs = Date.parse(earliest.observedAt);
  const latestMs = Date.parse(latest.observedAt);
  if (!Number.isFinite(earliestMs) || !Number.isFinite(latestMs)) return null;

  const spanHours = (latestMs - earliestMs) / 3_600_000;
  if (spanHours < minSpanHours) return null;

  const hasImportedInWindow = filtered.some(
    (entry) => normalizeTrustStatusForLocal(entry.trustStatus) === 'IMPORTED_UNVERIFIED'
  );
  const verifiedCreatorDeltaPct =
    normalizeTrustStatusForLocal(earliest.trustStatus) === 'LOCAL_OBSERVED' &&
    normalizeTrustStatusForLocal(latest.trustStatus) === 'LOCAL_OBSERVED'
      ? computePercentDelta(
          earliest.observations.creatorCountVerified,
          latest.observations.creatorCountVerified
        )
      : null;

  return {
    provenance: 'DERIVED',
    trustScope: hasImportedInWindow
      ? 'INCLUDES_IMPORTED_UNVERIFIED'
      : 'LOCAL_OBSERVED_ONLY',
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
    verifiedCreatorDeltaPct,
  };
}

export function isValidProductObservationSnapshot(
  value: unknown
): value is ProductObservationSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
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
  if (!obj.observations || typeof obj.observations !== 'object' || Array.isArray(obj.observations)) {
    return false;
  }
  return true;
}

function sanitizeImportedAuditMetadata(
  rawObj: Record<string, unknown>,
  rawObs: Record<string, unknown>,
  importedAt: string
): SnapshotImportedAuditMetadata {
  const existingAudit =
    rawObj.importedAudit &&
    typeof rawObj.importedAudit === 'object' &&
    !Array.isArray(rawObj.importedAudit)
      ? (rawObj.importedAudit as Record<string, unknown>)
      : null;

  const rawClaimedCreator =
    typeof rawObs.creatorCountVerified === 'boolean' ||
    (typeof rawObs.creatorCountVerified === 'number' &&
      Number.isFinite(rawObs.creatorCountVerified))
      ? rawObs.creatorCountVerified
      : existingAudit &&
          (typeof existingAudit.claimedCreatorCountVerified === 'boolean' ||
            typeof existingAudit.claimedCreatorCountVerified === 'number')
        ? (existingAudit.claimedCreatorCountVerified as number | boolean)
        : null;

  const rawClaimedGrowth =
    typeof rawObs.revenueGrowthVerified === 'boolean'
      ? rawObs.revenueGrowthVerified
      : typeof existingAudit?.claimedRevenueGrowthVerified === 'boolean'
        ? (existingAudit.claimedRevenueGrowthVerified as boolean)
        : null;

  const claimedTrustStatus =
    typeof rawObj.trustStatus === 'string'
      ? rawObj.trustStatus
      : typeof existingAudit?.claimedTrustStatus === 'string'
        ? (existingAudit.claimedTrustStatus as string)
        : null;

  const claimedSourceEndpoint = normalizeEndpoint(
    rawObj.sourceEndpoint ?? existingAudit?.claimedSourceEndpoint
  );

  const originalProvenance =
    typeof rawObj.provenance === 'string'
      ? rawObj.provenance
      : typeof rawObs.provenance === 'string'
        ? rawObs.provenance
        : typeof existingAudit?.originalProvenance === 'string'
          ? (existingAudit.originalProvenance as string)
          : null;

  const originalVerificationStatus =
    typeof rawObj.verificationStatus === 'string'
      ? rawObj.verificationStatus
      : typeof rawObs.verificationStatus === 'string'
        ? rawObs.verificationStatus
        : typeof existingAudit?.originalVerificationStatus === 'string'
          ? (existingAudit.originalVerificationStatus as string)
          : null;

  return {
    importedAt,
    claimedTrustStatus,
    claimedSourceEndpoint,
    claimedCreatorCountVerified: rawClaimedCreator,
    claimedRevenueGrowthVerified: rawClaimedGrowth,
    originalProvenance,
    originalVerificationStatus,
  };
}

function sanitizeSnapshotRecordInternal(
  raw: ProductObservationSnapshot,
  mode: 'local_storage' | 'untrusted_import',
  options?: { nowMs?: number; importedAt?: string }
): ProductObservationSnapshot | null {
  const nowMs = options?.nowMs ?? Date.now();
  const tsCheck = normalizeNonFutureTimestamp(raw.observedAt, nowMs);
  if (!tsCheck.valid || tsCheck.future || !tsCheck.normalizedIso) {
    return null;
  }

  const normalizedObservedAt = tsCheck.normalizedIso;
  const normalizedDay = normalizedObservedAt.slice(0, 10);
  const endpoint = normalizeEndpoint(raw.sourceEndpoint);
  const rawObj = raw as unknown as Record<string, unknown>;
  const rawObs = raw.observations as unknown as Record<string, unknown>;

  const trustStatus: SnapshotTrustStatus =
    mode === 'untrusted_import'
      ? 'IMPORTED_UNVERIFIED'
      : normalizeTrustStatusForLocal(raw.trustStatus);

  const isUnverifiedTrust = trustStatus === 'IMPORTED_UNVERIFIED';

  const revenueThb = normalizeNonNegativeFiniteOrNull(rawObs.revenueThb);
  const salesVolume = normalizeNonNegativeFiniteOrNull(rawObs.salesVolume);
  const videoRevenueThb = normalizeNonNegativeFiniteOrNull(rawObs.videoRevenueThb);
  const liveRevenueThb = normalizeNonNegativeFiniteOrNull(rawObs.liveRevenueThb);
  const shoppingMallRevenueThb = normalizeNonNegativeFiniteOrNull(
    rawObs.shoppingMallRevenueThb
  );
  const unitPriceThb = normalizeNonNegativeFiniteOrNull(rawObs.unitPriceThb);
  const commissionRate = normalizeCommissionRateOrNull(rawObs.commissionRate);
  const revenueGrowthRate = normalizeFiniteOrNull(rawObs.revenueGrowthRate);

  // CRITICAL TRUST BOUNDARY:
  // Imported records NEVER gain verified status from client-controlled JSON flags.
  const rawVerifiedCreatorNum = normalizeNonNegativeFiniteOrNull(
    rawObs.creatorCountVerified
  );
  const rawUnverifiedCreatorNum = normalizeNonNegativeFiniteOrNull(
    rawObs.creatorCountUnverifiedRaw
  );

  const creatorCountVerified = isUnverifiedTrust ? null : rawVerifiedCreatorNum;
  const creatorCountUnverifiedRaw = isUnverifiedTrust
    ? (rawUnverifiedCreatorNum ?? rawVerifiedCreatorNum)
    : rawUnverifiedCreatorNum;
  const revenueGrowthVerified = isUnverifiedTrust
    ? false
    : rawObs.revenueGrowthVerified === true && revenueGrowthRate !== null;

  const observations: ProductSourceObservationValues = {
    revenueThb,
    salesVolume,
    videoRevenueThb,
    liveRevenueThb,
    shoppingMallRevenueThb,
    unitPriceThb,
    commissionRate,
    revenueGrowthRate,
    revenueGrowthVerified,
    creatorCountVerified,
    creatorCountUnverifiedRaw,
  };

  if (countObservedFields(observations) === 0 && creatorCountUnverifiedRaw === null) {
    return null;
  }

  // Sanitize optional per-metric metadata
  let sanitizedMetricMeta:
    | Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>
    | undefined;
  if (rawObj.metricMeta && typeof rawObj.metricMeta === 'object' && !Array.isArray(rawObj.metricMeta)) {
    const rawMetaObj = rawObj.metricMeta as Record<string, unknown>;
    const cleanMeta: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>> = {};
    for (const key of OBSERVATION_METRIC_KEYS) {
      if (isUnverifiedTrust && key === 'creatorCountVerified') {
        // Downgrade any imported creatorCountVerified metadata to creatorCountUnverifiedRaw reference
        const downgraded = sanitizeMetricMetaEntry(
          rawMetaObj.creatorCountVerified,
          endpoint,
          raw.dateRange.trim(),
          nowMs
        );
        if (downgraded && !cleanMeta.creatorCountUnverifiedRaw) {
          cleanMeta.creatorCountUnverifiedRaw = downgraded;
        }
        continue;
      }
      const entry = sanitizeMetricMetaEntry(
        rawMetaObj[key],
        endpoint,
        raw.dateRange.trim(),
        nowMs
      );
      if (entry) {
        cleanMeta[key] = entry;
      }
    }
    if (Object.keys(cleanMeta).length > 0) {
      sanitizedMetricMeta = cleanMeta;
    }
  }

  const importedAudit =
    mode === 'untrusted_import'
      ? sanitizeImportedAuditMetadata(
          rawObj,
          rawObs,
          options?.importedAt ?? new Date(nowMs).toISOString()
        )
      : isUnverifiedTrust &&
          rawObj.importedAudit &&
          typeof rawObj.importedAudit === 'object' &&
          !Array.isArray(rawObj.importedAudit)
        ? sanitizeImportedAuditMetadata(
            rawObj,
            rawObs,
            typeof (rawObj.importedAudit as Record<string, unknown>).importedAt === 'string'
              ? ((rawObj.importedAudit as Record<string, unknown>).importedAt as string)
              : new Date(nowMs).toISOString()
          )
        : undefined;

  return {
    snapshotVersion: 1,
    productId: raw.productId.trim(),
    observedAt: normalizedObservedAt,
    observationDay: normalizedDay,
    dateRange: raw.dateRange.trim(),
    sourceEndpoint: endpoint,
    trustStatus,
    dataConfidenceScore: normalizeFiniteOrNull(raw.dataConfidenceScore),
    dataConfidenceLevel:
      raw.dataConfidenceLevel === 'HIGH' ||
      raw.dataConfidenceLevel === 'MEDIUM' ||
      raw.dataConfidenceLevel === 'LOW' ||
      raw.dataConfidenceLevel === 'VERY_LOW'
        ? raw.dataConfidenceLevel
        : null,
    observations,
    ...(sanitizedMetricMeta ? { metricMeta: sanitizedMetricMeta } : {}),
    ...(importedAudit ? { importedAudit } : {}),
  };
}

/**
 * Sanitizes locally persisted snapshots from browser storage.
 * Preserves legitimate LOCAL_OBSERVED records while enforcing IMPORTED_UNVERIFIED restrictions
 * on previously imported records and rejecting invalid/future timestamps.
 */
export function sanitizeProductSnapshotsMap(
  raw: unknown,
  options?: { nowMs?: number }
): Record<string, ProductObservationSnapshot[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, ProductObservationSnapshot[]> = {};
  for (const [productId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    let cleanList: ProductObservationSnapshot[] = [];
    for (const item of list) {
      if (!isValidProductObservationSnapshot(item)) continue;
      if (item.productId !== productId) continue;
      const sanitized = sanitizeSnapshotRecordInternal(item, 'local_storage', options);
      if (!sanitized) continue;
      cleanList = appendObservationSnapshot(
        cleanList,
        sanitized,
        MAX_SNAPSHOTS_PER_PRODUCT,
        options
      ).snapshots;
    }
    if (cleanList.length > 0) {
      result[productId] = cleanList;
    }
  }
  return result;
}

/**
 * Untrusted backup import sanitizer:
 * - Marks EVERY imported snapshot IMPORTED_UNVERIFIED regardless of client-supplied flags.
 * - Strips creatorCountVerified and revenueGrowthVerified from untrusted JSON while preserving
 *   audit metadata and numeric reference values so users can inspect their restored history.
 * - Rejects invalid or future timestamps.
 */
export function sanitizeImportedProductSnapshotsMap(
  raw: unknown,
  options?: { nowMs?: number; importedAt?: string }
): Record<string, ProductObservationSnapshot[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, ProductObservationSnapshot[]> = {};
  for (const [productId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    let cleanList: ProductObservationSnapshot[] = [];
    for (const item of list) {
      if (!isValidProductObservationSnapshot(item)) continue;
      if (item.productId !== productId) continue;
      const sanitized = sanitizeSnapshotRecordInternal(item, 'untrusted_import', options);
      if (!sanitized) continue;
      cleanList = appendObservationSnapshot(
        cleanList,
        sanitized,
        MAX_SNAPSHOTS_PER_PRODUCT,
        options
      ).snapshots;
    }
    if (cleanList.length > 0) {
      result[productId] = cleanList;
    }
  }
  return result;
}

export function loadProductSnapshotsFromStorage(
  storage: StorageLike | null = getDefaultStorage(),
  options?: { nowMs?: number }
): Record<string, ProductObservationSnapshot[]> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PRODUCT_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeProductSnapshotsMap(JSON.parse(raw), options);
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
  const current = loadProductSnapshotsFromStorage(storage, { nowMs: options?.nowMs });
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
    const result = appendObservationSnapshot(
      existingList,
      snapshot,
      MAX_SNAPSHOTS_PER_PRODUCT,
      { nowMs: options?.nowMs }
    );
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

/**
 * Merges restored backup snapshots into local storage with strict trust-boundary enforcement:
 * - Re-sanitizes every imported record as IMPORTED_UNVERIFIED regardless of caller input.
 * - Never overwrites or modifies existing trusted LOCAL_OBSERVED records.
 * - Preserves restored imported snapshots as inspectable historical references.
 */
export function mergeRestoredProductSnapshots(
  current: Record<string, ProductObservationSnapshot[]>,
  imported: Record<string, ProductObservationSnapshot[]>,
  storage: StorageLike | null = getDefaultStorage(),
  options?: { nowMs?: number; importedAt?: string }
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
      if (rawItem.productId !== productId) continue;
      const clean = sanitizeSnapshotRecordInternal(
        rawItem,
        'untrusted_import',
        options
      );
      if (!clean) continue;
      const res = appendObservationSnapshot(
        bucket,
        clean,
        MAX_SNAPSHOTS_PER_PRODUCT,
        options
      );
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
