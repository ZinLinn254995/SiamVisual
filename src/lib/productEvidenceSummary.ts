import type {
  BilingualText,
  CommercialScoreV2Result,
  ProductDiscoveryShortlistResult,
  ProductItem,
  ProductObservationSnapshot,
  ProductValidatedMetrics,
  SnapshotTrendDerivation,
} from '../types.ts';
import { classifyProductDiscoveryShortlist } from './discoveryShortlist.ts';
import { isUsableScoringMetric } from './metricFoundation.ts';
import { deriveSnapshotTrend } from './snapshotStore.ts';

export type ProductQualificationBucket =
  | 'QUALIFIED'
  | 'PRELIMINARY'
  | 'NOT_MONETIZABLE'
  | 'INSUFFICIENT_DATA';

export interface ProductEvidencePoint {
  id: string;
  label: BilingualText;
  value: string;
  detail: BilingualText;
}

export interface ProductEvidenceSummary {
  qualificationStatus: ProductQualificationBucket;
  discoveryCategory: ProductDiscoveryShortlistResult['primaryClassification'];
  whyDiscovered: BilingualText;
  qualificationReason: BilingualText;
  competitionKnown: boolean;
  videoSalesDemonstrated: boolean;
  verifiedFacts: ProductEvidencePoint[];
  derivedCalculations: ProductEvidencePoint[];
  unavailableEvidence: ProductEvidencePoint[];
  heuristicSignals: ProductEvidencePoint[];
  historicalSummary: {
    localObservedCount: number;
    importedUnverifiedCount: number;
    multiDayTrendAvailable: boolean;
    trend: SnapshotTrendDerivation | null;
  };
  nonGuaranteeNotice: BilingualText;
}

function formatThb(amount: number): string {
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(2)}M`;
  }
  return `฿${Math.round(amount).toLocaleString()}`;
}

/**
 * Builds a clean, structured, bilingual product-level evidence explanation that strictly separates:
 * 1. Verified Facts (SOURCE observations)
 * 2. Derived Calculations (computed ratios / payouts / local multi-day deltas)
 * 3. Unavailable / Unverified Evidence (what is missing or still unverified)
 * 4. Heuristic Signals (creative/visual cues — never conversion probability)
 *
 * Does NOT modify scoring formulas, weights, or eligibility gates.
 */
export function buildProductEvidenceSummary(params: {
  product: ProductItem;
  validated: ProductValidatedMetrics;
  commercialScore: CommercialScoreV2Result;
  discoveryShortlist?: ProductDiscoveryShortlistResult;
  snapshots?: ProductObservationSnapshot[];
  nowMs?: number;
}): ProductEvidenceSummary {
  const { product, validated, commercialScore, snapshots = [], nowMs } = params;
  const shortlist =
    params.discoveryShortlist ?? classifyProductDiscoveryShortlist(validated, commercialScore);

  const verifiedFacts: ProductEvidencePoint[] = [];
  const derivedCalculations: ProductEvidencePoint[] = [];
  const unavailableEvidence: ProductEvidencePoint[] = [];
  const heuristicSignals: ProductEvidencePoint[] = [];

  // 1. Historical local vs imported snapshot counts (preserving Phase 10.1 trust boundary)
  let localObservedCount = 0;
  let importedUnverifiedCount = 0;
  for (const snap of snapshots) {
    if (snap.trustStatus === 'IMPORTED_UNVERIFIED') {
      importedUnverifiedCount += 1;
    } else {
      localObservedCount += 1;
    }
  }
  const localTrend = deriveSnapshotTrend(snapshots, {
    dateRange: validated.dateRange ?? 'last7Day',
    nowMs,
    includeImportedReference: false,
  });

  // 2. VERIFIED FACTS (Strictly usable SOURCE observations only)
  const hasRevenueFact =
    isUsableScoringMetric(validated.revenueThb7d) && validated.revenueThb7d.value !== null;
  const hasSalesFact =
    isUsableScoringMetric(validated.salesVolume7d) && validated.salesVolume7d.value !== null;

  if (hasRevenueFact || hasSalesFact) {
    const revStr = hasRevenueFact ? formatThb(validated.revenueThb7d.value!) : null;
    const salesStr = hasSalesFact
      ? `${Math.round(validated.salesVolume7d.value!).toLocaleString()} units`
      : null;
    const combinedVal = [revStr, salesStr].filter(Boolean).join(' · ');
    const demandScoreText =
      commercialScore.demandScore.score !== null
        ? `${Math.round(commercialScore.demandScore.score)}/100`
        : '—';
    verifiedFacts.push({
      id: 'demand_fact',
      label: { en: '7-Day Demand', my: '၇ ရက် ဝယ်လိုအား' },
      value: combinedVal,
      detail: {
        en: `Source-observed 7d volume (Demand ${demandScoreText}).`,
        my: `မူရင်းဒေတာမှ ၇ ရက်ရောင်းအား (ဝယ်လိုအား ${demandScoreText})။`,
      },
    });
  } else {
    unavailableEvidence.push({
      id: 'demand_missing',
      label: { en: '7-Day Demand', my: '၇ ရက် ဝယ်လိုအား' },
      value: validated.revenueThb7d.state,
      detail: {
        en: 'Usable source revenue and unit sales are unavailable or stale.',
        my: 'အသုံးပြုနိုင်သော မူရင်းရောင်းအားဒေတာ မရရှိသေးပါ (သို့) သက်တမ်းကုန်နေပါသည်။',
      },
    });
  }

  // Affiliate commission fact
  const isZeroCommission =
    shortlist.isNotMonetizable ||
    validated.commissionRate.state === 'ZERO' ||
    commercialScore.earningScore.status === 'NOT_MONETIZABLE';
  const hasUsableCommission =
    isUsableScoringMetric(validated.commissionRate) && validated.commissionRate.value !== null;

  if (isZeroCommission) {
    verifiedFacts.push({
      id: 'commission_zero',
      label: { en: 'Affiliate Commission', my: 'ကော်မရှင်နှုန်း' },
      value: '0%',
      detail: {
        en: 'Verified 0% commission — excluded as non-monetizable for affiliate creators.',
        my: 'ကော်မရှင် 0% ဖြစ်သောကြောင့် ဝင်ငွေမရနိုင်သော ပစ္စည်းအဖြစ် ဖယ်ထုတ်ထားပါသည်။',
      },
    });
  } else if (hasUsableCommission) {
    const earningScoreVal = commercialScore.earningScore.score;
    const attractiveEn =
      earningScoreVal !== null && earningScoreVal >= 50
        ? 'Attractive affiliate earning potential'
        : 'Modest affiliate earning rate';
    const attractiveMy =
      earningScoreVal !== null && earningScoreVal >= 50
        ? 'ကော်မရှင်ဝင်ငွေ ဆွဲဆောင်မှုကောင်းသည်'
        : 'ကော်မရှင်နှုန်း အသင့်အတင့်သာရှိသည်';
    verifiedFacts.push({
      id: 'commission_fact',
      label: { en: 'Affiliate Commission', my: 'ကော်မရှင်နှုန်း' },
      value: `${validated.commissionRate.value}%`,
      detail: {
        en: `${attractiveEn} (Earning ${earningScoreVal !== null ? `${Math.round(earningScoreVal)}/100` : '—'}).`,
        my: `${attractiveMy} (ဝင်ငွေအမှတ် ${earningScoreVal !== null ? `${Math.round(earningScoreVal)}/100` : '—'})။`,
      },
    });
  } else {
    unavailableEvidence.push({
      id: 'commission_missing',
      label: { en: 'Affiliate Commission', my: 'ကော်မရှင်နှုန်း' },
      value: validated.commissionRate.state,
      detail: {
        en: 'Verified commission rate is missing or stale; affiliate earnings cannot be scored.',
        my: 'အတည်ပြုထားသော ကော်မရှင်နှုန်း မရှိသေးသဖြင့် ဝင်ငွေတွက်၍မရပါ။',
      },
    });
  }

  // Historical video revenue fact
  const hasUsableVideoRev =
    isUsableScoringMetric(validated.videoRevenueThb7d) &&
    validated.videoRevenueThb7d.value !== null;
  const videoSalesDemonstrated =
    shortlist.videoSalesEvidenceStatus === 'STRONG' ||
    shortlist.videoSalesEvidenceStatus === 'MODERATE';

  if (hasUsableVideoRev && (validated.videoRevenueThb7d.value ?? 0) > 0) {
    const vidVal = formatThb(validated.videoRevenueThb7d.value!);
    const levelEn =
      shortlist.videoSalesEvidenceStatus === 'STRONG'
        ? 'Strong historical short-video sales demonstrated'
        : shortlist.videoSalesEvidenceStatus === 'MODERATE'
          ? 'Moderate historical short-video sales observed'
          : 'Small short-video sales share (primarily Live/Mall driven)';
    const levelMy =
      shortlist.videoSalesEvidenceStatus === 'STRONG'
        ? 'ဗီဒီယိုတိုမှ ရောင်းအားသက်သေ ခိုင်မာစွာရှိသည်'
        : shortlist.videoSalesEvidenceStatus === 'MODERATE'
          ? 'ဗီဒီယိုတိုမှ ရောင်းအား အသင့်အတင့်ရှိသည်'
          : 'ဗီဒီယိုဝင်ငွေ အချိုးနည်းပြီး Live/Mall က ပိုများသည်';
    verifiedFacts.push({
      id: 'video_sales_fact',
      label: { en: 'Historical Video Sales', my: '၇ ရက် ဗီဒီယိုရောင်းအား' },
      value: vidVal,
      detail: {
        en: `${levelEn} (historical channel revenue only — not a conversion guarantee).`,
        my: `${levelMy} (ယခင်ရောင်းအားသက်သေသာဖြစ်ပြီး အနာဂတ်ရောင်းရမည်ဟု အာမမခံပါ)။`,
      },
    });
  } else if (validated.videoRevenueThb7d.state === 'ZERO') {
    verifiedFacts.push({
      id: 'video_sales_zero',
      label: { en: 'Historical Video Sales', my: '၇ ရက် ဗီဒီယိုရောင်းအား' },
      value: '฿0',
      detail: {
        en: 'No short-video sales observed in this 7-day window.',
        my: 'ဤ ၇ ရက်အတွင်း ဗီဒီယိုတိုမှ ရောင်းအား မတွေ့ရပါ။',
      },
    });
  } else {
    unavailableEvidence.push({
      id: 'video_sales_missing',
      label: { en: 'Historical Video Sales', my: '၇ ရက် ဗီဒီယိုရောင်းအား' },
      value: validated.videoRevenueThb7d.state,
      detail: {
        en: 'Verified short-video revenue data is unavailable.',
        my: 'အတည်ပြုထားသော ဗီဒီယိုရောင်းအားဒေတာ မရရှိသေးပါ။',
      },
    });
  }

  // Competition fact vs unavailable
  const competitionKnown =
    shortlist.competitionEvidenceStatus === 'VERIFIED_LOW' ||
    shortlist.competitionEvidenceStatus === 'VERIFIED_MODERATE' ||
    shortlist.competitionEvidenceStatus === 'VERIFIED_HIGH';

  if (competitionKnown && commercialScore.competitionScore.creatorCount !== null) {
    const count = commercialScore.competitionScore.creatorCount;
    const compScore = commercialScore.competitionScore.score;
    const compDescEn =
      shortlist.competitionEvidenceStatus === 'VERIFIED_LOW'
        ? 'Manageable verified creator competition'
        : shortlist.competitionEvidenceStatus === 'VERIFIED_HIGH'
          ? 'Heavy verified creator crowding'
          : 'Moderate verified creator competition';
    const compDescMy =
      shortlist.competitionEvidenceStatus === 'VERIFIED_LOW'
        ? 'ပြိုင်ဆိုင်မှု သက်သာကြောင်း အတည်ပြုနိုင်သည်'
        : shortlist.competitionEvidenceStatus === 'VERIFIED_HIGH'
          ? 'Creator ပြိုင်ဆိုင်မှု များပြားသည်'
          : 'ပြိုင်ဆိုင်မှု အသင့်အတင့်ရှိသည်';
    verifiedFacts.push({
      id: 'competition_fact',
      label: { en: 'Creator Competition', my: 'Creator ပြိုင်ဆိုင်မှု' },
      value: `${count.toLocaleString()} creators`,
      detail: {
        en: `${compDescEn} (Competition ${compScore !== null ? `${Math.round(compScore)}/100` : '—'}).`,
        my: `${compDescMy} (ပြိုင်ဆိုင်မှုအမှတ် ${compScore !== null ? `${Math.round(compScore)}/100` : '—'})။`,
      },
    });
  } else {
    const rawCreatorNote =
      validated.creatorCount.unit === 'UNVERIFIED' && validated.creatorCount.rawInput !== null
        ? {
            en: `Creator competition is UNKNOWN — upstream count (${validated.creatorCount.rawInput}) has unverified scope (active vs lifetime creators) and is excluded from scoring.`,
            my: `Creator ပြိုင်ဆိုင်မှုကို မသိရသေးပါ — မူရင်းဂဏန်း (${validated.creatorCount.rawInput}) ၏ အချိန်အတိုင်းအတာ အတည်မပြုနိုင်သေးသဖြင့် အမှတ်မတွက်ပါ။`,
          }
        : {
            en: 'Creator competition is UNKNOWN — not returned on /rank discovery rows. Never assume low competition.',
            my: 'Creator ပြိုင်ဆိုင်မှုကို မသိရသေးပါ — /rank ဒေတာတွင် မပါဝင်သဖြင့် ပြိုင်ဆိုင်မှုနည်းသည်ဟု မယူဆပါနှင့်။',
          };
    unavailableEvidence.push({
      id: 'competition_unavailable',
      label: { en: 'Creator Competition', my: 'Creator ပြိုင်ဆိုင်မှု' },
      value: shortlist.competitionEvidenceStatus === 'UNVERIFIED' ? 'UNVERIFIED' : 'MISSING',
      detail: rawCreatorNote,
    });
  }

  // Customer quality fact vs unavailable
  if (
    commercialScore.customerQualityScore.status === 'SCORED' &&
    commercialScore.customerQualityScore.bayesianRating !== null
  ) {
    verifiedFacts.push({
      id: 'quality_fact',
      label: { en: 'Customer Quality', my: 'ဝယ်သူအရည်အသွေး' },
      value: `${commercialScore.customerQualityScore.rawRating?.toFixed(2) ?? '—'}★ (${
        commercialScore.customerQualityScore.reviewCount?.toLocaleString() ?? 0
      } reviews)`,
      detail: {
        en: `Bayesian-adjusted rating ${commercialScore.customerQualityScore.bayesianRating.toFixed(2)}/5.`,
        my: `Bayesian ချိန်ညှိပြီး Rating ${commercialScore.customerQualityScore.bayesianRating.toFixed(2)}/5။`,
      },
    });
  } else {
    unavailableEvidence.push({
      id: 'quality_unavailable',
      label: { en: 'Customer Quality', my: 'ဝယ်သူအရည်အသွေး' },
      value: validated.rating.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'UNVERIFIED',
      detail: {
        en: 'Verified product rating and review semantics are unavailable on tested Kalodata endpoints.',
        my: 'Kalodata မှ Rating နှင့် Review အတည်ပြုဒေတာ မရရှိနိုင်သေးပါ။',
      },
    });
  }

  // Growth verification check
  if (commercialScore.demandScore.growthStatus === 'UNVERIFIED') {
    unavailableEvidence.push({
      id: 'growth_unverified',
      label: { en: 'Revenue Growth Baseline', my: 'ရောင်းအားတိုးနှုန်း အခြေခံ' },
      value: 'UNVERIFIED',
      detail: {
        en: 'Upstream growth comparison window is unverified and excluded from Demand scoring.',
        my: 'ရောင်းအားတိုးနှုန်း နှိုင်းယှဉ်ကာလ အတည်မပြုနိုင်သေးသဖြင့် ဝယ်လိုအားအမှတ်တွင် မထည့်သွင်းပါ။',
      },
    });
  }

  // 3. DERIVED CALCULATIONS (Strictly labeled as computed values)
  if (!isZeroCommission && commercialScore.earningScore.payoutPerSaleThb !== null) {
    derivedCalculations.push({
      id: 'derived_payout',
      label: { en: 'Est. Affiliate Payout / Sale', my: '၁ ခုရောင်းလျှင် ခန့်မှန်းကော်မရှင်' },
      value: `฿${commercialScore.earningScore.payoutPerSaleThb.toFixed(2)}`,
      detail: {
        en: 'Derived from source price × verified commission rate.',
        my: 'ဈေးနှုန်း × ကော်မရှင်နှုန်းဖြင့် တွက်ချက်ထားသည်။',
      },
    });
  }

  if (shortlist.videoRevenueSharePct !== null) {
    derivedCalculations.push({
      id: 'derived_video_share',
      label: { en: 'Video Revenue Share', my: 'ဗီဒီယိုဝင်ငွေ အချိုး' },
      value: `${Math.round(shortlist.videoRevenueSharePct)}%`,
      detail: {
        en: 'Derived ratio of 7d video revenue to total 7d revenue.',
        my: '၇ ရက် ဗီဒီယိုဝင်ငွေ ÷ စုစုပေါင်း ၇ ရက်ဝင်ငွေ အချိုး။',
      },
    });
  }

  if (competitionKnown && commercialScore.adjustedRpcThb !== null) {
    derivedCalculations.push({
      id: 'derived_rpc',
      label: { en: 'Smoothed Revenue / Creator', my: 'Creator ၁ ဦးပျမ်းမျှဝင်ငွေ (RPC)' },
      value: formatThb(commercialScore.adjustedRpcThb),
      detail: {
        en: 'Derived smoothed revenue per verified creator.',
        my: 'အတည်ပြုထားသော Creator ၁ ဦးချင်းစီအတွက် ချိန်ညှိတွက်ချက်ထားသော ဝင်ငွေ။',
      },
    });
  }

  if (localTrend) {
    const revDelta =
      localTrend.revenueDeltaPct !== null
        ? `${localTrend.revenueDeltaPct > 0 ? '+' : ''}${localTrend.revenueDeltaPct}%`
        : '—';
    derivedCalculations.push({
      id: 'derived_local_trend',
      label: { en: 'Observed Multi-Day Trend', my: 'ရက်ပေါင်းစုံ လေ့လာတွေ့ရှိမှု' },
      value: `${localTrend.observationCount}d · Rev ${revDelta}`,
      detail: {
        en: `Derived from ${localTrend.observationCount} trusted local observations over ${localTrend.spanDays} days.`,
        my: `${localTrend.spanDays} ရက်အတွင်း စစ်မှန်သော local မှတ်တမ်း ${localTrend.observationCount} ခုမှ တွက်ချက်ထားသည်။`,
      },
    });
  } else {
    unavailableEvidence.push({
      id: 'historical_trend_unavailable',
      label: { en: 'Multi-Day Historical Trend', my: 'ရက်ပေါင်းစုံ ရောင်းအားလမ်းကြောင်း' },
      value:
        localObservedCount > 0
          ? `${localObservedCount}d local`
          : importedUnverifiedCount > 0
            ? 'IMPORTED_ONLY'
            : '0d',
      detail:
        importedUnverifiedCount > 0 && localObservedCount < 2
          ? {
              en: `Only ${localObservedCount} trusted local observation(s) (${importedUnverifiedCount} imported backup snapshot(s) are unverified and excluded from trends).`,
              my: `စစ်မှန်သော local မှတ်တမ်း ${localObservedCount} ခုသာရှိသေးသည် (Backup မှသွင်းထားသော ${importedUnverifiedCount} ခုကို အတည်မပြုနိုင်သဖြင့် မထည့်တွက်ပါ)။`,
            }
          : {
              en: 'Requires ≥2 trusted local observations separated by ≥12h (≥3 over ≥24h for Trend Timing).',
              my: 'အနည်းဆုံး ၁၂ နာရီခြားသော local မှတ်တမ်း ၂ ခု (Trend Timing အတွက် ၂၄ နာရီအတွင်း ၃ ခု) လိုအပ်ပါသည်။',
            },
    });
  }

  // 4. HEURISTIC SIGNALS (Strictly separated from commercial & conversion evidence)
  const visualTags = product.visualTags?.filter(Boolean) ?? [];
  heuristicSignals.push({
    id: 'heuristic_video_studio',
    label: { en: 'Visual Demo Suitability (Heuristic)', my: 'ဗီဒီယိုပြသနိုင်စွမ်း (ခန့်မှန်းချက်)' },
    value: product.scoreBreakdown ? `${product.scoreBreakdown.total}/100` : 'Heuristic only',
    detail: {
      en:
        visualTags.length > 0
          ? `Creative cues (${visualTags.slice(0, 3).join(', ')}) are video-production heuristics only — never proof of conversion probability.`
          : 'Visual suitability is a creative production cue only — never proof of commercial demand or conversion probability.',
      my:
        visualTags.length > 0
          ? `ဗီဒီယိုဖန်တီးမှု အရိပ်အမြွက်များ (${visualTags.slice(0, 3).join(', ')}) သည် ရိုက်ကူးရန် ခန့်မှန်းချက်သာဖြစ်ပြီး ရောင်းထွက်မည်ဟု သက်သေမဟုတ်ပါ။`
          : 'ဗီဒီယိုပြသနိုင်စွမ်းသည် ရိုက်ကူးမှုခန့်မှန်းချက်သာဖြစ်ပြီး ရောင်းအားအာမခံချက် မဟုတ်ပါ။',
    },
  });

  // 5. Qualification Status & Why Discovered
  let qualificationStatus: ProductQualificationBucket;
  let whyDiscovered: BilingualText;
  let qualificationReason: BilingualText;

  if (isZeroCommission) {
    qualificationStatus = 'NOT_MONETIZABLE';
    whyDiscovered = {
      en: 'Returned in Thailand revenue ranking, but excluded from affiliate shortlists due to 0% commission.',
      my: 'ထိုင်းရောင်းအားစာရင်းတွင် ပါဝင်သော်လည်း ကော်မရှင် 0% ဖြစ်၍ Affiliate စာရင်းမှ ဖယ်ထုတ်ထားပါသည်။',
    };
    qualificationReason = {
      en: 'Non-monetizable (0% affiliate commission). Commercial score and all monetizable strategies are withheld.',
      my: 'ဝင်ငွေမရနိုင်သော ပစ္စည်း (ကော်မရှင် 0%) ဖြစ်၍ Commercial Score နှင့် Strategy အားလုံးမှ ပယ်ဖျက်ထားပါသည်။',
    };
  } else if (commercialScore.eligibilityStatus === 'ELIGIBLE') {
    qualificationStatus = 'QUALIFIED';
    whyDiscovered = {
      en:
        shortlist.reasons[0] ??
        'Verified demand, affiliate earnings, and competition metrics support commercial evaluation.',
      my: 'ဝယ်လိုအား၊ ကော်မရှင်ဝင်ငွေနှင့် ပြိုင်ဆိုင်မှုဒေတာများ အတည်ပြုနိုင်သဖြင့် Commercial အမှတ် တွက်ချက်ထားပါသည်။',
    };
    qualificationReason = {
      en: `Fully qualified commercial candidate (Confidence ${Math.round(commercialScore.dataConfidence.score)}/100) with verified core pillars.`,
      my: `အဓိကဒေတာများ စုံလင်အတည်ပြုနိုင်သော ပစ္စည်းဖြစ်သည် (ဒေတာယုံကြည်မှု ${Math.round(commercialScore.dataConfidence.score)}/100)။`,
    };
  } else if (shortlist.primaryClassification !== 'INSUFFICIENT_EVIDENCE') {
    qualificationStatus = 'PRELIMINARY';
    const hasVideoShortlist =
      shortlist.primaryClassification === 'STRONG_DEMAND_STRONG_VIDEO_SALES';
    const hasEarnShortlist =
      shortlist.primaryClassification === 'STRONG_AFFILIATE_EARNINGS' ||
      shortlist.secondarySignals.includes('STRONG_AFFILIATE_EARNINGS');
    whyDiscovered = hasVideoShortlist && hasEarnShortlist
      ? {
          en: 'Surfaced as a preliminary candidate for strong 7d demand, strong historical video sales, and attractive affiliate earnings.',
          my: '၇ ရက်ဝယ်လိုအားကောင်းခြင်း၊ ဗီဒီယိုရောင်းအားသက်သေခိုင်မာခြင်းနှင့် ကော်မရှင်ဝင်ငွေကောင်းခြင်းတို့ကြောင့် ကနဦးစာရင်းတွင် ဖော်ပြထားပါသည်။',
        }
      : hasVideoShortlist
        ? {
            en: 'Surfaced as a preliminary candidate for strong 7d demand and strong existing short-video sales revenue.',
            my: '၇ ရက်ဝယ်လိုအားကောင်းပြီး ဗီဒီယိုတိုမှ ရောင်းအားသက်သေခိုင်မာသဖြင့် ကနဦးစာရင်းတွင် ဖော်ပြထားပါသည်။',
          }
        : {
            en: 'Surfaced as a preliminary candidate for solid 7d demand paired with attractive affiliate commission/payout.',
            my: 'ဝယ်လိုအားကောင်းမွန်ပြီး ကော်မရှင်ဝင်ငွေ ဆွဲဆောင်မှုရှိသဖြင့် ကနဦးစာရင်းတွင် ဖော်ပြထားပါသည်။',
          };
    qualificationReason = {
      en: `Preliminary only (Commercial score withheld: ${commercialScore.eligibilityStatus}) because verified creator competition and/or customer quality are missing or unverified.`,
      my: `ကနဦးအဆင့်သာဖြစ်သည် (Commercial Score ခေတ္တချန်ထား) — Creator ပြိုင်ဆိုင်မှုနှင့်/သို့မဟုတ် ဝယ်သူအရည်အသွေး အတည်ပြုဒေတာ မစုံလင်သေးပါ။`,
    };
  } else {
    qualificationStatus = 'INSUFFICIENT_DATA';
    whyDiscovered = {
      en: 'Returned in Thailand discovery search, but lacks sufficient shortlist evidence across video sales, earnings, or competition.',
      my: 'ထိုင်းရှာဖွေမှုရလဒ်တွင် ပါဝင်သော်လည်း ဗီဒီယိုရောင်းအား၊ ကော်မရှင် သို့မဟုတ် ပြိုင်ဆိုင်မှုသက်သေ မလုံလောက်သေးပါ။',
    };
    qualificationReason = {
      en: `Insufficient verified evidence (${commercialScore.eligibilityStatus}) — missing verified competition, customer quality, or stronger affiliate/video signals.`,
      my: `အတည်ပြုသက်သေ မလုံလောက်သေးပါ — ပြိုင်ဆိုင်မှု၊ အရည်အသွေး သို့မဟုတ် ဗီဒီယို/ကော်မရှင်သက်သေ ထပ်မံလိုအပ်ပါသည်။`,
    };
  }

  return {
    qualificationStatus,
    discoveryCategory: shortlist.primaryClassification,
    whyDiscovered,
    qualificationReason,
    competitionKnown,
    videoSalesDemonstrated,
    verifiedFacts,
    derivedCalculations,
    unavailableEvidence,
    heuristicSignals,
    historicalSummary: {
      localObservedCount,
      importedUnverifiedCount,
      multiDayTrendAvailable: Boolean(localTrend),
      trend: localTrend,
    },
    nonGuaranteeNotice: {
      en: 'Market demand and historical video sales indicate commercial potential only — no product is guaranteed to sell.',
      my: 'ဝယ်လိုအားနှင့် ယခင်ဗီဒီယိုရောင်းအားများသည် အခွင့်အလမ်းအရိပ်အမြွက်သာဖြစ်ပြီး မည်သည့်ပစ္စည်းမျှ ရောင်းထွက်မည်ဟု အာမမခံပါ။',
    },
  };
}
