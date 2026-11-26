import type { ProductItem, ProductValidatedMetrics, ValidatedMetric } from '../types.ts';
import { adaptProductItemToValidatedMetrics } from './metricFoundation.ts';

export type SearchScoreStatus = 'SCORED' | 'NOT_MONETIZABLE' | 'INSUFFICIENT_RANK_DATA';

export type SearchScoreGrade =
  | 'TOP'
  | 'STRONG'
  | 'MODERATE'
  | 'WEAK'
  | 'NOT_MONETIZABLE'
  | 'INSUFFICIENT';

export type SearchDominantChannel = 'VIDEO' | 'LIVE' | 'SHOWCASE' | 'BALANCED' | 'UNKNOWN';

export type SearchScoreCapCode =
  | 'WEAK_DEMAND_CAP'
  | 'NO_VIDEO_SALES_CAP'
  | 'LIVE_DEPENDENT_CAP'
  | 'MISSING_VIDEO_DATA_CAP';

export interface SearchScorePillarBreakdown {
  score: number | null;
  weight: number;
  weightedPoints: number | null;
}

export interface SearchOpportunityScoreResult {
  score: number | null;
  rawWeightedScore: number | null;
  status: SearchScoreStatus;
  grade: SearchScoreGrade;
  isStale: boolean;
  capsApplied: SearchScoreCapCode[];
  pillars: {
    demand: SearchScorePillarBreakdown;
    earning: SearchScorePillarBreakdown;
    videoProof: SearchScorePillarBreakdown;
    priceFit: SearchScorePillarBreakdown;
  };
  metrics: {
    revenueThb: number | null;
    salesVolume: number | null;
    priceThb: number | null;
    commissionRatePct: number | null;
    payoutPerSaleThb: number | null;
    videoRevenueThb: number | null;
    liveRevenueThb: number | null;
    showcaseRevenueThb: number | null;
    videoSharePct: number | null;
    liveSharePct: number | null;
    showcaseSharePct: number | null;
    videoCommissionPoolThb: number | null;
    dominantChannel: SearchDominantChannel;
  };
}

export const SEARCH_SCORE_WEIGHTS = {
  demand: 0.3,
  earning: 0.3,
  videoProof: 0.25,
  priceFit: 0.15,
} as const;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function logCurve(value: number, pivot: number, maxRef: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const num = Math.log10(1 + value / pivot);
  const den = Math.log10(1 + maxRef / pivot);
  if (den <= 0) return 0;
  return clamp((num / den) * 100, 0, 100);
}

function readRankNumericMetric(
  metric: ValidatedMetric<number> | undefined,
  expectedUnit: ValidatedMetric<number>['unit']
): { value: number | null; isZero: boolean; isStale: boolean } {
  if (!metric || metric.unit !== expectedUnit) {
    return { value: null, isZero: false, isStale: false };
  }
  if (
    (metric.state === 'OK' || metric.state === 'ZERO' || metric.state === 'STALE') &&
    typeof metric.value === 'number' &&
    Number.isFinite(metric.value)
  ) {
    return {
      value: metric.value,
      isZero: metric.state === 'ZERO' || metric.value === 0,
      isStale: metric.state === 'STALE',
    };
  }
  return { value: null, isZero: false, isStale: metric.state === 'STALE' };
}

function scorePriceFit(priceThb: number): number {
  if (!Number.isFinite(priceThb) || priceThb <= 0) return 0;
  // TikTok Shop Thailand short-video impulse purchase sweet spot: ฿150 – ฿790
  if (priceThb >= 220 && priceThb <= 590) {
    return 100;
  }
  if (priceThb >= 150 && priceThb < 220) {
    return 92 + ((priceThb - 150) / 70) * 8;
  }
  if (priceThb > 590 && priceThb <= 790) {
    return 100 - ((priceThb - 590) / 200) * 8;
  }
  if (priceThb >= 80 && priceThb < 150) {
    return 74 + ((priceThb - 80) / 70) * 18;
  }
  if (priceThb > 790 && priceThb <= 1500) {
    return 92 - ((priceThb - 790) / 710) * 20;
  }
  if (priceThb >= 40 && priceThb < 80) {
    return 52 + ((priceThb - 40) / 40) * 22;
  }
  if (priceThb > 1500 && priceThb <= 3500) {
    return 72 - ((priceThb - 1500) / 2000) * 26;
  }
  if (priceThb < 40) {
    return clamp(28 + (priceThb / 40) * 24, 25, 52);
  }
  return clamp(46 - ((priceThb - 3500) / 10_000) * 21, 25, 46);
}

function scoreToSearchGrade(
  score: number | null,
  status: SearchScoreStatus
): SearchScoreGrade {
  if (status === 'NOT_MONETIZABLE') return 'NOT_MONETIZABLE';
  if (status === 'INSUFFICIENT_RANK_DATA' || score === null) return 'INSUFFICIENT';
  if (score >= 80) return 'TOP';
  if (score >= 65) return 'STRONG';
  if (score >= 45) return 'MODERATE';
  return 'WEAK';
}

function classifyDominantChannel(
  videoSharePct: number | null,
  liveSharePct: number | null,
  showcaseSharePct: number | null
): SearchDominantChannel {
  if (videoSharePct === null && liveSharePct === null && showcaseSharePct === null) {
    return 'UNKNOWN';
  }
  const v = videoSharePct ?? 0;
  const l = liveSharePct ?? 0;
  const s = showcaseSharePct ?? 0;
  if (v >= 50) return 'VIDEO';
  if (l >= 50) return 'LIVE';
  if (s >= 50) return 'SHOWCASE';
  if (v + l + s > 0) return 'BALANCED';
  return 'UNKNOWN';
}

/**
 * Pure, deterministic 0–100 Search Opportunity Score computed STRICTLY from verified
 * `/tiktok/product/rank` (0.20 cr search) fields — zero Deep Data calls and zero fabricated metrics.
 *
 * Weights:
 * - Market Demand (30%): 7d/30d revenue + unit sales volume
 * - Affiliate Earning (30%): commission % + derived THB payout per sale
 * - Video Sales Proof (25%): short-video revenue + video revenue share + video affiliate commission pool
 * - Price Fit (15%): TikTok Shop Thailand short-video impulse purchase price alignment
 */
export function evaluateSearchOpportunityScore(
  input: ProductItem | ProductValidatedMetrics,
  options?: { nowMs?: number }
): SearchOpportunityScoreResult {
  const validated: ProductValidatedMetrics =
    'validatedMetrics' in input
      ? input.validatedMetrics ?? adaptProductItemToValidatedMetrics(input, options)
      : 'priceThb' in input && 'commissionRate' in input && 'revenueThb7d' in input
        ? (input as ProductValidatedMetrics)
        : adaptProductItemToValidatedMetrics(input as ProductItem, options);

  const revenueMetric = readRankNumericMetric(validated.revenueThb7d, 'THB');
  const salesMetric = readRankNumericMetric(validated.salesVolume7d, 'COUNT');
  const priceMetric = readRankNumericMetric(validated.priceThb, 'THB');
  const commRateMetric = readRankNumericMetric(validated.commissionRate, 'PERCENT');
  const commThbMetric = readRankNumericMetric(validated.commissionThb, 'THB');
  const videoRevMetric = readRankNumericMetric(validated.videoRevenueThb7d, 'THB');
  const liveRevMetric = readRankNumericMetric(validated.liveRevenueThb7d, 'THB');
  const showcaseRevMetric = readRankNumericMetric(validated.shoppingMallRevenueThb7d, 'THB');

  const isStale =
    revenueMetric.isStale ||
    salesMetric.isStale ||
    commRateMetric.isStale ||
    videoRevMetric.isStale;

  const revenueThb = revenueMetric.value;
  const salesVolume = salesMetric.value;
  const priceThb = priceMetric.value !== null && priceMetric.value > 0 ? priceMetric.value : null;
  const commissionRatePct = commRateMetric.value;
  const payoutPerSaleThb =
    commissionRatePct !== null && commissionRatePct > 0 && priceThb !== null
      ? Math.round(priceThb * (commissionRatePct / 100) * 100) / 100
      : commThbMetric.value !== null && commThbMetric.value > 0
        ? commThbMetric.value
        : commissionRatePct === 0
          ? 0
          : null;

  const videoRevenueThb = videoRevMetric.value;
  const liveRevenueThb = liveRevMetric.value;
  const showcaseRevenueThb = showcaseRevMetric.value;

  const totalRevPositive = revenueThb !== null && revenueThb > 0;
  const videoSharePct =
    totalRevPositive && videoRevenueThb !== null
      ? round1(clamp((videoRevenueThb / revenueThb) * 100, 0, 100))
      : null;
  const liveSharePct =
    totalRevPositive && liveRevenueThb !== null
      ? round1(clamp((liveRevenueThb / revenueThb) * 100, 0, 100))
      : null;
  const showcaseSharePct =
    totalRevPositive && showcaseRevenueThb !== null
      ? round1(clamp((showcaseRevenueThb / revenueThb) * 100, 0, 100))
      : null;

  const videoCommissionPoolThb =
    videoRevenueThb !== null && commissionRatePct !== null && commissionRatePct > 0
      ? Math.round(videoRevenueThb * (commissionRatePct / 100))
      : videoRevenueThb !== null && commissionRatePct === 0
        ? 0
        : null;

  const dominantChannel = classifyDominantChannel(
    videoSharePct,
    liveSharePct,
    showcaseSharePct
  );

  const metricsSummary = {
    revenueThb,
    salesVolume,
    priceThb,
    commissionRatePct,
    payoutPerSaleThb,
    videoRevenueThb,
    liveRevenueThb,
    showcaseRevenueThb,
    videoSharePct,
    liveSharePct,
    showcaseSharePct,
    videoCommissionPoolThb,
    dominantChannel,
  };

  // Pillar 1: Demand (30%)
  let demandScore: number | null = null;
  if (revenueThb !== null && salesVolume !== null) {
    const revScore = logCurve(revenueThb, 5_000, 3_000_000);
    const volScore = logCurve(salesVolume, 10, 10_000);
    demandScore = round1(0.65 * revScore + 0.35 * volScore);
  } else if (revenueThb !== null) {
    demandScore = round1(Math.min(88, logCurve(revenueThb, 5_000, 3_000_000)));
  } else if (salesVolume !== null) {
    demandScore = round1(Math.min(78, logCurve(salesVolume, 10, 10_000)));
  }

  // Pillar 4: Price Fit (15%)
  const priceFitScore = priceThb !== null ? round1(scorePriceFit(priceThb)) : null;

  // Hard Gate 1: Verified 0% Commission -> NOT_MONETIZABLE (Score = 0)
  if (commRateMetric.isZero || commissionRatePct === 0) {
    return {
      score: 0,
      rawWeightedScore: 0,
      status: 'NOT_MONETIZABLE',
      grade: 'NOT_MONETIZABLE',
      isStale,
      capsApplied: [],
      pillars: {
        demand: { score: demandScore, weight: SEARCH_SCORE_WEIGHTS.demand, weightedPoints: 0 },
        earning: { score: 0, weight: SEARCH_SCORE_WEIGHTS.earning, weightedPoints: 0 },
        videoProof: {
          score:
            videoRevenueThb !== null && videoRevenueThb > 0
              ? round1(
                  0.55 * logCurve(videoRevenueThb, 3_000, 1_500_000) +
                    0.45 * clamp(((videoSharePct ?? 0) / 70) * 100, 0, 100)
                )
              : videoRevenueThb === 0
                ? 0
                : null,
          weight: SEARCH_SCORE_WEIGHTS.videoProof,
          weightedPoints: 0,
        },
        priceFit: { score: priceFitScore, weight: SEARCH_SCORE_WEIGHTS.priceFit, weightedPoints: 0 },
      },
      metrics: metricsSummary,
    };
  }

  // Pillar 2: Affiliate Earning (30%)
  let earningScore: number | null = null;
  if (commissionRatePct !== null && commissionRatePct > 0) {
    const rateCurve =
      (Math.pow(commissionRatePct, 1.3) /
        (Math.pow(commissionRatePct, 1.3) + Math.pow(8, 1.3))) *
      100;
    if (payoutPerSaleThb !== null && payoutPerSaleThb > 0) {
      const payoutCurve = logCurve(payoutPerSaleThb, 6, 220);
      earningScore = round1(clamp(0.4 * rateCurve + 0.6 * payoutCurve, 0, 100));
    } else {
      earningScore = round1(clamp(Math.min(75, rateCurve), 0, 100));
    }
  }

  // Pillar 3: Video Sales Proof (25%) — includes Video Affiliate Commission Pool THB!
  let videoProofScore: number | null = null;
  if (videoRevMetric.isZero || videoRevenueThb === 0) {
    videoProofScore = 0;
  } else if (videoRevenueThb !== null && videoRevenueThb > 0) {
    const vidRevCurve = logCurve(videoRevenueThb, 3_000, 1_500_000);
    const vidShareCurve =
      videoSharePct !== null ? clamp((videoSharePct / 70) * 100, 0, 100) : 50;
    const vidPoolCurve =
      videoCommissionPoolThb !== null && videoCommissionPoolThb > 0
        ? logCurve(videoCommissionPoolThb, 500, 150_000)
        : vidRevCurve * 0.8;
    videoProofScore = round1(
      clamp(0.45 * vidRevCurve + 0.35 * vidShareCurve + 0.2 * vidPoolCurve, 0, 100)
    );
  }

  // Require at least Demand + Earning to compute a trustworthy Search Score
  if (demandScore === null || earningScore === null) {
    return {
      score: null,
      rawWeightedScore: null,
      status: 'INSUFFICIENT_RANK_DATA',
      grade: 'INSUFFICIENT',
      isStale,
      capsApplied: [],
      pillars: {
        demand: { score: demandScore, weight: SEARCH_SCORE_WEIGHTS.demand, weightedPoints: null },
        earning: { score: earningScore, weight: SEARCH_SCORE_WEIGHTS.earning, weightedPoints: null },
        videoProof: {
          score: videoProofScore,
          weight: SEARCH_SCORE_WEIGHTS.videoProof,
          weightedPoints: null,
        },
        priceFit: {
          score: priceFitScore,
          weight: SEARCH_SCORE_WEIGHTS.priceFit,
          weightedPoints: null,
        },
      },
      metrics: metricsSummary,
    };
  }

  const activePillars: Array<{ key: keyof typeof SEARCH_SCORE_WEIGHTS; score: number; weight: number }> =
    [
      { key: 'demand', score: demandScore, weight: SEARCH_SCORE_WEIGHTS.demand },
      { key: 'earning', score: earningScore, weight: SEARCH_SCORE_WEIGHTS.earning },
    ];
  if (videoProofScore !== null) {
    activePillars.push({
      key: 'videoProof',
      score: videoProofScore,
      weight: SEARCH_SCORE_WEIGHTS.videoProof,
    });
  }
  if (priceFitScore !== null) {
    activePillars.push({
      key: 'priceFit',
      score: priceFitScore,
      weight: SEARCH_SCORE_WEIGHTS.priceFit,
    });
  }

  const totalWeight = activePillars.reduce((sum, p) => sum + p.weight, 0);
  const normalizedPoints: Record<keyof typeof SEARCH_SCORE_WEIGHTS, number | null> = {
    demand: null,
    earning: null,
    videoProof: null,
    priceFit: null,
  };

  let weightedSum = 0;
  for (const pillar of activePillars) {
    const normWeight = pillar.weight / totalWeight;
    const pts = pillar.score * normWeight;
    normalizedPoints[pillar.key] = round1(pts);
    weightedSum += pts;
  }

  const rawWeightedScore = round1(clamp(weightedSum, 0, 100));
  let finalScore = rawWeightedScore;
  const capsApplied: SearchScoreCapCode[] = [];

  if (demandScore < 30 && finalScore > 42) {
    finalScore = 42;
    capsApplied.push('WEAK_DEMAND_CAP');
  }
  if ((videoRevMetric.isZero || videoRevenueThb === 0) && finalScore > 58) {
    finalScore = 58;
    capsApplied.push('NO_VIDEO_SALES_CAP');
  } else if (
    videoSharePct !== null &&
    videoSharePct < 10 &&
    liveSharePct !== null &&
    liveSharePct >= 60 &&
    finalScore > 68
  ) {
    finalScore = 68;
    capsApplied.push('LIVE_DEPENDENT_CAP');
  } else if (videoProofScore === null && finalScore > 75) {
    finalScore = 75;
    capsApplied.push('MISSING_VIDEO_DATA_CAP');
  }

  const roundedScore = Math.round(clamp(finalScore, 1, 100));
  const status: SearchScoreStatus = 'SCORED';

  return {
    score: roundedScore,
    rawWeightedScore,
    status,
    grade: scoreToSearchGrade(roundedScore, status),
    isStale,
    capsApplied,
    pillars: {
      demand: {
        score: demandScore,
        weight: SEARCH_SCORE_WEIGHTS.demand,
        weightedPoints: normalizedPoints.demand,
      },
      earning: {
        score: earningScore,
        weight: SEARCH_SCORE_WEIGHTS.earning,
        weightedPoints: normalizedPoints.earning,
      },
      videoProof: {
        score: videoProofScore,
        weight: SEARCH_SCORE_WEIGHTS.videoProof,
        weightedPoints: normalizedPoints.videoProof,
      },
      priceFit: {
        score: priceFitScore,
        weight: SEARCH_SCORE_WEIGHTS.priceFit,
        weightedPoints: normalizedPoints.priceFit,
      },
    },
    metrics: metricsSummary,
  };
}
