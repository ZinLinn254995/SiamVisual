import type {
  MetricProvenance,
  MetricUnit,
  ProductMetricSourceEndpoint,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../types/metrics.ts';
import type { ProductItem } from '../types.ts';

export const DEFAULT_METRIC_STALE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type StrictNumericParseResult =
  | { kind: 'missing' }
  | { kind: 'valid'; value: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'invalid'; reason: string };

const RANGE_PATTERN =
  /^\s*[฿$]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*[-–~]\s*[฿$]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*$/;

const STRICT_NUMBER_PATTERN =
  /^\s*([+-])?\s*(?:[฿$]|THB\s*)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*$/i;

const SIMPLE_SCI_OR_DECIMAL_PATTERN =
  /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i;

/**
 * Strictly parses numeric inputs without silently stripping arbitrary garbage
 * or collapsing price ranges like "199-299" into a single number.
 */
export function parseStrictNumericInput(rawInput: unknown): StrictNumericParseResult {
  if (rawInput === null || rawInput === undefined) {
    return { kind: 'missing' };
  }

  if (typeof rawInput === 'number') {
    if (!Number.isFinite(rawInput)) {
      return { kind: 'invalid', reason: 'Non-finite number (NaN or Infinity).' };
    }
    return { kind: 'valid', value: rawInput };
  }

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { kind: 'missing' };
    }

    const rangeMatch = trimmed.match(RANGE_PATTERN);
    if (rangeMatch) {
      const minNum = Number.parseFloat(
        `${rangeMatch[1].replace(/,/g, '')}${rangeMatch[2] ? `.${rangeMatch[2]}` : ''}`
      );
      const maxNum = Number.parseFloat(
        `${rangeMatch[3].replace(/,/g, '')}${rangeMatch[4] ? `.${rangeMatch[4]}` : ''}`
      );
      if (Number.isFinite(minNum) && Number.isFinite(maxNum)) {
        return { kind: 'range', min: minNum, max: maxNum };
      }
      return { kind: 'invalid', reason: `Unparseable range string: "${trimmed}".` };
    }

    const currencyOrPlain = trimmed.match(STRICT_NUMBER_PATTERN);
    if (currencyOrPlain) {
      const sign = currencyOrPlain[1] === '-' ? -1 : 1;
      const intPart = currencyOrPlain[2].replace(/,/g, '');
      const fracPart = currencyOrPlain[3] ? `.${currencyOrPlain[3]}` : '';
      const parsed = sign * Number.parseFloat(`${intPart}${fracPart}`);
      if (Number.isFinite(parsed)) {
        return { kind: 'valid', value: parsed };
      }
    }

    if (SIMPLE_SCI_OR_DECIMAL_PATTERN.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return { kind: 'valid', value: parsed };
      }
    }

    return { kind: 'invalid', reason: `Malformed numeric string: "${trimmed}".` };
  }

  return {
    kind: 'invalid',
    reason: `Unsupported input type "${typeof rawInput}".`,
  };
}

/**
 * Safe strict number extractor for legacy fields (returns null on missing, range, or invalid input).
 */
export function parseStrictFiniteNumber(rawInput: unknown): number | null {
  const parsed = parseStrictNumericInput(rawInput);
  return parsed.kind === 'valid' ? parsed.value : null;
}

export interface TimestampValidationResult {
  valid: boolean;
  normalizedIso: string | null;
  stale: boolean;
  future: boolean;
  ageMs: number | null;
  reason: string | null;
}

export function validateMetricTimestamp(
  fetchedAt: string | null | undefined,
  options?: { staleAfterMs?: number; nowMs?: number; maxFutureSkewMs?: number }
): TimestampValidationResult {
  if (fetchedAt === null || fetchedAt === undefined || !fetchedAt.trim()) {
    return {
      valid: false,
      normalizedIso: null,
      stale: false,
      future: false,
      ageMs: null,
      reason: 'Missing fetchedAt timestamp.',
    };
  }

  const parsedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(parsedMs)) {
    return {
      valid: false,
      normalizedIso: null,
      stale: false,
      future: false,
      ageMs: null,
      reason: `Invalid fetchedAt timestamp: "${fetchedAt}".`,
    };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const staleAfterMs = options?.staleAfterMs ?? DEFAULT_METRIC_STALE_MS;
  const maxFutureSkewMs = options?.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  const ageMs = nowMs - parsedMs;
  const future = ageMs < -maxFutureSkewMs;
  const stale = !future && staleAfterMs >= 0 && ageMs > staleAfterMs;

  return {
    valid: !future,
    normalizedIso: new Date(parsedMs).toISOString(),
    stale,
    future,
    ageMs,
    reason: future
      ? `Snapshot timestamp is in the future by ${Math.round(Math.abs(ageMs) / 60000)}m relative to reference clock.`
      : stale
        ? `Snapshot age (${Math.round(ageMs / 3600000)}h) exceeds freshness TTL.`
        : null,
  };
}

export interface ValidateNumericMetricOptions {
  rawInput: unknown;
  unit: MetricUnit;
  provenance?: MetricProvenance;
  fetchedAt?: string | null;
  dateRange?: string | null;
  allowZero?: boolean;
  allowNegative?: boolean;
  integerOnly?: boolean;
  decimalPlaces?: number;
  minValue?: number;
  maxValue?: number;
  staleAfterMs?: number;
  nowMs?: number;
  missingAsUnavailable?: boolean;
  unavailableReason?: string | null;
  note?: string | null;
}

function roundToDecimals(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

export function validateNumericMetric(
  options: ValidateNumericMetricOptions
): ValidatedMetric<number> {
  const provenance: MetricProvenance = options.provenance ?? 'SOURCE';
  const dateRange = options.dateRange ?? null;
  const tsCheck = validateMetricTimestamp(options.fetchedAt, {
    staleAfterMs: options.staleAfterMs,
    nowMs: options.nowMs,
  });
  const normalizedFetchedAt = tsCheck.normalizedIso ?? options.fetchedAt ?? null;

  const parsed = parseStrictNumericInput(options.rawInput);

  if (parsed.kind === 'missing') {
    if (options.missingAsUnavailable) {
      return {
        value: null,
        state: 'UNAVAILABLE',
        provenance,
        rawInput: options.rawInput ?? null,
        unit: options.unit,
        fetchedAt: normalizedFetchedAt,
        dateRange,
        note: options.unavailableReason ?? options.note ?? 'Metric unavailable from upstream source.',
      };
    }
    return {
      value: null,
      state: 'MISSING',
      provenance,
      rawInput: options.rawInput ?? null,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? 'Missing from payload.',
    };
  }

  if (parsed.kind === 'range') {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note:
        options.note ??
        `Ambiguous range (${parsed.min}..${parsed.max}) cannot be normalized into a single scalar value.`,
    };
  }

  if (parsed.kind === 'invalid') {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? parsed.reason,
    };
  }

  const rawNum = parsed.value;

  if (options.allowNegative !== true && rawNum < 0) {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? `Negative value (${rawNum}) is invalid for this metric.`,
    };
  }

  if (options.allowZero === false && rawNum === 0) {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? 'Zero is not valid for this metric.',
    };
  }

  if (options.minValue !== undefined && rawNum < options.minValue) {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? `Value (${rawNum}) is below minimum (${options.minValue}).`,
    };
  }

  if (options.maxValue !== undefined && rawNum > options.maxValue) {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.note ?? `Value (${rawNum}) exceeds maximum (${options.maxValue}).`,
    };
  }

  if (options.unavailableReason) {
    return {
      value: null,
      state: 'UNAVAILABLE',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: options.unavailableReason,
    };
  }

  let normalized = rawNum;
  if (options.integerOnly) {
    normalized = Math.round(normalized);
  } else if (options.decimalPlaces !== undefined) {
    normalized = roundToDecimals(normalized, options.decimalPlaces);
  }

  if (options.fetchedAt !== undefined && options.fetchedAt !== null && tsCheck.future) {
    return {
      value: null,
      state: 'INVALID',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: tsCheck.reason ?? 'Future metric timestamp is invalid.',
    };
  }

  if (options.fetchedAt !== undefined && options.fetchedAt !== null && !tsCheck.valid) {
    return {
      value: null,
      state: 'STALE',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: tsCheck.reason ?? 'Invalid metric timestamp; treated as stale.',
    };
  }

  if (tsCheck.stale) {
    return {
      value: normalized,
      state: 'STALE',
      provenance,
      rawInput: options.rawInput,
      unit: options.unit,
      fetchedAt: normalizedFetchedAt,
      dateRange,
      note: tsCheck.reason ?? options.note ?? 'Metric data is stale.',
    };
  }

  return {
    value: normalized,
    state: normalized === 0 ? 'ZERO' : 'OK',
    provenance,
    rawInput: options.rawInput,
    unit: options.unit,
    fetchedAt: normalizedFetchedAt,
    dateRange,
    note: options.note ?? null,
  };
}

export interface MetricContext {
  fetchedAt?: string | null;
  dateRange?: string | null;
  staleAfterMs?: number;
  nowMs?: number;
}

/**
 * Validates listed THB price. Rejects <= 0 and ambiguous range strings like "199-299".
 */
export function validatePriceThbMetric(
  rawInput: unknown,
  context?: MetricContext
): ValidatedMetric<number> {
  return validateNumericMetric({
    rawInput,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: context?.fetchedAt,
    dateRange: context?.dateRange ?? null,
    allowZero: false,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: context?.staleAfterMs,
    nowMs: context?.nowMs,
  });
}

/**
 * Validates a metric whose upstream unit or semantics are UNVERIFIED per Phase 0.
 * Preserves rawInput and explicitly withholds numeric normalization from scoring.
 */
export function validateUnverifiedNumericMetric(
  rawInput: unknown,
  options: {
    allowNegative?: boolean;
    minValue?: number;
    maxValue?: number;
    missingAsUnavailable?: boolean;
    unverifiedNote: string;
    context?: MetricContext;
  }
): ValidatedMetric<number> {
  return validateNumericMetric({
    rawInput,
    unit: 'UNVERIFIED',
    provenance: 'SOURCE',
    fetchedAt: options.context?.fetchedAt,
    dateRange: options.context?.dateRange ?? null,
    allowZero: true,
    allowNegative: options.allowNegative ?? false,
    minValue: options.minValue,
    maxValue: options.maxValue,
    staleAfterMs: options.context?.staleAfterMs,
    nowMs: options.context?.nowMs,
    missingAsUnavailable: options.missingAsUnavailable,
    unavailableReason: options.unverifiedNote,
  });
}

/**
 * Validates commission_rate using Phase 0 live-verified percentage-point scale:
 * - 0 stays ZERO/PERCENT (mathematically invariant).
 * - 1..100 is verified percentage points on /rank and /detail (e.g. 10 = 10%, 7 = 7%, 15 = 15%).
 * - 0 < val < 1 stays UNAVAILABLE/UNVERIFIED because sub-1% encoding vs legacy decimal ratio
 *   was not observed in live top-20 samples.
 * - < 0 or > 100 is INVALID.
 */
export function validateCommissionRateMetric(
  rawInput: unknown,
  context?: MetricContext
): ValidatedMetric<number> {
  const parsed = parseStrictNumericInput(rawInput);

  if (parsed.kind === 'valid') {
    if (parsed.value === 0) {
      return validateNumericMetric({
        rawInput,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: context?.fetchedAt,
        dateRange: context?.dateRange ?? null,
        allowZero: true,
        allowNegative: false,
        staleAfterMs: context?.staleAfterMs,
        nowMs: context?.nowMs,
        note: 'Zero commission is invariant across decimal and percentage representations.',
      });
    }

    if (parsed.value >= 1 && parsed.value <= 100) {
      return validateNumericMetric({
        rawInput,
        unit: 'PERCENT',
        provenance: 'SOURCE',
        fetchedAt: context?.fetchedAt,
        dateRange: context?.dateRange ?? null,
        allowZero: true,
        allowNegative: false,
        minValue: 0,
        maxValue: 100,
        decimalPlaces: 2,
        staleAfterMs: context?.staleAfterMs,
        nowMs: context?.nowMs,
        note: 'Phase 0 verified percentage-point unit on /rank and /detail (e.g. 10 = 10%); open-plan vs targeted-plan commission semantics remain UNVERIFIED.',
      });
    }

    if (parsed.value > 0 && parsed.value < 1) {
      return validateUnverifiedNumericMetric(rawInput, {
        allowNegative: false,
        minValue: 0,
        maxValue: 100,
        unverifiedNote:
          'UNVERIFIED_COMMISSION_SUB_ONE: raw commission_rate between 0 and 1 preserved; sub-1% percentage vs decimal ratio encoding was not observed in Phase 0 live samples.',
        context,
      });
    }
  }

  return validateNumericMetric({
    rawInput,
    unit: 'PERCENT',
    provenance: 'SOURCE',
    fetchedAt: context?.fetchedAt,
    dateRange: context?.dateRange ?? null,
    allowZero: true,
    allowNegative: false,
    minValue: 0,
    maxValue: 100,
    decimalPlaces: 2,
    staleAfterMs: context?.staleAfterMs,
    nowMs: context?.nowMs,
  });
}

/**
 * Computes synthetic gross commission payout in THB ONLY from verified-unit metrics.
 * Never enforces a synthetic minimum floor (e.g. 0.58 stays 0.58; 0 stays 0).
 */
export function computeSyntheticCommissionThb(
  priceMetric: ValidatedMetric<number>,
  commissionPercentMetric: ValidatedMetric<number>
): ValidatedMetric<number> {
  const fetchedAt = priceMetric.fetchedAt ?? commissionPercentMetric.fetchedAt ?? null;
  const dateRange = priceMetric.dateRange ?? commissionPercentMetric.dateRange ?? null;

  if (commissionPercentMetric.state === 'ZERO') {
    if (priceMetric.state === 'OK' || priceMetric.state === 'ZERO' || priceMetric.state === 'MISSING') {
      return {
        value: 0,
        state: 'ZERO',
        provenance: 'SYNTHETIC',
        rawInput: {
          priceThb: priceMetric.rawInput,
          commissionRate: commissionPercentMetric.rawInput,
        },
        unit: 'THB',
        fetchedAt,
        dateRange,
        note: 'Derived synthetic commission payout: 0% commission yields 0 THB.',
      };
    }
  }

  if (
    priceMetric.state === 'STALE' ||
    commissionPercentMetric.state === 'STALE'
  ) {
    return {
      value: null,
      state: 'STALE',
      provenance: 'SYNTHETIC',
      rawInput: {
        priceThb: priceMetric.rawInput,
        commissionRate: commissionPercentMetric.rawInput,
      },
      unit: 'THB',
      fetchedAt,
      dateRange,
      note: 'Cannot derive trustworthy commission payout from stale input metric.',
    };
  }

  if (
    priceMetric.state === 'INVALID' ||
    commissionPercentMetric.state === 'INVALID'
  ) {
    return {
      value: null,
      state: 'INVALID',
      provenance: 'SYNTHETIC',
      rawInput: {
        priceThb: priceMetric.rawInput,
        commissionRate: commissionPercentMetric.rawInput,
      },
      unit: 'THB',
      fetchedAt,
      dateRange,
      note: 'Cannot derive commission payout from invalid price or commission rate.',
    };
  }

  if (
    commissionPercentMetric.state === 'UNAVAILABLE' ||
    priceMetric.state === 'UNAVAILABLE' ||
    commissionPercentMetric.unit === 'UNVERIFIED' ||
    priceMetric.unit === 'UNVERIFIED'
  ) {
    return {
      value: null,
      state: 'UNAVAILABLE',
      provenance: 'SYNTHETIC',
      rawInput: {
        priceThb: priceMetric.rawInput,
        commissionRate: commissionPercentMetric.rawInput,
      },
      unit: 'THB',
      fetchedAt,
      dateRange,
      note: 'Blocked: cannot derive THB commission payout while commissionRate unit is unverified.',
    };
  }

  if (
    priceMetric.state === 'MISSING' ||
    commissionPercentMetric.state === 'MISSING' ||
    priceMetric.value === null ||
    commissionPercentMetric.value === null
  ) {
    return {
      value: null,
      state: 'MISSING',
      provenance: 'SYNTHETIC',
      rawInput: {
        priceThb: priceMetric.rawInput,
        commissionRate: commissionPercentMetric.rawInput,
      },
      unit: 'THB',
      fetchedAt,
      dateRange,
      note: 'Missing price or commissionRate required to estimate THB commission payout.',
    };
  }

  const rateRatio =
    commissionPercentMetric.unit === 'RATIO'
      ? commissionPercentMetric.value
      : commissionPercentMetric.value / 100;
  const computed = roundToDecimals(priceMetric.value * rateRatio, 2);

  return {
    value: computed,
    state: computed === 0 ? 'ZERO' : 'OK',
    provenance: 'SYNTHETIC',
    rawInput: {
      priceThb: priceMetric.rawInput,
      commissionRate: commissionPercentMetric.rawInput,
    },
    unit: 'THB',
    fetchedAt,
    dateRange,
    note: 'Derived synthetic gross commission payout (priceThb * commissionRate; no minimum floor).',
  };
}

/**
 * Explicit synthetic revenue estimator (never labeled as SOURCE).
 */
export function computeSyntheticRevenueEstimate(
  salesVolumeMetric: ValidatedMetric<number>,
  priceMetric: ValidatedMetric<number>
): ValidatedMetric<number> {
  const fetchedAt = salesVolumeMetric.fetchedAt ?? priceMetric.fetchedAt ?? null;
  const dateRange = salesVolumeMetric.dateRange ?? priceMetric.dateRange ?? null;

  if (
    !isUsableScoringMetric(salesVolumeMetric) ||
    !isUsableScoringMetric(priceMetric)
  ) {
    return {
      value: null,
      state: 'UNAVAILABLE',
      provenance: 'SYNTHETIC',
      rawInput: {
        salesVolume: salesVolumeMetric.rawInput,
        priceThb: priceMetric.rawInput,
      },
      unit: 'THB',
      fetchedAt,
      dateRange,
      note: 'Synthetic revenue estimate requires usable SOURCE salesVolume and priceThb metrics.',
    };
  }

  const estimated = Math.round(salesVolumeMetric.value * priceMetric.value);
  return {
    value: estimated,
    state: estimated === 0 ? 'ZERO' : 'OK',
    provenance: 'SYNTHETIC',
    rawInput: {
      salesVolume: salesVolumeMetric.rawInput,
      priceThb: priceMetric.rawInput,
    },
    unit: 'THB',
    fetchedAt,
    dateRange,
    note: 'Synthetic estimate (salesVolume * priceThb); must never replace upstream SOURCE revenue.',
  };
}

/**
 * Scoring guardrail: rejects MISSING, INVALID, UNAVAILABLE, STALE, UNVERIFIED-unit,
 * and (by default) SYNTHETIC values so bad or unverified inputs cannot enter scoring.
 */
export function isUsableScoringMetric(
  metric: ValidatedMetric<number> | null | undefined,
  options?: { allowSynthetic?: boolean }
): metric is ValidatedMetric<number> & { value: number } {
  if (!metric) return false;
  if (metric.state !== 'OK' && metric.state !== 'ZERO') return false;
  if (metric.value === null || !Number.isFinite(metric.value)) return false;
  if (metric.unit === 'UNVERIFIED') return false;
  if (!options?.allowSynthetic && metric.provenance !== 'SOURCE') return false;
  return true;
}

function pickFirstDefined(
  row: Record<string, unknown>,
  keys: readonly string[]
): { key: string | null; value: unknown } {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return { key, value: row[key] };
    }
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return { key, value: row[key] };
    }
  }
  return { key: null, value: undefined };
}

function hasUnverifiedSemanticsNote(metric: ValidatedMetric<number>): boolean {
  return Boolean(metric.note && /UNVERIFIED_COMPARISON_PERIOD/i.test(metric.note));
}

function collectUnresolvedFields(metrics: Omit<ProductValidatedMetrics, 'unresolvedFields'>): string[] {
  const entries: Array<[string, ValidatedMetric<number>]> = [
    ['priceThb', metrics.priceThb],
    ['commissionRate', metrics.commissionRate],
    ['commissionThb', metrics.commissionThb],
    ['salesVolume7d', metrics.salesVolume7d],
    ['revenueThb7d', metrics.revenueThb7d],
    ['videoRevenueThb7d', metrics.videoRevenueThb7d],
    ['liveRevenueThb7d', metrics.liveRevenueThb7d],
    ...(metrics.shoppingMallRevenueThb7d
      ? ([['shoppingMallRevenueThb7d', metrics.shoppingMallRevenueThb7d]] as Array<[string, ValidatedMetric<number>]>)
      : []),
    ['revenueGrowthRate', metrics.revenueGrowthRate],
    ['creatorCount', metrics.creatorCount],
    ['rating', metrics.rating],
    ['reviewCount', metrics.reviewCount],
  ];
  return entries
    .filter(
      ([, m]) =>
        m.unit === 'UNVERIFIED' ||
        m.state === 'UNAVAILABLE' ||
        hasUnverifiedSemanticsNote(m)
    )
    .map(([name]) => name);
}

/**
 * Converts a raw Kalodata API row directly into Phase 1 ValidatedMetrics
 * WITHOUT fabricating missing values or guessing unverified units.
 */
export function adaptRawKalodataRowToValidatedMetrics(
  row: Record<string, unknown>,
  options: {
    fetchedAt: string;
    dateRange: string;
    sourceEndpoint: ProductMetricSourceEndpoint;
    staleAfterMs?: number;
    nowMs?: number;
  }
): ProductValidatedMetrics {
  const ctx: MetricContext = {
    fetchedAt: options.fetchedAt,
    dateRange: options.dateRange,
    staleAfterMs: options.staleAfterMs,
    nowMs: options.nowMs,
  };

  const pricePick = pickFirstDefined(row, ['unit_price', 'avg_price', 'min_price', 'price']);
  const priceThb = validatePriceThbMetric(pricePick.value, ctx);

  const commissionRate = validateCommissionRateMetric(row.commission_rate, ctx);
  const commissionThb = computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesPick = pickFirstDefined(row, ['sales_volumn', 'sales_volume', 'sale_count', 'item_sold']);
  const salesVolume7d = validateNumericMetric({
    rawInput: salesPick.value,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note: salesPick.key
      ? `Source key: ${salesPick.key} (Phase 0 partially verified count).`
      : 'Sales volume field absent in upstream row.',
  });

  const revenueThb7d = validateNumericMetric({
    rawInput: row.revenue,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note:
      row.revenue === undefined || row.revenue === null
        ? 'Upstream revenue missing; synthetic sales*price estimate not substituted.'
        : 'Phase 0 verified THB currency scale (matches video + live + shopping_mall/showcase); gross vs net-of-refunds remains UNVERIFIED.',
  });

  const videoRevenueThb7d = validateNumericMetric({
    rawInput: row.video_revenue,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note:
      row.video_revenue === undefined || row.video_revenue === null
        ? 'Upstream video_revenue missing.'
        : 'Phase 0 verified THB video channel revenue aligned with requested window.',
  });

  const liveRevenueThb7d = validateNumericMetric({
    rawInput: row.live_revenue,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note:
      row.live_revenue === undefined || row.live_revenue === null
        ? 'Upstream live_revenue missing.'
        : 'Phase 0 verified THB live channel revenue aligned with requested window.',
  });

  const mallRevPick = pickFirstDefined(row, ['shopping_mall_revenue', 'showcase_revenue']);
  const shoppingMallRevenueThb7d = validateNumericMetric({
    rawInput: mallRevPick.value,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note: mallRevPick.key
      ? `Phase 0 verified THB ${mallRevPick.key} channel revenue aligned with requested window.`
      : 'Upstream shopping_mall_revenue / showcase_revenue missing.',
  });

  const revenueGrowthRate = validateNumericMetric({
    rawInput: row.revenue_growth_rate,
    unit: 'PERCENT',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: true,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note:
      row.revenue_growth_rate === undefined || row.revenue_growth_rate === null
        ? 'Upstream revenue_growth_rate absent (not returned by /detail; returned on /rank).'
        : 'Phase 0 verified percentage-point unit on /rank (e.g. 17.75 = +17.75%); UNVERIFIED_COMPARISON_PERIOD: exact baseline window and zero-baseline encoding remain UNVERIFIED.',
  });

  const creatorPick = pickFirstDefined(row, [
    'creator_number',
    'creator_count',
    'affiliate_count',
    'influencer_count',
  ]);
  const creatorCount = validateUnverifiedNumericMetric(creatorPick.value, {
    allowNegative: false,
    unverifiedNote: creatorPick.key
      ? `UNVERIFIED_CREATOR_DEFINITION: mapped from ${creatorPick.key}; active-window vs selling-creators vs lifetime scope remains UNVERIFIED.`
      : 'UNVERIFIED_CREATOR_DEFINITION: creator_number absent on /rank; time-window scope remains UNVERIFIED.',
    context: ctx,
  });

  const ratingPick = pickFirstDefined(row, ['product_rating', 'rating']);
  const isKalodataTestedEndpoint =
    options.sourceEndpoint === 'rank' || options.sourceEndpoint === 'detail';
  const rating = validateUnverifiedNumericMetric(ratingPick.value, {
    allowNegative: false,
    minValue: 0,
    maxValue: 5,
    missingAsUnavailable: isKalodataTestedEndpoint,
    unverifiedNote:
      ratingPick.value === undefined || ratingPick.value === null
        ? 'RATING_UNAVAILABLE_ON_ENDPOINT: tested Kalodata /rank and /detail (need_extra: true) endpoints do not return product rating.'
        : 'UNVERIFIED_RATING_SEMANTICS: upstream rating coverage and zero-vs-unrated sentinel remain UNVERIFIED.',
    context: ctx,
  });

  const reviewPick = pickFirstDefined(row, [
    'product_review_count',
    'review_count',
    'comment_count',
  ]);
  const reviewCount = validateUnverifiedNumericMetric(reviewPick.value, {
    allowNegative: false,
    unverifiedNote: reviewPick.key
      ? `UNVERIFIED_REVIEW_COUNT: mapped from ${reviewPick.key}; lifetime PDP count vs window-scoped semantics remain UNVERIFIED.`
      : 'UNVERIFIED_REVIEW_COUNT: product_review_count absent on /rank; time-window semantics remain UNVERIFIED.',
    context: ctx,
  });

  const base: Omit<ProductValidatedMetrics, 'unresolvedFields'> = {
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    liveRevenueThb7d,
    shoppingMallRevenueThb7d,
    revenueGrowthRate,
    creatorCount,
    rating,
    reviewCount,
    fetchedAt: options.fetchedAt,
    dateRange: options.dateRange,
    sourceEndpoint: options.sourceEndpoint,
  };

  return {
    ...base,
    unresolvedFields: collectUnresolvedFields(base),
  };
}

/**
 * Safe adapter for existing normalized ProductItem instances (e.g. legacy localStorage items).
 * Retains already-attached validatedMetrics when present, or derives a conservative view
 * without inventing missing data or guessing unverified units.
 */
export function adaptProductItemToValidatedMetrics(
  product: ProductItem,
  options?: { staleAfterMs?: number; nowMs?: number }
): ProductValidatedMetrics {
  if (product.validatedMetrics) {
    return product.validatedMetrics;
  }

  const m = product.kalodataMetrics;
  const inferredFetchedAt =
    m?.fetchedAt ?? product.deepInsights?.fetchedAt ?? null;
  const dateRange = m?.dateRange ?? 'last7Day';

  const ctx: MetricContext = {
    fetchedAt: inferredFetchedAt,
    dateRange,
    staleAfterMs: options?.staleAfterMs,
    nowMs: options?.nowMs,
  };

  const priceThb = validatePriceThbMetric(product.priceThb, ctx);
  const commissionRate = validateCommissionRateMetric(product.commissionRate, ctx);
  const commissionThb = computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesVolume7d = validateNumericMetric({
    rawInput: m?.salesVolume7d ?? null,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
  });

  const revenueThb7d = validateNumericMetric({
    rawInput: m?.revenueThb7d ?? null,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
  });

  const videoRevenueThb7d = validateNumericMetric({
    rawInput: m?.videoRevenueThb7d ?? null,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
  });

  const liveRevenueThb7d = validateNumericMetric({
    rawInput: m?.liveRevenueThb7d ?? null,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: false,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
  });

  const shoppingMallRevenueThb7d =
    m?.shoppingMallRevenueThb7d !== undefined
      ? validateNumericMetric({
          rawInput: m.shoppingMallRevenueThb7d,
          unit: 'THB',
          provenance: 'SOURCE',
          fetchedAt: ctx.fetchedAt,
          dateRange: ctx.dateRange,
          allowZero: true,
          allowNegative: false,
          decimalPlaces: 2,
          staleAfterMs: ctx.staleAfterMs,
          nowMs: ctx.nowMs,
        })
      : undefined;

  const revenueGrowthRate = validateNumericMetric({
    rawInput: m?.revenueGrowthRate ?? null,
    unit: 'PERCENT',
    provenance: 'SOURCE',
    fetchedAt: ctx.fetchedAt,
    dateRange: ctx.dateRange,
    allowZero: true,
    allowNegative: true,
    decimalPlaces: 2,
    staleAfterMs: ctx.staleAfterMs,
    nowMs: ctx.nowMs,
    note:
      m?.revenueGrowthRate === undefined || m?.revenueGrowthRate === null
        ? 'Legacy product missing revenueGrowthRate.'
        : 'Legacy growth rate preserved in percentage points; UNVERIFIED_COMPARISON_PERIOD: exact baseline window remains UNVERIFIED.',
  });

  const creatorCount = validateUnverifiedNumericMetric(m?.creatorCount ?? null, {
    allowNegative: false,
    unverifiedNote:
      'UNVERIFIED_CREATOR_DEFINITION: creator_number time-window and activity scope remain UNVERIFIED.',
    context: ctx,
  });

  const rating = validateUnverifiedNumericMetric(m?.rating ?? null, {
    allowNegative: false,
    minValue: 0,
    maxValue: 5,
    missingAsUnavailable: true,
    unverifiedNote:
      m?.rating === undefined || m?.rating === null
        ? 'RATING_UNAVAILABLE_ON_ENDPOINT: tested Kalodata endpoints do not return product rating.'
        : 'UNVERIFIED_RATING_SEMANTICS: rating coverage and unrated sentinel remain UNVERIFIED.',
    context: ctx,
  });

  const reviewCount = validateUnverifiedNumericMetric(m?.reviewCount ?? null, {
    allowNegative: false,
    unverifiedNote:
      'UNVERIFIED_REVIEW_COUNT: product_review_count time-window semantics remain UNVERIFIED.',
    context: ctx,
  });

  const base: Omit<ProductValidatedMetrics, 'unresolvedFields'> = {
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    liveRevenueThb7d,
    ...(shoppingMallRevenueThb7d ? { shoppingMallRevenueThb7d } : {}),
    revenueGrowthRate,
    creatorCount,
    rating,
    reviewCount,
    fetchedAt: inferredFetchedAt,
    dateRange,
    sourceEndpoint: 'legacy_product',
  };

  return {
    ...base,
    unresolvedFields: collectUnresolvedFields(base),
  };
}

function refreshSingleValidatedMetricFreshness(
  metric: ValidatedMetric<number>,
  options: { staleAfterMs?: number; nowMs?: number }
): ValidatedMetric<number> {
  if (options.nowMs === undefined) return metric;
  if (metric.state !== 'OK' && metric.state !== 'ZERO') return metric;
  if (!metric.fetchedAt) return metric;

  const tsCheck = validateMetricTimestamp(metric.fetchedAt, {
    staleAfterMs: options.staleAfterMs,
    nowMs: options.nowMs,
  });

  if (tsCheck.future) {
    return {
      ...metric,
      value: null,
      state: 'INVALID',
      note: tsCheck.reason ?? metric.note ?? 'Future metric timestamp is invalid.',
    };
  }
  if (!tsCheck.valid || tsCheck.stale) {
    return {
      ...metric,
      state: 'STALE',
      note: tsCheck.reason ?? metric.note ?? 'Metric data is stale.',
    };
  }
  return metric;
}

/**
 * Re-evaluates freshness on an existing ProductValidatedMetrics bundle against `nowMs`.
 * Returns the original object reference untouched when `nowMs` is omitted or no metric state changed.
 */
export function refreshProductValidatedMetricsFreshness(
  metrics: ProductValidatedMetrics,
  options?: { staleAfterMs?: number; nowMs?: number }
): ProductValidatedMetrics {
  if (!options || options.nowMs === undefined) {
    return metrics;
  }

  const priceThb = refreshSingleValidatedMetricFreshness(metrics.priceThb, options);
  const commissionRate = refreshSingleValidatedMetricFreshness(metrics.commissionRate, options);
  const salesVolume7d = refreshSingleValidatedMetricFreshness(metrics.salesVolume7d, options);
  const revenueThb7d = refreshSingleValidatedMetricFreshness(metrics.revenueThb7d, options);
  const videoRevenueThb7d = refreshSingleValidatedMetricFreshness(metrics.videoRevenueThb7d, options);
  const liveRevenueThb7d = refreshSingleValidatedMetricFreshness(metrics.liveRevenueThb7d, options);
  const shoppingMallRevenueThb7d = metrics.shoppingMallRevenueThb7d
    ? refreshSingleValidatedMetricFreshness(metrics.shoppingMallRevenueThb7d, options)
    : undefined;
  const revenueGrowthRate = refreshSingleValidatedMetricFreshness(metrics.revenueGrowthRate, options);
  const creatorCount = refreshSingleValidatedMetricFreshness(metrics.creatorCount, options);
  const rating = refreshSingleValidatedMetricFreshness(metrics.rating, options);
  const reviewCount = refreshSingleValidatedMetricFreshness(metrics.reviewCount, options);

  let commissionThb = refreshSingleValidatedMetricFreshness(metrics.commissionThb, options);
  if (commissionThb.provenance === 'SYNTHETIC' && (commissionThb.state === 'OK' || commissionThb.state === 'ZERO')) {
    if (priceThb.state === 'INVALID' || commissionRate.state === 'INVALID') {
      commissionThb = {
        ...commissionThb,
        value: null,
        state: 'INVALID',
        note: 'Cannot derive commission payout from invalid price or commission rate.',
      };
    } else if (priceThb.state === 'STALE' || commissionRate.state === 'STALE') {
      commissionThb = {
        ...commissionThb,
        value: null,
        state: 'STALE',
        note: 'Cannot derive trustworthy commission payout from stale input metric.',
      };
    }
  }

  const changed =
    priceThb !== metrics.priceThb ||
    commissionRate !== metrics.commissionRate ||
    commissionThb !== metrics.commissionThb ||
    salesVolume7d !== metrics.salesVolume7d ||
    revenueThb7d !== metrics.revenueThb7d ||
    videoRevenueThb7d !== metrics.videoRevenueThb7d ||
    liveRevenueThb7d !== metrics.liveRevenueThb7d ||
    shoppingMallRevenueThb7d !== metrics.shoppingMallRevenueThb7d ||
    revenueGrowthRate !== metrics.revenueGrowthRate ||
    creatorCount !== metrics.creatorCount ||
    rating !== metrics.rating ||
    reviewCount !== metrics.reviewCount;

  if (!changed) {
    return metrics;
  }

  const nextBase: Omit<ProductValidatedMetrics, 'unresolvedFields'> = {
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    liveRevenueThb7d,
    ...(shoppingMallRevenueThb7d ? { shoppingMallRevenueThb7d } : {}),
    revenueGrowthRate,
    creatorCount,
    rating,
    reviewCount,
    fetchedAt: metrics.fetchedAt,
    dateRange: metrics.dateRange,
    sourceEndpoint: metrics.sourceEndpoint,
  };

  return {
    ...nextBase,
    unresolvedFields: collectUnresolvedFields(nextBase),
  };
}

