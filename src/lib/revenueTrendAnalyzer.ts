import type { BilingualText, HistoricalTrendClassification } from '../types.ts';

export type DetailRevenueTrendStatus =
  | 'VERIFIED_30D'
  | 'VERIFIED_7D'
  | 'INSUFFICIENT_DATA'
  | 'INCOMPARABLE_DATA';

export type RevenueTrendBaselineStatus =
  | 'VALID'
  | 'ZERO_BASELINE'
  | 'ALL_ZERO'
  | 'INSUFFICIENT_WINDOW';

export interface RevenueTrendAnalysis {
  status: DetailRevenueTrendStatus;
  dateRange: 'last7Day' | 'last30Day' | 'unknown';
  daysCount: number;
  /** Verified daily THB revenue values ordered chronologically (oldest -> newest). */
  dailyValuesThb: number[];
  sumThb: number;
  reportedRevenueThb: number | null;
  reconciliationDiffThb: number | null;
  reconciledWithRevenue: boolean;
  dailyAvgThb: number | null;
  minDayThb: number | null;
  maxDayThb: number | null;
  activeRevenueDays: number;
  zeroRevenueDays: number;
  /** Sample coefficient of variation (stddev / mean) across daily revenues; null when mean <= 0. */
  volatilityCv: number | null;
  /** Sum of the most recent 7 daily values (index len-7 .. len-1). */
  last7dSumThb: number | null;
  /** Sum of the immediately preceding 7 daily values (index len-14 .. len-8); requires >= 14 days. */
  prev7dSumThb: number | null;
  growth7dAbsThb: number | null;
  /** Derived 7d-over-previous-7d percentage change; null when prev7d === 0 or window < 14d. */
  growth7dPct: number | null;
  growth7dBaselineStatus: RevenueTrendBaselineStatus;
  /** First half sum vs second half sum when daysCount >= 14 (e.g. 15d vs 15d for last30Day). */
  firstHalfSumThb: number | null;
  secondHalfSumThb: number | null;
  halfWindowGrowthPct: number | null;
  classification: HistoricalTrendClassification;
  explanation: BilingualText;
  incomparabilityReason: string | null;
}

const RISING_THRESHOLD_PCT = 10;
const DECLINING_THRESHOLD_PCT = -10;
const VOLATILITY_CV_THRESHOLD = 0.75;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumValues(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

function formatCompactThb(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(2)}M`;
  }
  return `฿${Math.round(amount).toLocaleString()}`;
}

/**
 * Strictly validates a raw Kalodata `revenue_trend` array.
 * Live Probe P1 verified that `POST /tiktok/product/detail` returns a flat JSON array of
 * non-negative finite daily THB numbers ordered chronologically (oldest -> newest).
 * Returns null if missing, empty, or containing any malformed/negative/non-finite entry.
 */
export function sanitizeRevenueTrendArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 90) {
    return null;
  }

  const out: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
      return null;
    }
    out.push(round2(item));
  }
  return out;
}

function computeVolatilityCv(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  if (mean <= 0) return null;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return round2(Math.sqrt(variance) / mean);
}

/**
 * Analyzes verified daily THB `revenue_trend` arrays from `POST /tiktok/product/detail`.
 *
 * Strict integrity rules:
 * - Never fabricates missing days or interpolates values.
 * - Reconciles `sum(dailyValues)` against `reportedRevenueThb` when provided (tolerance: max(50 THB, 2%)).
 * - Never divides by zero (`prev7d === 0` produces `ZERO_BASELINE`, `growth7dPct: null`, preserving absolute change).
 * - Never alters `scoringEngineV2` weights, formulas, or eligibility gates.
 */
export function analyzeDetailRevenueTrend(params: {
  dailyValues?: unknown;
  reportedRevenueThb?: number | null;
  dateRange?: string | null;
}): RevenueTrendAnalysis {
  const normalizedRange: 'last7Day' | 'last30Day' | 'unknown' =
    params.dateRange === 'last30Day'
      ? 'last30Day'
      : params.dateRange === 'last7Day'
        ? 'last7Day'
        : 'unknown';

  const reported =
    typeof params.reportedRevenueThb === 'number' &&
    Number.isFinite(params.reportedRevenueThb) &&
    params.reportedRevenueThb >= 0
      ? round2(params.reportedRevenueThb)
      : null;

  const daily = sanitizeRevenueTrendArray(params.dailyValues);

  if (!daily || daily.length < 7) {
    return {
      status: 'INSUFFICIENT_DATA',
      dateRange: normalizedRange,
      daysCount: daily ? daily.length : 0,
      dailyValuesThb: daily ?? [],
      sumThb: daily ? sumValues(daily) : 0,
      reportedRevenueThb: reported,
      reconciliationDiffThb: null,
      reconciledWithRevenue: false,
      dailyAvgThb: null,
      minDayThb: null,
      maxDayThb: null,
      activeRevenueDays: daily ? daily.filter((v) => v > 0).length : 0,
      zeroRevenueDays: daily ? daily.filter((v) => v === 0).length : 0,
      volatilityCv: null,
      last7dSumThb: null,
      prev7dSumThb: null,
      growth7dAbsThb: null,
      growth7dPct: null,
      growth7dBaselineStatus: 'INSUFFICIENT_WINDOW',
      firstHalfSumThb: null,
      secondHalfSumThb: null,
      halfWindowGrowthPct: null,
      classification: 'INSUFFICIENT_HISTORY',
      explanation: {
        en: 'Daily revenue trend is unavailable (fetch Product Details on 7d or 30d window to inspect daily THB trajectory).',
        my: 'နေ့စဉ်ရောင်းအားလမ်းကြောင်း မရှိသေးပါ (7d သို့မဟုတ် 30d Product Details ခေါ်ယူပြီး ကြည့်ရှုနိုင်ပါသည်)။',
      },
      incomparabilityReason: null,
    };
  }

  const sumThb = sumValues(daily);
  const diffThb = reported !== null ? round2(Math.abs(sumThb - reported)) : null;
  const maxTolerance = reported !== null ? Math.max(50, reported * 0.02) : null;
  const reconciledWithRevenue =
    reported === null ? true : diffThb !== null && maxTolerance !== null && diffThb <= maxTolerance;

  const activeRevenueDays = daily.filter((v) => v > 0).length;
  const zeroRevenueDays = daily.length - activeRevenueDays;
  const dailyAvgThb = round2(sumThb / daily.length);
  const minDayThb = Math.min(...daily);
  const maxDayThb = Math.max(...daily);
  const volatilityCv = computeVolatilityCv(daily);

  if (!reconciledWithRevenue) {
    return {
      status: 'INCOMPARABLE_DATA',
      dateRange: normalizedRange,
      daysCount: daily.length,
      dailyValuesThb: daily,
      sumThb,
      reportedRevenueThb: reported,
      reconciliationDiffThb: diffThb,
      reconciledWithRevenue: false,
      dailyAvgThb,
      minDayThb,
      maxDayThb,
      activeRevenueDays,
      zeroRevenueDays,
      volatilityCv,
      last7dSumThb: null,
      prev7dSumThb: null,
      growth7dAbsThb: null,
      growth7dPct: null,
      growth7dBaselineStatus: 'INSUFFICIENT_WINDOW',
      firstHalfSumThb: null,
      secondHalfSumThb: null,
      halfWindowGrowthPct: null,
      classification: 'INCOMPARABLE_DATA',
      explanation: {
        en: `Daily revenue_trend sum (${formatCompactThb(sumThb)}) does not reconcile with reported revenue (${reported !== null ? formatCompactThb(reported) : '—'}); excluded from trend classification.`,
        my: `နေ့စဉ် revenue_trend ပေါင်းလဒ် (${formatCompactThb(sumThb)}) သည် စုစုပေါင်းဝင်ငွေ (${reported !== null ? formatCompactThb(reported) : '—'}) နှင့် မကိုက်ညီသဖြင့် နှိုင်းယှဉ်တွက်ချက်မှုမှ ဖယ်ထုတ်ထားပါသည်။`,
      },
      incomparabilityReason: 'REVENUE_SUM_MISMATCH',
    };
  }

  const last7Slice = daily.slice(-7);
  const last7dSumThb = sumValues(last7Slice);

  // 7-day detail window: daily stability is verified, but 7d-vs-prev-7d requires >= 14 daily points.
  if (daily.length < 14) {
    return {
      status: 'VERIFIED_7D',
      dateRange: normalizedRange === 'unknown' ? 'last7Day' : normalizedRange,
      daysCount: daily.length,
      dailyValuesThb: daily,
      sumThb,
      reportedRevenueThb: reported,
      reconciliationDiffThb: diffThb,
      reconciledWithRevenue: true,
      dailyAvgThb,
      minDayThb,
      maxDayThb,
      activeRevenueDays,
      zeroRevenueDays,
      volatilityCv,
      last7dSumThb,
      prev7dSumThb: null,
      growth7dAbsThb: null,
      growth7dPct: null,
      growth7dBaselineStatus: 'INSUFFICIENT_WINDOW',
      firstHalfSumThb: null,
      secondHalfSumThb: null,
      halfWindowGrowthPct: null,
      classification: 'INSUFFICIENT_HISTORY',
      explanation: {
        en: `Verified ${daily.length}-day daily THB breakdown (${activeRevenueDays}/${daily.length} active days, avg ${formatCompactThb(dailyAvgThb)}/day). Fetch 30d Details for verified 7d-vs-previous-7d growth.`,
        my: `${daily.length} ရက်စာ နေ့စဉ်ဘတ်ဝင်ငွေ အတည်ပြုပြီး (${activeRevenueDays}/${daily.length} ရက် ရောင်းအားရှိ၊ ပျမ်းမျှ ${formatCompactThb(dailyAvgThb)}/ရက်)။ ၇ ရက်ချင်း နှိုင်းယှဉ်တိုးနှုန်းအတွက် 30d Details ကို ရွေးယူနိုင်ပါသည်။`,
      },
      incomparabilityReason: null,
    };
  }

  // >= 14 daily points (e.g. 30-day `/detail` window): derive exact 7d-over-previous-7d growth & half-window comparison
  const prev7Slice = daily.slice(-14, -7);
  const prev7dSumThb = sumValues(prev7Slice);
  const growth7dAbsThb = round2(last7dSumThb - prev7dSumThb);

  let growth7dPct: number | null = null;
  let growth7dBaselineStatus: RevenueTrendBaselineStatus = 'VALID';

  if (prev7dSumThb === 0 && last7dSumThb === 0) {
    growth7dBaselineStatus = 'ALL_ZERO';
  } else if (prev7dSumThb === 0) {
    growth7dBaselineStatus = 'ZERO_BASELINE';
  } else {
    growth7dPct = round2(((last7dSumThb - prev7dSumThb) / prev7dSumThb) * 100);
    growth7dBaselineStatus = 'VALID';
  }

  const mid = Math.floor(daily.length / 2);
  const firstHalfSumThb = sumValues(daily.slice(0, mid));
  const secondHalfSumThb = sumValues(daily.slice(daily.length - mid));
  const halfWindowGrowthPct =
    firstHalfSumThb > 0
      ? round2(((secondHalfSumThb - firstHalfSumThb) / firstHalfSumThb) * 100)
      : null;

  // Transparent deterministic classification
  let classification: HistoricalTrendClassification = 'STABLE';
  const highVolatility = volatilityCv !== null && volatilityCv >= VOLATILITY_CV_THRESHOLD;
  const recent7Cv = computeVolatilityCv(last7Slice);
  const steadyRecentTakeoff =
    growth7dBaselineStatus === 'ZERO_BASELINE' &&
    last7dSumThb > 0 &&
    last7Slice.filter((v) => v > 0).length >= 4 &&
    (recent7Cv === null || recent7Cv < VOLATILITY_CV_THRESHOLD);

  if (growth7dBaselineStatus === 'ALL_ZERO') {
    classification = 'STABLE';
  } else if (steadyRecentTakeoff) {
    classification = 'RISING';
  } else if (
    highVolatility &&
    !(
      growth7dPct !== null &&
      halfWindowGrowthPct !== null &&
      ((growth7dPct >= RISING_THRESHOLD_PCT && halfWindowGrowthPct >= RISING_THRESHOLD_PCT) ||
        (growth7dPct <= DECLINING_THRESHOLD_PCT && halfWindowGrowthPct <= DECLINING_THRESHOLD_PCT))
    )
  ) {
    classification = 'VOLATILE';
  } else if (growth7dBaselineStatus === 'ZERO_BASELINE' && last7dSumThb > 0) {
    classification = 'RISING';
  } else if (growth7dPct !== null && growth7dPct >= RISING_THRESHOLD_PCT) {
    classification = 'RISING';
  } else if (growth7dPct !== null && growth7dPct <= DECLINING_THRESHOLD_PCT) {
    classification = 'DECLINING';
  } else {
    classification = 'STABLE';
  }

  let explanation: BilingualText;
  if (growth7dBaselineStatus === 'ALL_ZERO') {
    explanation = {
      en: `Verified ${daily.length}-day trend: ฿0 revenue in both recent 7d windows (${activeRevenueDays}/${daily.length} active days overall).`,
      my: `${daily.length} ရက်စာ စစ်ဆေးချက် — နောက်ဆုံး ၇ ရက်နှင့် ရှေ့ ၇ ရက် နှစ်ခုလုံး ฿0 ဖြစ်သည် (စုစုပေါင်း ${activeRevenueDays}/${daily.length} ရက်သာ ရောင်းအားရှိ)။`,
    };
  } else if (growth7dBaselineStatus === 'ZERO_BASELINE') {
    explanation = {
      en: `Derived from verified ${daily.length}-day daily THB trend: recent 7d ${formatCompactThb(last7dSumThb)} vs prior 7d ฿0 (Zero Baseline, +${formatCompactThb(growth7dAbsThb)}).`,
      my: `${daily.length} ရက်စာ နေ့စဉ်ဝင်ငွေမှ တွက်ချက်ချက် — နောက်ဆုံး ၇ ရက် ${formatCompactThb(last7dSumThb)} vs ရှေ့ ၇ ရက် ฿0 (Zero Baseline, +${formatCompactThb(growth7dAbsThb)})။`,
    };
  } else {
    const sign = growth7dPct !== null && growth7dPct > 0 ? '+' : '';
    const pctStr = growth7dPct !== null ? `${sign}${growth7dPct}%` : '—';
    explanation = {
      en: `Derived from verified ${daily.length}-day daily THB trend: last 7d ${formatCompactThb(last7dSumThb)} vs prior 7d ${formatCompactThb(prev7dSumThb)} (${pctStr}; ${activeRevenueDays}/${daily.length} active days).`,
      my: `${daily.length} ရက်စာ နေ့စဉ်ဘတ်ဝင်ငွေမှ တွက်ချက်ချက် — နောက်ဆုံး ၇ ရက် ${formatCompactThb(last7dSumThb)} vs ရှေ့ ၇ ရက် ${formatCompactThb(prev7dSumThb)} (${pctStr} · ${activeRevenueDays}/${daily.length} ရက် ရောင်းအားရှိ)။`,
    };
  }

  return {
    status: 'VERIFIED_30D',
    dateRange: normalizedRange === 'unknown' ? 'last30Day' : normalizedRange,
    daysCount: daily.length,
    dailyValuesThb: daily,
    sumThb,
    reportedRevenueThb: reported,
    reconciliationDiffThb: diffThb,
    reconciledWithRevenue: true,
    dailyAvgThb,
    minDayThb,
    maxDayThb,
    activeRevenueDays,
    zeroRevenueDays,
    volatilityCv,
    last7dSumThb,
    prev7dSumThb,
    growth7dAbsThb,
    growth7dPct,
    growth7dBaselineStatus,
    firstHalfSumThb,
    secondHalfSumThb,
    halfWindowGrowthPct,
    classification,
    explanation,
    incomparabilityReason: null,
  };
}
