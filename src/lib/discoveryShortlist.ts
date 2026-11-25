import type {
  CommercialScoreV2Result,
  CompetitionEvidenceStatus,
  DiscoveryShortlistCategory,
  ProductDiscoveryShortlistResult,
  ProductValidatedMetrics,
  VideoSalesEvidenceStatus,
} from '../types.ts';
import { isUsableScoringMetric } from './metricFoundation.ts';

/**
 * Phase 10 Evidence-Based Product Discovery Shortlist Classifier.
 *
 * STRICT DESIGN GUARDRAILS:
 * 1. Does NOT modify Commercial Opportunity scoring formulas or Strategy eligibility gates.
 * 2. Keeps Commercial Opportunity, Conversion Evidence, Video Suitability, and Data Confidence strictly separate.
 * 3. NEVER classifies a product as Low Competition, High Competition, or Emerging Opportunity
 *    when creator competition data is missing or unverified.
 * 4. NEVER classifies a product as Strong Video Sales when verified video revenue is unavailable or weak.
 * 5. NEVER equates high historical video revenue with low competition or conversion guarantee.
 * 6. Clearly distinguishes Preliminary Candidates (incomplete/unverified competition or quality)
 *    from Fully Qualified Opportunities (`commercialScore.eligibilityStatus === 'ELIGIBLE'`).
 */

export const DISCOVERY_SHORTLIST_THRESHOLDS = {
  strongDemandMinScore: 65,
  solidDemandMinScore: 50,
  strongVideoRevenueMinThb: 50_000,
  strongVideoShareMinRatio: 0.5,
  moderateVideoRevenueMinThb: 15_000,
  moderateVideoShareMinRatio: 0.25,
  lowCompetitionMinScore: 65,
  emergingCompetitionMinScore: 55,
  highCompetitionMaxScore: 40,
  strongEarningsMinScore: 50,
  strongCommissionMinRate: 10,
  strongPayoutMinThb: 40,
  emergingGrowthMinPct: 20,
} as const;

export function classifyProductDiscoveryShortlist(
  validated: ProductValidatedMetrics,
  commercialScore: CommercialScoreV2Result
): ProductDiscoveryShortlistResult {
  const reasons: string[] = [];
  const evidenceGaps: string[] = [];

  const isNotMonetizable =
    commercialScore.eligibilityStatus === 'NOT_MONETIZABLE' ||
    commercialScore.earningScore.status === 'NOT_MONETIZABLE' ||
    validated.commissionRate.state === 'ZERO';

  const isPreliminaryCandidate = commercialScore.eligibilityStatus !== 'ELIGIBLE';

  // 1. Evaluate Competition Evidence Status strictly
  const hasVerifiedCompetition =
    commercialScore.competitionScore.status === 'SCORED' &&
    commercialScore.competitionScore.score !== null &&
    validated.creatorCount.unit === 'COUNT' &&
    isUsableScoringMetric(validated.creatorCount);

  let competitionEvidenceStatus: CompetitionEvidenceStatus = 'MISSING';
  if (hasVerifiedCompetition) {
    const compScore = commercialScore.competitionScore.score!;
    if (
      compScore < DISCOVERY_SHORTLIST_THRESHOLDS.highCompetitionMaxScore ||
      commercialScore.riskTags.includes('EXTREME_COMPETITION')
    ) {
      competitionEvidenceStatus = 'VERIFIED_HIGH';
    } else if (compScore >= DISCOVERY_SHORTLIST_THRESHOLDS.lowCompetitionMinScore) {
      competitionEvidenceStatus = 'VERIFIED_LOW';
    } else {
      competitionEvidenceStatus = 'VERIFIED_MODERATE';
    }
  } else if (validated.creatorCount.unit === 'UNVERIFIED') {
    competitionEvidenceStatus = 'UNVERIFIED';
    evidenceGaps.push(
      'Creator competition scope is UNVERIFIED (active vs lifetime creators unconfirmed)'
    );
  } else {
    competitionEvidenceStatus = 'MISSING';
    evidenceGaps.push('Creator competition data is unavailable from current source');
  }

  // 2. Evaluate Video Sales Evidence Status strictly (historical channel evidence only)
  const hasUsableVideoRevenue =
    isUsableScoringMetric(validated.videoRevenueThb7d) &&
    (validated.videoRevenueThb7d.value ?? 0) > 0;
  const videoRevenueThb = hasUsableVideoRevenue ? validated.videoRevenueThb7d.value! : null;
  const videoShareRatio = commercialScore.conversionEvidence.videoRevenueShare;
  const videoRevenueSharePct =
    videoShareRatio !== null ? Math.round(videoShareRatio * 1000) / 10 : null;

  let videoSalesEvidenceStatus: VideoSalesEvidenceStatus = 'INSUFFICIENT';
  if (hasUsableVideoRevenue && videoRevenueThb !== null && videoShareRatio !== null) {
    if (
      videoRevenueThb >= DISCOVERY_SHORTLIST_THRESHOLDS.strongVideoRevenueMinThb &&
      videoShareRatio >= DISCOVERY_SHORTLIST_THRESHOLDS.strongVideoShareMinRatio &&
      commercialScore.conversionEvidence.evidenceLevel === 'STRONG'
    ) {
      videoSalesEvidenceStatus = 'STRONG';
    } else if (
      videoRevenueThb >= DISCOVERY_SHORTLIST_THRESHOLDS.moderateVideoRevenueMinThb &&
      videoShareRatio >= DISCOVERY_SHORTLIST_THRESHOLDS.moderateVideoShareMinRatio
    ) {
      videoSalesEvidenceStatus = 'MODERATE';
    } else {
      videoSalesEvidenceStatus = 'WEAK';
    }
  } else if (validated.videoRevenueThb7d.state === 'ZERO') {
    videoSalesEvidenceStatus = 'WEAK';
  } else {
    videoSalesEvidenceStatus = 'INSUFFICIENT';
    evidenceGaps.push('Verified short-video revenue data is unavailable');
  }

  // 3. Track Customer Quality / Growth evidence gaps transparently
  if (commercialScore.customerQualityScore.status !== 'SCORED') {
    if (validated.rating.state === 'UNAVAILABLE') {
      evidenceGaps.push('Product rating is unavailable from Kalodata endpoints');
    } else if (validated.rating.unit === 'UNVERIFIED' || validated.reviewCount.unit === 'UNVERIFIED') {
      evidenceGaps.push('Customer rating/review scope is unverified');
    } else {
      evidenceGaps.push('Customer quality metrics are missing');
    }
  }
  if (commercialScore.demandScore.growthStatus === 'UNVERIFIED') {
    evidenceGaps.push('Revenue growth comparison window is unverified');
  }

  // 4. Hard gate: Non-monetizable (0% commission) NEVER qualifies for affiliate shortlist opportunities
  if (isNotMonetizable) {
    return {
      primaryClassification: 'INSUFFICIENT_EVIDENCE',
      secondarySignals: [],
      isPreliminaryCandidate: true,
      isNotMonetizable: true,
      competitionEvidenceStatus,
      videoSalesEvidenceStatus,
      videoRevenueSharePct,
      reasons: ['0% affiliate commission — not monetizable for creators'],
      evidenceGaps,
      cautionNote:
        'Non-monetizable products (0% commission) are excluded from creator affiliate shortlists regardless of demand or video sales.',
    };
  }

  const demandScore = commercialScore.demandScore.score;
  const earningScore = commercialScore.earningScore.score;
  const competitionScore = commercialScore.competitionScore.score;

  const hasStrongDemand =
    commercialScore.demandScore.status === 'SCORED' &&
    demandScore !== null &&
    demandScore >= DISCOVERY_SHORTLIST_THRESHOLDS.strongDemandMinScore;
  const hasSolidDemand =
    commercialScore.demandScore.status === 'SCORED' &&
    demandScore !== null &&
    demandScore >= DISCOVERY_SHORTLIST_THRESHOLDS.solidDemandMinScore;

  const hasScoredEarnings =
    commercialScore.earningScore.status === 'SCORED' && earningScore !== null;
  const commissionRate = isUsableScoringMetric(validated.commissionRate)
    ? validated.commissionRate.value
    : null;
  const payoutPerSale = commercialScore.earningScore.payoutPerSaleThb;

  const isStrongAffiliateEarnings =
    hasSolidDemand &&
    hasScoredEarnings &&
    earningScore! >= DISCOVERY_SHORTLIST_THRESHOLDS.strongEarningsMinScore &&
    ((commissionRate !== null &&
      commissionRate >= DISCOVERY_SHORTLIST_THRESHOLDS.strongCommissionMinRate) ||
      (payoutPerSale !== null &&
        payoutPerSale >= DISCOVERY_SHORTLIST_THRESHOLDS.strongPayoutMinThb));

  const isStrongDemandStrongVideoSales =
    hasStrongDemand && hasScoredEarnings && videoSalesEvidenceStatus === 'STRONG';

  const isStrongDemandLowCompetition =
    hasStrongDemand &&
    hasScoredEarnings &&
    hasVerifiedCompetition &&
    competitionEvidenceStatus === 'VERIFIED_LOW';

  const isHighDemandHighCompetition =
    hasStrongDemand &&
    hasVerifiedCompetition &&
    competitionEvidenceStatus === 'VERIFIED_HIGH';

  const verifiedGrowthPct =
    commercialScore.demandScore.growthStatus === 'VERIFIED'
      ? commercialScore.demandScore.subcomponents.verifiedGrowthPercent
      : null;

  const isEmergingOpportunity =
    hasSolidDemand &&
    hasScoredEarnings &&
    earningScore! >= 35 &&
    hasVerifiedCompetition &&
    competitionScore !== null &&
    competitionScore >= DISCOVERY_SHORTLIST_THRESHOLDS.emergingCompetitionMinScore &&
    verifiedGrowthPct !== null &&
    verifiedGrowthPct >= DISCOVERY_SHORTLIST_THRESHOLDS.emergingGrowthMinPct;

  // Build ordered list of matched evidence-based categories
  const matched: DiscoveryShortlistCategory[] = [];
  if (isHighDemandHighCompetition) matched.push('HIGH_DEMAND_HIGH_COMPETITION');
  if (isStrongDemandLowCompetition) matched.push('STRONG_DEMAND_LOW_COMPETITION');
  if (isEmergingOpportunity) matched.push('EMERGING_OPPORTUNITY');
  if (isStrongDemandStrongVideoSales) matched.push('STRONG_DEMAND_STRONG_VIDEO_SALES');
  if (isStrongAffiliateEarnings) matched.push('STRONG_AFFILIATE_EARNINGS');

  const primaryClassification: DiscoveryShortlistCategory =
    matched[0] ?? 'INSUFFICIENT_EVIDENCE';
  const secondarySignals = matched.slice(1);

  // Build transparent, factual reasons
  if (hasStrongDemand && demandScore !== null) {
    reasons.push(`Verified strong demand (Demand ${Math.round(demandScore)}/100)`);
  } else if (hasSolidDemand && demandScore !== null) {
    reasons.push(`Verified solid demand (Demand ${Math.round(demandScore)}/100)`);
  }

  if (isStrongDemandStrongVideoSales && videoRevenueThb !== null && videoRevenueSharePct !== null) {
    reasons.push(
      `Strong historical video sales (฿${Math.round(videoRevenueThb).toLocaleString()} · ${Math.round(videoRevenueSharePct)}% of revenue)`
    );
  } else if (videoSalesEvidenceStatus === 'WEAK' && videoRevenueSharePct !== null) {
    reasons.push(
      `Low video channel share (${Math.round(videoRevenueSharePct)}% video — primarily Live/Mall driven)`
    );
  }

  if (isStrongAffiliateEarnings) {
    const commPart = commissionRate !== null ? `${commissionRate}% comm` : '';
    const payoutPart =
      payoutPerSale !== null ? `฿${payoutPerSale.toFixed(payoutPerSale < 10 ? 1 : 0)}/sale` : '';
    const detail = [commPart, payoutPart].filter(Boolean).join(' · ');
    reasons.push(`Strong affiliate earnings (${detail})`);
  }

  if (isStrongDemandLowCompetition && commercialScore.competitionScore.creatorCount !== null) {
    reasons.push(
      `Verified manageable creator competition (${commercialScore.competitionScore.creatorCount} creators)`
    );
  } else if (isHighDemandHighCompetition && commercialScore.competitionScore.creatorCount !== null) {
    reasons.push(
      `Verified heavy creator crowding (${commercialScore.competitionScore.creatorCount} creators)`
    );
  }

  if (isEmergingOpportunity && verifiedGrowthPct !== null) {
    reasons.push(`Verified rising demand (+${Math.round(verifiedGrowthPct)}% growth) with room to enter`);
  }

  if (primaryClassification === 'INSUFFICIENT_EVIDENCE' && reasons.length === 0) {
    reasons.push(
      'Insufficient verified demand, video-sales, earnings, or competition evidence to shortlist'
    );
  }

  const cautionNote = !hasVerifiedCompetition
    ? 'Preliminary signal only: creator competition is unverified/missing. Strong video sales do not imply low competition or guarantee your video conversion.'
    : isHighDemandHighCompetition
      ? 'High historical demand with verified heavy creator crowding — differentiation is required; past sales do not guarantee conversion.'
      : 'Historical demand, earnings, and video sales indicate market opportunity only — they do not guarantee affiliate conversion for new videos.';

  return {
    primaryClassification,
    secondarySignals,
    isPreliminaryCandidate,
    isNotMonetizable: false,
    competitionEvidenceStatus,
    videoSalesEvidenceStatus,
    videoRevenueSharePct,
    reasons,
    evidenceGaps,
    cautionNote,
  };
}
